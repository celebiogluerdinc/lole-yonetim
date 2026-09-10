import { getCtx } from '@/lib/auth';
import NewCompanyForm from '@/components/NewCompanyForm';
import CompanySwitch from '@/components/CompanySwitch';

export const dynamic = 'force-dynamic';

export default async function CompaniesPage() {
  const { supabase, profile, companyId } = await getCtx();
  const isSuper = profile.role === 'super_admin';
  const canSwitch = ['super_admin', 'admin'].includes(profile.role);

  const active = companyId;

  const { data: companies } = await supabase
    .from('companies').select('*').order('created_at');

  // quick stats (RLS: normal kullanıcılar yalnızca kendi şirketinin sayısını görür)
  const { data: profileCounts } = await supabase
    .from('profiles').select('company_id, is_customer');
  const counts: Record<string, number> = {};
  const customerCounts: Record<string, number> = {};
  for (const p of profileCounts ?? []) {
    if (!p.company_id) continue;
    counts[p.company_id] = (counts[p.company_id] ?? 0) + 1;
    if ((p as any).is_customer) customerCounts[p.company_id] = (customerCounts[p.company_id] ?? 0) + 1;
  }

  const all = companies ?? [];
  const internal = all.filter((c: any) => c.kind !== 'order_line');
  const orderLines = all.filter((c: any) => c.kind === 'order_line');

  const Card = ({ c }: { c: any }) => {
    const isOrder = c.kind === 'order_line';
    return (
      <div className={`card p-5 ${active === c.id ? 'border-brand-300 ring-2 ring-brand-100' : ''}`}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold shrink-0"
            style={{ backgroundColor: c.accent_color ?? (isOrder ? '#5E5CE6' : '#ff5a1f') }}
          >
            {isOrder ? '📦' : c.name.replace('Lole ', '')[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold truncate">{c.name}</p>
            <p className="text-xs text-[#AEAEB2]">
              {isOrder
                ? `${customerCounts[c.id] ?? 0} müşteri hesabı · ${counts[c.id] ?? 0} kullanıcı`
                : (counts[c.id] ? `${counts[c.id]} kullanıcı` : ' ')}
            </p>
          </div>
          {isOrder && <span className="badge bg-indigo-500/20 text-indigo-300 shrink-0">Sipariş Hattı</span>}
        </div>
        <div className="mt-4">
          {canSwitch ? (
            <CompanySwitch companyId={c.id} isActive={active === c.id} />
          ) : active === c.id ? (
            <span className="badge bg-emerald-500/20 text-emerald-300">✓ {isOrder ? 'Sipariş hattınız' : 'Şirketiniz'}</span>
          ) : (
            <span className="badge bg-white/10 text-[#8E8E93]">{isOrder ? 'Sipariş hattı' : 'Grup şirketi'}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight mb-1">Şirketler</h1>
      <p className="text-sm text-[#8E8E93] mb-6">
        {canSwitch
          ? 'Bir şirkete girerek uygulamayı orada tam yetkiyle kullanabilirsiniz. Admin ve Süper Admin hesapları tüm şirketlere erişir.'
          : 'Gruba bağlı şirketler aşağıda listelenir. Hesabınız işaretli şirkete bağlıdır.'}
      </p>

      {isSuper && <NewCompanyForm />}

      <h2 className="section-title mt-8 mb-3">🏢 Grup Şirketleri</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {internal.map((c: any) => <Card key={c.id} c={c} />)}
      </div>

      <h2 className="section-title mt-8 mb-3">📦 Sipariş Hatları</h2>
      {orderLines.length === 0 ? (
        <div className="card p-6 text-center text-sm text-[#8E8E93]">
          Henüz sipariş hattı yok.
          {isSuper && ' Yukarıdaki formdan "📦 Sipariş Hattı" seçerek oluşturabilirsiniz.'}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {orderLines.map((c: any) => <Card key={c.id} c={c} />)}
        </div>
      )}

      {!canSwitch && (
        <p className="text-xs text-[#AEAEB2] mt-5">
          Şirketler arasında geçiş Admin ve Süper Admin hesaplarında mümkündür.
        </p>
      )}
    </main>
  );
}
