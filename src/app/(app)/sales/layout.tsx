import { getCtx } from '@/lib/auth';
import { salesBadges, isSalesManager } from '@/lib/sales-badges';
import SalesTabs, { type SalesTab } from '@/components/sales/SalesTabs';
import OfflineQueueBanner from '@/components/sales/OfflineQueueBanner';

export const dynamic = 'force-dynamic';

/**
 * SAHA SATIŞ KABUĞU — beş sekme
 *
 * Önceki sürümde on bir alt sekme vardı; asıl şikâyet buydu
 * ("sayfalar arası kargaşa"). Temsilcinin günü dört soruya iniyor:
 * bugün ne yapacağım · nereye gideceğim · hangi noktada ne var ·
 * satış ne durumda. Beşinci sekme geri kalan bölümlerin listesi.
 *
 * HER ADRESİN TEK SAHİBİ VAR (owns). Kural: kullanıcı bir işe hangi
 * sekmeden girdiyse çıkışta da o sekme yanık olmalı.
 *   Rota      → rota planı
 *   Noktalar  → nokta kartı ve ziyaret formu (ziyaret nokta kartından açılır)
 *   Satış     → sipariş, teklif, doğrudan satış
 *   Diğer     → takipler, ziyaret arşivi, yönetim ekranları
 * /sales/visits/new Noktalar'ın, /sales/visits (arşiv) Diğer'in:
 * SalesTabs en uzun eşleşen yolu seçtiği için ikisi çakışmıyor.
 */
export default async function SalesLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();

  // Uygulama kabuğu da aynı sayaçları gösteriyor; argümanlar orada da
  // birebir aynı olduğu için cache() sorguyu istek başına bir kez çalıştırıyor.
  const { dueFollowUps, draftVisits, pendingOrders } = await salesBadges(
    supabase, profile.id, companyId, isSalesManager(profile.role, managedDepartmentIds));

  const tabs: SalesTab[] = [
    // Bugün rozeti: vadesi gelmiş takipler. Ekranın kendisinden
    // kapatılabildiği için rozet de oradan temizleniyor.
    { href: '/sales', label: 'Bugün', icon: 'bugun', badge: dueFollowUps },
    { href: '/sales/routes', label: 'Rota', icon: 'rota' },
    {
      href: '/sales/outlets', label: 'Noktalar', icon: 'noktalar',
      owns: ['/sales/visits/new']
    },
    { href: '/sales/orders', label: 'Satış', icon: 'satis', badge: pendingOrders },
    {
      // Taslak ziyaretler arşivde tamamlanıyor; rozet işin durduğu sekmede.
      href: '/sales/more', label: 'Diğer', icon: 'diger', badge: draftVisits,
      owns: ['/sales/follow-ups', '/sales/visits', '/sales/reports', '/sales/execution',
             '/sales/complaints', '/sales/products', '/sales/settings']
    }
  ];

  return (
    // DOKUNMA HEDEFİ GÜVENCESİ: sahada ayakta, tek elle kullanılıyor.
    // Modülün birçok ekranında düğmeler `!py-1.5` ile ~30px'e küçültülmüş;
    // tek tek kovalamak yerine alt sınır burada, modülün tamamı için
    // konuyor. `!` gerekli: globals.css'teki bileşen sınıflarını ve
    // sayfalardaki `!py-*` küçültmelerini ezmesi lazım.
    <div className="max-w-5xl mx-auto px-4 md:px-8
      [&_.btn-primary]:!min-h-[44px] [&_.btn-ghost]:!min-h-[44px] [&_.btn-outline]:!min-h-[44px]">
      <SalesTabs tabs={tabs} />
      {/* Bağlantı yokken kaydedilen ziyaretler: göster ve bağlantı gelince gönder */}
      <OfflineQueueBanner />
      {/* pb-28: mobil alt menü çubuğu son satırı örtüyordu */}
      <div className="pb-28 md:pb-12">{children}</div>
    </div>
  );
}
