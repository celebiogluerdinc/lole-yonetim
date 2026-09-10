import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { chunkedIn, selectAll } from '@/lib/db';
import { isToday, isOverdue, ROLE_LABEL, TZ } from '@/lib/utils';
import type { Task } from '@/lib/types';
import TaskRow from '@/components/TaskRow';
import NotesPanel from '@/components/NotesPanel';
import PushSetup from '@/components/PushSetup';
import LiveClock from '@/components/LiveClock';
import AutoRefresh from '@/components/AutoRefresh';
import {
  CalendarDays, CalendarClock, Inbox, AlertCircle, Flag, CheckCircle2, Pin,
  ShieldQuestion, ChevronRight, Users2, ShoppingCart, Wallet, ShieldAlert,
  Presentation, Plane, Clock, Megaphone, FolderOpen, ClipboardList, Package
} from 'lucide-react';

const AVATAR_COLORS = ['#0A6CFF', '#12A150', '#E8930C', '#7C5CFC', '#E5484D', '#5B54D6', '#0E9F9F'];
const colorFor = (s: string) =>
  AVATAR_COLORS[s.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

const C = {
  blue: '#0A6CFF', green: '#12A150', amber: '#E8930C', red: '#E5484D',
  purple: '#7C5CFC', teal: '#0E9F9F', violet: '#8B5CF6', sky: '#0EA5E9',
  orange: '#FF9500', gray: '#667085'
};

function chatTime(iso: string) {
  const d = new Date(iso);
  const today = new Date().toLocaleDateString('tr-TR', { timeZone: TZ });
  if (d.toLocaleDateString('tr-TR', { timeZone: TZ }) === today) {
    return d.toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('tr-TR', { timeZone: TZ, day: 'numeric', month: 'short' });
}

/** "12 dk", "3 sa", "2 gün" — akıştaki her satırın yaşı */
function since(iso: string): string {
  const dk = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk`;
  const sa = Math.round(dk / 60);
  if (sa < 24) return `${sa} sa`;
  return `${Math.round(sa / 24)} gün`;
}

export const dynamic = 'force-dynamic';

const SMART = [
  { key: 'today', label: 'Bugün', Icon: CalendarDays, color: C.blue },
  { key: 'upcoming', label: 'Yaklaşan', Icon: CalendarClock, color: C.amber },
  { key: 'all', label: 'Tümü', Icon: Inbox, color: C.gray },
  { key: 'overdue', label: 'Gecikmiş', Icon: AlertCircle, color: C.red },
  { key: 'priority', label: 'Öncelikli', Icon: Flag, color: C.orange },
  { key: 'done', label: 'Tamamlanan', Icon: CheckCircle2, color: C.green }
] as const;

export default async function HomePage({
  searchParams
}: { searchParams: { tab?: string } }) {
  const { supabase, profile, companyId, managedDepartmentIds, isOrderLine } = await getCtx();
  const tab = searchParams.tab ?? 'today';

  if (profile.role === 'super_admin' && !companyId) redirect('/super/companies');

  const isAdmin = ['super_admin', 'admin'].includes(profile.role);
  const isManager = isAdmin || managedDepartmentIds.length > 0;
  const nowIso = new Date().toISOString();
  const co = <T,>(q: T, fallback: any) => (companyId ? q : fallback);

  // --- tek turda tüm veriler ---
  const [
    assigned, panoRes, { data: notes }, flowRes, convRes,
    purchaseRes, paymentRes, incidentRes, meetingRes, leaveRes,
    feedPurchase, feedPayment, feedIncident, feedMeeting, feedTask
  ] = await Promise.all([
    isOrderLine
      ? Promise.resolve([] as any[])
      : selectAll<any>(() => supabase.from('task_assignees')
          .select('task_id, tasks(*, checklist_items(is_done))')
          .eq('user_id', profile.id)
          .order('task_id', { ascending: true })),
    co(supabase.from('announcements')
      .select('*, departments:department_id(name)')
      .eq('company_id', companyId!)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6), { data: [] }),
    supabase.from('notes').select('*')
      .eq('author_id', profile.id).is('task_id', null)
      .order('created_at', { ascending: false }).limit(20),
    // Sayaçlar için TÜM açık görevler okunur (sayfa sayfa) — 1000 satır
    // sınırına takılıp "Aktif iş" rakamının eksik çıkmaması için.
    isManager && companyId && !isOrderLine
      ? selectAll<any>(() => supabase.from('tasks')
          .select('id, status, due_at')
          .eq('company_id', companyId)
          .not('status', 'in', '("completed","cancelled")')
          .order('id', { ascending: true }))
      : Promise.resolve([] as any[]),
    co(supabase.from('conversation_members')
      .select('conversation_id, last_read_at, conversations!inner(id, type, name, company_id)')
      .eq('user_id', profile.id)
      .eq('conversations.company_id', companyId!), { data: [] }),

    // ---- bekleyen iş sayaçları ----
    co(supabase.from('purchase_requests').select('id', { count: 'exact', head: true })
      .eq('company_id', companyId!).eq('status', 'pending'), { count: 0 }),
    co(isOrderLine
      ? Promise.resolve({ count: 0 })
      : supabase.from('payment_requests').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId!).eq('status', 'pending'), { count: 0 }),
    isAdmin && companyId
      ? supabase.from('incidents').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).eq('status', 'pending')
      : Promise.resolve({ count: 0 } as any),
    supabase.from('meeting_participants')
      .select('meetings!inner(id, title, meeting_at, status)')
      .eq('user_id', profile.id)
      .eq('meetings.status', 'scheduled')
      .gte('meetings.meeting_at', nowIso),
    // NOT: sıralama aşağıda JS tarafında yapılır. PostgREST'te bağlı tabloya
    // göre sıralama ana satırları sıralamaz; limit koyulursa yanlış toplantı
    // "sıradaki" görünür. Filtre zaten yalnızca gelecekteki toplantıları getirir.
    isManager && companyId && !isOrderLine
      ? supabase.from('leave_requests').select('id', { count: 'exact', head: true })
          .eq('company_id', companyId).eq('status', 'pending')
      : Promise.resolve({ count: 0 } as any),

    // ---- son hareketler ----
    co(supabase.from('purchase_requests')
      .select('id, title, status, created_at, requester:requester_id(full_name, customer_name)')
      .eq('company_id', companyId!).order('created_at', { ascending: false }).limit(6), { data: [] }),
    co(isOrderLine
      ? Promise.resolve({ data: [] })
      : supabase.from('payment_requests')
          .select('id, work_title, firm_name, created_at, requester:requester_id(full_name)')
          .eq('company_id', companyId!).order('created_at', { ascending: false }).limit(6), { data: [] }),
    isAdmin && companyId
      ? supabase.from('incidents')
          .select('id, title, severity, created_at, reporter:reporter_id(full_name)')
          .eq('company_id', companyId).order('created_at', { ascending: false }).limit(6)
      : Promise.resolve({ data: [] } as any),
    co(supabase.from('meetings')
      .select('id, title, created_at, creator:created_by(full_name)')
      .eq('company_id', companyId!).order('created_at', { ascending: false }).limit(6), { data: [] }),
    co(isOrderLine
      ? Promise.resolve({ data: [] })
      : supabase.from('tasks')
          .select('id, title, completed_at, task_assignees(profiles:user_id(full_name))')
          .eq('company_id', companyId!).eq('status', 'completed')
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false }).limit(6), { data: [] })
  ]);

  // --- ekip iş akışı (yöneticiler) ---
  const flowTasks: any[] = Array.isArray(flowRes) ? flowRes : [];
  const effStatus = (t: any) => {
    if (['pending_review', 'blocked'].includes(t.status)) return t.status;
    if (t.due_at && new Date(t.due_at).getTime() < Date.now()) return 'overdue';
    return t.status;
  };
  const istDay = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
  const todayKeyIst = istDay(new Date());
  const flowCounts = { active: flowTasks.length, today: 0, pending_review: 0, blocked: 0, overdue: 0 };
  for (const t of flowTasks) {
    const e = effStatus(t);
    if (e === 'pending_review') flowCounts.pending_review++;
    else if (e === 'blocked') flowCounts.blocked++;
    else if (e === 'overdue') flowCounts.overdue++;
    if (t.due_at && istDay(new Date(t.due_at)) === todayKeyIst) flowCounts.today++;
  }

  // --- sayaçlar ---
  const purchasePending = (purchaseRes as any)?.count ?? 0;
  const paymentPending = (paymentRes as any)?.count ?? 0;
  const incidentPending = (incidentRes as any)?.count ?? 0;
  const leavePending = (leaveRes as any)?.count ?? 0;
  const meetings = ((meetingRes as any)?.data ?? [])
    .map((r: any) => r.meetings).filter(Boolean)
    .sort((a: any, b: any) => (a.meeting_at ?? '').localeCompare(b.meeting_at ?? ''));
  const nextMeeting = meetings[0] ?? null;

  const orderWord = isOrderLine ? 'sipariş' : 'satın alma';

  // --- SİZİ BEKLEYENLER ---
  const waiting: {
    key: string; href: string; icon: any; color: string;
    title: string; sub: string; value: string;
  }[] = [];
  if (incidentPending > 0) waiting.push({
    key: 'inc', href: '/incidents', icon: ShieldAlert, color: C.red,
    title: 'Olay kaydı onayı', sub: 'İnceleme ve aksiyon raporu bekliyor', value: String(incidentPending)
  });
  if (isManager && purchasePending > 0) waiting.push({
    key: 'pur', href: '/purchasing', icon: isOrderLine ? Package : ShoppingCart, color: C.amber,
    title: isOrderLine ? 'Sipariş onayı' : 'Satın alma onayı', sub: `Bekleyen ${orderWord} talebi`, value: String(purchasePending)
  });
  if (isManager && paymentPending > 0) waiting.push({
    key: 'pay', href: '/payments', icon: Wallet, color: C.green,
    title: 'Ödeme talebi onayı', sub: 'Onayınız bekleniyor', value: String(paymentPending)
  });
  if (isManager && flowCounts.pending_review > 0) waiting.push({
    key: 'rev', href: '/manage/tasks?f=pending_review', icon: ShieldQuestion, color: C.blue,
    title: 'Görev onayı bekliyor', sub: 'Tamamlanan görevlerin kontrolü', value: String(flowCounts.pending_review)
  });
  if (isManager && leavePending > 0) waiting.push({
    key: 'lev', href: '/leave', icon: Plane, color: C.teal,
    title: 'İzin talebi', sub: 'Karar bekleyen talep', value: String(leavePending)
  });
  if (nextMeeting) waiting.push({
    key: 'mtg', href: '/meetings', icon: Presentation, color: C.purple,
    title: 'Yaklaşan toplantı', sub: nextMeeting.title,
    value: nextMeeting.meeting_at
      ? new Date(nextMeeting.meeting_at).toLocaleString('tr-TR',
          { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : '—'
  });

  // --- SON HAREKETLER ---
  type Feed = { at: string; icon: any; color: string; who: string; what: string; sub: string; href: string };
  const feed: Feed[] = [];
  for (const r of ((feedPurchase as any)?.data ?? [])) {
    feed.push({
      at: r.created_at, icon: isOrderLine ? Package : ShoppingCart, color: C.amber,
      who: (isOrderLine ? (r.requester?.customer_name || r.requester?.full_name) : r.requester?.full_name) ?? '—',
      what: isOrderLine ? 'sipariş verdi' : 'satın alma talebi açtı',
      sub: r.title, href: '/purchasing'
    });
  }
  for (const r of ((feedPayment as any)?.data ?? [])) {
    feed.push({
      at: r.created_at, icon: Wallet, color: C.green,
      who: r.requester?.full_name ?? '—', what: 'ödeme talebi açtı',
      sub: `${r.firm_name} — ${r.work_title}`, href: '/payments'
    });
  }
  for (const r of ((feedIncident as any)?.data ?? [])) {
    feed.push({
      at: r.created_at, icon: ShieldAlert, color: C.red,
      who: r.reporter?.full_name ?? '—', what: 'olay kaydı açtı',
      sub: r.title, href: '/incidents'
    });
  }
  for (const r of ((feedMeeting as any)?.data ?? [])) {
    feed.push({
      at: r.created_at, icon: Presentation, color: C.purple,
      who: r.creator?.full_name ?? '—', what: 'toplantı açtı',
      sub: r.title, href: '/meetings'
    });
  }
  for (const r of ((feedTask as any)?.data ?? [])) {
    const names = (r.task_assignees ?? [])
      .map((a: any) => a.profiles?.full_name).filter(Boolean);
    feed.push({
      at: r.completed_at, icon: CheckCircle2, color: C.blue,
      who: names[0] ?? 'Ekip', what: 'görevi tamamladı',
      sub: r.title, href: `/tasks/${r.id}`
    });
  }
  for (const a of ((panoRes as any)?.data ?? []).slice(0, 3)) {
    feed.push({
      at: a.created_at, icon: Megaphone, color: C.violet,
      who: 'Yönetim', what: 'duyuru yayınladı', sub: a.title, href: '/announcements'
    });
  }
  feed.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  const recent = feed.slice(0, 8);

  // --- MODÜLLER ---
  const modules = [
    { href: '/manage/tasks', label: 'Görevler', Icon: ClipboardList, color: C.blue, n: flowCounts.pending_review, show: isManager && !isOrderLine },
    { href: '/purchasing', label: isOrderLine ? 'Sipariş Ver' : 'Satın Alma', Icon: isOrderLine ? Package : ShoppingCart, color: C.amber, n: purchasePending, show: true },
    { href: '/payments', label: 'Ödemeler', Icon: Wallet, color: C.green, n: paymentPending, show: !isOrderLine },
    { href: '/incidents', label: 'Olay Kaydı', Icon: ShieldAlert, color: C.red, n: incidentPending, show: true },
    { href: '/meetings', label: 'Toplantılar', Icon: Presentation, color: C.purple, n: meetings.length, show: true },
    { href: '/shifts', label: 'Vardiyalar', Icon: CalendarClock, color: C.orange, n: 0, show: !isOrderLine },
    { href: '/leave', label: 'İzinler', Icon: Plane, color: C.teal, n: leavePending, show: !isOrderLine },
    { href: '/clock', label: 'Mesai', Icon: Clock, color: C.green, n: 0, show: !isOrderLine },
    { href: '/announcements', label: 'Duyurular', Icon: Megaphone, color: C.violet, n: 0, show: true },
    { href: '/files', label: 'Dosyalar', Icon: FolderOpen, color: C.sky, n: 0, show: true }
  ].filter(m => m.show);

  // --- sohbetler ---
  const convMemberships: any[] = (convRes as any)?.data ?? [];
  const convIds = convMemberships.map((m: any) => m.conversation_id);
  let chats: any[] = [];
  if (convIds.length) {
    // Sohbet sayısı arttığında tek istekte gönderilemez → parçalı sorgu
    const [allMembers, msgs] = await Promise.all([
      chunkedIn<any>(chunk => supabase.from('conversation_members')
        .select('conversation_id, user_id, profiles:user_id(full_name)')
        .in('conversation_id', chunk), convIds),
      chunkedIn<any>(chunk => supabase.from('messages')
        .select('conversation_id, sender_id, body, created_at')
        .in('conversation_id', chunk)
        .order('created_at', { ascending: false }).limit(200), convIds)
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
        x.sender_id !== profile.id && (!m.last_read_at || x.created_at > m.last_read_at)).length;
      return { id: conv.id, type: conv.type, title, last, unread };
    })
      .filter(c => c.last)
      .sort((a, b) => (b.last?.created_at ?? '').localeCompare(a.last?.created_at ?? ''))
      .slice(0, 3);
  }

  // --- kendi görevlerim ---
  const myTasks: Task[] = (Array.isArray(assigned) ? assigned : []).map((r: any) => r.tasks).filter(Boolean);
  const progress: Record<string, { done: number; total: number }> = {};
  for (const t of myTasks) {
    const items: any[] = (t as any).checklist_items ?? [];
    if (items.length) {
      progress[t.id] = { done: items.filter((i: any) => i.is_done).length, total: items.length };
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
  const filtered = myTasks.filter(t => matches(t, tab))
    .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'));
  const activeSmart = SMART.find(s => s.key === tab) ?? SMART[0];
  const pano: any[] = (panoRes as any)?.data ?? [];
  const todayDone = myTasks.filter(t => isToday(t.due_at) && t.status === 'completed').length;
  const todayTotal = myTasks.filter(t => isToday(t.due_at)).length;
  const bekleyenToplam = waiting.filter(w => w.key !== 'mtg')
    .reduce((a, w) => a + (Number(w.value) || 0), 0);

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <AutoRefresh seconds={30} />

      {/* --- kullanıcı kartı --- */}
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
              {bekleyenToplam > 0
                ? ` · ${bekleyenToplam} iş onayınızı bekliyor`
                : todayTotal > 0 ? ` · Bugün ${todayDone}/${todayTotal} görev` : ''}
            </p>
          </div>
        </div>
        <LiveClock />
      </header>

      {/* --- SİZİ BEKLEYENLER --- */}
      {waiting.length > 0 && (
        <section>
          <h2 className="section-title">Sizi bekleyenler</h2>
          <div className="space-y-2">
            {waiting.map(w => (
              <Link key={w.key} href={w.href}
                className="card p-3 flex items-center gap-3 hover:bg-white/[0.04] transition-colors"
                style={{ borderLeft: `3px solid ${w.color}` }}>
                <span className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${w.color}1A`, color: w.color }}>
                  <w.icon size={16} strokeWidth={2.2} />
                </span>
                <span className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold leading-tight">{w.title}</p>
                  <p className="text-[12px] text-[#8E8E93] truncate">{w.sub}</p>
                </span>
                <span className="text-[17px] font-bold shrink-0" style={{ color: w.color }}>{w.value}</span>
                <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* --- BUGÜN --- */}
      {!isOrderLine && (
        <section>
          <div className="flex items-baseline justify-between pr-2">
            <h2 className="section-title">Bugün</h2>
            {isManager && (
              <Link href="/manage/tasks" className="text-[13px] text-ios-blue font-medium">Görevler</Link>
            )}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { n: counts.today ?? 0, l: 'Benim görevim', c: C.blue },
              { n: counts.overdue ?? 0, l: 'Gecikmiş', c: C.red },
              { n: isManager ? flowCounts.today : todayTotal, l: isManager ? 'Ekip bugün' : 'Bugün toplam', c: undefined },
              { n: isManager ? flowCounts.active : counts.all ?? 0, l: 'Aktif iş', c: C.teal }
            ].map((s, i) => (
              <div key={i} className="card p-3 text-center">
                <b className="block text-[21px] leading-none font-bold tracking-tight"
                  style={s.c ? { color: s.c } : undefined}>{s.n}</b>
                <span className="block text-[11px] text-[#8E8E93] mt-1 leading-tight">{s.l}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- MODÜLLER --- */}
      <section>
        <h2 className="section-title">Modüller</h2>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
          {modules.map(m => (
            <Link key={m.href} href={m.href} className="smart-card !items-center relative">
              <span className="smart-icon" style={{ backgroundColor: m.color }}>
                <m.Icon size={16} strokeWidth={2.2} />
              </span>
              <p className="text-[12px] font-semibold text-center leading-tight">{m.label}</p>
              {m.n > 0 && (
                <span className="absolute top-1.5 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-ios-red text-white text-[10.5px] font-bold flex items-center justify-center">
                  {m.n > 99 ? '99+' : m.n}
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* --- SON HAREKETLER --- */}
      <section>
        <div className="flex items-baseline justify-between pr-2">
          <h2 className="section-title">Son hareketler</h2>
          <Link href="/notifications" className="text-[13px] text-ios-blue font-medium">Bildirimler</Link>
        </div>
        {recent.length === 0 ? (
          <div className="card p-8 text-center text-[14px] text-[#8E8E93]">
            Henüz hareket yok.
          </div>
        ) : (
          <div className="card divide-y divide-white/[0.08] overflow-hidden">
            {recent.map((f, i) => (
              <Link key={i} href={f.href}
                className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors">
                <span className="w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: `${f.color}1A`, color: f.color }}>
                  <f.icon size={14} strokeWidth={2.2} />
                </span>
                <span className="flex-1 min-w-0">
                  <p className="text-[14px] leading-tight">
                    <b className="font-semibold">{f.who}</b> {f.what}
                  </p>
                  <p className="text-[12px] text-[#8E8E93] truncate mt-0.5">{f.sub}</p>
                </span>
                <span className="text-[11.5px] text-[#AEAEB2] shrink-0 whitespace-nowrap">{since(f.at)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* --- KENDİ GÖREVLERİM --- */}
      {!isOrderLine && (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
            {SMART.map(s => (
              <Link key={s.key} href={`/home?tab=${s.key}`}
                className={`smart-card ${tab === s.key ? 'ring-2' : ''}`}
                style={tab === s.key ? ({ ['--tw-ring-color' as any]: s.color }) : undefined}>
                <div className="flex items-center justify-between">
                  <span className="smart-icon !w-7 !h-7" style={{ backgroundColor: s.color }}>
                    <s.Icon size={14} strokeWidth={2.2} />
                  </span>
                  <span className="text-[19px] font-bold leading-none">{counts[s.key]}</span>
                </div>
                <p className="text-[12px] font-semibold text-[#8E8E93]">{s.label}</p>
              </Link>
            ))}
          </div>

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
        </>
      )}

      {/* --- MESAJLAR --- */}
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
                <span className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold shrink-0"
                  style={{ backgroundColor: colorFor(c.title) }}>
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

      {/* --- PANO --- */}
      {pano.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between pr-2">
            <h2 className="section-title">Şirket Panosu</h2>
            <Link href="/announcements" className="text-[13px] text-ios-blue font-medium">Tümü</Link>
          </div>
          <div className="card divide-y divide-white/[0.08] overflow-hidden">
            {pano.slice(0, 4).map(a => (
              <Link key={a.id} href="/announcements"
                className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors">
                <span className="smart-icon !w-7 !h-7 mt-0.5"
                  style={{ backgroundColor: a.is_pinned ? C.orange : C.gray }}>
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

      <NotesPanel notes={(notes ?? []) as any} />
      <PushSetup />
    </main>
  );
}
