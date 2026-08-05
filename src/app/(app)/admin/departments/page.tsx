import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import NewDepartmentForm from '@/components/NewDepartmentForm';
import { Building2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DepartmentsPage() {
  const { supabase, profile, companyId } = await getCtx();
  if (!['super_admin', 'admin'].includes(profile.role)) redirect('/home');
  if (!companyId) redirect(profile.role === 'super_admin' ? '/super/companies' : '/home');

  const [{ data: depts }, { data: memberships }] = await Promise.all([
    supabase.from('departments').select('*').eq('company_id', companyId).order('created_at'),
    supabase.from('department_members').select('department_id, is_manager, profiles:user_id(full_name)')
  ]);

  const byDept: Record<string, { members: string[]; managers: string[] }> = {};
  for (const m of memberships ?? []) {
    const b = (byDept[m.department_id] ??= { members: [], managers: [] });
    const name = (m as any).profiles?.full_name;
    if (!name) continue;
    if (m.is_manager) b.managers.push(name); else b.members.push(name);
  }

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight mb-6">Departmanlar</h1>

      <NewDepartmentForm />

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        {(depts ?? []).map(d => (
          <div key={d.id} className="card p-5">
            <h3 className="font-semibold flex items-center gap-2">
              <Building2 size={16} className="text-ios-blue" />
              {d.name}
              {d.is_preset && <span className="badge bg-white/10 text-[#8E8E93]">Hazır</span>}
            </h3>
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-[#8E8E93]">
                <span className="font-medium text-[#D1D1D6]">Müdür:</span>{' '}
                {byDept[d.id]?.managers.join(', ') || '—'}
              </p>
              <p className="text-[#8E8E93]">
                <span className="font-medium text-[#D1D1D6]">Üyeler:</span>{' '}
                {byDept[d.id]?.members.join(', ') || '—'}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#AEAEB2] mt-4">
        Üyelik ve müdür atamaları Kullanıcılar sayfasından, kullanıcı oluştururken yapılır.
      </p>
    </main>
  );
}
