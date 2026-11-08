import { getCtx } from '@/lib/auth';
import { TZ } from '@/lib/utils';
import SalesTabs, { type SalesTab } from '@/components/sales/SalesTabs';

export const dynamic = 'force-dynamic';

/**
 * SAHA SATIŞ KABUĞU
 *
 * Yan menüde tek giriş var ("Satış & Pazarlama"); bölümler burada alt sekme
 * olarak açılıyor. Böylece hem kenar çubuğu şişmiyor hem de modülün bir
 * bütün olduğu görünüyor.
 *
 * Sekmeler role göre filtreleniyor: saha temsilcisi beş sekme görüyor,
 * müdür hepsini. Temsilciye raporu ve ayarları göstermek, günlük işinde
 * kullanmayacağı seçeneklerle dikkatini dağıtmak olurdu.
 */
export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, managedDepartmentIds } = await getCtx();

  const isManager =
    ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
  const isAdmin = ['super_admin', 'admin'].includes(profile.role);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });

  // Rozet: bana ait, vadesi gelmiş açık takipler. Tek sorgu.
  const { count: dueFollowUps } = await supabase
    .from('follow_ups').select('id', { count: 'exact', head: true })
    .eq('owner_user_id', profile.id).eq('status', 'acik').lte('due_date', today);

  const tabs: SalesTab[] = ([
    { href: '/sales', label: 'Bugün', show: true, badge: 0 },
    { href: '/sales/routes', label: 'Rota', show: true, badge: 0 },
    { href: '/sales/outlets', label: 'Noktalar', show: true, badge: 0 },
    { href: '/sales/visits', label: 'Ziyaretler', show: true, badge: 0 },
    { href: '/sales/follow-ups', label: 'Takipler', show: true, badge: dueFollowUps ?? 0 },
    { href: '/sales/orders', label: 'Teklif & Sipariş', show: true, badge: 0 },
    { href: '/sales/execution', label: 'Saha İcra', show: isManager, badge: 0 },
    { href: '/sales/complaints', label: 'Şikâyetler', show: isManager, badge: 0 },
    { href: '/sales/products', label: 'Ürünler', show: isManager, badge: 0 },
    { href: '/sales/reports', label: 'Raporlar', show: isManager, badge: 0 },
    { href: '/sales/settings', label: 'Ayarlar', show: isAdmin, badge: 0 }
  ] as const)
    .filter(t => t.show)
    .map(({ href, label, badge }) => ({ href, label, badge }));

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8">
      <SalesTabs tabs={tabs} />
      {/* pb-28: mobil alt menü çubuğu son satırı örtüyordu */}
      <div className="pb-28 md:pb-12">{children}</div>
    </div>
  );
}
