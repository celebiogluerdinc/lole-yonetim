import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { fmtDay, isToday, isOverdue } from '@/lib/utils';
import type { Task } from '@/lib/types';
import TaskRow from '@/components/TaskRow';
import NotesPanel from '@/components/NotesPanel';
import { Pin } from 'lucide-react';

export const dynamic = 'force-dynamic';

const TABS = [
  { key: 'today', label: 'Bugün' },
  { key: 'upcoming', label: 'Yaklaşan' },
  { key: 'overdue', label: 'Gecikmiş' },
  { key: 'priority', label: 'Öncelikli' },
  { key: 'done', label: 'Tamamlanan' },
  { key: 'all', label: 'Tümü' }
] as const;

export default async function HomePage({
  searchParams
}: { searchParams: { tab?: string } }) {
  const { supabase, profile, companyId } = await getCtx();
  const tab = searchParams.tab ?? 'today';

  // --- my assigned tasks ---
  const { data: assigned } = await supabase
    .from('task_assignees')
    .select('task_id, tasks(*)')
    .eq('user_id', profile.id);

  let myTasks: Task[] = (assigned ?? [])
    .map((r: any) => r.tasks)
    .filter(Boolean);

  // checklist progress
  const taskIds = myTasks.map(t => t.id);
  const progress: Record<string, { done: number; total: number }> = {};
  if (taskIds.length) {
    const { data: items } = await supabase
      .from('checklist_items')
      .select('task_id, is_done')
      .in('task_id', taskIds);
    for (const it of items ?? []) {
      const p = (progress[it.task_id] ??= { done: 0, total: 0 });
      p.total++;
      if (it.is_done) p.done++;
    }
  }

  const active = (t: Task) => !['completed', 'cancelled'].includes(t.status);
  const filtered = myTasks.filter(t => {
    switch (tab) {
      case 'today': return active(t) && isToday(t.due_at);
      case 'upcoming': return active(t) && !!t.due_at && new Date(t.due_at) > new Date() && !isToday(t.due_at);
      case 'overdue': return isOverdue(t.due_at, t.status);
      case 'priority': return active(t) && ['high', 'urgent'].includes(t.priority);
      case 'done': return t.status === 'completed';
      default: return true;
    }
  }).sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'));

  const todayTotal = myTasks.filter(t => isToday(t.due_at)).length;
  const todayDone = myTasks.filter(t => isToday(t.due_at) && t.status === 'completed').length;

  // --- pano (company-wide announcements) ---
  let pano: any[] = [];
  if (companyId) {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .eq('company_id', companyId)
      .is('department_id', null)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3);
    pano = data ?? [];
  }

  // --- personal notes ---
  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .eq('author_id', profile.id)
    .is('task_id', null)
    .order('created_at', { ascending: false })
    .limit(20);

  const now = new Date();

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <header>
        <p className="text-sm text-slate-500">{fmtDay(now.toISOString())}</p>
        <h1 className="text-2xl font-bold tracking-tight mt-0.5">
          Merhaba, {profile.full_name.split(' ')[0] || 'Hoş geldiniz'} 👋
        </h1>
        {todayTotal > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Bugünün ilerlemesi</span>
              <span className="font-medium">{todayDone}/{todayTotal} tamamlandı</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${todayTotal ? (todayDone / todayTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Pano */}
      {pano.length > 0 && (
        <section className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-slate-700">📌 Şirket Panosu</h2>
            <Link href="/announcements" className="text-xs text-brand-600 font-medium">Tümü →</Link>
          </div>
          <div className="space-y-3">
            {pano.map(a => (
              <Link key={a.id} href="/announcements" className="block group">
                <div className="flex items-start gap-2">
                  {a.is_pinned && <Pin size={14} className="text-brand-500 mt-1 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium group-hover:text-brand-600 transition-colors">{a.title}</p>
                    <p className="text-xs text-slate-500 line-clamp-1">{a.body}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {TABS.map(t => (
          <Link
            key={t.key}
            href={`/home?tab=${t.key}`}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Task list */}
      <section className="card divide-y divide-slate-100">
        {filtered.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-sm text-slate-500">
              {tab === 'today' ? 'Bugün için görev yok — harika iş!' : 'Bu görünümde görev yok.'}
            </p>
          </div>
        )}
        {filtered.map(t => (
          <TaskRow key={t.id} task={t} progress={progress[t.id]} />
        ))}
      </section>

      {/* Notes */}
      <NotesPanel notes={(notes ?? []) as any} />
    </main>
  );
}
