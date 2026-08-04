import { redirect } from 'next/navigation';
import { getCtx } from '@/lib/auth';
import NewCompanyForm from '@/components/NewCompanyForm';
import CompanySwitch from '@/components/CompanySwitch';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const { supabase, profile } = await getCtx();
  if (profile.role !== 'super_admin') redirect('/home');

  const active = cookies().get('active_company')?.value ?? null;
  const { data: companies } = await supabase
    .from('companies').select('*').order('created_at');

  // quick stats
  const { data: profileCounts } = await supabase
    .from('profiles').select('company_id');
  const counts: Record<string, number> = {};
  for (const p of profileCounts ?? []) {
    if (p.company_id) counts[p.company_id] = (counts[p.company_id] ?? 0) + 1;
  }

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight mb-1">Şirketler</h1>
      <p className="text-sm text-[#8E8E93] mb-6">
        Bir şirkete girerek uygulamayı orada tam yetkiyle kullanabilirsiniz.
        Yeni şirket eklediğinizde Operasyon, Satış, Üretim ve Yönetim departmanları hazır gelir.
      </p>

      <NewCompanyForm />

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        {(companies ?? []).map(c => (
          <div key={c.id} className={`card p-5 ${active === c.id ? 'border-brand-300 ring-2 ring-brand-100' : ''}`}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold"
                style={{ backgroundColor: c.accent_color ?? '#ff5a1f' }}
              >
                {c.name.replace('Lole ', '')[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate">{c.name}</p>
                <p className="text-xs text-[#AEAEB2]">{counts[c.id] ?? 0} kullanıcı</p>
              </div>
            </div>
            <div className="mt-4">
              <CompanySwitch companyId={c.id} isActive={active === c.id} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
