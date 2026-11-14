'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Gift } from 'lucide-react';
import { tl, BOTTLES_PER_CASE, bottlePriceFromCase, casePriceFromBottle } from '@/lib/commerce-format';

export interface SaleProduct { id: string; name: string }

export interface SaleLinesState {
  /** En az bir satırda miktar var mı */
  any: boolean;
  /** Ücretli satırı olup fiyatı girilmemiş ürün var mı */
  missingPrice: boolean;
  /** KDV hariç net toplam */
  net: number;
  /** Toplam koli (ücretli + bedelsiz) */
  cases: number;
}

/**
 * SATIŞ SATIRLARI — koli adedi ve KOLİ FİYATI
 *
 * Saha koli ile pazarlık yapıyor: "koli 700". Önceki sürümde fiyat
 * yalnızca liste fiyatından geliyordu ve ekranda değiştirilemiyordu —
 * sahada anlaşılan fiyat girilemediği için doğrudan satış yapılamıyordu.
 *
 * Artık her satırda düzenlenebilir koli fiyatı var; liste fiyatı
 * (şişe × 12) öneri olarak hazır geliyor. Veritabanı şişe fiyatı
 * tutuyor, çevrim tek yerde: koli fiyatı / 12, dört ondalıkla.
 * Dört ondalık şart — 700/12 = 58,3333 ve iki ondalıkta kolide
 * 4 kuruş kayboluyordu (migration 0032).
 *
 * Bedelsiz koli varsayılan olarak gizli: satırı kalabalıklaştırmadan,
 * ihtiyaç duyanın açabildiği bir alan.
 */
export default function SaleLines({
  products, prices, field, onState, compact = false
}: {
  products: SaleProduct[];
  /** Ürün başına ŞİŞE fiyatı (liste veya noktayla anlaşılan); null = tanımsız */
  prices: Record<string, number | null>;
  /** 'order' → oi_<id>_* alanları · 'quote' → item_<id>_* alanları */
  field: 'order' | 'quote';
  onState?: (s: SaleLinesState) => void;
  compact?: boolean;
}) {
  const [cases, setCases] = useState<Record<string, string>>({});
  const [free, setFree] = useState<Record<string, string>>({});
  const [casePrice, setCasePrice] = useState<Record<string, string>>({});
  const [freeOpen, setFreeOpen] = useState<Record<string, boolean>>({});
  // Kullanıcı fiyatı elle değiştirdiyse liste fiyatı üzerine yazmıyoruz
  const touched = useRef<Record<string, boolean>>({});

  // Liste fiyatı geldiğinde koli fiyatını öner (dokunulmamış satırlara)
  useEffect(() => {
    setCasePrice(prev => {
      const next = { ...prev };
      for (const p of products) {
        if (touched.current[p.id]) continue;
        const b = prices[p.id];
        next[p.id] = b && b > 0 ? String(casePriceFromBottle(b)) : '';
      }
      return next;
    });
  }, [prices, products]);

  const num = (v: string | undefined) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const lines = useMemo(() => products.map(p => {
    const paidCases = Math.max(0, Math.round(num(cases[p.id])));
    const freeCases = Math.max(0, Math.round(num(free[p.id])));
    const cp = num(casePrice[p.id]);
    // Veritabanı şişe tutuyor: koli fiyatı / 12, dört ondalık
    const bottlePrice = bottlePriceFromCase(cp);
    return {
      p, paidCases, freeCases, cp, bottlePrice,
      total: paidCases * cp
    };
  }), [products, cases, free, casePrice]);

  const state = useMemo<SaleLinesState>(() => ({
    any: lines.some(l => l.paidCases > 0 || l.freeCases > 0),
    missingPrice: lines.some(l => l.paidCases > 0 && l.cp <= 0),
    net: lines.reduce((s, l) => s + l.total, 0),
    cases: lines.reduce((s, l) => s + l.paidCases + l.freeCases, 0)
  }), [lines]);

  const cb = useRef(onState);
  cb.current = onState;
  useEffect(() => { cb.current?.(state); }, [state]);

  return (
    <div className="space-y-2">
      {products.length === 0 && (
        <p className="text-[13px] text-[#8E8E93]">Tanımlı ürün yok.</p>
      )}

      {lines.map(l => {
        const pid = l.p.id;
        const listPrice = prices[pid];
        const showFree = freeOpen[pid] || l.freeCases > 0;
        return (
          <div key={pid} className="rounded-xl bg-white/[0.03] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-medium flex-1 min-w-0 truncate">{l.p.name}</p>
              {!showFree && (
                <button type="button" onClick={() => setFreeOpen(s => ({ ...s, [pid]: true }))}
                  className="text-[11.5px] text-[#8E8E93] hover:text-[#D1D1D6] flex items-center gap-1 shrink-0"
                  title="Bedelsiz koli ekle">
                  <Gift size={12} /> bedelsiz
                </button>
              )}
            </div>

            <div className={`grid gap-2 mt-2 ${showFree ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <label className="block">
                <span className="block text-[11px] text-[#8E8E93] mb-1">Koli</span>
                <input inputMode="numeric" className="input !py-2 !text-[14px] tabular-nums"
                  placeholder="0" value={cases[pid] ?? ''}
                  onChange={e => setCases(s => ({ ...s, [pid]: e.target.value }))} />
              </label>

              <label className="block">
                <span className="block text-[11px] text-[#8E8E93] mb-1">
                  Koli fiyatı ₺
                  {listPrice && listPrice > 0 && !touched.current[pid] && (
                    <span className="text-[#AEAEB2]"> · liste</span>
                  )}
                </span>
                <input inputMode="decimal" className="input !py-2 !text-[14px] tabular-nums"
                  placeholder="0" value={casePrice[pid] ?? ''}
                  onChange={e => {
                    touched.current[pid] = true;
                    setCasePrice(s => ({ ...s, [pid]: e.target.value }));
                  }} />
              </label>

              {showFree && (
                <label className="block">
                  <span className="block text-[11px] text-[#8E8E93] mb-1">Bedelsiz</span>
                  <input inputMode="numeric" className="input !py-2 !text-[14px] tabular-nums"
                    placeholder="0" value={free[pid] ?? ''}
                    onChange={e => setFree(s => ({ ...s, [pid]: e.target.value }))} />
                </label>
              )}
            </div>

            {/* Ne yazdığının şişe ve para karşılığı: sahada en çok yapılan
                hata birimi karıştırmak, bu satır onu kapatıyor. */}
            {(l.paidCases > 0 || l.freeCases > 0) && (
              <p className="text-[11.5px] text-[#AEAEB2] mt-1.5 tabular-nums">
                {l.paidCases > 0 && (
                  <>
                    {l.paidCases} koli = {l.paidCases * BOTTLES_PER_CASE} şişe
                    {l.cp > 0 && <> · {tl(l.total)} · şişe {l.bottlePrice.toFixed(4)} ₺</>}
                  </>
                )}
                {l.freeCases > 0 && (
                  <span className="text-emerald-300">
                    {l.paidCases > 0 ? ' · ' : ''}{l.freeCases} koli bedelsiz
                  </span>
                )}
                {l.paidCases > 0 && l.cp <= 0 && (
                  <span className="text-amber-300"> · koli fiyatı girilmedi</span>
                )}
              </p>
            )}

            {/* Sunucuya giden alanlar: miktar koli, fiyat ŞİŞE başına */}
            {field === 'order' ? (
              <>
                <input type="hidden" name={`oi_${pid}_paid_cases`} value={l.paidCases || ''} />
                <input type="hidden" name={`oi_${pid}_free_cases`} value={l.freeCases || ''} />
                <input type="hidden" name={`oi_${pid}_price`} value={l.bottlePrice || ''} />
              </>
            ) : (
              <>
                <input type="hidden" name={`item_${pid}_cases`} value={l.paidCases || ''} />
                <input type="hidden" name={`item_${pid}_price`} value={l.bottlePrice || ''} />
                <input type="hidden" name={`item_${pid}_discount`} value="0" />
              </>
            )}
          </div>
        );
      })}

      {!compact && state.any && (
        <div className="flex items-baseline justify-between rounded-xl bg-white/[0.05] px-3 py-2.5">
          <span className="text-[13px] text-[#8E8E93]">Net toplam (KDV hariç)</span>
          <span className="text-[17px] font-bold tabular-nums">{tl(state.net)}</span>
        </div>
      )}
    </div>
  );
}
