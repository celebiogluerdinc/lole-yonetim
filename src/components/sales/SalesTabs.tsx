'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Route, Store, Receipt, LayoutGrid, type LucideIcon } from 'lucide-react';

export type SalesTabIcon = 'bugun' | 'rota' | 'noktalar' | 'satis' | 'diger';

const ICONS: Record<SalesTabIcon, LucideIcon> = {
  bugun: Sun, rota: Route, noktalar: Store, satis: Receipt, diger: LayoutGrid
};

export interface SalesTab {
  href: string;
  label: string;
  icon: SalesTabIcon;
  /** Bekleyen iş sayısı — kırmızı rozet */
  badge?: number;
  /** Bu sekmenin altında açılan diğer yollar (aktiflik bunlara da bakar) */
  owns?: string[];
}

/**
 * SAHA SATIŞ — BEŞ SEKME
 *
 * On bir sekme vardı ve asıl şikâyet buydu: "sayfalar arası kargaşa".
 * Temsilcinin günü dört soruya iniyor — bugün ne yapacağım, nereye
 * gideceğim, hangi noktada ne var, satış ne durumda. Beşinci sekme geri
 * kalan her şeyin listesi.
 *
 * Rota ayrı sekme: Bugün ekranının düğmelerinin çoğu oraya gidiyor ama
 * Rota "Diğer" listesinde gömülüydü; kullanıcı Bugün'den çıkınca hangi
 * sekmede olduğunu bilemiyordu.
 */
export default function SalesTabs({ tabs }: { tabs: SalesTab[] }) {
  const pathname = usePathname();

  // EN UZUN ÖNEK KAZANIR. Düz "startsWith" ile /sales/visits/new hem
  // Noktalar'a (ziyaret formu nokta işidir) hem Diğer'e (/sales/visits
  // arşivi) uyuyordu ve hangisinin yanacağı dizideki sıraya kalıyordu —
  // "her çıkış başka sekmeyi yakıyor" şikâyetinin kaynağı buydu.
  // Sınır denetimi de var: /sales/routes, /sales/routes-eski'yi sahiplenmez.
  const matchLen = (t: SalesTab) => {
    // "Bugün" modülün köküdür; önek sayılırsa her sayfada o yanardı.
    if (t.href === '/sales') return pathname === '/sales' ? 6 : 0;
    let best = 0;
    for (const p of [t.href, ...(t.owns ?? [])]) {
      if ((pathname === p || pathname.startsWith(p + '/')) && p.length > best) best = p.length;
    }
    return best;
  };
  let activeHref: string | null = null;
  let bestLen = 0;
  for (const t of tabs) {
    const n = matchLen(t);
    if (n > bestLen) { bestLen = n; activeHref = t.href; }
  }

  return (
    // Üstte yapışık: uygulamanın kendi alt barı ekranın altını tutuyor,
    // iki çubuk üst üste binmesin. Zemin açık tema yüzeyi (yarı saydam +
    // bulanıklık) — eski koyu zemin açık temada siyah bir şerit olarak
    // kalıyor, pasif sekmeler içinde kayboluyordu.
    // color-mix'i tanımayan eski WebView satır içi stili yok sayar ve
    // sınıftaki düz zemine düşer; çubuk hiçbir tarayıcıda saydam kalmaz.
    <div className="sticky top-0 z-30 -mx-4 md:-mx-8 px-3 md:px-8 pt-2.5 pb-2.5
      bg-[color:var(--raised)] border-b border-[color:var(--line)] backdrop-blur-xl"
      style={{ background: 'color-mix(in srgb, var(--raised) 88%, transparent)' }}>
      <nav className="grid grid-cols-5 gap-1.5" aria-label="Satış & Pazarlama">
        {tabs.map(t => {
          const active = t.href === activeHref;
          const Icon = ICONS[t.icon];
          const n = t.badge ?? 0;
          return (
            <Link key={t.href} href={t.href} aria-current={active ? 'page' : undefined}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-xl
                min-h-[52px] px-0.5 py-2 transition-colors ${
                active
                  ? 'bg-[color:var(--blue)] text-white shadow-[0_2px_8px_rgba(10,108,255,0.28)]'
                  : 'bg-[color:var(--fill)] text-[color:var(--muted)] hover:bg-[color:var(--fill-hover)] hover:text-[color:var(--ink)]'
              }`}>
              <Icon size={19} strokeWidth={active ? 2.3 : 2} />
              <span className="text-[12px] font-semibold leading-none">{t.label}</span>
              {n > 0 && (
                <span
                  aria-label={`${n} bekleyen iş`}
                  className={`absolute -top-1 right-0.5 text-[10.5px] font-bold tabular-nums
                  rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center
                  ring-2 ring-[color:var(--raised)] ${
                  active ? 'bg-white text-[color:var(--blue)]' : 'bg-[color:var(--red)] text-white'
                }`}>
                  {n > 99 ? '99+' : n}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
