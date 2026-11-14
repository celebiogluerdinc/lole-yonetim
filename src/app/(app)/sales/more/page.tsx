import Link from 'next/link';
import { getCtx } from '@/lib/auth';
import { salesBadges, isSalesManager } from '@/lib/sales-badges';
import {
  ClipboardCheck, BellRing, BarChart3, ShieldCheck,
  MessageSquareWarning, Package, Settings2, ChevronRight
} from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * DİĞER BÖLÜMLER
 *
 * Dört sekmeye inince geri kalan bölümler buraya toplandı. Günlük
 * akışta gerekmeyen ama kaybolmaması gereken ekranlar: rota detayı,
 * ziyaret ve takip arşivi, yönetim ekranları.
 *
 * Rol filtresi burada: temsilciye kullanmayacağı ekranı göstermek,
 * aradığını bulmasını zorlaştırmak olurdu.
 */
export default async function MorePage() {
  const { supabase, profile, companyId, managedDepartmentIds } = await getCtx();

  const isManager =
    ['super_admin', 'admin'].includes(profile.role) || managedDepartmentIds.length > 0;
  const isAdmin = ['super_admin', 'admin'].includes(profile.role);

  const { dueFollowUps, draftVisits } = await salesBadges(
    supabase, profile.id, companyId, isSalesManager(profile.role, managedDepartmentIds));

  const groups: {
    title: string;
    items: { href: string; label: string; note: string; icon: any; badge?: number; show: boolean }[];
  }[] = [
    {
      // Rota artık kendi sekmesinde; burada yalnız arşiv niteliğindekiler var.
      title: 'Arşiv',
      items: [
        { href: '/sales/follow-ups', label: 'Takipler', icon: BellRing, show: true,
          badge: dueFollowUps, note: 'Söz verilen işler, sonuçları ve kapanış kanıtları' },
        { href: '/sales/visits', label: 'Ziyaret arşivi', icon: ClipboardCheck, show: true,
          badge: draftVisits, note: 'Tüm ziyaretler, taslaklar, arama, Excel çıktısı' }
      ]
    },
    {
      title: 'Yönetim',
      items: [
        { href: '/sales/reports', label: 'Raporlar', icon: BarChart3, show: isManager,
          note: 'Günlük, haftalık, aylık; itiraz dağılımı ve huni' },
        { href: '/sales/execution', label: 'Saha icra', icon: ShieldCheck, show: isManager,
          note: 'Nokta açılış kontrolü ve personel eğitimi' },
        { href: '/sales/complaints', label: 'Şikâyetler', icon: MessageSquareWarning, show: isManager,
          note: 'Hasar ve ürün güvenliği kayıtları, tekrar sipariş planı' },
        { href: '/sales/products', label: 'Ürünler', icon: Package, show: isManager,
          note: 'Ürün listesi ve tat referansları' },
        { href: '/sales/settings', label: 'Ayarlar', icon: Settings2, show: isAdmin,
          note: 'Fiyat, hedef, puan kriterleri, nokta tipleri' }
      ]
    }
  ];

  return (
    <main className="py-5 space-y-5">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Diğer</h1>
        <p className="text-[14px] text-[#8E8E93]">
          Arşiv ve yönetim ekranları. Ziyaret ve satış nokta kartından, günün planı Rota sekmesinden yürür.
        </p>
      </header>

      {groups.map(g => {
        const items = g.items.filter(i => i.show);
        if (!items.length) return null;
        return (
          <section key={g.title} className="space-y-2">
            <p className="section-title px-1">{g.title}</p>
            <div className="card divide-y divide-white/[0.08] overflow-hidden">
              {items.map(i => (
                <Link key={i.href} href={i.href}
                  className="flex items-center gap-3 px-4 py-3.5 min-h-[56px] hover:bg-white/[0.04] transition-colors">
                  <span className="shrink-0 w-9 h-9 rounded-xl bg-white/[0.07] flex items-center justify-center">
                    <i.icon size={17} className="text-[#D1D1D6]" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium flex items-center gap-2">
                      {i.label}
                      {!!i.badge && i.badge > 0 && (
                        <span className="badge bg-ios-red/20 text-rose-300">{i.badge}</span>
                      )}
                    </p>
                    <p className="text-[12.5px] text-[#8E8E93] truncate">{i.note}</p>
                  </div>
                  <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
