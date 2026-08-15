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

/** İstanbul takvimine göre görev ileri tarihli mi? (yanlış günün görevi kilidi) */
function isFutureDay(dueAt: string | null): boolean {
  if (!dueAt) return false;
  const key = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(d);
  return key(new Date(dueAt)) > key(new Date());
}

/** One-tap complete from lists. Optimized: task + photo check in one parallel round. */
export async function quickComplete(taskId: string, force = false) {
  const { supabase, profile } = await getCtx();

  const [{ data: task }, { count: myPhotos }] = await Promise.all([
    supabase.from('tasks').select('*').eq('id', taskId).maybeSingle(),
    supabase.from('attachments').select('id', { count: 'exact', head: true })
      .eq('task_id', taskId).eq('uploaded_by', profile.id)
  ]);
  if (!task) return { error: 'Görev bulunamadı veya erişiminiz yok.' };
  if (['completed', 'cancelled'].includes(task.status)) return { ok: true };
  if (!force && isFutureDay(task.due_at)) return { error: 'future_task' }; // sunucu tarafı yanlış-gün kilidi
  if (task.requires_photo && !(myPhotos ?? 0)) return { error: 'photo_required' };

  const nextStatus = task.requires_approval ? 'pending_review' : 'completed';
  const { data: updated, error } = await supabase.from('tasks').update({
    status: nextStatus, completed_at: new Date().toISOString()
  }).eq('id', taskId).in('status', ['open', 'in_progress', 'blocked']).select('id');
  if (error) return { error: error.message };
  if (!updated?.length) return { error: 'Görev az önce başka biri tarafından güncellendi.' };

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
  if (['completed', 'cancelled'].includes(item.tasks?.status ?? '')) {
    return { error: 'Bu görev kapatılmış — maddeleri artık değiştirilemez.' };
  }

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
  const results = await Promise.all(updates);
  const failed = results.find((r: any) => r?.error);
  if (failed?.error) return { error: failed.error.message };

  revalidatePath(`/tasks/${item.task_id}`);
  revalidatePath('/home');
  return { ok: true };
}

export async function completeTask(taskId: string, force = false) {
  const { supabase, profile } = await getCtx();

  const [{ data: task }, { count: notDone }, { count: myPhotos }] = await Promise.all([
    supabase.from('tasks').select('*').eq('id', taskId).maybeSingle(),
    supabase.from('checklist_items').select('id', { count: 'exact', head: true })
      .eq('task_id', taskId).eq('is_done', false),
    supabase.from('attachments').select('id', { count: 'exact', head: true })
      .eq('task_id', taskId).eq('uploaded_by', profile.id)
  ]);
  if (!task) return { error: 'Görev bulunamadı veya erişiminiz yok.' };
  if (!force && isFutureDay(task.due_at)) return { error: 'future_task' }; // sunucu tarafı yanlış-gün kilidi

  if (task.type === 'checklist' && (notDone ?? 0) > 0) {
    return { error: 'Önce tüm maddeleri tamamlayın.' };
  }
  if (task.requires_photo && !(myPhotos ?? 0)) {
    return { error: 'Bu görevi kapatmak için fotoğraf eklemeniz zorunlu.' };
  }

  const nextStatus = task.requires_approval ? 'pending_review' : 'completed';
  const { data: updated, error } = await supabase.from('tasks').update({
    status: nextStatus, completed_at: new Date().toISOString(), blocked_reason: null
  }).eq('id', taskId).in('status', ['open', 'in_progress', 'blocked']).select('id');
  if (error) return { error: error.message };
  if (!updated?.length) return { error: 'Görev az önce başka biri tarafından güncellendi.' };

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

  // Adminler tam yetkilidir: hangi şirketten eklenmiş olurlarsa olsunlar TÜM
  // şirketlerin görevlerini bitirebilir/iptal edebilir (migration 0012 ile
  // veritabanı kuralları da adminleri süper admin kapsamında sayıyor).
  // Müdürler yalnızca müdürü oldukları departmanların görevlerinde yetkilidir.
  const allowed =
    profile.role === 'super_admin' ||
    profile.role === 'admin' ||
    (task.department_id && managedDepartmentIds.includes(task.department_id));
  if (!allowed) return { error: 'Bu görev üzerinde yetkiniz yok.' };
  if (['completed', 'cancelled'].includes(task.status) && task.status === status) return { ok: true };

  const { data: updated, error } = await supabase.from('tasks').update({
    status,
    completed_at: status === 'completed' ? new Date().toISOString() : task.completed_at,
    blocked_reason: null,
    ...(status === 'completed' ? { approved_by: profile.id, approved_at: new Date().toISOString() } : {})
  }).eq('id', taskId).not('status', 'in', '("completed","cancelled")').select('id');
  if (error) return { error: error.message };
  if (!updated?.length) return { error: 'Görev zaten kapatılmış.' };

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
  if (['completed', 'cancelled'].includes(task.status)) {
    return { error: 'Kapatılmış görev için engel bildirilemez.' };
  }

  const { error } = await supabase.from('tasks').update({
    status: 'blocked', blocked_reason: parsed.data
  }).eq('id', taskId).in('status', ['open', 'in_progress', 'pending_review']);
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
    const { data: updated, error } = await supabase.from('tasks').update({
      status: 'completed', approved_by: profile.id,
      approved_at: new Date().toISOString(), rejection_note: null
    }).eq('id', taskId).eq('status', 'pending_review').select('id'); // yarış koruması
    if (error) return { error: error.message };
    if (!updated?.length) return { error: 'Görev az önce başka biri tarafından sonuçlandırıldı.' };
    await log(supabase, task.company_id, profile.id, 'task', taskId, 'approved');
  } else {
    const n = z.string().min(3).max(500).safeParse((note ?? '').trim());
    if (!n.success) return { error: 'Reddetme sebebi zorunludur.' };
    const { data: updated, error } = await supabase.from('tasks').update({
      status: 'open', completed_at: null, rejection_note: n.data
    }).eq('id', taskId).eq('status', 'pending_review').select('id'); // yarış koruması
    if (error) return { error: error.message };
    if (!updated?.length) return { error: 'Görev az önce başka biri tarafından sonuçlandırıldı.' };

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

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
  'application/pdf'
]);

export async function uploadAttachment(formData: FormData) {
  const { supabase, profile } = await getCtx();
  const taskId = String(formData.get('task_id') ?? '');
  const itemId = String(formData.get('item_id') ?? '') || null;
  const file = formData.get('file') as File | null;
  if (!file || !z.string().uuid().safeParse(taskId).success) return { error: 'Dosya seçilmedi.' };
  if (itemId && !z.string().uuid().safeParse(itemId).success) return { error: 'Geçersiz madde.' };
  if (file.size > 10 * 1024 * 1024) return { error: 'Dosya 10MB sınırını aşıyor.' };
  const extGuess = (file.name.split('.').pop() || '').toLowerCase();
  const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'pdf']);
  if (file.type ? !ALLOWED_MIME.has(file.type) : !ALLOWED_EXT.has(extGuess)) {
    return { error: 'Yalnızca fotoğraf (JPG/PNG/HEIC/WebP) ve PDF yüklenebilir.' };
  }

  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Görev bulunamadı veya erişiminiz yok.' };

  const ext = (file.name.split('.').pop() || 'bin')
    .toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
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
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) && // HEIC vision desteklemiyor — sessizce atla
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

/** <input type="datetime-local"> has no timezone — interpret it as Istanbul (+03:00). */
function istDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s)) {
    return new Date(`${s.slice(0, 16)}:00+03:00`);
  }
  return new Date(s);
}

/** Manager permission for a task: admin/super, or manages the task's department. */
async function canManageTask(profile: any, managedDepartmentIds: string[], task: any): Promise<boolean> {
  if (profile.role === 'super_admin' || profile.role === 'admin') return true;
  return !!(task.department_id && managedDepartmentIds.includes(task.department_id));
}

/**
 * Manager edits an existing task: title, description, due date/time, priority,
 * photo/approval requirements, assignees (replaced) and NEW checklist items (appended).
 */
export async function updateTask(formData: FormData) {
  const schema = z.object({
    task_id: z.string().uuid(),
    title: z.string().min(2).max(200),
    description: z.string().max(2000).optional().default(''),
    due_at: z.string().min(1),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
    requires_photo: z.boolean(),
    requires_approval: z.boolean(),
    assignees: z.array(z.string().uuid()).min(1),
    new_items: z.array(z.string().min(1).max(300)).default([]),
    apply_series: z.boolean()
  });
  const parsed = schema.safeParse({
    task_id: String(formData.get('task_id') ?? ''),
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim(),
    due_at: String(formData.get('due_at') ?? ''),
    priority: String(formData.get('priority') ?? 'normal'),
    requires_photo: formData.get('requires_photo') === 'on',
    requires_approval: formData.get('requires_approval') === 'on',
    assignees: formData.getAll('assignees').map(String),
    new_items: formData.getAll('new_items').map(String).map(s => s.trim()).filter(Boolean),
    apply_series: formData.get('apply_series') === 'on'
  });
  if (!parsed.success) {
    return { error: 'Başlık, bitiş tarihi ve en az bir atanan kişi zorunludur.' };
  }
  const i = parsed.data;

  const { supabase, profile, managedDepartmentIds } = await getCtx();
  const { data: task } = await supabase.from('tasks').select('*').eq('id', i.task_id).maybeSingle();
  if (!task) return { error: 'Görev bulunamadı veya erişiminiz yok.' };
  if (!(await canManageTask(profile, managedDepartmentIds, task))) {
    return { error: 'Bu görevi düzenleme yetkiniz yok.' };
  }
  if (['completed', 'cancelled'].includes(task.status)) {
    return { error: 'Tamamlanmış veya iptal edilmiş görev düzenlenemez.' };
  }

  const due = istDate(i.due_at);
  if (isNaN(due.getTime())) return { error: 'Geçersiz tarih/saat.' };

  // güvenlik: atananlar görevin şirketinde olmalı
  const { data: validAssignees } = await supabase
    .from('profiles').select('id').eq('company_id', task.company_id).in('id', i.assignees);
  if ((validAssignees ?? []).length !== i.assignees.length) {
    return { error: 'Seçilen kişilerden bazıları bu şirkette bulunamadı.' };
  }

  const { error } = await supabase.from('tasks').update({
    title: i.title,
    description: i.description || null,
    due_at: due.toISOString(),
    priority: i.priority,
    requires_photo: i.requires_photo,
    requires_approval: i.requires_approval
  }).eq('id', i.task_id);
  if (error) return { error: error.message };

  // atananları güncelle (fark bazlı: yeni eklenenlere bildirim gider)
  const { data: currentA } = await supabase
    .from('task_assignees').select('user_id').eq('task_id', i.task_id);
  const before = new Set((currentA ?? []).map((a: any) => a.user_id));
  const after = new Set(i.assignees);
  const added = i.assignees.filter(u => !before.has(u));
  const removed = Array.from(before).filter((u: any) => !after.has(u)) as string[];

  const ops: any[] = [];
  if (removed.length) {
    ops.push(supabase.from('task_assignees').delete().eq('task_id', i.task_id).in('user_id', removed));
  }
  if (added.length) {
    ops.push(supabase.from('task_assignees').insert(added.map(user_id => ({ task_id: i.task_id, user_id }))));
  }
  if (i.new_items.length) {
    const { data: lastItem } = await supabase.from('checklist_items')
      .select('position').eq('task_id', i.task_id)
      .order('position', { ascending: false }).limit(1).maybeSingle();
    const base = (lastItem?.position ?? -1) + 1;
    ops.push(supabase.from('checklist_items').insert(
      i.new_items.map((title, idx) => ({ task_id: i.task_id, title, position: base + idx }))
    ));
  }
  ops.push(log(supabase, task.company_id, profile.id, 'task', i.task_id, 'updated',
    { title: i.title, added: added.length, removed: removed.length, new_items: i.new_items.length }));
  const results = await Promise.all(ops);
  const failed = results.find((r: any) => r?.error);
  if (failed?.error) return { error: failed.error.message };

  if (added.length) {
    await supabase.from('notifications').insert(added.map(user_id => ({
      company_id: task.company_id, user_id, type: 'task_assigned',
      payload: { task_id: i.task_id, title: i.title, due_at: due.toISOString() }
    })));
    pushToUsers(added, {
      title: '📋 Size yeni görev atandı', body: i.title, url: `/tasks/${i.task_id}`
    }).catch(() => {});
  }

  // "Serinin kalanına da uygula": başlık/açıklama/öncelik/gereksinimler + atananlar,
  // gelecekteki açık tekrarlara da işlenir (tarihler DEĞİŞMEZ — her tekrar kendi günü)
  let seriesUpdated = 0;
  if (i.apply_series && (task.recurrence_rule || task.parent_recurring_id)) {
    const rootId = task.parent_recurring_id ?? task.id;
    const { data: siblings } = await supabase.from('tasks')
      .select('id')
      .or(`id.eq.${rootId},parent_recurring_id.eq.${rootId}`)
      .neq('id', i.task_id)
      .in('status', ['open', 'in_progress', 'blocked'])
      .gte('due_at', new Date().toISOString());
    const sibIds = (siblings ?? []).map((s: any) => s.id);
    if (sibIds.length) {
      const { error: e1 } = await supabase.from('tasks').update({
        title: i.title,
        description: i.description || null,
        priority: i.priority,
        requires_photo: i.requires_photo,
        requires_approval: i.requires_approval
      }).in('id', sibIds);
      if (e1) return { error: `Seri güncellenirken hata: ${e1.message}` };
      // atananları eşitle (hata kontrolüyle — görevler sahipsiz kalmasın)
      const { error: e2 } = await supabase.from('task_assignees').delete().in('task_id', sibIds);
      if (e2) return { error: `Seri atamaları güncellenemedi: ${e2.message}` };
      const { error: e3 } = await supabase.from('task_assignees').insert(
        sibIds.flatMap((tid: string) => i.assignees.map(uid => ({ task_id: tid, user_id: uid })))
      );
      if (e3) return { error: `Seri atamaları eklenemedi: ${e3.message} — atamaları görevden tekrar kaydedin.` };
      seriesUpdated = sibIds.length;
    }
  }

  revalidatePath(`/tasks/${i.task_id}`);
  revalidatePath('/manage/tasks');
  revalidatePath('/home');
  return { ok: true, seriesUpdated };
}

/** Atanan kişi göreve "Başla" der — durum in_progress olur. */
export async function startTask(taskId: string) {
  if (!z.string().uuid().safeParse(taskId).success) return { error: 'Geçersiz görev.' };
  const { supabase, profile } = await getCtx();
  const { data: task } = await supabase.from('tasks').select('id, status, company_id, title').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Görev bulunamadı.' };
  if (task.status !== 'open') return { error: 'Görev zaten başlamış veya kapatılmış.' };

  const { data, error } = await supabase.from('tasks')
    .update({ status: 'in_progress' })
    .eq('id', taskId).eq('status', 'open').select('id');
  if (error) return { error: error.message };
  if (!data?.length) return { error: 'Görev güncellenemedi.' };

  await log(supabase, task.company_id, profile.id, 'task', taskId, 'started');
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/home');
  return { ok: true };
}

/** Personel erteleme talep eder — yöneticilere bildirim gider (görev değişmez). */
export async function requestPostpone(taskId: string, reason: string) {
  const parsed = z.string().min(3).max(500).safeParse(reason.trim());
  if (!parsed.success) return { error: 'Lütfen erteleme sebebini kısaca yazın.' };
  const { supabase, profile } = await getCtx();
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Görev bulunamadı.' };
  if (['completed', 'cancelled'].includes(task.status)) return { error: 'Kapatılmış görev için erteleme istenemez.' };

  await Promise.all([
    log(supabase, task.company_id, profile.id, 'task', taskId, 'postpone_requested', { reason: parsed.data }),
    notifyManagers(supabase, task, 'custom', {
      task_id: taskId,
      title: `⏰ Erteleme talebi: ${task.title}`,
      body: `${profile.full_name}: ${parsed.data}`,
      url: `/tasks/${taskId}`
    })
  ]);
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}

/** Tekrarlayan serinin KALAN (bugünden sonraki, açık) görevlerini iptal eder. */
export async function cancelTaskSeries(taskId: string) {
  if (!z.string().uuid().safeParse(taskId).success) return { error: 'Geçersiz görev.' };
  const { supabase, profile, managedDepartmentIds } = await getCtx();
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Görev bulunamadı.' };

  const allowed =
    ['super_admin', 'admin'].includes(profile.role) ||
    (task.department_id && managedDepartmentIds.includes(task.department_id));
  if (!allowed) return { error: 'Bu seri üzerinde yetkiniz yok.' };

  const rootId = task.parent_recurring_id ?? task.id;
  const { data: cancelled, error } = await supabase.from('tasks')
    .update({ status: 'cancelled' })
    .or(`id.eq.${rootId},parent_recurring_id.eq.${rootId}`)
    .in('status', ['open', 'in_progress', 'blocked'])
    .gte('due_at', new Date().toISOString())
    .select('id');
  if (error) return { error: error.message };
  if (!cancelled?.length) return { error: 'İptal edilecek gelecek tekrar bulunamadı (geçmiş/kapanmış olanlar korunur).' };

  await log(supabase, task.company_id, profile.id, 'task', rootId, 'series_cancelled',
    { count: cancelled.length, title: task.title });
  revalidatePath('/manage/tasks');
  revalidatePath(`/tasks/${taskId}`);
  revalidatePath('/home');
  return { ok: true, count: cancelled.length };
}

/** Manager removes a checklist item from a task. */
export async function deleteChecklistItem(itemId: string) {
  if (!z.string().uuid().safeParse(itemId).success) return { error: 'Geçersiz madde.' };
  const { supabase, profile, managedDepartmentIds } = await getCtx();
  const { data: item } = await supabase.from('checklist_items')
    .select('id, task_id, tasks:task_id(id, company_id, department_id, status)')
    .eq('id', itemId).maybeSingle();
  if (!item || !item.tasks) return { error: 'Madde bulunamadı.' };
  const task: any = item.tasks;
  if (!(await canManageTask(profile, managedDepartmentIds, task))) {
    return { error: 'Bu görevi düzenleme yetkiniz yok.' };
  }
  if (['completed', 'cancelled'].includes(task.status)) {
    return { error: 'Tamamlanmış görev düzenlenemez.' };
  }
  const { error } = await supabase.from('checklist_items').delete().eq('id', itemId);
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${task.id}`);
  return { ok: true };
}

export async function addTaskNote(formData: FormData) {
  const { supabase, profile } = await getCtx();
  const taskId = String(formData.get('task_id') ?? '');
  const bodyParsed = z.string().min(1).max(2000).safeParse(String(formData.get('body') ?? '').trim());
  if (!bodyParsed.success) return { error: 'Not boş olamaz (en fazla 2000 karakter).' };
  const { data: task } = await supabase.from('tasks').select('id, company_id').eq('id', taskId).maybeSingle();
  if (!task) return { error: 'Görev bulunamadı.' };
  const { error } = await supabase.from('notes').insert({
    company_id: task.company_id, author_id: profile.id, task_id: taskId, body: bodyParsed.data
  });
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${taskId}`);
  return { ok: true };
}
