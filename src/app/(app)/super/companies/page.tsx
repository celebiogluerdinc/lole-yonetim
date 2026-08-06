import { getCtx } from '@/lib/auth';
import NewCompanyForm from '@/components/NewCompanyForm';
import CompanySwitch from '@/components/CompanySwitch';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const { supabase, profile, companyId } = await getCtx();
  const isSuper = profile.role === 'super_admin';

  const active = isSuper
    ? (cookies().get('active_company')?.value ?? null)
    : companyId;

  const { data: companies } = await supabase
    .from('companies').select('*').order('created_at');

  // quick stats (RLS: normal kullanıcılar yalnızca kendi şirketinin sayısını görür)
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
        {isSuper
          ? 'Bir şirkete girerek uygulamayı orada tam yetkiyle kullanabilirsiniz. Yeni şirket eklediğinizde Operasyon, Satış, Üretim ve Yönetim departmanları hazır gelir.'
          : 'Gruba bağlı şirketler aşağıda listelenir. Hesabınız işaretli şirkete bağlıdır; şirketler arasında geçiş yalnızca Süper Admin hesaplarında mümkündür.'}
      </p>

      {isSuper && <NewCompanyForm />}

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
                <p className="text-xs text-[#AEAEB2]">
                  {counts[c.id] ? `${counts[c.id]} kullanıcı` : ' '}
                </p>
              </div>
            </div>
            <div className="mt-4">
              {isSuper ? (
                <CompanySwitch companyId={c.id} isActive={active === c.id} />
              ) : active === c.id ? (
                <span className="badge bg-emerald-500/20 text-emerald-300">✓ Şirketiniz</span>
              ) : (
                <span className="badge bg-white/10 text-[#8E8E93]">Grup şirketi</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {!isSuper && (
        <p className="text-xs text-[#AEAEB2] mt-5">
          Birden fazla şirkette çalışmanız gerekiyorsa, Süper Admin sizi Kullanıcılar sayfasından
          &quot;Süper Admin&quot; yetkisine yükseltebilir — o zaman buradan tüm şirketlere geçiş yapabilirsiniz.
        </p>
      )}
    </main>
  );
}
