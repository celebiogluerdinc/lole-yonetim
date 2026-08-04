import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { fmtDate, TZ, STATUS_COLOR, STATUS_LABEL } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function CalendarPage({
  searchParams
}: { searchParams: { m?: string; scope?: string } }) {
  const { supabase, profile, managedDepartmentIds } = await getCtx();

  const now = new Date();
  const [y, m] = (searchParams.m ?? `${now.getFullYear()}-${now.getMonth() + 1}`)
    .split('-').map(Number);
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 1));
  const prev = `${m === 1 ? y - 1 : y}-${m === 1 ? 12 : m - 1}`;
  const next = `${m === 12 ? y + 1 : y}-${m === 12 ? 1 : m + 1}`;

  const isManager = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
  const scope = isManager && searchParams.scope === 'team' ? 'team' : 'mine';

  let tasks: any[] = [];
  if (scope === 'mine') {
    const { data } = await supabase
      .from('task_assignees')
      .select('tasks(*)')
      .eq('user_id', profile.id);
    tasks = (data ?? []).map((r: any) => r.tasks).filter(Boolean);
  } else {
    const { data } = await supabase.from('tasks').select('*');
    tasks = data ?? [];
  }
  tasks = tasks
    .filter(t => t.due_at && new Date(t.due_at) >= monthStart && new Date(t.due_at) < monthEnd)
    .sort((a, b) => a.due_at.localeCompare(b.due_at));

  // group by day
  const byDay: Record<string, any[]> = {};
  for (const t of tasks) {
    const key = new Date(t.due_at).toLocaleDateString('tr-TR', {
      timeZone: TZ, day: 'numeric', month: 'long', weekday: 'long'
    });
    (byDay[key] ??= []).push(t);
  }

  const monthLabel = monthStart.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Takvim</h1>
        <div className="flex items-center gap-1">
          <Link href={`/calendar?m=${prev}&scope=${scope}`} className="btn-ghost !px-2"><ChevronLeft size={18} /></Link>
          <span className="text-sm font-medium min-w-[130px] text-center capitalize">{monthLabel}</span>
          <Link href={`/calendar?m=${next}&scope=${scope}`} className="btn-ghost !px-2"><ChevronRight size={18} /></Link>
        </div>
      </div>

      {isManager && (
        <div className="flex gap-1.5 mb-5">
          <Link href={`/calendar?m=${y}-${m}&scope=mine`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${scope === 'mine' ? 'bg-ios-blue text-white' : 'bg-white text-[#3a3a3c]'}`}>
            Benim ajandam
          </Link>
          <Link href={`/calendar?m=${y}-${m}&scope=team`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${scope === 'team' ? 'bg-ios-blue text-white' : 'bg-white text-[#3a3a3c]'}`}>
            Ekip takvimi
          </Link>
        </div>
      )}

      {Object.keys(byDay).length === 0 && (
        <div className="card p-10 text-center text-sm text-[#8E8E93]">Bu ay planlanmış görev yok.</div>
      )}

      <div className="space-y-5">
        {Object.entries(byDay).map(([day, list]) => (
          <section key={day}>
            <h2 className="text-sm font-semibold text-[#8E8E93] mb-2 capitalize">{day}</h2>
            <div className="card divide-y divide-slate-100">
              {list.map(t => (
                <Link key={t.id} href={`/tasks/${t.id}`}
                  className="flex items-center gap-3 p-3.5 hover:bg-slate-50 transition-colors">
                  <span className="text-xs font-semibold text-ios-blue w-12 shrink-0">
                    {new Date(t.due_at).toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className={`flex-1 text-sm truncate ${t.status === 'completed' ? 'line-through text-[#AEAEB2]' : ''}`}>
                    {t.title}
                  </span>
                  <span className={`badge ${STATUS_COLOR[t.status as keyof typeof STATUS_COLOR]}`}>
                    {STATUS_LABEL[t.status as keyof typeof STATUS_LABEL]}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
