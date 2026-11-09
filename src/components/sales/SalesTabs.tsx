'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  Sun, Route, Store, ClipboardCheck, BellRing, Receipt,
  ShieldCheck, MessageSquareWarning, Package, BarChart3, Settings2,
  type LucideIcon
} from 'lucide-react';

export type SalesTabIcon =
  | 'bugun' | 'rota' | 'noktalar' | 'ziyaretler' | 'takipler' | 'ticaret'
  | 'icra' | 'sikayet' | 'urun' | 'rapor' | 'ayar';

const ICONS: Record<SalesTabIcon, LucideIcon> = {
  bugun: Sun, rota: Route, noktalar: Store, ziyaretler: ClipboardCheck,
  takipler: BellRing, ticaret: Receipt, icra: ShieldCheck,
  sikayet: MessageSquareWarning, urun: Package, rapor: BarChart3, ayar: Settings2
};

export interface SalesTab {
  href: string;
  label: string;
  icon: SalesTabIcon;
  /** Sayaç. `warn` ise kırmızı (bekleyen iş), değilse mavi (bilgi). */
  badge?: number;
  warn?: boolean;
  /** 'gun' = günlük akış · 'yonetim' = müdür/admin bölümleri */
  group: 'gun' | 'yonetim';
}

/**
 * SAHA SATIŞ ALT SEKMELERİ
 *
 * Önceki tasarım küçük gri yuvarlaklardı: hangi sekmede olduğunuz
 * zor anlaşılıyordu ve on bir sekme birbirinden ayrışmıyordu. Yenisinde
 * üç şey değişti:
 *
 *   1. Her sekme ikon + etiket taşıyor — sahada göz ikonu metinden
 *      hızlı buluyor.
 *   2. Günlük akış ile yönetim bölümleri görsel olarak ayrılıyor
 *      (ayırıcı çizgi + mobilde ayrı kaydırma grubu).
 *   3. Bekleyen iş sayısı kırmızı rozetle sekmenin üstünde duruyor;
 *      "bekleyen sipariş var mı" sorusu için bölüme girmek gerekmiyor.
 *
 * Kaydırma notu: çubuk `sticky` ama sayfa gövdesi KENDİ kaydırma kutusunu
 * açmıyor. İç içe kaydırma kutusu, mobilde "sayfa en alta inmiyor"
 * sorununun en sık sebebi.
 */
export default function SalesTabs({ tabs }: { tabs: SalesTab[] }) {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    href === '/sales' ? pathname === '/sales' : pathname.startsWith(href);

  // Aktif sekme görünür alanın dışındaysa çubuğu ona kaydır —
  // mobilde son sekmeler sağda kalıp hiç görünmüyordu.
  useEffect(() => {
    const el = barRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  const gun = tabs.filter(t => t.group === 'gun');
  const yonetim = tabs.filter(t => t.group === 'yonetim');
  const totalWarn = tabs.reduce((n, t) => n + (t.warn && t.badge ? t.badge : 0), 0);

  return (
    <div className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 pt-3 pb-2.5
      bg-gradient-to-b from-[#0b0b0d] via-[#0b0b0d]/95 to-[#0b0b0d]/80
      backdrop-blur-xl border-b border-white/[0.09]">

      {/* Modül başlığı: alt sekmeler bir menünün içinde olduğunu söylüyor */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6E6E73]">
          Satış &amp; Pazarlama
        </p>
        {totalWarn > 0 && (
          <span className="text-[11px] font-semibold text-amber-300/90">
            {totalWarn} bekleyen iş
          </span>
        )}
      </div>

      <div ref={barRef}
        className="flex items-stretch gap-1.5 overflow-x-auto md:overflow-visible
          md:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {gun.map(t => <Tab key={t.href} tab={t} active={isActive(t.href)} />)}

        {yonetim.length > 0 && (
          <span className="shrink-0 self-stretch w-px my-1 mx-1 bg-white/[0.12]" aria-hidden />
        )}

        {yonetim.map(t => <Tab key={t.href} tab={t} active={isActive(t.href)} muted />)}
      </div>
    </div>
  );
}

function Tab({ tab, active, muted }: { tab: SalesTab; active: boolean; muted?: boolean }) {
  const Icon = ICONS[tab.icon];
  const n = tab.badge ?? 0;

  return (
    <Link href={tab.href} data-active={active} aria-current={active ? 'page' : undefined}
      className={`group relative shrink-0 flex items-center gap-2 rounded-xl pl-2 pr-3.5 py-2
        min-h-[44px] transition-all duration-150 ${
        active
          ? 'bg-ios-blue text-white shadow-[0_2px_12px_-2px_rgba(10,108,255,0.65)]'
          : muted
            ? 'bg-white/[0.04] text-[#9A9AA0] hover:bg-white/[0.08] hover:text-[#D1D1D6]'
            : 'bg-[#1C1C1E] text-[#D1D1D6] shadow-[0_0_0_0.5px_rgba(255,255,255,0.1)] hover:bg-[#2C2C2E]'
      }`}>
      <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
        active ? 'bg-white/20' : 'bg-white/[0.07] group-hover:bg-white/[0.12]'
      }`}>
        <Icon size={15} />
      </span>

      <span className="text-[13.5px] font-semibold whitespace-nowrap">{tab.label}</span>

      {n > 0 && (
        <span className={`ml-0.5 text-[11px] font-bold tabular-nums rounded-full
          min-w-[19px] h-[19px] px-1.5 flex items-center justify-center ${
          active
            ? 'bg-white text-ios-blue'
            : tab.warn
              ? 'bg-ios-red text-white'
              : 'bg-white/[0.14] text-[#D1D1D6]'
        }`}>
          {n > 99 ? '99+' : n}
        </span>
      )}

      {/* Aktif sekmenin altındaki ince çizgi: filled renk + çizgi birlikte
          hangi sekmede olduğunu uzaktan da belli ediyor. */}
      {active && (
        <span className="absolute -bottom-[10.5px] left-3 right-3 h-[2.5px] rounded-full bg-ios-blue" />
      )}
    </Link>
  );
}
