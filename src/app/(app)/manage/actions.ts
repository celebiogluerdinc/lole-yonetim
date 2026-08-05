'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { RRule, Weekday } from 'rrule';
import { getCtx } from '@/lib/auth';
import { pushToUsers } from '@/lib/push';

const WD: Record<string, Weekday> = {
  MO: RRule.MO, TU: RRule.TU, WE: RRule.WE, TH: RRule.TH,
  FR: RRule.FR, SA: RRule.SA, SU: RRule.SU
};

const TaskSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional().default(''),
  type: z.enum(['task', 'checklist']),
  department_id: z.string().min(1), // uuid OR '__all__' (company-wide, admins)
  due_at: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  requires_photo: z.boolean(),
  requires_approval: z.boolean(),
  assignees: z.array(z.string().uuid()).min(1),
  items: z.array(z.string().min(1)).optional().default([]),
  recur: z.enum(['none', 'daily', 'weekly', 'monthly', 'custom']),
  weekdays: z.array(z.string()).optional().default([]),
  monthday: z.coerce.number().min(1).max(31).optional(),
  interval: z.coerce.number().min(1).max(90).optional().default(1),
  count: z.coerce.number().min(1).max(30).optional().default(8),
  custom_rrule: z.string().optional().default('')
});

/** <input type="datetime-local"> has no timezone — interpret it as Istanbul (+03:00, no DST). */
function istDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s)) {
    return new Date(`${s.slice(0, 16)}:00+03:00`);
  }
  return new Date(s);
}

function buildOccurrences(input: z.infer<typeof TaskSchema>): { dates: Date[]; rruleStr: string | null } {
  const dtstart = istDate(input.due_at);
  if (input.recur === 'none') return { dates: [dtstart], rruleStr: null };

  let rule: RRule;
  if (input.recur === 'custom' && input.custom_rrule) {
    rule = new RRule({ ...RRule.parseString(input.custom_rrule), dtstart, count: input.count });
  } else if (input.recur === 'daily') {
    rule = new RRule({ freq: RRule.DAILY, interval: input.interval, dtstart, count: input.count });
  } else if (input.recur === 'weekly') {
    const byweekday = input.weekdays.map(w => WD[w]).filter(Boolean);
    rule = new RRule({
      freq: RRule.WEEKLY, interval: input.interval, dtstart, count: input.count,
      ...(byweekday.length ? { byweekday } : {})
    });
  } else {
    rule = new RRule({
      freq: RRule.MONTHLY, interval: input.interval, dtstart, count: input.count,
      ...(input.monthday ? { bymonthday: input.monthday } : {})
    });
  }
  const dates = rule.all();
  return { dates: dates.length ? dates : [dtstart], rruleStr: rule.toString() };
}

/** Manager/admin creates a task or checklist series and assigns it. */
export async function createTask(formData: FormData): Promise<{ error?: string } | never> {
  const raw = {
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    type: String(formData.get('type') ?? 'task'),
    department_id: String(formData.get('department_id') ?? ''),
    due_at: String(formData.get('due_at') ?? ''),
    priority: String(formData.get('priority') ?? 'normal'),
    requires_photo: formData.get('requires_photo') === 'on',
    requires_approval: formData.get('requires_approval') === 'on',
    assignees: formData.getAll('assignees').map(String),
    items: formData.getAll('items').map(String).filter(s => s.trim().length > 0),
    recur: String(formData.get('recur') ?? 'none'),
    weekdays: formData.getAll('weekdays').map(String),
    monthday: formData.get('monthday') || undefined,
    interval: formData.get('interval') || 1,
    count: formData.get('count') || 8,
    custom_rrule: String(formData.get('custom_rrule') ?? '')
  };
  const parsed = TaskSchema.safeParse(raw);
  if (!parsed.success) {
    const FIELD_TR: Record<string, string> = {
      title: 'Başlık', description: 'Açıklama', type: 'Görev türü',
      department_id: 'Departman', due_at: 'Bitiş tarihi/saati', priority: 'Öncelik',
      assignees: 'Atanacak kişiler', items: 'Checklist maddeleri', recur: 'Tekrar',
      weekdays: 'Haftanın günleri', monthday: 'Ayın günü', interval: 'Aralık',
      count: 'Tekrar sayısı', custom_rrule: 'Özel kural'
    };
    const fields = Array.from(new Set(
      parsed.error.issues.map(i => FIELD_TR[String(i.path[0])] ?? String(i.path[0]))
    )).join(', ');
    return { error: `Şu alan(lar) eksik veya hatalı: ${fields}. Lütfen kontrol edip tekrar deneyin.` };
  }
  const input = parsed.data;
  if (input.type === 'checklist' && input.items.length === 0) {
    return { error: 'Checklist için en az bir madde ekleyin.' };
  }

  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin (Şirketler sayfası).' };

  // '__all__' → company-wide task (admins only)
  const isCompanyWide = input.department_id === '__all__';
  const deptId = isCompanyWide ? null : input.department_id;
  if (!isCompanyWide && !z.string().uuid().safeParse(input.department_id).success) {
    return { error: 'Geçersiz departman seçimi.' };
  }

  const allowed = isCompanyWide
    ? ['super_admin', 'admin'].includes(profile.role)
    : profile.role === 'super_admin' || profile.role === 'admin' ||
      managedDepartmentIds.includes(input.department_id);
  if (!allowed) {
    return { error: isCompanyWide
      ? 'Tüm şirkete görev atamayı yalnızca adminler yapabilir.'
      : 'Bu departmana görev atama yetkiniz yok.' };
  }

  if (isNaN(istDate(input.due_at).getTime())) return { error: 'Geçersiz bitiş tarihi.' };

  // güvenlik: atananlar bu şirketin kullanıcıları olmalı
  const { data: validAssignees } = await supabase
    .from('profiles').select('id').eq('company_id', companyId).in('id', input.assignees);
  if ((validAssignees ?? []).length !== input.assignees.length) {
    return { error: 'Seçilen kişilerden bazıları bu şirkette bulunamadı.' };
  }

  const { dates, rruleStr } = buildOccurrences(input);

  // BATCH insert: 1 tasks insert + 1 assignees + 1 items + 1 notifications
  // regardless of how many recurring occurrences — fast even for long series.
  const taskRows = dates.map(d => ({
    company_id: companyId,
    department_id: deptId,
    title: input.title,
    description: input.description || null,
    type: input.type,
    created_by: profile.id,
    due_at: d.toISOString(),
    priority: input.priority,
    requires_photo: input.requires_photo,
    requires_approval: input.requires_approval,
    recurrence_rule: rruleStr
  }));

  const { data: created, error } = await supabase
    .from('tasks').insert(taskRows).select('id, due_at');
  if (error) return { error: error.message };
  const tasks = created ?? [];
  const parentId = tasks[0]?.id ?? null;

  const assigneeRows = tasks.flatMap((t: any) =>
    input.assignees.map(uid => ({ task_id: t.id, user_id: uid })));
  const itemRows = input.items.length
    ? tasks.flatMap((t: any) =>
        input.items.map((title, i) => ({ task_id: t.id, title, position: i })))
    : [];
  const notifRows = tasks.flatMap((t: any) =>
    input.assignees.map(uid => ({
      company_id: companyId, user_id: uid, type: 'task_assigned',
      payload: { task_id: t.id, title: input.title, due_at: t.due_at }
    })));

  const sideEffects: any[] = [
    supabase.from('task_assignees').insert(assigneeRows),
    supabase.from('notifications').insert(notifRows),
    supabase.from('activity_log').insert({
      company_id: companyId, actor_id: profile.id, entity_type: 'task',
      entity_id: parentId, action: 'created',
      meta: { title: input.title, occurrences: dates.length, company_wide: isCompanyWide }
    })
  ];
  if (itemRows.length) sideEffects.push(supabase.from('checklist_items').insert(itemRows));
  if (tasks.length > 1) {
    sideEffects.push(
      supabase.from('tasks').update({ parent_recurring_id: parentId })
        .in('id', tasks.slice(1).map((t: any) => t.id))
    );
  }
  const results = await Promise.all(sideEffects);
  const sideErr = results.find(r => r?.error);
  if (sideErr?.error) return { error: sideErr.error.message };

  pushToUsers(input.assignees, {
    title: '📋 Size yeni görev atandı',
    body: input.title,
    url: parentId ? `/tasks/${parentId}` : '/home'
  }).catch(() => {});

  revalidatePath('/home');
  revalidatePath('/manage/tasks');
  redirect('/manage/tasks');
}

const TemplateSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(1000).optional().default(''),
  type: z.enum(['task', 'checklist']),
  department_id: z.string().uuid().optional().nullable(),
  default_priority: z.enum(['low', 'normal', 'high', 'urgent']),
  requires_photo: z.boolean(),
  requires_approval: z.boolean(),
  items: z.array(z.string().min(1)).optional().default([])
});

export async function createTemplate(formData: FormData): Promise<{ error?: string } | never> {
  const parsed = TemplateSchema.safeParse({
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? ''),
    type: String(formData.get('type') ?? 'task'),
    department_id: String(formData.get('department_id') ?? '') || null,
    default_priority: String(formData.get('default_priority') ?? 'normal'),
    requires_photo: formData.get('requires_photo') === 'on',
    requires_approval: formData.get('requires_approval') === 'on',
    items: formData.getAll('items').map(String).filter(s => s.trim().length > 0)
  });
  if (!parsed.success) return { error: 'Şablon adı ve türü zorunludur.' };
  const input = parsed.data;

  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: tpl, error } = await supabase.from('templates').insert({
    company_id: companyId,
    department_id: input.department_id,
    name: input.name,
    description: input.description || null,
    type: input.type,
    default_priority: input.default_priority,
    requires_photo: input.requires_photo,
    requires_approval: input.requires_approval,
    created_by: profile.id
  }).select().single();
  if (error) return { error: error.message };

  if (input.items.length) {
    await supabase.from('template_items').insert(
      input.items.map((title, i) => ({ template_id: tpl.id, title, position: i }))
    );
  }
  revalidatePath('/manage/templates');
  redirect('/manage/templates');
}

/** Instantiate a template as a real task. */
export async function instantiateTemplate(formData: FormData): Promise<{ error?: string } | never> {
  const templateId = String(formData.get('template_id') ?? '');
  const due_at = String(formData.get('due_at') ?? '');
  const assignees = formData.getAll('assignees').map(String)
    .filter(a => z.string().uuid().safeParse(a).success);
  if (!templateId || !due_at || assignees.length === 0) {
    return { error: 'Tarih ve en az bir kişi seçin.' };
  }

  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: tpl } = await supabase.from('templates').select('*').eq('id', templateId).single();
  if (!tpl || tpl.company_id !== companyId) return { error: 'Şablon bulunamadı.' };

  // yetki: admin, ya da şablonun departmanını yöneten müdür
  const canUse = ['super_admin', 'admin'].includes(profile.role) ||
    (tpl.department_id
      ? managedDepartmentIds.includes(tpl.department_id)
      : managedDepartmentIds.length > 0);
  if (!canUse) return { error: 'Bu şablondan görev oluşturma yetkiniz yok.' };

  // güvenlik: atananlar bu şirketin kullanıcıları olmalı
  const { data: validAssignees } = await supabase
    .from('profiles').select('id').eq('company_id', companyId).in('id', assignees);
  if ((validAssignees ?? []).length !== assignees.length) {
    return { error: 'Seçilen kişilerden bazıları bu şirkette bulunamadı.' };
  }

  const { data: tplItems } = await supabase
    .from('template_items').select('*').eq('template_id', templateId).order('position');

  const dueDate = istDate(due_at);
  if (isNaN(dueDate.getTime())) return { error: 'Geçersiz tarih.' };

  const { data: task, error } = await supabase.from('tasks').insert({
    company_id: companyId,
    department_id: tpl.department_id,
    title: tpl.name,
    description: tpl.description,
    type: tpl.type,
    created_by: profile.id,
    due_at: dueDate.toISOString(),
    priority: tpl.default_priority,
    requires_photo: tpl.requires_photo,
    requires_approval: tpl.requires_approval,
    template_id: tpl.id
  }).select().single();
  if (error) return { error: error.message };

  const { error: aErr } = await supabase.from('task_assignees')
    .insert(assignees.map(uid => ({ task_id: task.id, user_id: uid })));
  if (aErr) return { error: `Atama yapılamadı: ${aErr.message}` };
  if (tplItems?.length) {
    const { error: iErr } = await supabase.from('checklist_items').insert(
      tplItems.map((it: any) => ({
        task_id: task.id, title: it.title, position: it.position, requires_photo: it.requires_photo
      }))
    );
    if (iErr) return { error: `Checklist oluşturulamadı: ${iErr.message}` };
  }
  await supabase.from('notifications').insert(
    assignees.map(uid => ({
      company_id: companyId, user_id: uid, type: 'task_assigned',
      payload: { task_id: task.id, title: tpl.name }
    }))
  );
  pushToUsers(assignees, {
    title: '📋 Size yeni görev atandı',
    body: tpl.name,
    url: `/tasks/${task.id}`
  }).catch(() => {});
  revalidatePath('/home');
  revalidatePath('/manage/tasks');
  redirect(`/tasks/${task.id}`);
}

/** Delete a template (its items cascade). Admin, or manager of its department. */
export async function deleteTemplate(templateId: string) {
  if (!z.string().uuid().safeParse(templateId).success) return { error: 'Geçersiz şablon.' };
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: tpl } = await supabase.from('templates')
    .select('id, company_id, department_id').eq('id', templateId).maybeSingle();
  if (!tpl || tpl.company_id !== companyId) return { error: 'Şablon bulunamadı.' };

  const canDelete = ['super_admin', 'admin'].includes(profile.role) ||
    (tpl.department_id ? managedDepartmentIds.includes(tpl.department_id) : false);
  if (!canDelete) return { error: 'Bu şablonu silme yetkiniz yok.' };

  const { error } = await supabase.from('templates').delete().eq('id', templateId);
  if (error) return { error: error.message };
  revalidatePath('/manage/templates');
  return { ok: true };
}
