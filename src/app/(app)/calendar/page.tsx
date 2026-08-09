import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { TZ, STATUS_COLOR, STATUS_LABEL } from '@/lib/utils';
import { ChevronLeft, ChevronRight, CalendarClock, Plane } from 'lucide-react';

export const dynamic = 'force-dynamic';

const LEAVE_TR: Record<string, string> = {
  annual: 'Yıllık izin', sick: 'Rapor', unpaid: 'Ücretsiz izin', other: 'İzin'
};

export default async function CalendarPage({
  searchParams
}: { searchParams: { m?: string; scope?: string; k?: string; d?: string } }) {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();

  const now = new Date();
  let [y, m] = (searchParams.m ?? '').split('-').map(Number);
  if (!y || !m || m < 1 || m > 12 || y < 2000 || y > 2100) {
    y = now.getFullYear(); m = now.getMonth() + 1; // geçersiz parametre → bu ay
  }
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 1));
  const prev = `${m === 1 ? y - 1 : y}-${m === 1 ? 12 : m - 1}`;
  const next = `${m === 12 ? y + 1 : y}-${m === 12 ? 1 : m + 1}`;

  const isManager = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
  const scope = isManager && searchParams.scope === 'team' ? 'team' : 'mine';
  const kat = ['tasks', 'shifts', 'leave'].includes(searchParams.k ?? '') ? searchParams.k! : 'all';

  // görevler + vardiyalar + onaylı izinler — tek takvimde
  const monthStartIso = monthStart.toISOString();
  const monthEndIso = monthEnd.toISOString();
  const monthStartDate = monthStartIso.slice(0, 10);
  const monthEndDate = monthEndIso.slice(0, 10);

  let tasksQ;
  if (scope === 'mine') {
    tasksQ = supabase.from('task_assignees').select('tasks(*)').eq('user_id', profile.id);
  } else {
    tasksQ = supabase.from('tasks').select('*')
      .eq('company_id', companyId ?? '')
      .gte('due_at', monthStartIso).lt('due_at', monthEndIso).limit(500);
  }
  const shiftsQ = supabase.from('shifts')
    .select('id, user_id, company_id, starts_at, ends_at, note, profiles:user_id(full_name)')
    .gte('starts_at', monthStartIso).lt('starts_at', monthEndIso)
    .order('starts_at').limit(500) as any;
  const leaveQ = supabase.from('leave_requests')
    .select('id, user_id, company_id, type, start_date, end_date, profiles:user_id(full_name)')
    .eq('status', 'approved')
    .lte('start_date', monthEndDate).gte('end_date', monthStartDate)
    .limit(200) as any;

  const [tasksRes, shiftsRes, leaveRes] = await Promise.all([tasksQ, shiftsQ, leaveQ]);

  let tasks: any[] = scope === 'mine'
    ? (tasksRes.data ?? []).map((r: any) => r.tasks).filter(Boolean)
        .filter((t: any) => t.due_at && new Date(t.due_at) >= monthStart && new Date(t.due_at) < monthEnd)
    : (tasksRes.data ?? []);
  tasks.sort((a, b) => a.due_at.localeCompare(b.due_at));

  let shifts: any[] = (shiftsRes.data ?? []);
  let leaves: any[] = (leaveRes.data ?? []);
  if (companyId) {
    // süper adminde diğer şirketlerin kayıtları karışmasın
    shifts = shifts.filter((s: any) => s.company_id === companyId);
    leaves = leaves.filter((l: any) => l.company_id === companyId);
    if (scope === 'team') tasks = tasks.filter((task: any) => task.company_id === companyId);
  }
  if (scope === 'mine') {
    shifts = shifts.filter((s: any) => s.user_id === profile.id);
    leaves = leaves.filter((l: any) => l.user_id === profile.id);
  }

  // günler ISO (YYYY-MM-DD, İstanbul) anahtarıyla gruplanır
  const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date(iso));
  const labelOf = (isoDay: string) => new Date(`${isoDay}T12:00:00Z`).toLocaleDateString('tr-TR', {
    timeZone: 'UTC', day: 'numeric', month: 'long', weekday: 'long'
  });
  const t = (iso: string) => new Date(iso).toLocaleTimeString('tr-TR', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit'
  });

  // group everything by day
  type Entry = { kind: 'task' | 'shift' | 'leave'; sort: string; el: any };
  const byDay: Record<string, Entry[]> = {};
  for (const task of tasks) (byDay[dayKey(task.due_at)] ??= []).push({ kind: 'task', sort: task.due_at, el: task });
  for (const s of shifts) (byDay[dayKey(s.starts_at)] ??= []).push({ kind: 'shift', sort: s.starts_at, el: s });
  for (const l of leaves) {
    // her izin gününü ay içinde ayrı satır olarak göster
    const from = l.start_date < monthStartDate ? monthStartDate : l.start_date;
    const to = l.end_date >= monthEndDate ? monthEndDate : l.end_date;
    for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to && d < monthEnd; d = new Date(d.getTime() + 86400000)) {
      (byDay[dayKey(d.toISOString())] ??= []).push({ kind: 'leave', sort: '00:00', el: l });
    }
  }
  // kategori filtresi + gün içinde kategoriye göre sırala (görev → vardiya → izin)
  const KIND_ORDER: Record<string, number> = { task: 0, shift: 1, leave: 2 };
  const catCounts = { tasks: tasks.length, shifts: shifts.length, leave: leaves.length };
  for (const k of Object.keys(byDay)) {
    if (kat !== 'all') {
      byDay[k] = byDay[k].filter(e =>
        (kat === 'tasks' && e.kind === 'task') ||
        (kat === 'shifts' && e.kind === 'shift') ||
        (kat === 'leave' && e.kind === 'leave'));
    }
    byDay[k].sort((a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.sort.localeCompare(b.sort));
    if (byDay[k].length === 0) delete byDay[k];
  }

  // ---- AY IZGARASI verileri ----
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstOffset = (monthStart.getUTCDay() + 6) % 7; // Pzt=0
  const todayIso = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const pad = (n: number) => String(n).padStart(2, '0');
  const isoOf = (dayNum: number) => `${y}-${pad(m)}-${pad(dayNum)}`;
  const gridDots: Record<string, { t: boolean; s: boolean; l: boolean; n: number }> = {};
  for (const [k, list] of Object.entries(byDay)) {
    gridDots[k] = {
      t: list.some(e => e.kind === 'task'),
      s: list.some(e => e.kind === 'shift'),
      l: list.some(e => e.kind === 'leave'),
      n: list.length
    };
  }
  // seçili gün (?d=) — geçerliyse yalnız o günün listesi gösterilir
  const selDay = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.d ?? '') ? searchParams.d! : null;
  const sortedDays = Object.keys(byDay).sort();
  const visibleDays = selDay ? sortedDays.filter(k => k === selDay) : sortedDays;
  const qs = (extra: string) => `/calendar?m=${y}-${m}&scope=${scope}&k=${kat}${extra}`;

  const monthLabel = monthStart.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const KAT_CHIPS = [
    ['all', `Tümü`, ''],
    ['tasks', `📋 Görevler (${catCounts.tasks})`, '#0A84FF'],
    ['shifts', `🕐 Vardiyalar (${catCounts.shifts})`, '#FF9F0A'],
    ['leave', `🏖 İzinler (${catCounts.leave})`, '#30B0C7']
  ] as const;

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Takvim</h1>
        <div className="flex items-center gap-1">
          <Link href={`/calendar?m=${todayIso.slice(0, 7)}&scope=${scope}&k=${kat}&d=${todayIso}#gunler`}
            className="btn-ghost text-[13px] !px-2.5">Bugün</Link>
          <Link href={`/calendar?m=${prev}&scope=${scope}&k=${kat}`} className="btn-ghost !px-2"><ChevronLeft size={18} /></Link>
          <span className="text-sm font-medium min-w-[130px] text-center capitalize">{monthLabel}</span>
          <Link href={`/calendar?m=${next}&scope=${scope}&k=${kat}`} className="btn-ghost !px-2"><ChevronRight size={18} /></Link>
        </div>
      </div>

      {isManager && (
        <div className="flex gap-1.5 mb-3">
          <Link href={`/calendar?m=${y}-${m}&scope=mine&k=${kat}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${scope === 'mine' ? 'bg-ios-blue text-white' : 'bg-[#1C1C1E] text-[#D1D1D6]'}`}>
            Benim ajandam
          </Link>
          <Link href={`/calendar?m=${y}-${m}&scope=team&k=${kat}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${scope === 'team' ? 'bg-ios-blue text-white' : 'bg-[#1C1C1E] text-[#D1D1D6]'}`}>
            Ekip takvimi
          </Link>
        </div>
      )}

      {/* kategori filtresi */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto -mx-1 px-1 pb-1">
        {KAT_CHIPS.map(([k, l, color]) => (
          <Link key={k} href={`/calendar?m=${y}-${m}&scope=${scope}&k=${k}${selDay ? `&d=${selDay}` : ''}`}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              kat === k ? 'text-white' : 'bg-[#1C1C1E] text-[#D1D1D6]'}`}
            style={kat === k ? { backgroundColor: color || '#5856D6' } : undefined}>
            {l}
          </Link>
        ))}
      </div>

      {/* ---- AY IZGARASI ---- */}
      <div className="card p-3 mb-5">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-[#8E8E93] uppercase py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {/* önceki ayın kuyruğu — soluk */}
          {Array.from({ length: firstOffset }).map((_, i) => {
            const prevMonthDays = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
            return (
              <div key={`e${i}`} className="aspect-square rounded-xl flex items-center justify-center text-[12px] text-white/[0.15]">
                {prevMonthDays - firstOffset + i + 1}
              </div>
            );
          })}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const iso = isoOf(dayNum);
            const dots = gridDots[iso];
            const isToday = iso === todayIso;
            const isSel = iso === selDay;
            const isWeekend = (firstOffset + i) % 7 >= 5;
            return (
              <Link
                key={iso}
                href={`${qs(isSel ? '' : `&d=${iso}`)}${isSel ? '' : '#gunler'}`}
                title={dots ? `${dots.n} kayıt` : undefined}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-[13px] transition-colors ${
                  isSel ? `bg-ios-blue text-white font-bold${isToday ? ' ring-2 ring-white/40' : ''}`
                  : isToday ? 'bg-ios-blue/15 text-ios-blue font-bold'
                  : dots ? `${isWeekend ? 'bg-white/[0.08]' : 'bg-white/[0.05]'} hover:bg-white/[0.12]`
                  : `${isWeekend ? 'bg-white/[0.03] ' : ''}text-[#8E8E93] hover:bg-white/[0.05]`
                }`}
              >
                {dayNum}
                {dots && (
                  <span className="flex gap-[3px]">
                    {dots.t && <i className="w-1.5 h-1.5 rounded-full" style={{ background: isSel ? '#fff' : '#0A84FF' }} />}
                    {dots.s && <i className="w-1.5 h-1.5 rounded-full" style={{ background: isSel ? '#fff' : '#FF9F0A' }} />}
                    {dots.l && <i className="w-1.5 h-1.5 rounded-full" style={{ background: isSel ? '#fff' : '#30B0C7' }} />}
                  </span>
                )}
              </Link>
            );
          })}
          {/* sonraki ayın başı — soluk (son hafta satırı tamamlanır) */}
          {Array.from({ length: (7 - (firstOffset + daysInMonth) % 7) % 7 }).map((_, i) => (
            <div key={`n${i}`} className="aspect-square rounded-xl flex items-center justify-center text-[12px] text-white/[0.15]">
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {selDay && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-[14px] font-semibold capitalize">📍 {labelOf(selDay)}</p>
          <Link href={qs('')} className="text-[13px] text-ios-blue font-medium">Tüm ayı göster</Link>
        </div>
      )}

      {visibleDays.length === 0 && (
        <div className="card p-10 text-center text-sm text-[#8E8E93]">
          {selDay ? 'Seçili günde kayıt yok.' : 'Bu ay planlanmış görev, vardiya veya izin yok.'}
        </div>
      )}

      <div className="space-y-5" id="gunler">
        {visibleDays.map(dayIso => {
          const list = byDay[dayIso];
          return (
          <section key={dayIso}>
            <h2 className="text-sm font-semibold text-[#8E8E93] mb-2 capitalize">{labelOf(dayIso)}</h2>
            <div className="card divide-y divide-white/[0.08]">
              {list.map((e, i) => {
                if (e.kind === 'task') {
                  const task = e.el;
                  return (
                    <Link key={`t${task.id}-${i}`} href={`/tasks/${task.id}`}
                      className="flex items-center gap-3 p-3.5 border-l-[3px] border-ios-blue hover:bg-[#1C1C1E]/[0.04] transition-colors">
                      <span className="text-xs font-semibold text-ios-blue w-12 shrink-0">{t(task.due_at)}</span>
                      <span className={`flex-1 text-sm truncate ${task.status === 'completed' ? 'line-through text-[#AEAEB2]' : ''}`}>
                        {task.title}
                      </span>
                      <span className={`badge ${STATUS_COLOR[task.status as keyof typeof STATUS_COLOR]}`}>
                        {STATUS_LABEL[task.status as keyof typeof STATUS_LABEL]}
                      </span>
                    </Link>
                  );
                }
                if (e.kind === 'shift') {
                  const s = e.el;
                  return (
                    <div key={`s${s.id}-${i}`} className="flex items-center gap-3 p-3.5 border-l-[3px] border-ios-orange">
                      <span className="text-xs font-semibold text-ios-orange w-12 shrink-0">{t(s.starts_at)}</span>
                      <CalendarClock size={14} className="text-ios-orange shrink-0" />
                      <span className="flex-1 text-sm truncate">
                        Vardiya · {t(s.starts_at)}–{t(s.ends_at)}
                        {scope === 'team' && s.profiles?.full_name ? ` · ${s.profiles.full_name}` : ''}
                        {s.note ? ` · ${s.note}` : ''}
                      </span>
                      <Link href="/shifts" className="badge bg-amber-500/20 text-amber-300">Vardiya</Link>
                    </div>
                  );
                }
                const l = e.el;
                return (
                  <div key={`l${l.id}-${i}`} className="flex items-center gap-3 p-3.5 border-l-[3px] border-[#30B0C7]">
                    <span className="text-xs font-semibold text-[#30B0C7] w-12 shrink-0">Tüm gün</span>
                    <Plane size={14} className="text-[#30B0C7] shrink-0" />
                    <span className="flex-1 text-sm truncate">
                      {LEAVE_TR[l.type] ?? 'İzin'}
                      {scope === 'team' && l.profiles?.full_name ? ` · ${l.profiles.full_name}` : ''}
                    </span>
                    <Link href="/leave" className="badge bg-cyan-500/20 text-cyan-300">İzin</Link>
                  </div>
                );
              })}
            </div>
          </section>
          );
        })}
      </div>
    </main>
  );
}
