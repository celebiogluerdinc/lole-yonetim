'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import { pushToUsers } from '@/lib/push';

const PUSH_TITLES: Record<string, string> = {
  task_completed: '✅ Görev tamamlandı',
  task_pending_review: '🔍 Onayınız bekleniyor',
  task_blocked: '🚧 Engel bildirildi'
};

async function log(supabase: any, companyId: string | null, actorId: string, entity_type: string, entity_id: string, action: string, meta: any = {}) {
  await supabase.from('activity_log').insert({
    company_id: companyId, actor_id: actorId, entity_type, entity_id, action, meta
  });
}

async function notifyManagers(supabase: any, task: any, type: string, payload: any) {
  // department managers + admins of the company
  const targets = new Set<string>();
  if (task.department_id) {
    const { data: mgrs } = await supabase
      .from('department_members').select('user_id')
      .eq('department_id', task.department_id).eq('is_manager', true);
    for (const m of mgrs ?? []) targets.add(m.user_id);
  }
  const { data: admins } = await supabase
    .from('profiles').select('id').eq('company_id', task.company_id).eq('role', 'admin');
  for (const a of admins ?? []) targets.add(a.id);
  if (targets.size) {
    const ids = Array.from(targets);
    await supabase.from('notifications').insert(
      ids.map(user_id => ({ company_id: task.company_id, user_id, type, payload }))
    );
    pushToUsers(ids, {
      title: PUSH_TITLES[type] ?? 'Lole Yönetim',
      body: `${payload.title ?? ''}${payload.by ? ` — ${payload.by}` : ''}`,
      url: `/tasks/${task.id}`
    }).catch(() => {});
  }
}

/** Fetch a task the current user may act on (RLS enforces visibility). */
async function getTask(supabase: any, id: string) {
  const { data: task, error } = await supabase.from('tasks').select('*').eq('id', id).single();
  if (error || !task) throw new Error('Görev bulunamadı veya erişiminiz yok.');
  return task;
}

async function hasMyPhoto(supabase: any, taskId: string, userId: string) {
  const { count } = await supabase
    .from('attachments')
    .select('id', { count: 'exact', head: true })
    .eq('task_id', taskId).eq('uploaded_by', userId);
  return (count ?? 0) > 0;
}

export async function quickComplete(taskId: string) {
  const { supabase, profile, companyId } = await getCtx();
  const task = await getTask(supabase, taskId);

  if (task.requires_photo && !(await hasMyPhoto(supabase, taskId, profile.id))) {
    return { error: 'photo_required' };
  }
  const nextStatus = task.requires_approval ? 'pending_review' : 'completed';
  const { error } = await supabase.from('tasks').update({
    status: nextStatus,
    completed_at: new Date().toISOString()
  }).eq('id', taskId);
  if (error) return { error: error.message };

  await log(supabase, task.company_id, profile.id, 'task', taskId,
    nextStatus === 'completed' ? 'completed' : 'submitted_for_review');
  await notifyManagers(supabase, task,
    nextStatus === 'completed' ? 'task_completed' : 'task_pending_review',
    { task_id: taskId, title: task.title, by: profile.full_name });

  revalidatePath('/home');
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function toggleChecklistItem(itemId: string, done: boolean) {
  const { supabase, profile } = await getCtx();
  const { data: item } = await supabase.from('checklist_items').select('*, tasks(*)').eq('id', itemId).single();
  if (!item) return { error: 'Madde bulunamadı.' };

  if (done && item.requires_photo) {
    const { count } = await supabase
      .from('attachments').select('id', { count: 'exact', head: true })
      .eq('checklist_item_id', itemId);
    if ((count ?? 0) === 0) return { error: 'photo_required' };
  }

  const { error } = await supabase.from('checklist_items').update({
    is_done: done,
    done_by: done ? profile.id : null,
    done_at: done ? new Date().toISOString() : null
  }).eq('id', itemId);
  if (error) return { error: error.message };

  // mark parent in_progress when first item ticked
  if (done && item.tasks?.status === 'open') {
    await supabase.from('tasks').update({ status: 'in_progress' }).eq('id', item.task_id);
  }
  revalidatePath(`/tasks/${item.task_id}`);
  revalidatePath('/home');
  return { ok: true };
}

export async function completeTask(taskId: string) {
  const { supabase, profile } = await getCtx();
  const task = await getTask(supabase, taskId);

  if (task.type === 'checklist') {
    const { data: items } = await supabase
      .from('checklist_items').select('is_done').eq('task_id', taskId);
    if ((items ?? []).some((i: any) => !i.is_done)) {
      return { error: 'Önce tüm maddeleri tamamlayın.' };
    }
  }
  if (task.requires_photo && !(await hasMyPhoto(supabase, taskId, profile.id))) {
    return { error: 'Bu görevi kapatmak için fotoğraf eklemeniz zorunlu.' };
  }

  const nextStatus = task.requires_approval ? 'pending_review' : 'completed';
  const { error } = await supabase.from('tasks').update({
    status: nextStatus, completed_at: new Date().toISOString(), blocked_reason: null
  }).eq('id', taskId);
  if (error) return { error: error.message };

  await log(supabase, task.company_id, profile.id, 'task', taskId,
    nextStatus === 'completed' ? 'completed' : 'submitted_for_review');
  await notifyManagers(supabase, task,
    nextStatus === 'completed' ? 'task_completed' : 'task_pending_review',
    { task_id: taskId, title: task.title, by: profile.full_name });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/home');
  return { ok: true, pending: nextStatus === 'pending_review' };
}

export async function blockTask(taskId: string, reason: string) {
  const parsed = z.string().min(3).max(500).safeParse(reason.trim());
  if (!parsed.success) return { error: 'Lütfen engeli kısaca açıklayın.' };

  const { supabase, profile } = await getCtx();
  const task = await getTask(supabase, taskId);

  const { error } = await supabase.from('tasks').update({
    status: 'blocked', blocked_reason: parsed.data
  }).eq('id', taskId);
  if (error) return { error: error.message };

  await log(supabase, task.company_id, profile.id, 'task', taskId, 'blocked', { reason: parsed.data });
  await notifyManagers(supabase, task, 'task_blocked',
    { task_id: taskId, title: task.title, by: profile.full_name, reason: parsed.data });

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/home');
  return { ok: true };
}

export async function reviewTask(taskId: string, approve: boolean, note?: string) {
  const { supabase, profile, managedDepartmentIds } = await getCtx();
  const task = await getTask(supabase, taskId);

  const canReview =
    profile.role === 'super_admin' ||
    (profile.role === 'admin' && task.company_id === profile.company_id) ||
    (task.department_id && managedDepartmentIds.includes(task.department_id));
  if (!canReview) return { error: 'Bu görevi onaylama yetkiniz yok.' };
  if (task.status !== 'pending_review') return { error: 'Görev onay beklemiyor.' };

  if (approve) {
    await supabase.from('tasks').update({
      status: 'completed', approved_by: profile.id, approved_at: new Date().toISOString(), rejection_note: null
    }).eq('id', taskId);
    await log(supabase, task.company_id, profile.id, 'task', taskId, 'approved');
  } else {
    const n = z.string().min(3).max(500).safeParse((note ?? '').trim());
    if (!n.success) return { error: 'Reddetme sebebi zorunludur.' };
    await supabase.from('tasks').update({
      status: 'open', completed_at: null, rejection_note: n.data
    }).eq('id', taskId);
    await log(supabase, task.company_id, profile.id, 'task', taskId, 'rejected', { note: n.data });
    // notify assignees
    const { data: asg } = await supabase.from('task_assignees').select('user_id').eq('task_id', taskId);
    if (asg?.length) {
      const ids = asg.map((a: any) => a.user_id);
      await supabase.from('notifications').insert(ids.map((user_id: string) => ({
        company_id: task.company_id, user_id, type: 'task_rejected',
        payload: { task_id: taskId, title: task.title, note: n.data }
      })));
      pushToUsers(ids, {
        title: '↩️ Görev reddedildi',
        body: `${task.title}: ${n.data}`,
        url: `/tasks/${taskId}`
      }).catch(() => {});
    }
  }
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/home');
  return { ok: true };
}

export async function uploadAttachment(formData: FormData) {
  const { supabase, profile } = await getCtx();
  const taskId = String(formData.get('task_id') ?? '');
  const itemId = String(formData.get('item_id') ?? '') || null;
  const file = formData.get('file') as File | null;
  if (!file || !taskId) return { error: 'Dosya seçilmedi.' };
  if (file.size > 10 * 1024 * 1024) return { error: 'Dosya 10MB sınırını aşıyor.' };

  const task = await getTask(supabase, taskId);
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${task.company_id}/${taskId}/${crypto.randomUUID()}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from('attachments')
    .upload(path, buf, { contentType: file.type || 'application/octet-stream' });
  if (upErr) return { error: `Yükleme başarısız: ${upErr.message}` };

  const { data: att, error } = await supabase.from('attachments').insert({
    company_id: task.company_id,
    task_id: taskId,
    checklist_item_id: itemId,
    uploaded_by: profile.id,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size
  }).select().single();
  if (error) return { error: error.message };

  await log(supabase, task.company_id, profile.id, 'attachment', taskId, 'uploaded', { file: file.name });

  // Fotoğraf Denetçisi (vision): flags implausible proof photos for the reviewer.
  // Never blocks the upload; failures are silent.
  if (
    task.requires_photo &&
    file.type?.startsWith('image/') &&
    file.size < 3_500_000 &&
    process.env.ANTHROPIC_API_KEY
  ) {
    try {
      const { verifyPhoto, checkAllowance, logRun } = await import('@/lib/ai');
      const blocked = await checkAllowance(task.company_id, 'photo_verifier');
      if (!blocked) {
        const res = await verifyPhoto(buf.toString('base64'), file.type, task.title, task.description);
        const { supabaseAdmin } = await import('@/lib/supabase/server');
        await supabaseAdmin().from('attachments')
          .update({ ai_verdict: res.verdict, ai_note: res.note })
          .eq('id', att.id);
        await logRun({
          companyId: task.company_id, agent: 'photo_verifier', userId: profile.id,
          input: { task_id: taskId, file: file.name },
          output: { verdict: res.verdict, note: res.note },
          inputTokens: res.inputTokens, outputTokens: res.outputTokens
        });
      }
    } catch { /* vision check is best-effort */ }
  }

  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function addTaskNote(formData: FormData) {
  const { supabase, profile } = await getCtx();
  const taskId = String(formData.get('task_id') ?? '');
  const body = z.string().min(1).max(2000).parse(String(formData.get('body') ?? '').trim());
  const task = await getTask(supabase, taskId);
  await supabase.from('notes').insert({
    company_id: task.company_id, author_id: profile.id, task_id: taskId, body
  });
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}
