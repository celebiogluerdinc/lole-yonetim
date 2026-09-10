import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import TemplateCard from '@/components/TemplateCard';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();
  const isManager = ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
  if (!isManager) redirect('/home');
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const [{ data: templates }, { data: items }, { data: people }, { data: depts }] = await Promise.all([
    supabase.from('templates').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('template_items').select('*').order('position'),
    supabase.from('profiles').select('id, full_name').eq('company_id', companyId).eq('is_active', true).order('full_name'),
    supabase.from('departments').select('id, name').eq('company_id', companyId)
  ]);

  const itemsByTpl: Record<string, any[]> = {};
  for (const it of items ?? []) (itemsByTpl[it.template_id] ??= []).push(it);
  const deptName: Record<string, string> = {};
  for (const d of depts ?? []) deptName[d.id] = d.name;

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Şablonlar</h1>
        <Link href="/manage/templates/new" className="btn-primary"><Plus size={16} /> Yeni Şablon</Link>
      </div>

      {(templates ?? []).length === 0 && (
        <div className="card p-10 text-center text-sm text-[#8E8E93]">
          Henüz şablon yok. Sık kullandığınız görev ve checklistleri şablon olarak kaydedin,
          tek dokunuşla atayın.
        </div>
      )}

      <div className="space-y-4">
        {(templates ?? []).map(t => (
          <TemplateCard
            key={t.id}
            template={t as any}
            items={itemsByTpl[t.id] ?? []}
            people={(people ?? []) as any}
            departmentName={t.department_id ? deptName[t.department_id] : undefined}
          />
        ))}
      </div>
    </main>
  );
}
