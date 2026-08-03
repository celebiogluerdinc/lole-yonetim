import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/utils';
import NewUserForm from '@/components/NewUserForm';
import UserActiveToggle from '@/components/UserActiveToggle';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const { supabase, profile, companyId } = await getCtx();
  if (!['super_admin', 'admin'].includes(profile.role)) redirect('/home');
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const [{ data: users }, { data: depts }, { data: memberships }] = await Promise.all([
    supabase.from('profiles').select('*').eq('company_id', companyId).order('full_name'),
    supabase.from('departments').select('id, name').eq('company_id', companyId).order('name'),
    supabase.from('department_members').select('department_id, user_id, is_manager')
  ]);

  const deptName: Record<string, string> = {};
  for (const d of depts ?? []) deptName[d.id] = d.name;
  const userDepts: Record<string, string[]> = {};
  for (const m of memberships ?? []) {
    if (deptName[m.department_id]) {
      (userDepts[m.user_id] ??= []).push(
        `${deptName[m.department_id]}${m.is_manager ? ' (Müdür)' : ''}`
      );
    }
  }

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8">
      <h1 className="text-2xl font-bold tracking-tight mb-6">Kullanıcılar</h1>

      <NewUserForm departments={(depts ?? []) as any} />

      <div className="card divide-y divide-slate-100 mt-6">
        {(users ?? []).map(u => (
          <div key={u.id} className="flex items-center gap-3 p-4">
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold shrink-0">
              {(u.full_name || u.email)[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${u.is_active ? '' : 'text-slate-400 line-through'}`}>
                {u.full_name || u.email}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {ROLE_LABEL[u.role]} · {u.email}
                {userDepts[u.id]?.length ? ` · ${userDepts[u.id].join(', ')}` : ''}
              </p>
            </div>
            {u.id !== profile.id && (
              <UserActiveToggle userId={u.id} active={u.is_active} />
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
