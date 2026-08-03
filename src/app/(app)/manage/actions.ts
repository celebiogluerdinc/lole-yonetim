'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { RRule, Weekday } from 'rrule';
import { getCtx } from '@/lib/auth';

const WD: Record<string, Weekday> = {
  MO: RRule.MO, TU: RRule.TU, WE: RRule.WE, TH: RRule.TH,
  FR: RRule.FR, SA: RRule.SA, SU: RRule.SU
};

const TaskSchema = z.object({
  title: z.string().min(2).max(200),
  description: z.string().max(2000).optional().default(''),
  type: z.enum(['task', 'checklist']),
  department_id: z.string().uuid(),
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

function buildOccurrences(input: z.infer<typeof TaskSchema>): { dates: Date[]; rruleStr: string | null } {
  const dtstart = new Date(input.due_at);
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
  if (!parsed.success) return { error: 'Form eksik: başlık, departman, tarih ve en az bir kişi gereklidir.' };
  const input = parsed.data;
  if (input.type === 'checklist' && input.items.length === 0) {
    return { error: 'Checklist için en az bir madde ekleyin.' };
  }

  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin (Şirketler sayfası).' };

  const allowed =
    profile.role === 'super_admin' || profile.role === 'admin' ||
    managedDepartmentIds.includes(input.department_id);
  if (!allowed) return { error: 'Bu departmana görev atama yetkiniz yok.' };

  const { dates, rruleStr } = buildOccurrences(input);
  let parentId: string | null = null;

  for (const d of dates) {
    const { data: task, error }: { data: any; error: any } = await supabase.from('tasks').insert({
      company_id: companyId,
      department_id: input.department_id,
      title: input.title,
      description: input.description || null,
      type: input.type,
      created_by: profile.id,
      due_at: d.toISOString(),
      priority: input.priority,
      requires_photo: input.requires_photo,
      requires_approval: input.requires_approval,
      recurrence_rule: rruleStr,
      parent_recurring_id: parentId
    }).select().single();
    if (error) return { error: error.message };
    if (!parentId) parentId = task.id;

    await supabase.from('task_assignees').insert(
      input.assignees.map(uid => ({ task_id: task.id, user_id: uid }))
    );
    if (input.items.length) {
      await supabase.from('checklist_items').insert(
        input.items.map((title, i) => ({ task_id: task.id, title, position: i }))
      );
    }
    await supabase.from('notifications').insert(
      input.assignees.map(uid => ({
        company_id: companyId, user_id: uid, type: 'task_assigned',
        payload: { task_id: task.id, title: input.title, due_at: d.toISOString() }
      }))
    );
  }

  await supabase.from('activity_log').insert({
    company_id: companyId, actor_id: profile.id, entity_type: 'task',
    entity_id: parentId, action: 'created',
    meta: { title: input.title, occurrences: dates.length }
  });

  revalidatePath('/home');
  redirect('/home?tab=all');
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
  const assignees = formData.getAll('assignees').map(String);
  if (!templateId || !due_at || assignees.length === 0) {
    return { error: 'Tarih ve en az bir kişi seçin.' };
  }

  const { supabase, profile, companyId } = await getCtx();
  if (!companyId) return { error: 'Önce bir şirket seçin.' };

  const { data: tpl } = await supabase.from('templates').select('*').eq('id', templateId).single();
  if (!tpl) return { error: 'Şablon bulunamadı.' };
  const { data: tplItems } = await supabase
    .from('template_items').select('*').eq('template_id', templateId).order('position');

  const { data: task, error } = await supabase.from('tasks').insert({
    company_id: companyId,
    department_id: tpl.department_id,
    title: tpl.name,
    description: tpl.description,
    type: tpl.type,
    created_by: profile.id,
    due_at: new Date(due_at).toISOString(),
    priority: tpl.default_priority,
    requires_photo: tpl.requires_photo,
    requires_approval: tpl.requires_approval,
    template_id: tpl.id
  }).select().single();
  if (error) return { error: error.message };

  await supabase.from('task_assignees').insert(assignees.map(uid => ({ task_id: task.id, user_id: uid })));
  if (tplItems?.length) {
    await supabase.from('checklist_items').insert(
      tplItems.map((it: any) => ({
        task_id: task.id, title: it.title, position: it.position, requires_photo: it.requires_photo
      }))
    );
  }
  await supabase.from('notifications').insert(
    assignees.map(uid => ({
      company_id: companyId, user_id: uid, type: 'task_assigned',
      payload: { task_id: task.id, title: tpl.name }
    }))
  );
  revalidatePath('/home');
  redirect(`/tasks/${task.id}`);
}
