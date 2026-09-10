import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { aiEnabled, writeRiskSummary, logRun } from '@/lib/ai';
import { pushToUsers } from '@/lib/push';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Gecikme Riski Ajanı — pg_cron ile her sabah çağrılır.
 * Süresi geçmiş + 24 saat içinde bitmesi gereken açık görevleri toplar,
 * şirket başına yönetici/müdürlere TEK özet bildirim gönderir.
 * ANTHROPIC_API_KEY varsa özet AI diliyle yazılır; yoksa deterministik özet gider.
 */
export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = supabaseAdmin();
  const now = Date.now();
  const in24h = new Date(now + 24 * 3600 * 1000).toISOString();

  // ---- günlük bakım: 16 saatten uzun süredir açık kalan mesaileri otomatik kapat ----
  const cutoff = new Date(now - 16 * 3600 * 1000).toISOString();
  const { data: staleEntries } = await admin
    .from('time_entries')
    .select('id, user_id, company_id, clock_in')
    .is('clock_out', null)
    .lt('clock_in', cutoff)
    .limit(200);
  if (staleEntries?.length) {
    await admin.from('time_entries')
      .update({ clock_out: new Date().toISOString(), note: 'Sistem: çıkış unutuldu, otomatik kapatıldı' })
      .in('id', staleEntries.map((e: any) => e.id));
    await admin.from('notifications').insert(staleEntries.map((e: any) => ({
      company_id: e.company_id, user_id: e.user_id, type: 'custom',
      payload: {
        title: '⏱ Mesainiz otomatik kapatıldı',
        body: 'Çıkış yapmayı unuttuğunuz için açık mesainiz sistem tarafından kapatıldı. Hatalıysa yöneticinize bildirin.',
        url: '/clock'
      }
    })));
  }

  const { data: companies } = await admin
    .from('companies').select('id, name').eq('is_active', true);

  const results: Record<string, string> = {};

  for (const c of companies ?? []) {
    const { data: risky } = await admin
      .from('tasks')
      .select('id, title, due_at, priority, status, task_assignees(profiles:user_id(full_name))')
      .eq('company_id', c.id)
      .not('status', 'in', '("completed","cancelled")')
      .not('due_at', 'is', null)
      .lt('due_at', in24h)
      .order('due_at')
      .limit(40);
    if (!risky?.length) { results[c.name] = 'risk yok'; continue; }

    const items: any[] = risky.map((t: any) => ({
      gorev: t.title,
      durum: new Date(t.due_at).getTime() < now ? 'GECİKMİŞ' : '24 saat içinde',
      bitis: new Date(t.due_at).toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
      }),
      oncelik: t.priority,
      atananlar: (t.task_assignees ?? []).map((a: any) => a.profiles?.full_name).filter(Boolean)
    }));
    const overdueCount = items.filter((i: any) => i.durum === 'GECİKMİŞ').length;
    const soonCount = items.length - overdueCount;

    // özet metni: AI varsa akıllı anlatım, yoksa deterministik
    let body = `${overdueCount} gecikmiş, ${soonCount} bugün bitmesi gereken görev var. ` +
      items.slice(0, 3).map((i: any) => `• ${i.gorev} (${i.atananlar.join(', ') || 'atanmamış'}) — ${i.bitis}`).join(' ');
    if (aiEnabled()) {
      try {
        const res = await writeRiskSummary(c.name, items);
        if (res.text) body = res.text;
        await logRun({
          companyId: c.id, agent: 'performance_analyst', trigger: 'cron',
          input: { risk_count: items.length }, output: { text: res.text.slice(0, 400) },
          inputTokens: res.inputTokens, outputTokens: res.outputTokens
        });
      } catch { /* deterministik özetle devam */ }
    }

    // hedefler: şirket adminleri + tüm departman müdürleri
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
        company_id: c.id, user_id, type: 'custom',
        payload: {
          title: `⚠️ Gecikme riski: ${overdueCount + soonCount} görev`,
          body: body.slice(0, 400),
          url: '/manage/tasks?f=overdue'
        }
      })));
      pushToUsers(targets, {
        title: `⚠️ Gecikme riski: ${overdueCount + soonCount} görev`,
        body: body.slice(0, 140),
        url: '/manage/tasks?f=overdue'
      }).catch(() => {});
    }
    results[c.name] = `${items.length} riskli görev bildirildi`;
  }

  return NextResponse.json({ ok: true, results });
}
