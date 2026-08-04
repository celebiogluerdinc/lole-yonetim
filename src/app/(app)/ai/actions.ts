'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { getCtx } from '@/lib/auth';
import {
  aiEnabled, checkAllowance, logRun,
  runAssistant, draftTaskFromText, draftTemplateFromText, draftAnnouncementFromText,
  suggestAssignees
} from '@/lib/ai';

/** Chat with Lole Asistan — persists the thread, runs tools with the user's permissions. */
export async function askAssistant(question: string) {
  const q = z.string().min(1).max(2000).safeParse(question.trim());
  if (!q.success) return { error: 'Soru boş olamaz.' };

  const ctx = await getCtx();
  const blocked = await checkAllowance(ctx.companyId, 'assistant');
  if (blocked) return { error: blocked };

  // single rolling thread per user
  let { data: thread } = await ctx.supabase
    .from('ai_threads').select('id')
    .eq('user_id', ctx.profile.id)
    .order('created_at', { ascending: false })
    .limit(1).maybeSingle();
  if (!thread) {
    const { data: t, error } = await ctx.supabase
      .from('ai_threads')
      .insert({ user_id: ctx.profile.id, company_id: ctx.companyId, title: 'Lole Asistan' })
      .select().single();
    if (error) return { error: error.message };
    thread = t;
  }

  await ctx.supabase.from('ai_messages').insert({
    thread_id: thread!.id, role: 'user', content: q.data
  });

  const { data: hist } = await ctx.supabase
    .from('ai_messages')
    .select('role, content')
    .eq('thread_id', thread!.id)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: true })
    .limit(24);

  try {
    const res = await runAssistant(ctx, (hist ?? []) as any);
    await ctx.supabase.from('ai_messages').insert({
      thread_id: thread!.id, role: 'assistant', content: res.text
    });
    await logRun({
      companyId: ctx.companyId, agent: 'assistant', userId: ctx.profile.id,
      input: { q: q.data }, output: { text: res.text.slice(0, 500) },
      inputTokens: res.inputTokens, outputTokens: res.outputTokens
    });
    revalidatePath('/assistant');
    return { ok: true };
  } catch (e: any) {
    await logRun({
      companyId: ctx.companyId, agent: 'assistant', userId: ctx.profile.id,
      input: { q: q.data }, output: { error: String(e?.message ?? e) },
      inputTokens: 0, outputTokens: 0, status: 'error'
    });
    return { error: 'Yapay zeka şu anda yanıt veremedi. Lütfen tekrar deneyin.' };
  }
}

export async function clearAssistantThread() {
  const ctx = await getCtx();
  const { data: threads } = await ctx.supabase
    .from('ai_threads').select('id').eq('user_id', ctx.profile.id);
  if (threads?.length) {
    await ctx.supabase.from('ai_threads').delete().in('id', threads.map((t: any) => t.id));
  }
  revalidatePath('/assistant');
  return { ok: true };
}

/** Natural language → task draft (manager confirms in the form; AI never assigns directly). */
export async function aiDraftTask(instruction: string) {
  const q = z.string().min(5).max(2000).safeParse(instruction.trim());
  if (!q.success) return { error: 'Lütfen görevi kısaca tarif edin.' };

  const ctx = await getCtx();
  if (!['super_admin', 'admin', 'manager'].includes(ctx.profile.role) && ctx.managedDepartmentIds.length === 0) {
    return { error: 'Bu özellik yöneticiler içindir.' };
  }
  const blocked = await checkAllowance(ctx.companyId, 'task_creator');
  if (blocked) return { error: blocked };

  const [{ data: people }, { data: depts }] = await Promise.all([
    ctx.supabase.from('profiles').select('full_name').eq('company_id', ctx.companyId!).eq('is_active', true),
    ctx.supabase.from('departments').select('name').eq('company_id', ctx.companyId!)
  ]);

  try {
    const res = await draftTaskFromText(
      q.data,
      (people ?? []).map((p: any) => p.full_name),
      (depts ?? []).map((d: any) => d.name)
    );
    await logRun({
      companyId: ctx.companyId, agent: 'task_creator', userId: ctx.profile.id,
      input: { instruction: q.data }, output: res.draft,
      inputTokens: res.inputTokens, outputTokens: res.outputTokens
    });
    if (!res.draft) return { error: 'Taslak üretilemedi, lütfen tekrar deneyin.' };
    return { ok: true, draft: res.draft };
  } catch (e: any) {
    return { error: 'Yapay zeka şu anda yanıt veremedi. Lütfen tekrar deneyin.' };
  }
}

export async function aiDraftTemplate(instruction: string) {
  const q = z.string().min(5).max(1000).safeParse(instruction.trim());
  if (!q.success) return { error: 'Lütfen şablonu kısaca tarif edin.' };

  const ctx = await getCtx();
  const blocked = await checkAllowance(ctx.companyId, 'checklist_generator');
  if (blocked) return { error: blocked };

  try {
    const res = await draftTemplateFromText(q.data);
    await logRun({
      companyId: ctx.companyId, agent: 'checklist_generator', userId: ctx.profile.id,
      input: { instruction: q.data }, output: res.draft,
      inputTokens: res.inputTokens, outputTokens: res.outputTokens
    });
    if (!res.draft) return { error: 'Taslak üretilemedi, lütfen tekrar deneyin.' };
    return { ok: true, draft: res.draft };
  } catch {
    return { error: 'Yapay zeka şu anda yanıt veremedi. Lütfen tekrar deneyin.' };
  }
}

/** Workload Balancer — suggests who to assign a task to (advice only). */
export async function aiSuggestAssignees(departmentId: string, taskSummary: string) {
  const ctx = await getCtx();
  const blocked = await checkAllowance(ctx.companyId, 'workload_balancer');
  if (blocked) return { error: blocked };

  const { data: members } = await ctx.supabase
    .from('department_members')
    .select('user_id, profiles:user_id(full_name)')
    .eq('department_id', departmentId);
  const ids = (members ?? []).map((m: any) => m.user_id);
  if (ids.length === 0) return { error: 'Bu departmanda üye yok.' };

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: asg } = await ctx.supabase
    .from('task_assignees')
    .select('user_id, tasks!inner(status, due_at, completed_at, created_at)')
    .in('user_id', ids);

  const now = Date.now();
  const stats = (members ?? []).map((m: any) => {
    const mine = (asg ?? []).filter((a: any) => a.user_id === m.user_id).map((a: any) => a.tasks);
    const open = mine.filter((t: any) => !['completed', 'cancelled'].includes(t.status)).length;
    const recent = mine.filter((t: any) => t.due_at && t.due_at >= since);
    const done = recent.filter((t: any) => t.status === 'completed');
    const onTime = done.filter((t: any) => !t.due_at || !t.completed_at || new Date(t.completed_at) <= new Date(t.due_at));
    const late = recent.filter((t: any) =>
      (t.status === 'completed' && t.completed_at && t.due_at && new Date(t.completed_at) > new Date(t.due_at)) ||
      (!['completed', 'cancelled'].includes(t.status) && t.due_at && new Date(t.due_at).getTime() < now));
    return {
      isim: m.profiles?.full_name ?? '?',
      acik_gorev_sayisi: open,
      son30gun_zamaninda: onTime.length,
      son30gun_gec_veya_kacirilan: late.length
    };
  });

  try {
    const res = await suggestAssignees(taskSummary || 'Yeni görev', stats);
    await logRun({
      companyId: ctx.companyId, agent: 'workload_balancer', userId: ctx.profile.id,
      input: { departmentId, taskSummary, stats }, output: res.draft,
      inputTokens: res.inputTokens, outputTokens: res.outputTokens
    });
    if (!res.draft) return { error: 'Öneri üretilemedi.' };
    return { ok: true, suggestion: res.draft };
  } catch {
    return { error: 'Yapay zeka şu anda yanıt veremedi.' };
  }
}

export async function aiDraftAnnouncement(rough: string) {
  const q = z.string().min(5).max(2000).safeParse(rough.trim());
  if (!q.success) return { error: 'Önce birkaç kelime karalayın.' };

  const ctx = await getCtx();
  const blocked = await checkAllowance(ctx.companyId, 'announcement_writer');
  if (blocked) return { error: blocked };

  try {
    const res = await draftAnnouncementFromText(q.data);
    await logRun({
      companyId: ctx.companyId, agent: 'announcement_writer', userId: ctx.profile.id,
      input: { rough: q.data }, output: res.draft,
      inputTokens: res.inputTokens, outputTokens: res.outputTokens
    });
    if (!res.draft) return { error: 'Metin üretilemedi, lütfen tekrar deneyin.' };
    return { ok: true, draft: res.draft };
  } catch {
    return { error: 'Yapay zeka şu anda yanıt veremedi. Lütfen tekrar deneyin.' };
  }
}
