import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import NewUserForm from '@/components/NewUserForm';
import UserManage, { type ManagedUser } from '@/components/UserManage';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const { supabase, profile, companyId } = await getCtx();
  if (!['super_admin', 'admin'].includes(profile.role)) redirect('/home');
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const isSuper = profile.role === 'super_admin';
  // adminler de tüm şirketlere kullanıcı ekleyip yönetebilir
  const crossCompany = ['super_admin', 'admin'].includes(profile.role);
  const [{ data: users }, { data: depts }, { data: memberships }, { data: companies }] = await Promise.all([
    supabase.from('profiles').select('*').eq('company_id', companyId).order('full_name'),
    crossCompany
      ? supabase.from('departments').select('id, name, company_id').order('name')
      : supabase.from('departments').select('id, name, company_id').eq('company_id', companyId).order('name'),
    supabase.from('department_members').select('department_id, user_id, is_manager'),
    crossCompany
      ? supabase.from('companies').select('id, name').eq('is_active', true).order('name')
      : Promise.resolve({ data: [] } as any)
  ]);

  const companyDepts = (depts ?? []).filter((d: any) => d.company_id === companyId);
  const companyDeptIds = new Set(companyDepts.map((d: any) => d.id));

  const rows: ManagedUser[] = (users ?? []).map((u: any) => {
    const mine = (memberships ?? []).filter(
      (m: any) => m.user_id === u.id && companyDeptIds.has(m.department_id)
    );
    return {
      id: u.id,
      full_name: u.full_name ?? '',
      email: u.email ?? '',
      role: u.role,
      is_active: u.is_active,
      leave_allowance: u.leave_allowance ?? 14,
      memberIds: mine.filter((m: any) => !m.is_manager).map((m: any) => m.department_id),
      managerIds: mine.filter((m: any) => m.is_manager).map((m: any) => m.department_id)
    };
  });

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight mb-1">Kullanıcılar</h1>
      <p className="text-[14px] text-[#8E8E93] mb-6">
        Düzenlemek için bir kullanıcıya dokunun — ad, rol, departman ve parola tek panelden.
      </p>

      <NewUserForm
        departments={(depts ?? []) as any}
        companies={(companies ?? []) as any}
        defaultCompanyId={companyId}
        isSuper={crossCompany}
      />

      <div className="card divide-y divide-white/[0.08] mt-6 overflow-hidden">
        {rows.map(u => (
          <UserManage key={u.id} user={u} departments={companyDepts as any} meId={profile.id} meIsSuper={isSuper} />
        ))}
      </div>
    </main>
  );
}
