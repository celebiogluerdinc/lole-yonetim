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

  const [{ data: openEntry }, { data: myEntries }, teamRes] = await Promise.all([
    supabase.from('time_entries').select('*')
      .eq('user_id', profile.id).is('clock_out', null)
      .order('clock_in', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('time_entries').select('*')
      .eq('user_id', profile.id).gte('clock_in', weekAgo)
      .order('clock_in', { ascending: false }).limit(30),
    isManager
      ? supabase.from('time_entries')
          .select('*, profiles:user_id(full_name)')
          .eq('company_id', companyId)
          .gte('clock_in', todayStart.toISOString())
          .order('clock_in', { ascending: false })
      : Promise.resolve({ data: [] } as any)
  ]);

  const weekTotal = (myEntries ?? [])
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
      isManager={isManager}
      isAdmin={['super_admin', 'admin'].includes(profile.role)}
    />
  );
}
