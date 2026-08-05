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

function log(supabase: any, companyId: string | null, actorId: string, entity_type: string, entity_id: string, action: string, meta: any = {}) {
  return supabase.from('activity_log').insert({
    company_id: companyId, actor_id: actorId, entity_type, entity_id, action, meta
  });
}

/** dept managers + company admins → in-app notification + push. Two parallel lookups, one insert. */
async function notifyManagers(supabase: any, task: any, type: string, payload: any) {
  const [mgrsRes, adminsRes] = await Promise.all([
    task.department_id
      ? supabase.from('department_members').select('user_id')
          .eq('department_id', task.department_id).eq('is_manager', true)
      : Promise.resolve({ data: [] } as any),
    supabase.from('profiles').select('id')
      .eq('company_id', task.company_id).eq('role', 'admin')
  ]);
  const targets = new Set<string>([
    ...((mgrsRes.data ?? []) as any[]).map(m => m.user_id),
    ...((adminsRes.data ?? []) as any[]).map(a => a.id)
  ]);
  if (!targets.size) return;
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

/** One-tap complete from lists. Optimized: task + photo check in one parallel round. */
export async function quickComplete(taskId: string) {
  const { supabase, profile } = await getCtx();

  const [{ data: task }, { count: myPhotos }] = await Promise.all([
    supabase.from('tasks').select('*').eq('id', taskId).maybeSingle(),
    supabase.from('attachments').select('id', { count: 'exact', head: true })
      .eq('task_id', taskId).eq('uploaded_by', profile.id)
  ]);
  if (!task) return { error: 'Görev bulunamadı veya erişiminiz yok.' };
  if (['completed', 'cancelled'].includes(task.status)) return { ok: true };
  if (task.requires_photo && !(myPhotos ?? 0)) return { error: 'photo_required' };

  const nextStatus = task.requires_approval ? 'pending_review' : 'completed';
  const { error } = await supabase.from('tasks').update({
    status: nextStatus, completed_at: new Date().toISOString()
  }).eq('id', taskId);
  if (error) return { error: error.message };

  await Promise.all([
    log(supabase, task.company_id, profile.id, 'task', taskId,
      nextStatus === 'completed' ? 'completed' : 'submitted_for_review'),
    notifyManagers(supabase, task,
      nextStatus === 'completed' ? 'task_completed' : 'task_pending_review',
      { task_id: taskId, title: task.title, by: profile.full_name })
  ]);

  revalidatePath('/home');
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true, pending: nextStatus === 'pending_review' };
}

export async function toggleChecklistItem(itemId: string, done: boolean) {
  const { supabase, profile } = await getCtx();
  const { data: item } = await supabase
    .from('checklist_items').select('*, tasks(id, status)').eq('id', itemId).maybeSingle();
  if (!item) return { error: 'Madde bulunamadı.' };

  if (done && item.requires_photo) {
    const { count } = await supabase
      .from('attachments').select('id', { count: 'exact', head: true })
      .eq('checklist_item_id', itemId);
    if ((count ?? 0) === 0) return { error: 'photo_required' };
  }

  const updates: any[] = [
    supabase.from('checklist_items').update({
      is_done: done,
      done_by: done ? profile.id : null,
      done_at: done ? new Date().toISOString() : null
    }).eq('id', itemId)
  ];
  if (done && item.tasks?.status === 'open') {
    updates.push(supabase.from('tasks').update({ status: 'in_progress' }).eq('id', item.task_id));
  }
  const [{ error }] = await Promise.all(updates);
  if (error) return { error: error.message };

  revalidatePath(`/tasks/${item.task_id}`);
  revalidatePath('/home');
  return { ok: true };
}

export async function completeTask(taskId: string) {
  const { supabase, profile } = await getCtx();

  const [{ data: task }, { count: notDone }, { count: myPhotos }] = await Promise.all([
    supabase.from('tasks').select('*').eq('id', taskId).maybeSingle(),
    supabase.from('checklist_items').select('id', { count: 'exact', head: true })
      .eq('task_id', taskId).eq('is_done', false),
    supabase.from('attachments').select('id', { count: 'exact', head: true })
      .eq('task_id', taskId).eq('uploaded_by', profile.id)
  ]);
  if (!task) return { error: 'Görev bulunamadı veya erişiminiz yok.' };

  if (task.type === 'checklist' && (notDone ?? 0) > 0) {
    return { error: 'Önce tüm maddeleri tamamlayın.' };
  }
  if (task.requires_photo && !(myPhotos ?? 0)) {
    return { error: 'Bu görevi kapatmak için fotoğraf eklemeniz zorunlu.' };
  }

  const nextStatus = task.requires_approval ? 'pending_review' : 'completed';
  const { error } = await supabase.from('tasks').update({
    status: nextStatus, completed_at: new Date().toISOString(), blocked_reason: null
  }).eq('id', taskId);
  if (error) return { error: error.message };

  await Promise.all([
    log(supabase, task.company_id, profile.id, 'task', taskId,
      nextStatus === 'completed' ? 'completed' : 'submitted_for_review'),
    notifyManagers(supabase, task,
      nextStatus === 'completed' ? 'task_completed' : 'task_pending_review',
      { task_id: taskId, title: task.title, by: profile.full_name })
  ]);

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/home');
  return { ok: true, pending: nextStatus === 'pending_review' };
}

/** Manager/admin: finish or cancel any task in scope — from the board or detail page. */
export async function managerSetTaskStatus(taskId: string, status: 'completed' | 'cancelled') {
  const { supabase, profile, managedDepartmentIds } = await getCtx();
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Görev bulunamadı.' };

  const allowed =
    profile.role === 'super_admin' ||
    (profile.role === 'admin' && (!profile.company_id || task.company_id === profile.company_id)) ||
    (task.department_id && managedDepartmentIds.includes(task.department_id));
  if (!allowed) return { error: 'Bu görev üzerinde yetkiniz yok.' };
  if (['completed', 'cancelled'].includes(task.status) && task.status === status) return { ok: true };

  const { error } = await supabase.from('tasks').update({
    status,
    completed_at: status === 'completed' ? new Date().toISOString() : task.completed_at,
    blocked_reason: null,
    ...(status === 'completed' ? { approved_by: profile.id, approved_at: new Date().toISOString() } : {})
  }).eq('id', taskId);
  if (error) return { error: error.message };

  const notifyAssignees = async () => {
    const { data: asg } = await supabase
      .from('task_assignees').select('user_id').eq('task_id', taskId);
    const ids = (asg ?? []).map((a: any) => a.user_id).filter((id: string) => id !== profile.id);
    if (!ids.length) return;
    await supabase.from('notifications').insert(ids.map((user_id: string) => ({
      company_id: task.company_id, user_id, type: 'custom',
      payload: {
        title: status === 'completed' ? '✅ Göreviniz yönetici tarafından tamamlandı' : '⛔ Görev iptal edildi',
        body: task.title, url: `/tasks/${taskId}`
      }
    })));
    pushToUsers(ids, {
      title: status === 'completed' ? '✅ Görev tamamlandı' : '⛔ Görev iptal edildi',
      body: task.title, url: `/tasks/${taskId}`
    }).catch(() => {});
  };

  await Promise.all([
    log(supabase, task.company_id, profile.id, 'task', taskId,
      status === 'completed' ? 'manager_completed' : 'cancelled'),
    notifyAssignees()
  ]);

  revalidatePath('/manage/tasks');
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/home');
  return { ok: true };
}

export async function blockTask(taskId: string, reason: string) {
  const parsed = z.string().min(3).max(500).safeParse(reason.trim());
  if (!parsed.success) return { error: 'Lütfen engeli kısaca açıklayın.' };

  const { supabase, profile } = await getCtx();
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Görev bulunamadı veya erişiminiz yok.' };

  const { error } = await supabase.from('tasks').update({
    status: 'blocked', blocked_reason: parsed.data
  }).eq('id', taskId);
  if (error) return { error: error.message };

  await Promise.all([
    log(supabase, task.company_id, profile.id, 'task', taskId, 'blocked', { reason: parsed.data }),
    notifyManagers(supabase, task, 'task_blocked',
      { task_id: taskId, title: task.title, by: profile.full_name, reason: parsed.data })
  ]);

  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/home');
  return { ok: true };
}

export async function reviewTask(taskId: string, approve: boolean, note?: string) {
  const { supabase, profile, managedDepartmentIds } = await getCtx();
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Görev bulunamadı.' };

  const canReview =
    profile.role === 'super_admin' ||
    profile.role === 'admin' ||
    (task.department_id && managedDepartmentIds.includes(task.department_id));
  if (!canReview) return { error: 'Bu görevi onaylama yetkiniz yok.' };
  if (task.status !== 'pending_review') return { error: 'Görev onay beklemiyor.' };

  if (approve) {
    const { error } = await supabase.from('tasks').update({
      status: 'completed', approved_by: profile.id,
      approved_at: new Date().toISOString(), rejection_note: null
    }).eq('id', taskId);
    if (error) return { error: error.message };
    await log(supabase, task.company_id, profile.id, 'task', taskId, 'approved');
  } else {
    const n = z.string().min(3).max(500).safeParse((note ?? '').trim());
    if (!n.success) return { error: 'Reddetme sebebi zorunludur.' };
    const { error } = await supabase.from('tasks').update({
      status: 'open', completed_at: null, rejection_note: n.data
    }).eq('id', taskId);
    if (error) return { error: error.message };

    const notifyAssignees = async () => {
      const { data: asg } = await supabase.from('task_assignees').select('user_id').eq('task_id', taskId);
      const ids = (asg ?? []).map((a: any) => a.user_id);
      if (!ids.length) return;
      await supabase.from('notifications').insert(ids.map((user_id: string) => ({
        company_id: task.company_id, user_id, type: 'task_rejected',
        payload: { task_id: taskId, title: task.title, note: n.data }
      })));
      pushToUsers(ids, {
        title: '↩️ Görev reddedildi',
        body: `${task.title}: ${n.data}`,
        url: `/tasks/${taskId}`
      }).catch(() => {});
    };
    await Promise.all([
      log(supabase, task.company_id, profile.id, 'task', taskId, 'rejected', { note: n.data }),
      notifyAssignees()
    ]);
  }
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/manage/tasks');
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

  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Görev bulunamadı veya erişiminiz yok.' };

  const ext = file.name.split('.').pop() || 'bin';
  const path = `${task.company_id}/${taskId}/${crypto.randomUUID()}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from('attachments')
    .upload(path, buf, { contentType: file.type || 'application/octet-stream' });
  if (upErr) return { error: `Yükleme başarısız: ${upErr.message}` };

  const [{ data: att, error }] = await Promise.all([
    supabase.from('attachments').insert({
      company_id: task.company_id,
      task_id: taskId,
      checklist_item_id: itemId,
      uploaded_by: profile.id,
      storage_path: path,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size
    }).select().single(),
    log(supabase, task.company_id, profile.id, 'attachment', taskId, 'uploaded', { file: file.name })
  ]);
  if (error) return { error: error.message };

  // Fotoğraf Denetçisi (vision) — best-effort, never blocks the upload result
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
        await Promise.all([
          supabaseAdmin().from('attachments')
            .update({ ai_verdict: res.verdict, ai_note: res.note })
            .eq('id', att.id),
          logRun({
            companyId: task.company_id, agent: 'photo_verifier', userId: profile.id,
            input: { task_id: taskId, file: file.name },
            output: { verdict: res.verdict, note: res.note },
            inputTokens: res.inputTokens, outputTokens: res.outputTokens
          })
        ]);
      }
    } catch { /* ignore */ }
  }

  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

export async function addTaskNote(formData: FormData) {
  const { supabase, profile } = await getCtx();
  const taskId = String(formData.get('task_id') ?? '');
  const body = z.string().min(1).max(2000).parse(String(formData.get('body') ?? '').trim());
  const { data: task } = await supabase.from('tasks').select('id, company_id').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Görev bulunamadı.' };
  await supabase.from('notes').insert({
    company_id: task.company_id, author_id: profile.id, task_id: taskId, body
  });
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}
