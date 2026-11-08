'use client';

import { useMemo, useState } from 'react';
import { Quote, FlaskConical } from 'lucide-react';
import { CHANNEL_LABEL, VERDICT_LABEL, type OutletChannel } from '@/lib/sales-types';

interface Product { id: string; name: string; taste_reference: string | null; sort_order: number }
interface Usage {
  product_id: string; product_name: string; period: string;
  bottles_opened: number; bottles_left: number; bottles_total: number; outlets_reached: number;
}

/**
 * İstatistiksel anlamlılık eşiği.
 * Küçük örneklemde ortalama tat puanı çok oynak olur: 4 tadımdan sonra
 * "Reyhan 2.5" demek ürün hakkında değil tesadüf hakkında bilgi verir.
 * Bu yüzden n<30 altında puan gösterilmiyor.
 */
const MIN_N = 30;

/** Kategorik seri renkleri — erişilebilirlik için doğrulanmış sabit sıra. */
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500'];

export default function ProductTaste({
  products, tastings, summaries, usage
}: { products: Product[]; tastings: any[]; summaries: any[]; usage: Usage[] }) {
  const [tab, setTab] = useState<'lezzet' | 'numune'>('lezzet');

  const stats = useMemo(() => {
    const prefCount = new Map<string, number>();
    for (const s of summaries) {
      prefCount.set(s.preferred_product_id, (prefCount.get(s.preferred_product_id) ?? 0) + 1);
    }
    const prefTotal = summaries.length || 1;

    return products.map((p, idx) => {
      const rows = tastings.filter(t => t.product_id === p.id && t.visits?.status !== 'taslak');
      const n = rows.length;
      const avg = (k: string) => {
        const vals = rows.map(r => r[k]).filter((v: any) => typeof v === 'number') as number[];
        return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
      };

      // kanal kırılımı
      const byChannel = new Map<string, number[]>();
      for (const r of rows) {
        const ch = r.visits?.outlets?.outlet_types?.channel ?? 'diger';
        if (typeof r.taste_score !== 'number') continue;
        byChannel.set(ch, [...(byChannel.get(ch) ?? []), r.taste_score]);
      }
      const channels = Array.from(byChannel.entries())
        .map(([ch, vals]) => ({
          channel: ch as OutletChannel,
          n: vals.length,
          avg: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
        }))
        .sort((a, b) => b.avg - a.avg);

      const verdicts = rows.reduce((acc: Record<string, number>, r) => {
        if (r.verdict) acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
        return acc;
      }, {});

      const quotes = rows
        .filter(r => r.customer_verbatim && String(r.customer_verbatim).trim().length > 8)
        .slice(0, 3)
        .map(r => String(r.customer_verbatim));

      return {
        ...p, idx, n,
        taste: avg('taste_score'),
        pack: avg('packaging_score'),
        price: avg('price_perception'),
        channels, verdicts, quotes,
        prefShare: Math.round(((prefCount.get(p.id) ?? 0) / prefTotal) * 1000) / 10,
        listIntent: n ? Math.round(((verdicts['listeye_alir'] ?? 0) / n) * 1000) / 10 : 0
      };
    });
  }, [products, tastings, summaries]);

  const ranked = useMemo(
    () => [...stats].sort((a, b) => (b.taste ?? -1) - (a.taste ?? -1)), [stats]
  );

  const usageByProduct = useMemo(() => {
    const m = new Map<string, { name: string; opened: number; left: number; total: number; outlets: number }>();
    for (const u of usage) {
      const cur = m.get(u.product_id) ?? { name: u.product_name, opened: 0, left: 0, total: 0, outlets: 0 };
      cur.opened += u.bottles_opened; cur.left += u.bottles_left;
      cur.total += u.bottles_total; cur.outlets = Math.max(cur.outlets, u.outlets_reached);
      m.set(u.product_id, cur);
    }
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [usage]);

  const maxUsage = Math.max(1, ...usageByProduct.map(u => u.total));

  return (
    <main className="py-5 space-y-5">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Ürünler & Tadım</h1>
        <p className="text-[14px] text-[#8E8E93]">
          {tastings.length} tadım kaydı · {products.length} ürün
        </p>
      </header>

      <div className="flex gap-1.5">
        {([['lezzet', 'Lezzet analizi'], ['numune', 'Numune tüketimi']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              tab === k ? 'bg-ios-blue text-white' : 'bg-[#1C1C1E] text-[#D1D1D6]'
            }`}>{l}</button>
        ))}
      </div>

      {/* ---------------- LEZZET ---------------- */}
      {tab === 'lezzet' && (
        <>
          <section className="card p-5 space-y-3">
            <p className="section-title">Tat sıralaması</p>
            {ranked.map(s => (
              <div key={s.id} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{s.name}</span>
                  <span className="tabular-nums text-[#AEAEB2]">
                    {s.n < MIN_N
                      ? <span className="text-[#8E8E93]">yeterli veri yok (n={s.n})</span>
                      : <>{s.taste}/5 <span className="text-[#8E8E93]">· n={s.n}</span></>}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{
                      width: s.n < MIN_N || s.taste === null ? '0%' : `${((s.taste - 1) / 4) * 100}%`,
                      backgroundColor: s.n < MIN_N ? '#898781' : SERIES[s.idx % SERIES.length]
                    }} />
                </div>
              </div>
            ))}
            <p className="text-[12px] text-[#8E8E93]">
              Puan n≥{MIN_N} olunca gösterilir. Küçük örneklemde ortalama ürün hakkında değil
              tesadüf hakkında bilgi verir.
            </p>
          </section>

          {stats.map(s => (
            <section key={s.id} className="card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[17px] font-semibold">{s.name}</p>
                  {s.taste_reference && (
                    <p className="text-[13px] text-[#8E8E93]">Tat referansı: {s.taste_reference}</p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <span className="badge bg-white/10 text-[#D1D1D6]">tercih %{s.prefShare}</span>
                  <span className="badge bg-emerald-500/20 text-emerald-300">
                    listeye alır %{s.listIntent}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {([['Lezzet', s.taste], ['Ambalaj', s.pack], ['Fiyat algısı', s.price]] as const).map(([l, v]) => (
                  <div key={l} className="rounded-xl bg-white/[0.03] py-2">
                    <p className="text-[12px] text-[#8E8E93]">{l}</p>
                    <p className="text-lg font-bold tabular-nums">
                      {s.n < MIN_N ? '—' : (v ?? '—')}
                    </p>
                  </div>
                ))}
              </div>

              {s.channels.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[13px] text-[#8E8E93]">Kanal kırılımı</p>
                  {s.channels.map(c => (
                    <div key={c.channel} className="flex items-center gap-2 text-[13px]">
                      <span className="w-40 shrink-0 truncate">{CHANNEL_LABEL[c.channel] ?? c.channel}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${((c.avg - 1) / 4) * 100}%`, backgroundColor: SERIES[s.idx % SERIES.length] }} />
                      </div>
                      <span className="tabular-nums text-[#AEAEB2] w-20 text-right">
                        {c.avg}/5 <span className="text-[#8E8E93]">n={c.n}</span>
                      </span>
                    </div>
                  ))}
                  <p className="text-[12px] text-[#8E8E93]">
                    Kanallar arası büyük fark, ürünün kitlesel değil o kanala özgü olduğunu gösterir.
                  </p>
                </div>
              )}

              {Object.keys(s.verdicts).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(s.verdicts).map(([v, c]) => (
                    <span key={v} className="badge bg-white/[0.07] text-[#D1D1D6]">
                      {VERDICT_LABEL[v as keyof typeof VERDICT_LABEL] ?? v}: {c as number}
                    </span>
                  ))}
                </div>
              )}

              {s.quotes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[13px] text-[#8E8E93] flex items-center gap-1.5">
                    <Quote size={13} /> Müşterinin kendi sözleri
                  </p>
                  {s.quotes.map((q, i) => (
                    <p key={i} className="text-sm italic text-[#D1D1D6] border-l-2 border-white/20 pl-3">
                      “{q}”
                    </p>
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}

      {/* ---------------- NUMUNE ---------------- */}
      {tab === 'numune' && (
        <section className="card p-5 space-y-3">
          <p className="section-title flex items-center gap-2">
            <FlaskConical size={15} /> Numune tüketimi
          </p>
          <p className="text-[13px] text-[#8E8E93]">
            Zimmet takibi yok — yalnızca toplamda ne dağıtıldığı. Tadım kayıtlarından otomatik gelir.
          </p>

          {usageByProduct.length === 0 && (
            <p className="text-[14px] text-[#8E8E93]">Henüz numune kaydı yok.</p>
          )}

          {usageByProduct.map(u => (
            <div key={u.name} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">{u.name}</span>
                <span className="tabular-nums text-[#AEAEB2]">
                  {u.total} şişe
                  <span className="text-[#8E8E93]"> · {u.opened} açılan / {u.left} kapalı · {u.outlets} nokta</span>
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden flex">
                <div className="h-full bg-[#d95926]" style={{ width: `${(u.opened / maxUsage) * 100}%` }} />
                <div className="h-full bg-[#3987e5]" style={{ width: `${(u.left / maxUsage) * 100}%` }} />
              </div>
            </div>
          ))}

          {usageByProduct.length > 0 && (
            <div className="flex gap-4 text-[12px] text-[#8E8E93] pt-1">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-[#d95926] inline-block" /> açılan şişe
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 rounded-sm bg-[#3987e5] inline-block" /> bırakılan kapalı
              </span>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
