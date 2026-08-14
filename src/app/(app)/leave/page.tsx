import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import LeaveClient from '@/components/LeaveClient';

export const dynamic = 'force-dynamic';

export default async function LeavePage() {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const isManager = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;

  // Güvence: personel YALNIZCA kendi taleplerini görür (veritabanı kuralına ek olarak
  // uygulama tarafında da filtrelenir); yönetici ve müdürler ekip taleplerini görür.
  let q = supabase
    .from('leave_requests')
    .select('*, profiles:user_id(full_name)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (!isManager) {
    q = q.eq('user_id', profile.id);
  } else if (!['super_admin', 'admin'].includes(profile.role)) {
    // müdür: yalnızca yönettiği departmanların üyeleri + kendi talepleri
    const { data: teamMembers } = await supabase
      .from('department_members').select('user_id')
      .in('department_id', managedDepartmentIds);
    const ids = Array.from(new Set([
      ...(teamMembers ?? []).map((m: any) => m.user_id), profile.id
    ]));
    q = q.in('user_id', ids);
  }
  const { data: requests } = await q;

  // ---- yıllık izin bakiyesi (bu yıl kullanılan onaylı 'annual' günler) ----
  const year = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' })
    .format(new Date()).slice(0, 4));
  const yStart = `${year}-01-01`;
  const yEnd = `${year}-12-31`;
  const { data: myAnnual } = await supabase
    .from('leave_requests')
    .select('start_date, end_date')
    .eq('user_id', profile.id).eq('status', 'approved').eq('type', 'annual')
    .lte('start_date', yEnd).gte('end_date', yStart);
  let usedDays = 0;
  for (const l of myAnnual ?? []) {
    const s = l.start_date < yStart ? yStart : l.start_date;
    const e = l.end_date > yEnd ? yEnd : l.end_date;
    usedDays += Math.floor((new Date(e + 'T00:00:00Z').getTime() - new Date(s + 'T00:00:00Z').getTime()) / 86400000) + 1;
  }
  const allowance = (profile as any).leave_allowance ?? 14;

  return (
    <LeaveClient
      requests={(requests ?? []) as any}
      meId={profile.id}
      isManager={isManager}
      allowance={allowance}
      usedDays={usedDays}
      year={year}
    />
  );
}
