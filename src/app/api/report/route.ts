import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { aiEnabled, writeWeeklyReport, logRun } from '@/lib/ai';
import { pushToUsers } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Weekly AI performance report — called by pg_cron every Monday morning.
 * Generates a Turkish written summary per company and notifies managers/admins.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!aiEnabled()) return NextResponse.json({ skipped: 'no api key' });

  const admin = supabaseAdmin();
  const since = new Date(Date.now() - 7 * 86400000);
  const weekStart = since.toISOString().slice(0, 10);
  const now = Date.now();

  const { data: companies } = await admin
    .from('companies').select('id, name').eq('is_active', true);

  const results: Record<string, string> = {};

  for (const c of companies ?? []) {
    // skip if this week's report already exists (idempotent)
    const { data: existing } = await admin
      .from('ai_reports').select('id')
      .eq('company_id', c.id).eq('week_start', weekStart).maybeSingle();
    if (existing) { results[c.name] = 'already'; continue; }

    const { data: tasks } = await admin
      .from('tasks')
      .select('id, title, status, due_at, completed_at')
      .eq('company_id', c.id)
      .not('due_at', 'is', null)
      .gte('due_at', since.toISOString());
    if (!tasks?.length) { results[c.name] = 'no data'; continue; }

    const { data: asg } = await admin
      .from('task_assignees')
      .select('task_id, profiles:user_id(full_name)')
      .in('task_id', tasks.map((t: any) => t.id));

    const classify = (t: any) => {
      if (t.status === 'completed') {
        return t.completed_at && t.due_at && new Date(t.completed_at) > new Date(t.due_at) ? 'gec' : 'zamaninda';
      }
      if (t.due_at && new Date(t.due_at).getTime() < now && t.status !== 'cancelled') return 'kacirilan';
      return 'bekleyen';
    };
    const counts: Record<string, number> = {};
    const perPerson: Record<string, Record<string, number>> = {};
    const taskMap: Record<string, any> = {};
    for (const t of tasks) { taskMap[t.id] = t; counts[classify(t)] = (counts[classify(t)] ?? 0) + 1; }
    for (const a of asg ?? []) {
      const t = taskMap[a.task_id]; if (!t) continue;
      const nm = (a as any).profiles?.full_name ?? '?';
      (perPerson[nm] ??= {})[classify(t)] = ((perPerson[nm] ??= {})[classify(t)] ?? 0) + 1;
    }
    const missedTitles = tasks.filter((t: any) => classify(t) === 'kacirilan').map((t: any) => t.title).slice(0, 8);

    try {
      const rep = await writeWeeklyReport(c.name, {
        hafta_baslangici: weekStart,
        toplam_gorev: tasks.length,
        durum_sayilari: counts,
        kisi_bazinda: perPerson,
        kacirilan_gorev_ornekleri: missedTitles
      });

      await admin.from('ai_reports').insert({
        company_id: c.id, week_start: weekStart, content: rep.text
      });
      await logRun({
        companyId: c.id, agent: 'performance_analyst', trigger: 'cron',
        input: { week_start: weekStart, task_count: tasks.length },
        output: { text: rep.text.slice(0, 300) },
        inputTokens: rep.inputTokens, outputTokens: rep.outputTokens
      });

      // notify managers + admins
      const [{ data: admins }, { data: mgrs }] = await Promise.all([
        admin.from('profiles').select('id').eq('company_id', c.id).eq('role', 'admin').eq('is_active', true),
        admin.from('department_members')
          .select('user_id, departments!inner(company_id)')
          .eq('is_manager', true)
          .eq('departments.company_id', c.id)
      ]);
      const targets = Array.from(new Set([
        ...(admins ?? []).map((a: any) => a.id),
        ...(mgrs ?? []).map((m: any) => m.user_id)
      ]));
      if (targets.length) {
        await admin.from('notifications').insert(targets.map(user_id => ({
          company_id: c.id, user_id, type: 'custom', pushed: true,
          payload: { title: '📊 Haftalık AI Raporu hazır', body: 'Performans sekmesinden okuyabilirsiniz.' }
        })));
        await pushToUsers(targets, {
          title: '📊 Haftalık AI Raporunuz hazır',
          body: `${c.name} — geçen haftanın özeti ve öneriler`,
          url: '/performance'
        });
      }
      results[c.name] = 'ok';
    } catch (e: any) {
      results[c.name] = 'error: ' + (e?.message ?? 'unknown');
    }
  }

  return NextResponse.json(results);
}
