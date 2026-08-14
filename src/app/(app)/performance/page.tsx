import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import PrintButton from '@/components/PrintButton';
import { CheckCircle2, Clock, AlertCircle, Inbox } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PERIODS = [
  { key: '1', label: 'Bugün' },
  { key: '7', label: 'Hafta' },
  { key: '30', label: 'Ay' },
  { key: '90', label: 'Çeyrek' },
  { key: 'all', label: 'Tümü' }
] as const;

/** milisaniyeyi insancıl süreye çevir: "2 gün", "3s 20dk", "45dk" */
function fmtDur(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}s ${mins % 60}dk`;
  return `${Math.round(hours / 24)} gün`;
}

interface Bucket { total: number; onTime: number; late: number; missed: number; open: number; }
const emptyBucket = (): Bucket => ({ total: 0, onTime: 0, late: 0, missed: 0, open: 0 });

function classify(t: any, now: number): keyof Omit<Bucket, 'total'> {
  if (t.status === 'completed') {
    if (t.due_at && t.completed_at && new Date(t.completed_at).getTime() > new Date(t.due_at).getTime()) return 'late';
    return 'onTime';
  }
  if (t.due_at && new Date(t.due_at).getTime() < now && !['cancelled'].includes(t.status)) return 'missed';
  return 'open';
}

function add(b: Bucket, k: keyof Omit<Bucket, 'total'>) { b.total++; b[k]++; }

const rate = (b: Bucket) => {
  const done = b.onTime + b.late + b.missed;
  return done ? Math.round((b.onTime / done) * 100) : null;
};

/** Stacked status bar — green/orange/red segments with 2px gaps, gray remainder. */
function StatusBar({ b }: { b: Bucket }) {
  if (!b.total) return <div className="h-[6px] rounded-full bg-white/10" />;
  const seg = (n: number) => `${(n / b.total) * 100}%`;
  return (
    <div className="flex h-[6px] rounded-full overflow-hidden gap-[2px]">
      {b.onTime > 0 && <span style={{ width: seg(b.onTime), backgroundColor: '#34C759' }} />}
      {b.late > 0 && <span style={{ width: seg(b.late), backgroundColor: '#FF9500' }} />}
      {b.missed > 0 && <span style={{ width: seg(b.missed), backgroundColor: '#FF3B30' }} />}
      {b.open > 0 && <span style={{ width: seg(b.open), backgroundColor: 'rgba(255,255,255,0.14)' }} />}
    </div>
  );
}

export default async function PerformancePage({
  searchParams
}: { searchParams: { p?: string } }) {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const period = searchParams.p ?? '30';
  const now = Date.now();
  const since = period === 'all' ? null : new Date(now - Number(period) * 86400000).toISOString();

  const isAdmin = ['super_admin', 'admin'].includes(profile.role);
  const isManager = isAdmin || managedDepartmentIds.length > 0;

  // ---- fetch tasks in scope (RLS already limits visibility; we filter further) ----
  let q = supabase
    .from('tasks')
    .select('id, title, status, due_at, completed_at, created_at, priority, department_id')
    .eq('company_id', companyId)
    .not('due_at', 'is', null);
  if (since) q = q.gte('due_at', since);
  if (!isAdmin && isManager) q = q.in('department_id', managedDepartmentIds);
  const { data: allTasks } = isManager
    ? await q
    : await supabase
        .from('task_assignees')
        .select('tasks!inner(id, title, status, due_at, completed_at, created_at, priority, department_id)')
        .eq('user_id', profile.id)
        .then(r => ({ data: (r.data ?? []).map((x: any) => x.tasks).filter((t: any) => t.due_at && (!since || t.due_at >= since)) }));

  const tasks = (allTasks ?? []) as any[];
  const taskIds = tasks.map(t => t.id);

  // overall bucket
  const overall = emptyBucket();
  for (const t of tasks) add(overall, classify(t, now));

  // ---- önceki dönem kıyası (aynı uzunlukta bir önceki pencere) ----
  let prevRateVal: number | null = null;
  if (since && isManager) {
    const days = Number(period);
    const prevSince = new Date(now - 2 * days * 86400000).toISOString();
    let pq = supabase.from('tasks')
      .select('status, due_at, completed_at')
      .eq('company_id', companyId)
      .not('due_at', 'is', null)
      .gte('due_at', prevSince).lt('due_at', since);
    if (!isAdmin) pq = pq.in('department_id', managedDepartmentIds);
    const { data: prevTasks } = await pq;
    const pb = emptyBucket();
    for (const t of prevTasks ?? []) add(pb, classify(t, now));
    prevRateVal = rate(pb);
  }

  // ---- ek KPI'lar: ortalama gecikme + ortalama tamamlama süresi + acil görev başarımı ----
  const lateDone = tasks.filter(t => t.status === 'completed' && t.due_at && t.completed_at &&
    new Date(t.completed_at) > new Date(t.due_at));
  const avgDelay = lateDone.length
    ? lateDone.reduce((a, t) => a + (new Date(t.completed_at).getTime() - new Date(t.due_at).getTime()), 0) / lateDone.length
    : 0;
  const doneAll = tasks.filter(t => t.status === 'completed' && t.completed_at && t.created_at);
  const avgCompletion = doneAll.length
    ? doneAll.reduce((a, t) => a + (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()), 0) / doneAll.length
    : 0;
  const urgentBucket = emptyBucket();
  for (const t of tasks.filter(t => ['high', 'urgent'].includes(t.priority))) add(urgentBucket, classify(t, now));
  const urgentRate = rate(urgentBucket);

  // ---- per person / per department (managers & admins) ----
  let perPerson: { name: string; b: Bucket; leaveDays: number }[] = [];
  let perDept: { name: string; b: Bucket }[] = [];
  if (isManager && taskIds.length) {
    const sinceDate = (since ?? new Date(now - 365 * 86400000).toISOString()).slice(0, 10);
    const [{ data: asg }, { data: depts }, { data: leaves }] = await Promise.all([
      supabase
        .from('task_assignees')
        .select('task_id, user_id, profiles:user_id(full_name)')
        .in('task_id', taskIds),
      supabase.from('departments').select('id, name').eq('company_id', companyId),
      // dönem içindeki onaylı izinler → adil performans okuması
      supabase.from('leave_requests')
        .select('user_id, start_date, end_date')
        .eq('company_id', companyId).eq('status', 'approved')
        .gte('end_date', sinceDate)
    ]);
    // kişi başına dönem içindeki izin günü sayısı
    const leaveByUser: Record<string, number> = {};
    const winStart = new Date(sinceDate + 'T00:00:00Z').getTime();
    for (const l of leaves ?? []) {
      const s = Math.max(new Date(l.start_date + 'T00:00:00Z').getTime(), winStart);
      const e = Math.min(new Date(l.end_date + 'T00:00:00Z').getTime(), now);
      if (e >= s) leaveByUser[l.user_id] = (leaveByUser[l.user_id] ?? 0) + Math.floor((e - s) / 86400000) + 1;
    }
    const byUser: Record<string, { name: string; b: Bucket; leaveDays: number }> = {};
    const taskMap: Record<string, any> = {};
    for (const t of tasks) taskMap[t.id] = t;
    for (const a of asg ?? []) {
      const t = taskMap[a.task_id];
      if (!t) continue;
      const name = (a as any).profiles?.full_name ?? 'Kullanıcı';
      const u = (byUser[a.user_id] ??= { name, b: emptyBucket(), leaveDays: leaveByUser[a.user_id] ?? 0 });
      add(u.b, classify(t, now));
    }
    perPerson = Object.values(byUser).sort((a, b) => (rate(b.b) ?? -1) - (rate(a.b) ?? -1));

    if (isAdmin) {
      const dName: Record<string, string> = {};
      for (const d of depts ?? []) dName[d.id] = d.name;
      const byDept: Record<string, { name: string; b: Bucket }> = {};
      for (const t of tasks) {
        if (!t.department_id || !dName[t.department_id]) continue;
        const d = (byDept[t.department_id] ??= { name: dName[t.department_id], b: emptyBucket() });
        add(d.b, classify(t, now));
      }
      perDept = Object.values(byDept).sort((a, b) => (rate(b.b) ?? -1) - (rate(a.b) ?? -1));
    }
  }

  const overallRate = rate(overall);

  // ---- 8 haftalık eğilim (tamamlanan görevler / hafta) ----
  let trend: { label: string; done: number; late: number }[] = [];
  if (isManager) {
    const eightWeeksAgo = new Date(now - 8 * 7 * 86400000).toISOString();
    let tq = supabase.from('tasks')
      .select('completed_at, due_at')
      .eq('company_id', companyId)
      .eq('status', 'completed')
      .gte('completed_at', eightWeeksAgo);
    if (!isAdmin) tq = tq.in('department_id', managedDepartmentIds);
    const { data: doneTasks } = await tq;
    const weeks: { start: Date; done: number; late: number }[] = [];
    const monday = (d: Date) => {
      const x = new Date(d);
      x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
      x.setUTCHours(0, 0, 0, 0);
      return x;
    };
    const w0 = monday(new Date(now - 7 * 7 * 86400000));
    for (let i = 0; i < 8; i++) weeks.push({ start: new Date(w0.getTime() + i * 7 * 86400000), done: 0, late: 0 });
    for (const t of doneTasks ?? []) {
      const ts = new Date(t.completed_at).getTime();
      const idx = Math.floor((ts - w0.getTime()) / (7 * 86400000));
      if (idx >= 0 && idx < 8) {
        weeks[idx].done++;
        if (t.due_at && ts > new Date(t.due_at).getTime()) weeks[idx].late++;
      }
    }
    trend = weeks.map(w => ({
      label: w.start.toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'short' }),
      done: w.done, late: w.late
    }));
  }
  const trendMax = Math.max(1, ...trend.map(t => t.done));

  // ---- PDF tablo verisi ----
  const periodLabel = period === 'all' ? 'Tüm zamanlar' : `Son ${period} gün`;
  const printTable = {
    title: 'Performans Raporu',
    subtitle: `${periodLabel} · Zamanında tamamlama: ${overallRate === null ? '—' : `%${overallRate}`}`,
    landscape: false,
    headers: ['Kişi', 'Görev', 'Zamanında', 'Geç', 'Kaçırılan', 'Bekleyen', 'İzin (gün)', 'Oran'],
    rows: perPerson.map(p => [
      p.name, String(p.b.total), String(p.b.onTime), String(p.b.late),
      String(p.b.missed), String(p.b.open), p.leaveDays ? String(p.leaveDays) : '—',
      rate(p.b) === null ? '—' : `%${rate(p.b)}`
    ])
  };

  // latest weekly AI report (RLS: managers & admins only)
  let aiReport: { content: string; week_start: string } | null = null;
  if (isManager) {
    const { data } = await supabase
      .from('ai_reports')
      .select('content, week_start')
      .eq('company_id', companyId)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle();
    aiReport = data ?? null;
  }

  const TILES = [
    { label: 'Zamanında', value: overall.onTime, Icon: CheckCircle2, color: '#34C759' },
    { label: 'Geç tamamlanan', value: overall.late, Icon: Clock, color: '#FF9500' },
    { label: 'Kaçırılan', value: overall.missed, Icon: AlertCircle, color: '#FF3B30' },
    { label: 'Bekleyen', value: overall.open, Icon: Inbox, color: '#8E8E93' }
  ];

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <header className="px-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Performans</h1>
          <p className="text-[14px] text-[#8E8E93] mt-0.5">
            {isAdmin ? 'Tüm şirket' : isManager ? 'Departmanlarınız' : 'Kişisel performansınız'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="segment !w-auto">
            {PERIODS.map(p => (
              <Link key={p.key} href={`/performance?p=${p.key}`}
                className={`segment-item !px-4 ${period === p.key ? 'segment-item-active' : ''}`}>
                {p.label}
              </Link>
            ))}
          </div>
          {isManager && perPerson.length > 0 && <PrintButton table={printTable} label="PDF" />}
        </div>
      </header>

      {/* Weekly AI report */}
      {aiReport && (
        <section>
          <h2 className="section-title" style={{ color: '#5E5CE6' }}>🤖 Haftalık AI Raporu</h2>
          <div className="card p-5 border border-[#5E5CE6]/40 bg-gradient-to-br from-[#5E5CE6]/[0.18] to-[#AF52DE]/[0.18]">
            <p className="text-[12px] text-[#8E8E93] mb-2">
              {new Date(aiReport.week_start).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })} haftası
            </p>
            <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap">{aiReport.content}</p>
          </div>
        </section>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {TILES.map(t => (
          <div key={t.label} className="smart-card">
            <div className="flex items-center justify-between">
              <span className="smart-icon" style={{ backgroundColor: t.color }}>
                <t.Icon size={17} strokeWidth={2.2} />
              </span>
              <span className="text-[22px] font-bold leading-none">{t.value}</span>
            </div>
            <p className="text-[13px] font-semibold text-[#8E8E93]">{t.label}</p>
          </div>
        ))}
      </div>

      {/* Ek KPI'lar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="smart-card">
          <p className="text-[20px] font-bold leading-tight">{fmtDur(avgDelay)}</p>
          <p className="text-[12px] font-semibold text-[#8E8E93]">Ort. gecikme (geç kalanlarda)</p>
        </div>
        <div className="smart-card">
          <p className="text-[20px] font-bold leading-tight">{fmtDur(avgCompletion)}</p>
          <p className="text-[12px] font-semibold text-[#8E8E93]">Ort. tamamlama süresi</p>
        </div>
        <div className="smart-card col-span-2 sm:col-span-1">
          <p className="text-[20px] font-bold leading-tight">
            {urgentRate === null ? '—' : `%${urgentRate}`}
            <span className="text-[12px] text-[#8E8E93] font-normal ml-1">({urgentBucket.total} görev)</span>
          </p>
          <p className="text-[12px] font-semibold text-[#8E8E93]">⚡ Acil & Yüksek öncelik başarımı</p>
        </div>
      </div>

      {/* Overall rate */}
      <section>
        <h2 className="section-title">Zamanında Tamamlama Oranı</h2>
        <div className="card p-5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[40px] font-bold leading-none">
              {overallRate === null ? '—' : `%${overallRate}`}
            </span>
            {prevRateVal !== null && overallRate !== null && (
              <span className={`text-[14px] font-semibold ${
                overallRate >= prevRateVal ? 'text-emerald-300' : 'text-rose-300'}`}>
                {overallRate >= prevRateVal ? '▲' : '▼'} {Math.abs(overallRate - prevRateVal)} puan
                <span className="text-[#8E8E93] font-normal"> (önceki dönem %{prevRateVal})</span>
              </span>
            )}
            <span className="text-[13px] text-[#8E8E93]">
              {overall.total} görev · {period === 'all' ? 'tüm zamanlar' : period === '1' ? 'bugün' : `son ${period} gün`}
            </span>
          </div>
          <div className="mt-4"><StatusBar b={overall} /></div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[12px] text-[#8E8E93]">
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#34C759' }} /> Zamanında {overall.onTime}</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#FF9500' }} /> Geç {overall.late}</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: '#FF3B30' }} /> Kaçırılan {overall.missed}</span>
            <span className="flex items-center gap-1.5"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: 'rgba(255,255,255,0.28)' }} /> Bekleyen {overall.open}</span>
          </div>
        </div>
      </section>

      {/* 8 haftalık eğilim */}
      {isManager && trend.some(t => t.done > 0) && (
        <section>
          <h2 className="section-title">Haftalık Eğilim — tamamlanan görevler</h2>
          <div className="card p-5">
            <div className="flex items-end gap-2 h-32">
              {trend.map((w, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <span className="text-[11px] text-[#D1D1D6] font-semibold">{w.done || ''}</span>
                  <div className="w-full max-w-[34px] rounded-t-md overflow-hidden flex flex-col justify-end"
                    style={{ height: `${(w.done / trendMax) * 100}%`, minHeight: w.done ? 6 : 2 }}>
                    {w.late > 0 && (
                      <div style={{ height: `${(w.late / Math.max(w.done, 1)) * 100}%`, backgroundColor: '#FF9500' }} />
                    )}
                    <div className="flex-1" style={{ backgroundColor: w.done ? '#34C759' : 'rgba(255,255,255,0.10)' }} />
                  </div>
                  <span className="text-[10px] text-[#8E8E93] truncate w-full text-center">{w.label}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#8E8E93] mt-3">
              <span className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style={{ background: '#34C759' }} /> zamanında ·{' '}
              <span className="inline-block w-2.5 h-2.5 rounded-sm align-middle mr-1" style={{ background: '#FF9500' }} /> geç tamamlanan
            </p>
          </div>
        </section>
      )}

      {/* Per person — çok kolonlu tablo */}
      {isManager && perPerson.length > 0 && (
        <section>
          <h2 className="section-title">Kişi Bazında Sıralama</h2>
          <div className="card overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] uppercase tracking-wide text-[#8E8E93]">
                  <th className="text-left px-4 py-2.5 font-semibold">Kişi</th>
                  <th className="text-center px-2 py-2.5 font-semibold">Görev</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-emerald-300">Zamanında</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-amber-300">Geç</th>
                  <th className="text-center px-2 py-2.5 font-semibold text-rose-300">Kaçırılan</th>
                  <th className="text-center px-2 py-2.5 font-semibold">Bekleyen</th>
                  <th className="text-center px-2 py-2.5 font-semibold">🏖 İzin</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Oran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {perPerson.map((p, idx) => {
                  const r = rate(p.b);
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                  return (
                    <tr key={`${p.name}-${idx}`} className="hover:bg-white/[0.03]">
                      <td className="px-4 py-2.5">
                        <p className="font-medium truncate max-w-[180px]">
                          {medal && <span className="mr-1">{medal}</span>}{p.name}
                        </p>
                        <div className="mt-1 max-w-[180px]"><StatusBar b={p.b} /></div>
                      </td>
                      <td className="text-center px-2 py-2.5 font-semibold">{p.b.total}</td>
                      <td className="text-center px-2 py-2.5 text-emerald-300">{p.b.onTime}</td>
                      <td className="text-center px-2 py-2.5 text-amber-300">{p.b.late}</td>
                      <td className="text-center px-2 py-2.5 text-rose-300">{p.b.missed}</td>
                      <td className="text-center px-2 py-2.5 text-[#8E8E93]">{p.b.open}</td>
                      <td className="text-center px-2 py-2.5 text-[#8E8E93]">
                        {p.leaveDays ? `${p.leaveDays}g` : '—'}
                      </td>
                      <td className="text-right px-4 py-2.5 font-bold text-[15px]">
                        {r === null ? <span className="text-[#AEAEB2] font-normal">—</span> : `%${r}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[#AEAEB2] mt-1.5 px-1">
            🏖 İzin kolonu dönem içindeki onaylı izin günleridir — performansı değerlendirirken göz önünde bulundurun.
          </p>
        </section>
      )}

      {/* Per department */}
      {isAdmin && perDept.length > 0 && (
        <section>
          <h2 className="section-title">Departman Bazında</h2>
          <div className="card divide-y divide-white/[0.08] overflow-hidden">
            {perDept.map((d, idx) => {
              const r = rate(d.b);
              const delta = r !== null && overallRate !== null ? r - overallRate : null;
              return (
                <div key={d.name} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <p className="text-[15px] font-medium truncate">
                      {idx === 0 && perDept.length > 1 ? '⭐ ' : ''}{d.name}
                    </p>
                    <p className="text-[14px] font-semibold shrink-0">
                      {r === null ? <span className="text-[#AEAEB2]">—</span> : `%${r}`}
                      {delta !== null && delta !== 0 && (
                        <span className={`text-[12px] ml-1 ${delta > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                          ({delta > 0 ? '+' : ''}{delta})
                        </span>
                      )}
                      <span className="text-[12px] text-[#8E8E93] font-normal ml-1.5">{d.b.total} görev</span>
                    </p>
                  </div>
                  <StatusBar b={d.b} />
                </div>
              );
            })}
            {overallRate !== null && (
              <p className="px-4 py-2 text-[11px] text-[#AEAEB2]">
                Parantez içi değerler şirket ortalamasına (%{overallRate}) göre farktır; ⭐ en iyi departman.
              </p>
            )}
          </div>
        </section>
      )}

      {tasks.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-[15px] text-[#8E8E93]">Bu dönemde veri yok. Dönemi genişletmeyi deneyin.</p>
        </div>
      )}
    </main>
  );
}
