import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { isToday, isOverdue, ROLE_LABEL, TZ } from '@/lib/utils';
import type { Task } from '@/lib/types';
import TaskRow from '@/components/TaskRow';
import NotesPanel from '@/components/NotesPanel';
import PushSetup from '@/components/PushSetup';
import LiveClock from '@/components/LiveClock';
import AutoRefresh from '@/components/AutoRefresh';
import {
  CalendarDays, CalendarClock, Inbox, AlertCircle, Flag, CheckCircle2, Pin,
  ShieldQuestion, OctagonAlert, ChevronRight, Users2
} from 'lucide-react';

const AVATAR_COLORS = ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF453A', '#5E5CE6', '#64D2FF'];
const colorFor = (s: string) =>
  AVATAR_COLORS[s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

function chatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date().toLocaleDateString('tr-TR', { timeZone: TZ });
  if (d.toLocaleDateString('tr-TR', { timeZone: TZ }) === today) {
    return d.toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('tr-TR', { timeZone: TZ, day: 'numeric', month: 'short' });
}

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
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  const tab = searchParams.tab ?? 'today';

  // Super admin lands on the company picker until a company is chosen
  if (profile.role === 'super_admin' && !companyId) {
    redirect('/super/companies');
  }

  const isManager = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;

  // --- fetch everything this page needs in ONE parallel round ---
  const [{ data: assigned }, panoRes, { data: notes }, flowRes, convRes] = await Promise.all([
    supabase
      .from('task_assignees')
      .select('task_id, tasks(*, checklist_items(is_done))')
      .eq('user_id', profile.id),
    companyId
      ? supabase
          .from('announcements')
          .select('*, departments:department_id(name)')
          .eq('company_id', companyId)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] } as any),
    supabase
      .from('notes')
      .select('*')
      .eq('author_id', profile.id)
      .is('task_id', null)
      .order('created_at', { ascending: false })
      .limit(20),
    isManager && companyId
      ? supabase
          .from('tasks')
          .select('id, title, status, due_at, priority, task_assignees(profiles:user_id(full_name))')
          .eq('company_id', companyId)
          .not('status', 'in', '("completed","cancelled")')
          .order('due_at', { ascending: true, nullsFirst: false })
          .limit(200)
      : Promise.resolve({ data: null } as any),
    companyId
      ? supabase
          .from('conversation_members')
          .select('conversation_id, last_read_at, conversations!inner(id, type, name, company_id)')
          .eq('user_id', profile.id)
          .eq('conversations.company_id', companyId)
      : Promise.resolve({ data: [] } as any)
  ]);

  // --- team workflow summary (managers) ---
  const flowTasks: any[] = flowRes?.data ?? [];
  const effStatus = (t: any) => {
    if (['pending_review', 'blocked'].includes(t.status)) return t.status;
    if (t.due_at && new Date(t.due_at).getTime() < Date.now()) return 'overdue';
    return t.status;
  };
  const flowCounts = { active: flowTasks.length, pending_review: 0, blocked: 0, overdue: 0 };
  for (const t of flowTasks) {
    const e = effStatus(t);
    if (e === 'pending_review') flowCounts.pending_review++;
    else if (e === 'blocked') flowCounts.blocked++;
    else if (e === 'overdue') flowCounts.overdue++;
  }
  const attention = flowTasks
    .map(t => ({ ...t, eff: effStatus(t) }))
    .filter(t => ['overdue', 'pending_review', 'blocked'].includes(t.eff))
    .slice(0, 6);

  // --- recent conversations (top 3, with unread counts) ---
  const convMemberships: any[] = convRes?.data ?? [];
  const convIds = convMemberships.map((m: any) => m.conversation_id);
  let chats: any[] = [];
  if (convIds.length) {
    const [{ data: allMembers }, { data: msgs }] = await Promise.all([
      supabase
        .from('conversation_members')
        .select('conversation_id, user_id, profiles:user_id(full_name)')
        .in('conversation_id', convIds),
      supabase
        .from('messages')
        .select('conversation_id, sender_id, body, created_at')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
        .limit(120)
    ]);
    chats = convMemberships.map((m: any) => {
      const conv = m.conversations;
      const members = (allMembers ?? []).filter((x: any) => x.conversation_id === conv.id);
      const others = members.filter((x: any) => x.user_id !== profile.id);
      const title = conv.type === 'group'
        ? (conv.name ?? 'Grup')
        : ((others[0] as any)?.profiles?.full_name ?? 'Sohbet');
      const convMsgs = (msgs ?? []).filter((x: any) => x.conversation_id === conv.id);
      const last = convMsgs[0];
      const unread = convMsgs.filter((x: any) =>
        x.sender_id !== profile.id && (!m.last_read_at || x.created_at > m.last_read_at)
      ).length;
      return { id: conv.id, type: conv.type, title, last, unread };
    })
      .filter(c => c.last)
      .sort((a, b) => (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? ''))
      .slice(0, 3);
  }

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
  const todayDone = myTasks.filter(t => isToday(t.due_at) && t.status === 'completed').length;
  const todayTotal = myTasks.filter(t => isToday(t.due_at)).length;

  const FLOW_CHIPS = [
    { key: 'active', label: 'Aktif İş', count: flowCounts.active, color: '#007AFF', Icon: Inbox },
    { key: 'pending_review', label: 'Onay Bekleyen', count: flowCounts.pending_review, color: '#FF9500', Icon: ShieldQuestion },
    { key: 'overdue', label: 'Geciken', count: flowCounts.overdue, color: '#FF3B30', Icon: AlertCircle },
    { key: 'blocked', label: 'Engelli', count: flowCounts.blocked, color: '#FF3B30', Icon: OctagonAlert }
  ];

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <AutoRefresh seconds={30} />
      {/* User card + live clock */}
      <header className="card p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white flex items-center justify-center text-[18px] font-bold shrink-0 shadow-sm">
            {(profile.full_name || 'K')[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] text-[#8E8E93]">Hoş geldiniz</p>
            <h1 className="text-[19px] leading-tight font-bold tracking-tight truncate">
              {profile.full_name}
            </h1>
            <p className="text-[12px] text-[#8E8E93]">
              {ROLE_LABEL[profile.role]}
              {todayTotal > 0 ? ` · Bugün ${todayDone}/${todayTotal} görev` : ''}
            </p>
          </div>
        </div>
        <LiveClock />
      </header>

      {/* Team workflow — managers only */}
      {isManager && (
        <section>
          <div className="flex items-baseline justify-between pr-2">
            <h2 className="section-title">İş Akışı</h2>
            <Link href="/manage/tasks" className="text-[13px] text-ios-blue font-medium">Tümünü Gör</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
            {FLOW_CHIPS.map(c => (
              <Link key={c.key} href={`/manage/tasks?f=${c.key}`} className="smart-card">
                <div className="flex items-center justify-between">
                  <span className="smart-icon !w-7 !h-7" style={{ backgroundColor: c.color }}>
                    <c.Icon size={14} strokeWidth={2.2} />
                  </span>
                  <span className="text-[20px] font-bold leading-none">{c.count}</span>
                </div>
                <p className="text-[12px] font-semibold text-[#8E8E93]">{c.label}</p>
              </Link>
            ))}
          </div>
          {attention.length > 0 && (
            <div className="card divide-y divide-white/[0.08] overflow-hidden">
              {attention.map((t: any) => {
                const names = (t.task_assignees ?? []).map((a: any) => a.profiles?.full_name).filter(Boolean).join(', ');
                const meta = t.eff === 'pending_review'
                  ? { label: 'Onay bekliyor', cls: 'bg-amber-500/20 text-amber-300' }
                  : t.eff === 'blocked'
                    ? { label: 'Engellendi', cls: 'bg-rose-500/20 text-rose-300' }
                    : { label: 'Gecikti', cls: 'bg-rose-500/20 text-rose-300' };
                return (
                  <Link key={t.id} href={`/tasks/${t.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors">
                    <span className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium truncate">{t.title}</p>
                      <p className="text-[12px] text-[#8E8E93] truncate">
                        {t.due_at ? new Date(t.due_at).toLocaleString('tr-TR', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                        {names ? ` · 👤 ${names}` : ''}
                      </p>
                    </span>
                    <span className={`badge shrink-0 ${meta.cls}`}>{meta.label}</span>
                    <ChevronRight size={14} className="text-[#C7C7CC] shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )}

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

      {/* Active list — gün başlıklarıyla gruplu */}
      <section>
        <h2 className="section-title" style={{ color: activeSmart.color }}>{activeSmart.label}</h2>
        {filtered.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-[15px] text-[#8E8E93]">
              {tab === 'today' ? 'Bugün için görev yok — harika iş!' : 'Bu listede görev yok.'}
            </p>
          </div>
        )}
        {(() => {
          // görevleri güne göre grupla (Bugün / Yarın / tarih) — tekrarlar karışmasın
          const dayKeyOf = (iso: string | null) => iso
            ? new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso))
            : 'tarihsiz';
          const todayK = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
          const tomorrowK = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(Date.now() + 86400000));
          const labelOf = (k: string) => k === 'tarihsiz' ? '📌 Tarihsiz'
            : k === todayK ? '🔵 Bugün'
            : k === tomorrowK ? '🟠 Yarın'
            : k < todayK ? `🔴 ${new Date(k + 'T12:00:00Z').toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long', weekday: 'long' })} (geçmiş)`
            : new Date(k + 'T12:00:00Z').toLocaleDateString('tr-TR', { timeZone: 'UTC', day: 'numeric', month: 'long', weekday: 'long' });
          const groups: Record<string, typeof filtered> = {};
          for (const t of filtered) (groups[dayKeyOf(t.due_at)] ??= [] as any).push(t);
          const keys = Object.keys(groups).sort((a, b) =>
            a === 'tarihsiz' ? 1 : b === 'tarihsiz' ? -1 : a.localeCompare(b));
          return keys.map(k => (
            <div key={k} className="mb-4">
              <h3 className="text-[13px] font-semibold text-[#8E8E93] px-1 mb-1.5 capitalize">
                {labelOf(k)} · {groups[k].length} görev
              </h3>
              <div className="card divide-y divide-white/[0.08] overflow-hidden">
                {groups[k].map(t => (
                  <TaskRow key={t.id} task={t} progress={progress[t.id]} />
                ))}
              </div>
            </div>
          ));
        })()}
      </section>

      {/* Mesajlar */}
      {chats.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between pr-2">
            <h2 className="section-title">Mesajlar</h2>
            <Link href="/messages" className="text-[13px] text-ios-blue font-medium">Tümü</Link>
          </div>
          <div className="card divide-y divide-white/[0.08] overflow-hidden">
            {chats.map((c: any) => (
              <Link key={c.id} href={`/messages/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors">
                <span
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
                  style={{ backgroundColor: colorFor(c.title) }}
                >
                  {c.type === 'group' ? <Users2 size={17} /> : c.title[0]?.toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between gap-2">
                    <p className="text-[15px] font-semibold truncate">{c.title}</p>
                    <p className="text-[12px] text-[#8E8E93] shrink-0">{chatTime(c.last.created_at)}</p>
                  </span>
                  <p className="text-[13px] text-[#8E8E93] truncate">
                    {c.last.sender_id === profile.id ? 'Siz: ' : ''}{c.last.body}
                  </p>
                </span>
                {c.unread > 0 && (
                  <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-ios-blue text-white text-[12px] font-semibold flex items-center justify-center shrink-0">
                    {c.unread > 99 ? '99+' : c.unread}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Pano */}
      {pano.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between pr-2">
            <h2 className="section-title">Şirket Panosu</h2>
            <Link href="/announcements" className="text-[13px] text-ios-blue font-medium">Tümü</Link>
          </div>
          <div className="card divide-y divide-white/[0.08] overflow-hidden">
            {pano.slice(0, 4).map(a => (
              <Link key={a.id} href="/announcements" className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors">
                <span className="smart-icon !w-7 !h-7 mt-0.5" style={{ backgroundColor: a.is_pinned ? '#FF9500' : '#8E8E93' }}>
                  {a.is_pinned ? <Pin size={14} /> : <Inbox size={14} />}
                </span>
                <span className="min-w-0">
                  <p className="text-[15px] font-medium truncate">
                    {a.title}
                    {a.departments?.name && (
                      <span className="ml-1.5 text-[11px] font-semibold text-ios-blue bg-ios-blue/15 rounded-full px-2 py-0.5 align-middle">
                        {a.departments.name}
                      </span>
                    )}
                  </p>
                  <p className="text-[13px] text-[#8E8E93] line-clamp-1">{a.body}</p>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Notes */}
      <NotesPanel notes={(notes ?? []) as any} />

      {/* Push izni — abone değilse öner (Bildirimler sayfasına girmeyenler için) */}
      <PushSetup />
    </main>
  );
}
