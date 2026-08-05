import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { fmtDay, isToday, isOverdue } from '@/lib/utils';
import type { Task } from '@/lib/types';
import TaskRow from '@/components/TaskRow';
import NotesPanel from '@/components/NotesPanel';
import {
  CalendarDays, CalendarClock, Inbox, AlertCircle, Flag, CheckCircle2, Pin
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const SMART = [
  { key: 'today', label: 'Bugün', Icon: CalendarDays, color: '#007AFF' },
  { key: 'upcoming', label: 'Yaklaşan', Icon: CalendarClock, color: '#FF9500' },
  { key: 'all', label: 'Tümü', Icon: Inbox, color: '#8E8E93' },
  { key: 'overdue', label: 'Gecikmiş', Icon: AlertCircle, color: '#FF3B30' },
  { key: 'priority', label: 'Öncelikli', Icon: Flag, color: '#FF9500' },
  { key: 'done', label: 'Tamamlanan', Icon: CheckCircle2, color: '#34C759' }
] as const;

export default async function HomePage({
  searchParams
}: { searchParams: { tab?: string } }) {
  const { supabase, profile, companyId } = await getCtx();
  const tab = searchParams.tab ?? 'today';

  // Super admin lands on the company picker until a company is chosen
  if (profile.role === 'super_admin' && !companyId) {
    redirect('/super/companies');
  }

  // --- fetch everything this page needs in ONE parallel round ---
  const [{ data: assigned }, panoRes, { data: notes }] = await Promise.all([
    supabase
      .from('task_assignees')
      .select('task_id, tasks(*, checklist_items(is_done))')
      .eq('user_id', profile.id),
    companyId
      ? supabase
          .from('announcements')
          .select('*')
          .eq('company_id', companyId)
          .is('department_id', null)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(3)
      : Promise.resolve({ data: [] } as any),
    supabase
      .from('notes')
      .select('*')
      .eq('author_id', profile.id)
      .is('task_id', null)
      .order('created_at', { ascending: false })
      .limit(20)
  ]);

  let myTasks: Task[] = (assigned ?? [])
    .map((r: any) => r.tasks)
    .filter(Boolean);

  // checklist progress — embedded in the main query, no extra round-trip
  const progress: Record<string, { done: number; total: number }> = {};
  for (const t of (assigned ?? []).map((r: any) => r.tasks).filter(Boolean)) {
    const items: any[] = (t as any).checklist_items ?? [];
    if (items.length) {
      progress[t.id] = {
        done: items.filter((i: any) => i.is_done).length,
        total: items.length
      };
    }
  }

  const active = (t: Task) => !['completed', 'cancelled'].includes(t.status);
  const matches = (t: Task, key: string) => {
    switch (key) {
      case 'today': return active(t) && isToday(t.due_at);
      case 'upcoming': return active(t) && !!t.due_at && new Date(t.due_at) > new Date() && !isToday(t.due_at);
      case 'overdue': return isOverdue(t.due_at, t.status);
      case 'priority': return active(t) && ['high', 'urgent'].includes(t.priority);
      case 'done': return t.status === 'completed';
      default: return true;
    }
  };
  const counts: Record<string, number> = {};
  for (const s of SMART) counts[s.key] = myTasks.filter(t => matches(t, s.key)).length;

  const filtered = myTasks
    .filter(t => matches(t, tab))
    .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'));

  const activeSmart = SMART.find(s => s.key === tab) ?? SMART[0];
  const pano: any[] = panoRes?.data ?? [];
  const now = new Date();
  const todayDone = myTasks.filter(t => isToday(t.due_at) && t.status === 'completed').length;
  const todayTotal = myTasks.filter(t => isToday(t.due_at)).length;

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      {/* Large title header */}
      <header className="px-1">
        <p className="text-[13px] text-[#8E8E93] capitalize">{fmtDay(now.toISOString())}</p>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          Merhaba, {profile.full_name.split(' ')[0] || 'Hoş geldiniz'}
        </h1>
        {todayTotal > 0 && (
          <p className="text-[15px] text-[#8E8E93] mt-0.5">
            Bugün {todayDone}/{todayTotal} görev tamamlandı
          </p>
        )}
      </header>

      {/* Smart list grid — Apple Reminders style */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {SMART.map(s => (
          <Link
            key={s.key}
            href={`/home?tab=${s.key}`}
            className={`smart-card ${tab === s.key ? 'ring-2' : ''}`}
            style={tab === s.key ? ({ ['--tw-ring-color' as any]: s.color }) : undefined}
          >
            <div className="flex items-center justify-between">
              <span className="smart-icon" style={{ backgroundColor: s.color }}>
                <s.Icon size={17} strokeWidth={2.2} />
              </span>
              <span className="text-[22px] font-bold leading-none">{counts[s.key]}</span>
            </div>
            <p className="text-[15px] font-semibold text-[#8E8E93]">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* Active list */}
      <section>
        <h2 className="section-title" style={{ color: activeSmart.color }}>{activeSmart.label}</h2>
        <div className="card divide-y divide-black/[0.06] overflow-hidden">
          {filtered.length === 0 && (
            <div className="p-10 text-center">
              <p className="text-3xl mb-2">🎉</p>
              <p className="text-[15px] text-[#8E8E93]">
                {tab === 'today' ? 'Bugün için görev yok — harika iş!' : 'Bu listede görev yok.'}
              </p>
            </div>
          )}
          {filtered.map(t => (
            <TaskRow key={t.id} task={t} progress={progress[t.id]} />
          ))}
        </div>
      </section>

      {/* Pano */}
      {pano.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between pr-2">
            <h2 className="section-title">Şirket Panosu</h2>
            <Link href="/announcements" className="text-[13px] text-ios-blue font-medium">Tümü</Link>
          </div>
          <div className="card divide-y divide-black/[0.06] overflow-hidden">
            {pano.map(a => (
              <Link key={a.id} href="/announcements" className="flex items-start gap-3 px-4 py-3 hover:bg-black/[0.02] transition-colors">
                <span className="smart-icon !w-7 !h-7 mt-0.5" style={{ backgroundColor: a.is_pinned ? '#FF9500' : '#8E8E93' }}>
                  {a.is_pinned ? <Pin size={14} /> : <Inbox size={14} />}
                </span>
                <span className="min-w-0">
                  <p className="text-[15px] font-medium truncate">{a.title}</p>
                  <p className="text-[13px] text-[#8E8E93] line-clamp-1">{a.body}</p>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      <NotesPanel notes={(notes ?? []) as any} />
    </main>
  );
}
