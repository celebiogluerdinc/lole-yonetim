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
  if (!isManager) q = q.eq('user_id', profile.id);
  const { data: requests } = await q;

  return (
    <LeaveClient
      requests={(requests ?? []) as any}
      meId={profile.id}
      isManager={isManager}
    />
  );
}
