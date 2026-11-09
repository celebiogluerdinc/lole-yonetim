import { getCtx } from '@/lib/auth';
import { salesBadges } from '@/lib/sales-badges';
import SalesTabs, { type SalesTab } from '@/components/sales/SalesTabs';

export const dynamic = 'force-dynamic';

/**
 * SAHA SATIŞ KABUĞU
 *
 * Yan menüde tek giriş var ("Satış & Pazarlama"); bölümler burada alt sekme
 * olarak açılıyor. Böylece hem kenar çubuğu şişmiyor hem de modülün bir
 * bütün olduğu görünüyor.
 *
 * Sekmeler role göre filtreleniyor: saha temsilcisi günlük akışı,
 * müdür yönetim bölümlerini de görüyor.
 *
 * Rozetler: üç sayaç TEK turda (Promise.all) alınıyor. `head: true` ile
 * satır gövdesi taşınmıyor — yalnızca sayı dönüyor.
 */
export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();

  const isManager =
    ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
  const isAdmin = ['super_admin', 'admin'].includes(profile.role);

  // Kenar çubuğu da aynı sayaçları gösteriyor; `cache()` sayesinde
  // sorgu istek başına bir kez çalışıyor.
  const { dueFollowUps, draftVisits, pendingOrders } =
    await salesBadges(supabase, profile.id, companyId);

  const all: (SalesTab & { show: boolean })[] = [
    { href: '/sales', label: 'Bugün', icon: 'bugun', group: 'gun', show: true },
    { href: '/sales/routes', label: 'Rota', icon: 'rota', group: 'gun', show: true },
    { href: '/sales/outlets', label: 'Noktalar', icon: 'noktalar', group: 'gun', show: true },
    { href: '/sales/visits', label: 'Ziyaretler', icon: 'ziyaretler', group: 'gun', show: true,
      badge: draftVisits ?? 0 },
    { href: '/sales/follow-ups', label: 'Takipler', icon: 'takipler', group: 'gun', show: true,
      badge: dueFollowUps ?? 0, warn: true },
    { href: '/sales/orders', label: 'Teklif & Sipariş', icon: 'ticaret', group: 'gun', show: true,
      badge: pendingOrders ?? 0, warn: true },
    { href: '/sales/execution', label: 'Saha İcra', icon: 'icra', group: 'yonetim', show: isManager },
    { href: '/sales/complaints', label: 'Şikâyetler', icon: 'sikayet', group: 'yonetim', show: isManager },
    { href: '/sales/products', label: 'Ürünler', icon: 'urun', group: 'yonetim', show: isManager },
    { href: '/sales/reports', label: 'Raporlar', icon: 'rapor', group: 'yonetim', show: isManager },
    { href: '/sales/settings', label: 'Ayarlar', icon: 'ayar', group: 'yonetim', show: isAdmin }
  ];

  const tabs: SalesTab[] = all.filter(t => t.show)
    .map(({ show, ...t }) => ({ ...t, badge: t.badge ?? 0, warn: t.warn ?? false }));

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8">
      <SalesTabs tabs={tabs} />
      {/* pb-28: mobil alt menü çubuğu son satırı örtüyordu */}
      <div className="pb-28 md:pb-12">{children}</div>
    </div>
  );
}
