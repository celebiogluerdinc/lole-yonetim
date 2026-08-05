import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { CheckCircle2, Clock, AlertCircle, Inbox } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PERIODS = [
  { key: '7', label: 'Hafta' },
  { key: '30', label: 'Ay' },
  { key: 'all', label: 'Tümü' }
] as const;

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
  if (!b.total) return <div className="h-[6px] rounded-full bg-[#1C1C1E]/[0.10]" />;
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
    .select('id, title, status, due_at, completed_at, department_id')
    .eq('company_id', companyId)
    .not('due_at', 'is', null);
  if (since) q = q.gte('due_at', since);
  if (!isAdmin && isManager) q = q.in('department_id', managedDepartmentIds);
  const { data: allTasks } = isManager
    ? await q
    : await supabase
        .from('task_assignees')
        .select('tasks!inner(id, title, status, due_at, completed_at, department_id)')
        .eq('user_id', profile.id)
        .then(r => ({ data: (r.data ?? []).map((x: any) => x.tasks).filter((t: any) => t.due_at && (!since || t.due_at >= since)) }));

  const tasks = (allTasks ?? []) as any[];
  const taskIds = tasks.map(t => t.id);

  // overall bucket
  const overall = emptyBucket();
  for (const t of tasks) add(overall, classify(t, now));

  // ---- per person / per department (managers & admins) ----
  let perPerson: { name: string; b: Bucket }[] = [];
  let perDept: { name: string; b: Bucket }[] = [];
  if (isManager && taskIds.length) {
    const [{ data: asg }, { data: depts }] = await Promise.all([
      supabase
        .from('task_assignees')
        .select('task_id, user_id, profiles:user_id(full_name)')
        .in('task_id', taskIds),
      supabase.from('departments').select('id, name').eq('company_id', companyId)
    ]);
    const byUser: Record<string, { name: string; b: Bucket }> = {};
    const taskMap: Record<string, any> = {};
    for (const t of tasks) taskMap[t.id] = t;
    for (const a of asg ?? []) {
      const t = taskMap[a.task_id];
      if (!t) continue;
      const name = (a as any).profiles?.full_name ?? 'Kullanıcı';
      const u = (byUser[a.user_id] ??= { name, b: emptyBucket() });
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
        <div className="segment !w-auto shrink-0">
          {PERIODS.map(p => (
            <Link key={p.key} href={`/performance?p=${p.key}`}
              className={`segment-item !px-4 ${period === p.key ? 'segment-item-active' : ''}`}>
              {p.label}
            </Link>
          ))}
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

      {/* Overall rate */}
      <section>
        <h2 className="section-title">Zamanında Tamamlama Oranı</h2>
        <div className="card p-5">
          <div className="flex items-baseline gap-2">
            <span className="text-[40px] font-bold leading-none">
              {overallRate === null ? '—' : `%${overallRate}`}
            </span>
            <span className="text-[13px] text-[#8E8E93]">
              {overall.total} görev · son {period === 'all' ? 'tüm zamanlar' : `${period} gün`}
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

      {/* Per person */}
      {isManager && perPerson.length > 0 && (
        <section>
          <h2 className="section-title">Kişi Bazında</h2>
          <div className="card divide-y divide-white/[0.08] overflow-hidden">
            {perPerson.map(p => {
              const r = rate(p.b);
              return (
                <div key={p.name} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <p className="text-[15px] font-medium truncate">{p.name}</p>
                    <p className="text-[14px] font-semibold shrink-0">
                      {r === null ? <span className="text-[#AEAEB2]">—</span> : `%${r}`}
                      <span className="text-[12px] text-[#8E8E93] font-normal ml-1.5">{p.b.total} görev</span>
                    </p>
                  </div>
                  <StatusBar b={p.b} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Per department */}
      {isAdmin && perDept.length > 0 && (
        <section>
          <h2 className="section-title">Departman Bazında</h2>
          <div className="card divide-y divide-white/[0.08] overflow-hidden">
            {perDept.map(d => {
              const r = rate(d.b);
              return (
                <div key={d.name} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <p className="text-[15px] font-medium truncate">{d.name}</p>
                    <p className="text-[14px] font-semibold shrink-0">
                      {r === null ? <span className="text-[#AEAEB2]">—</span> : `%${r}`}
                      <span className="text-[12px] text-[#8E8E93] font-normal ml-1.5">{d.b.total} görev</span>
                    </p>
                  </div>
                  <StatusBar b={d.b} />
                </div>
              );
            })}
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
