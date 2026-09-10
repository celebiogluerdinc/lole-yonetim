import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import NewTaskForm from '@/components/NewTaskForm';

export const dynamic = 'force-dynamic';

export default async function NewTaskPage() {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (profile.role === 'staff' && managedDepartmentIds.length === 0) redirect('/home');
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  // departments this user may assign into
  let deptQuery = supabase.from('departments').select('*').eq('company_id', companyId).order('name');
  const { data: allDepts } = await deptQuery;
  const departments = (allDepts ?? []).filter(d =>
    ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.includes(d.id)
  );

  const { data: people } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('full_name');

  const { data: memberships } = await supabase
    .from('department_members')
    .select('department_id, user_id');

  return (
    <main className="max-w-2xl mx-auto p-4 md:p-8">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight mb-6">Yeni Görev / Checklist</h1>
      <NewTaskForm
        departments={departments as any}
        people={(people ?? []) as any}
        memberships={(memberships ?? []) as any}
        aiAvailable={!!process.env.ANTHROPIC_API_KEY}
        isAdmin={['super_admin', 'admin'].includes(profile.role)}
      />
    </main>
  );
}
