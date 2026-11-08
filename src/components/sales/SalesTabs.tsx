'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

export interface SalesTab { href: string; label: string; badge?: number }

/**
 * Saha satış alt sekme çubuğu.
 *
 * Kenar çubuğunda on bir sekme taşımak hem yan menüyü şişiriyor hem de
 * modülün bir bütün olduğunu gizliyordu. Tek giriş + burada alt sekmeler.
 *
 * Kaydırma notu: çubuk `sticky` ama sayfa gövdesi KENDİ kaydırma kutusunu
 * açmıyor. İç içe kaydırma kutusu, mobilde "sayfa en alta inmiyor" sorununun
 * en sık sebebi; burada bilinçli olarak kaçınıldı — sayfa normal pencere
 * kaydırmasıyla çalışıyor.
 */
export default function SalesTabs({ tabs }: { tabs: SalesTab[] }) {
  const pathname = usePathname();
  const barRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) =>
    href === '/sales' ? pathname === '/sales' : pathname.startsWith(href);

  // Aktif sekme görünür alanın dışındaysa çubuğu ona kaydır —
  // mobilde "Raporlar" sekmesi sağda kalıp hiç görünmüyordu.
  useEffect(() => {
    const el = barRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [pathname]);

  return (
    <div className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-2.5
      bg-[#0b0b0d]/85 backdrop-blur-xl border-b border-white/[0.08]">
      <div ref={barRef} className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map(t => {
          const active = isActive(t.href);
          return (
            <Link key={t.href} href={t.href} data-active={active}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${
                active
                  ? 'bg-ios-blue text-white'
                  : 'bg-[#1C1C1E] text-[#D1D1D6] shadow-[0_0_0_0.5px_rgba(255,255,255,0.09)] hover:bg-[#2C2C2E]'
              }`}>
              {t.label}
              {!!t.badge && t.badge > 0 && (
                <span className={`text-[11px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ${
                  active ? 'bg-white/25' : 'bg-ios-red text-white'}`}>
                  {t.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
