import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import ClockClient from '@/components/ClockClient';

export const dynamic = 'force-dynamic';

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { timeZone: TZ, day: 'numeric', month: 'long', weekday: 'short' });

function hours(a: string, b: string | null) {
  if (!b) return null;
  return Math.round(((new Date(b).getTime() - new Date(a).getTime()) / 3600000) * 10) / 10;
}

export default async function ClockPage({
  searchParams
}: { searchParams: { qr?: string } }) {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const isManager = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  // bugünün İstanbul sınırları (timestamptz karşılaştırması — tarih stringi üretme yok)
  const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const dayStartIst = new Date(`${todayIst}T00:00:00+03:00`);
  const dayEndIst = new Date(dayStartIst.getTime() + 86400000);

  const [{ data: openEntry }, { data: myEntries }, teamRes, shiftsRes] = await Promise.all([
    supabase.from('time_entries').select('*')
      .eq('user_id', profile.id).is('clock_out', null)
      .order('clock_in', { ascending: false }).limit(1).maybeSingle(),
    // mesai geçmişi silinmez: son 90 gün listelenir (haftalık toplam ayrıca hesaplanır)
    supabase.from('time_entries').select('*')
      .eq('user_id', profile.id)
      .gte('clock_in', new Date(Date.now() - 90 * 86400000).toISOString())
      .order('clock_in', { ascending: false }).limit(500),
    isManager
      ? supabase.from('time_entries')
          .select('*, profiles:user_id(full_name)')
          .eq('company_id', companyId)
          .gte('clock_in', todayStart.toISOString())
          .order('clock_in', { ascending: false })
      : Promise.resolve({ data: [] } as any),
    isManager
      ? supabase.from('shifts')
          .select('user_id, starts_at, ends_at, profiles:user_id(full_name)')
          .eq('company_id', companyId)
          .gte('starts_at', dayStartIst.toISOString())
          .lt('starts_at', dayEndIst.toISOString())
          .order('starts_at')
      : Promise.resolve({ data: [] } as any)
  ]);

  // ---- bugünün vardiya yoklaması: geç kalan / gelmeyen (yöneticiler) ----
  const nowMs = Date.now();
  const firstClockIn: Record<string, number> = {};
  for (const e of (teamRes?.data ?? []) as any[]) {
    const t = new Date(e.clock_in).getTime();
    if (!(e.user_id in firstClockIn) || t < firstClockIn[e.user_id]) firstClockIn[e.user_id] = t;
  }
  const attendance = ((shiftsRes?.data ?? []) as any[])
    .filter(s => new Date(s.starts_at).getTime() <= nowMs) // yalnız başlamış vardiyalar
    .map(s => {
      const startMs = new Date(s.starts_at).getTime();
      const cin = firstClockIn[s.user_id];
      let status: 'ontime' | 'late' | 'absent'; let lateMin = 0;
      if (cin === undefined) status = 'absent';
      else if (cin > startMs + 5 * 60000) { status = 'late'; lateMin = Math.round((cin - startMs) / 60000); }
      else status = 'ontime';
      return {
        name: s.profiles?.full_name ?? '?',
        shift: `${hhmm(s.starts_at)}–${hhmm(s.ends_at)}`,
        status, lateMin
      };
    });

  const weekTotal = (myEntries ?? [])
    .filter((e: any) => e.clock_in >= weekAgo) // "bu hafta" yalnız son 7 gün
    .reduce((a: number, e: any) => a + (hours(e.clock_in, e.clock_out) ?? 0), 0);

  const rows = (myEntries ?? []).map((e: any) => ({
    id: e.id,
    day: dayLabel(e.clock_in),
    in: hhmm(e.clock_in),
    out: e.clock_out ? hhmm(e.clock_out) : null,
    hours: hours(e.clock_in, e.clock_out),
    method: e.in_method
  }));

  const team = ((teamRes?.data ?? []) as any[])
    .filter(e => e.user_id !== profile.id)
    .map(e => ({
      id: e.id,
      name: e.profiles?.full_name ?? '?',
      in: hhmm(e.clock_in),
      out: e.clock_out ? hhmm(e.clock_out) : null,
      method: e.in_method
    }));

  return (
    <ClockClient
      open={openEntry ? { since: hhmm(openEntry.clock_in) } : null}
      viaQr={searchParams.qr === '1'}
      rows={rows}
      weekTotal={Math.round(weekTotal * 10) / 10}
      team={team}
      attendance={attendance}
      isManager={isManager}
      isAdmin={['super_admin', 'admin'].includes(profile.role)}
    />
  );
}
