'use client';

import { useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

/**
 * RAPOR GRAFİKLERİ — elle çizilmiş, bağımlılıksız
 *
 * Grafik kitaplığı eklenmedi: dört basit biçim yetiyor ve paket
 * büyümüyor (sahada mobil veriyle açılan bir ekran).
 *
 * Kurallar (hepsi burada tek yerde):
 *  - Tek seri = tek renk. Renk sıralamayı değil kimliği taşır.
 *  - Yazı her zaman metin renginde; seri rengini yalnız işaret taşır.
 *  - Çubuk ince (en çok 24px), veri ucu 4px yuvarlak, taban düz.
 *  - Izgara ve eksen silik; yüksek sesli olan yalnız veri.
 *  - Her işaretin üzerine gelince/odaklanınca değeri okunur; aynı
 *    değerler tabloda ve "Excel" çıktısında da var (renge mahkûm değil).
 *
 * Renkler açık zemine (#ffffff) karşı doğrulanmış sabit değerlerdir.
 */
export const VIZ = {
  s1: '#2a78d6',        // birincil seri (mavi)
  s2: '#eb6834',        // ikinci seri (turuncu)
  s3: '#1baf7a',        // üçüncü seri (su yeşili)
  track: '#e8edf5',     // boş iz
  // tek renk sıralı ölçek (ısı tablosu): açık → koyu
  ramp: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#104281']
};

/** KPI kutusu: etiket · değer · değişim · isteğe bağlı mini eğilim. */
export function StatTile({
  label, value, hint, delta, goodWhenUp = true, spark, hero = false
}: {
  label: string; value: string; hint?: string;
  /** Önceki döneme göre yüzde değişim; null = karşılaştırma yok */
  delta?: number | null; goodWhenUp?: boolean;
  spark?: number[]; hero?: boolean;
}) {
  const up = (delta ?? 0) >= 0;
  const good = up === goodWhenUp;
  return (
    <div className="card p-4 min-w-0">
      <p className="text-[12.5px] text-[#8E8E93]">{label}</p>
      <p className={`font-bold leading-tight mt-1 ${hero ? 'text-[34px] sm:text-[40px]' : 'text-[24px]'}`}>
        {value}
      </p>
      <div className="flex items-end justify-between gap-2 mt-1 min-h-[20px]">
        <div className="min-w-0">
          {delta !== null && delta !== undefined && (
            <p className={`text-[12.5px] font-semibold flex items-center gap-0.5 ${good ? 'text-emerald-300' : 'text-rose-300'}`}>
              {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
              %{Math.abs(delta).toLocaleString('tr-TR')}
              <span className="font-normal text-[#8E8E93] ml-1">önceki döneme göre</span>
            </p>
          )}
          {hint && <p className="text-[12px] text-[#8E8E93] truncate">{hint}</p>}
        </div>
        {spark && spark.length > 1 && <Spark values={spark} />}
      </div>
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  const w = 72, h = 22, max = Math.max(1, ...values);
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (w - 6) + 3, h - 3 - (v / max) * (h - 6)
  ]);
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden="true">
      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none"
        stroke="#b6bfcd" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={VIZ.s1} stroke="#fff" strokeWidth={1.5} />
    </svg>
  );
}

/** Grafik kartı: başlık + kısa açıklama. */
export function ChartCard({
  title, note, children, right
}: { title: string; note?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5 space-y-3 min-w-0" style={{ breakInside: 'avoid' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-tight">{title}</p>
          {note && <p className="text-[12.5px] text-[#8E8E93] mt-0.5">{note}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

/**
 * Sütun grafiği — zaman içinde tek ölçü.
 * Dokunma alanı sütunun tamamı (işaretten geniş); değer üstte okunur.
 */
export function ColumnChart({
  data, format, color = VIZ.s1, height = 150, max
}: {
  data: { key: string; label: string; value: number }[];
  format: (n: number) => string;
  color?: string; height?: number;
  /** Eksen üst sınırı (temiz sayı) */
  max: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const every = Math.max(1, Math.ceil(data.length / 6));
  const active = hover !== null ? data[hover] : null;

  return (
    <div>
      {/* Okuma satırı: seçili sütunun değeri; seçim yokken dönem toplamı */}
      <p className="text-[12.5px] text-[#8E8E93] h-5 tabular-nums" aria-live="polite">
        {active
          ? <><strong className="text-[#F2F2F7]">{format(active.value)}</strong> · {active.label}</>
          : 'Bir sütuna dokunun'}
      </p>
      <div className="relative" style={{ height }}>
        {[1, 0.5, 0].map(f => (
          <div key={f} className="absolute left-0 right-0 border-t border-white/[0.08]"
            style={{ top: `${(1 - f) * 100}%` }}>
            <span className="absolute right-0 -top-[15px] text-[10.5px] text-[#8E8E93] tabular-nums">
              {format(max * f)}
            </span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] pr-12">
          {data.map((d, i) => (
            <button key={d.key} type="button"
              onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)} onBlur={() => setHover(null)}
              aria-label={`${d.label}: ${format(d.value)}`}
              className="flex-1 h-full flex items-end justify-center min-w-0 outline-none group">
              <span className="block w-full max-w-[24px] rounded-t-[4px] transition-opacity"
                style={{
                  height: `${max > 0 ? Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100) : 0}%`,
                  background: color,
                  opacity: hover === null || hover === i ? 1 : 0.45
                }} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-[2px] pr-12 mt-1">
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 min-w-0 text-center text-[10.5px] text-[#8E8E93] whitespace-nowrap overflow-visible">
            {i % every === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Sıralı yatay çubuklar — büyükten küçüğe, tek renk, değer uçta.
 * Kategoriler arasında karşılaştırma için pasta/halka yerine bu.
 */
export function BarList({
  rows, format, color = VIZ.s1, empty = 'Veri yok.'
}: {
  rows: { key: string; label: string; value: number; sub?: string; href?: string }[];
  format: (n: number) => string;
  color?: string; empty?: string;
}) {
  const max = Math.max(1, ...rows.map(r => r.value));
  if (!rows.length) return <p className="text-[13px] text-[#8E8E93]">{empty}</p>;
  return (
    <div className="space-y-2.5">
      {rows.map(r => (
        <div key={r.key} className="group">
          <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className="min-w-0 truncate">
              {r.href ? <a href={r.href} className="hover:underline">{r.label}</a> : r.label}
              {r.sub && <span className="text-[#8E8E93]"> · {r.sub}</span>}
            </span>
            <span className="tabular-nums font-semibold shrink-0">{format(r.value)}</span>
          </div>
          <div className="mt-1 h-[10px]">
            <div className="h-full rounded-r-[4px] group-hover:opacity-80 transition-opacity"
              style={{ width: `${Math.max(r.value > 0 ? 1 : 0, (r.value / max) * 100)}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Isı tablosu — tek renk, çok olan koyu. Sayı her hücrede yazılı. */
export function HeatTable({
  rows, cols, cell, max, format
}: {
  rows: { id: string; label: string; total: number }[];
  cols: { id: string; label: string; total: number }[];
  cell: (r: string, c: string) => number;
  max: number; format: (n: number) => string;
}) {
  if (!rows.length || !cols.length) return <p className="text-[13px] text-[#8E8E93]">Bu dönemde satış yok.</p>;
  const shade = (v: number) => {
    if (!(v > 0) || !(max > 0)) return null;
    const i = Math.min(VIZ.ramp.length - 1, Math.floor((v / max) * (VIZ.ramp.length - 0.001)));
    return { bg: VIZ.ramp[i], dark: i >= 3 };
  };
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full text-[13px] border-separate" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className="text-left font-medium text-[#8E8E93] py-1 pr-2">Ürün</th>
            {cols.map(c => (
              <th key={c.id} className="font-medium text-[#8E8E93] py-1 px-1 text-center whitespace-nowrap">{c.label}</th>
            ))}
            <th className="font-medium text-[#8E8E93] py-1 pl-2 text-right">Toplam</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td className="py-1 pr-2 whitespace-nowrap">{r.label}</td>
              {cols.map(c => {
                const v = cell(r.id, c.id);
                const s = shade(v);
                return (
                  <td key={c.id} title={`${r.label} · ${c.label}: ${format(v)} koli`}
                    className="text-center tabular-nums rounded-[4px] min-w-[52px] py-2"
                    style={s ? { background: s.bg, color: s.dark ? '#fff' : '#10151f' } : { background: '#f4f6fa', color: '#8a94a6' }}>
                    {v > 0 ? format(v) : '–'}
                  </td>
                );
              })}
              <td className="py-1 pl-2 text-right tabular-nums font-semibold">{format(r.total)}</td>
            </tr>
          ))}
          <tr>
            <td className="pt-2 pr-2 text-[#8E8E93]">Toplam</td>
            {cols.map(c => (
              <td key={c.id} className="pt-2 text-center tabular-nums font-semibold">{format(c.total)}</td>
            ))}
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
