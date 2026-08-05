import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import ShiftsClient, { type ShiftRow } from '@/components/ShiftsClient';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const dynamic = 'force-dynamic';

function mondayOf(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
const iso = (d: Date) => d.toISOString().slice(0, 10);
const istDay = (isoTs: string) => {
  // YYYY-MM-DD in Istanbul
  const d = new Date(isoTs);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(d);
  return parts; // en-CA gives YYYY-MM-DD
};
const istTime = (isoTs: string) =>
  new Date(isoTs).toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

export default async function ShiftsPage({
  searchParams
}: { searchParams: { v?: string; w?: string } }) {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const isManager = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
  const view: 'week' | 'month' = searchParams.v === 'month' ? 'month' : 'week';

  // ----- range -----
  const anchorRaw = searchParams.w ? new Date(searchParams.w) : new Date();
  const anchor = isNaN(anchorRaw.getTime()) ? new Date() : anchorRaw;

  let rangeStart: Date, rangeEnd: Date, prev: string, next: string, rangeLabel: string;
  if (view === 'week') {
    rangeStart = mondayOf(anchor);
    rangeEnd = new Date(rangeStart.getTime() + 7 * 86400000);
    prev = iso(new Date(rangeStart.getTime() - 7 * 86400000));
    next = iso(new Date(rangeStart.getTime() + 7 * 86400000));
    rangeLabel = `${rangeStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} – ${new Date(rangeEnd.getTime() - 86400000).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}`;
  } else {
    rangeStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    rangeEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1);
    prev = iso(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
    next = iso(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
    rangeLabel = rangeStart.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  }

  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());

  // week columns (used by the grid)
  const weekBase = view === 'week' ? rangeStart : mondayOf(anchor);
  const days: string[] = [];
  const dayLabels: string[] = [];
  for (let d = 0; d < 7; d++) {
    const dt = new Date(weekBase.getTime() + d * 86400000);
    days.push(iso(dt));
    dayLabels.push(dt.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric' }));
  }

  const [{ data: shifts }, { data: depts }, { data: people }, { data: memberships }] = await Promise.all([
    supabase.from('shifts')
      .select('id, user_id, department_id, starts_at, ends_at, note, series_id, profiles:user_id(full_name), departments:department_id(name)')
      .eq('company_id', companyId)
      .gte('starts_at', rangeStart.toISOString())
      .lt('starts_at', rangeEnd.toISOString())
      .order('starts_at'),
    supabase.from('departments').select('id, name').eq('company_id', companyId).order('name'),
    supabase.from('profiles').select('id, full_name').eq('company_id', companyId).eq('is_active', true).order('full_name'),
    supabase.from('department_members').select('department_id, user_id')
  ]);

  const manageableDepts = (depts ?? []).filter(d =>
    ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.includes(d.id));

  const rows: ShiftRow[] = (shifts ?? []).map((s: any) => ({
    id: s.id,
    user_id: s.user_id,
    name: s.profiles?.full_name ?? '—',
    dept: s.departments?.name ?? null,
    starts_at: s.starts_at,
    ends_at: s.ends_at,
    note: s.note,
    series_id: s.series_id,
    day: istDay(s.starts_at),
    t: `${istTime(s.starts_at)}–${istTime(s.ends_at)}`
  }));

  return (
    <main className="max-w-5xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Vardiyalar</h1>
          <p className="text-[14px] text-[#8E8E93]">
            {isManager ? 'Tüm personelin vardiya planı' : 'Vardiya programınız'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="segment">
            <Link href={`/shifts?v=week&w=${iso(anchor)}`}
              className={`segment-item ${view === 'week' ? 'segment-item-active' : ''}`}>Hafta</Link>
            <Link href={`/shifts?v=month&w=${iso(anchor)}`}
              className={`segment-item ${view === 'month' ? 'segment-item-active' : ''}`}>Ay</Link>
          </div>
          <div className="flex items-center gap-1">
            <Link href={`/shifts?v=${view}&w=${prev}`} className="btn-ghost !px-2"><ChevronLeft size={18} /></Link>
            <span className="text-sm font-medium min-w-[110px] text-center capitalize">{rangeLabel}</span>
            <Link href={`/shifts?v=${view}&w=${next}`} className="btn-ghost !px-2"><ChevronRight size={18} /></Link>
          </div>
        </div>
      </header>

      <ShiftsClient
        view={view}
        days={days}
        dayLabels={dayLabels}
        todayKey={todayKey}
        shifts={rows}
        people={(people ?? []) as any}
        departments={manageableDepts as any}
        memberships={(memberships ?? []) as any}
        meId={profile.id}
        isManager={isManager}
      />
    </main>
  );
}
