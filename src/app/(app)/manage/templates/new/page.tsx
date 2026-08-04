import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import NewTemplateForm from '@/components/NewTemplateForm';

export const dynamic = 'force-dynamic';

export default async function NewTemplatePage() {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  if (profile.role === 'staff' && managedDepartmentIds.length === 0) redirect('/home');
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const { data: allDepts } = await supabase
    .from('departments').select('*').eq('company_id', companyId).order('name');
  const departments = (allDepts ?? []).filter(d =>
    ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.includes(d.id)
  );

  return (
    <main className="max-w-2xl mx-auto p-4 md:p-8">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight mb-6">Yeni Şablon</h1>
      <NewTemplateForm departments={departments as any} aiAvailable={!!process.env.ANTHROPIC_API_KEY} />
    </main>
  );
}
