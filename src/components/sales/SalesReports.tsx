'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { CHANNEL_LABEL, OUTCOME_LABEL, type OutletChannel } from '@/lib/sales-types';

interface Reason { id: string; label: string }
type Period = 'gunluk' | 'haftalik' | 'aylik';

const PERIODS: { k: Period; l: string; days: number }[] = [
  { k: 'gunluk', l: 'Günlük', days: 1 },
  { k: 'haftalik', l: 'Haftalık', days: 7 },
  { k: 'aylik', l: 'Aylık', days: 30 }
];

const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

export default function SalesReports({
  visits, reasons, outlets, people, targets, orders, today
}: {
  visits: any[]; reasons: Reason[]; outlets: any[]; people: any[];
  targets: any[]; orders: any[]; today: string;
}) {
  const [period, setPeriod] = useState<Period>('haftalik');
  const [rep, setRep] = useState('');

  const def = PERIODS.find(p => p.k === period)!;
  const from = useMemo(
    () => dayKey(new Date(Date.now() - (def.days - 1) * 86400000)), [def.days]
  );

  const rows = useMemo(() => visits.filter(v =>
    v.status !== 'taslak' &&
    v.visit_date >= from && v.visit_date <= today &&
    (!rep || v.user_id === rep)
  ), [visits, from, today, rep]);

  const reasonLabel = (id: string | null) =>
    id ? (reasons.find(r => r.id === id)?.label ?? 'Diğer') : null;

  const kpi = useMemo(() => {
    const total = rows.length;
    const orderCount = rows.filter(r => r.outcome === 'siparis').length;
    const tastingCount = rows.filter(r => (r.visit_tastings ?? []).length > 0).length;
    const workDays = new Set(rows.map(r => r.visit_date)).size || 1;

    // Hedef: şehir kuralı (İstanbul 5 / varsayılan 10), kişi × çalışılan gün
    const cityTarget = (city: string | null) => {
      const t = targets.find(x => x.scope === 'sehir' && x.scope_value === city);
      if (t) return Number(t.target_value);
      const d = targets.find(x => x.scope === 'varsayilan');
      return d ? Number(d.target_value) : 10;
    };
    const reps = Array.from(new Set<string>(rows.map(r => r.user_id)));
    let targetTotal = 0;
    for (const u of reps) {
      const city = rows.find(r => r.user_id === u)?.outlets?.city ?? null;
      const daysWorked = new Set(rows.filter(r => r.user_id === u).map(r => r.visit_date)).size;
      targetTotal += cityTarget(city) * daysWorked;
    }

    return {
      total,
      orderCount,
      conversion: total ? Math.round((orderCount / total) * 1000) / 10 : 0,
      perDay: Math.round((total / workDays) * 10) / 10,
      attainment: targetTotal ? Math.round((total / targetTotal) * 1000) / 10 : null,
      tastingRate: total ? Math.round((tastingCount / total) * 1000) / 10 : 0,
      // Tadımın işe yarayıp yaramadığı — modülün en aksiyon alınabilir sayısı
      tastedConv: tastingCount
        ? Math.round((rows.filter(r => (r.visit_tastings ?? []).length > 0 && r.outcome === 'siparis').length / tastingCount) * 1000) / 10
        : 0,
      untastedConv: (total - tastingCount)
        ? Math.round((rows.filter(r => (r.visit_tastings ?? []).length === 0 && r.outcome === 'siparis').length / (total - tastingCount)) * 1000) / 10
        : 0
    };
  }, [rows, targets]);

  const funnel = useMemo(() => {
    const c = (o: string) => rows.filter(r => r.outcome === o).length;
    return [
      { l: 'Ziyaret', n: rows.length },
      { l: 'Tadım planlandı', n: c('tadim_planlandi') },
      { l: 'Teklif istendi', n: c('teklif_istendi') },
      { l: 'Sipariş', n: c('siparis') },
      { l: 'Olumsuz', n: c('olumsuz') }
    ];
  }, [rows]);

  /** İtiraz Pareto'su — beyan edilen ve gerçek neden YAN YANA. */
  const objections = useMemo(() => {
    const tally = (key: 'objection_stated_id' | 'objection_real_id') => {
      const m = new Map<string, number>();
      let tot = 0;
      for (const r of rows) {
        const l = reasonLabel(r[key]);
        if (!l) continue;
        m.set(l, (m.get(l) ?? 0) + 1); tot++;
      }
      return Array.from(m.entries())
        .map(([label, n]) => ({ label, n, pct: tot ? Math.round((n / tot) * 1000) / 10 : 0 }))
        .sort((a, b) => b.n - a.n).slice(0, 6);
    };
    return { stated: tally('objection_stated_id'), real: tally('objection_real_id') };
  }, [rows, reasons]);

  const channels = useMemo(() => {
    const m = new Map<string, { n: number; orders: number }>();
    for (const r of rows) {
      const ch = r.outlets?.outlet_types?.channel ?? 'diger';
      const cur = m.get(ch) ?? { n: 0, orders: 0 };
      cur.n++; if (r.outcome === 'siparis') cur.orders++;
      m.set(ch, cur);
    }
    return Array.from(m.entries())
      .map(([ch, v]) => ({
        channel: ch as OutletChannel, ...v,
        conv: v.n ? Math.round((v.orders / v.n) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.conv - a.conv);
  }, [rows]);

  /**
   * Temsilci karnesi.
   * Ortalama ziyaret puanı BİLEREK yok: karnede gösterilirse temsilci
   * kendi verdiği puanı şişirir, nokta segmenti bozulur ve rota planı
   * çöker. Puan bir planlama girdisidir, performans notu değil.
   */
  const scorecard = useMemo(() => {
    const m = new Map<string, { name: string; n: number; orders: number; outlets: Set<string>; tastings: number }>();
    for (const r of rows) {
      const cur = m.get(r.user_id) ?? {
        name: r.profiles?.full_name ?? '—', n: 0, orders: 0, outlets: new Set<string>(), tastings: 0
      };
      cur.n++;
      if (r.outcome === 'siparis') cur.orders++;
      if ((r.visit_tastings ?? []).length) cur.tastings++;
      cur.outlets.add(r.outlet_id);
      m.set(r.user_id, cur);
    }
    return Array.from(m.values())
      .map(v => ({
        name: v.name, n: v.n, orders: v.orders, outlets: v.outlets.size, tastings: v.tastings,
        conv: v.n ? Math.round((v.orders / v.n) * 1000) / 10 : 0
      }))
      .sort((a, b) => b.conv - a.conv);
  }, [rows]);

  const neglected = useMemo(() => {
    const cut = Date.now() - 14 * 86400000;
    return outlets.filter(o =>
      ['A', 'B'].includes(o.segment ?? '') &&
      (!o.last_visit_at || new Date(o.last_visit_at).getTime() < cut)
    ).length;
  }, [outlets]);

  const orderVolume = useMemo(() => {
    const fromTs = new Date(from).getTime();
    return orders
      .filter(o => new Date(o.created_at).getTime() >= fromTs && o.status !== 'iptal')
      .reduce((a, o) => a + Number(o.total_amount ?? 0), 0);
  }, [orders, from]);

  function exportCsv() {
    const esc = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = [['Tarih', 'Nokta', 'Şehir', 'Temsilci', 'Sonuç', 'Beyan itiraz', 'Gerçek neden']
      .map(esc).join(';')];
    for (const r of rows) {
      lines.push([
        r.visit_date, r.outlets?.name, r.outlets?.city, r.profiles?.full_name,
        OUTCOME_LABEL[r.outcome as keyof typeof OUTCOME_LABEL] ?? r.outcome,
        reasonLabel(r.objection_stated_id) ?? '', reasonLabel(r.objection_real_id) ?? ''
      ].map(esc).join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `saha-rapor-${period}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const maxFunnel = Math.max(1, ...funnel.map(f => f.n));

  return (
    <main className="py-5 space-y-5">
      <header className="px-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Raporlar</h1>
          <p className="text-[14px] text-[#8E8E93]">{from} — {today}</p>
        </div>
        <button onClick={exportCsv} className="btn-ghost text-sm shrink-0">
          <Download size={15} /> CSV
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1.5">
          {PERIODS.map(p => (
            <button key={p.k} onClick={() => setPeriod(p.k)}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
                period === p.k ? 'bg-ios-blue text-white' : 'bg-[#1C1C1E] text-[#D1D1D6]'
              }`}>{p.l}</button>
          ))}
        </div>
        <select value={rep} onChange={e => setRep(e.target.value)} className="input sm:w-56">
          <option value="">Tüm temsilciler</option>
          {people.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Ziyaret" value={String(kpi.total)}
          hint={kpi.attainment !== null ? `hedefin %${kpi.attainment}'i` : undefined}
          tone={kpi.attainment === null ? undefined : kpi.attainment >= 90 ? 'good' : kpi.attainment >= 75 ? 'warn' : 'bad'} />
        <Tile label="Dönüşüm" value={`%${kpi.conversion}`}
          tone={kpi.conversion >= 15 ? 'good' : kpi.conversion < 8 ? 'bad' : 'warn'} />
        <Tile label="Günlük ortalama" value={String(kpi.perDay)} />
        <Tile label="Sipariş tutarı" value={`${orderVolume.toLocaleString('tr-TR')} ₺`} />
      </div>

      <section className="card p-5 space-y-3">
        <p className="section-title">Dönüşüm hunisi</p>
        {funnel.map(f => (
          <div key={f.l} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>{f.l}</span>
              <span className="tabular-nums text-[#AEAEB2]">{f.n}</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.08] overflow-hidden">
              <div className="h-full rounded-full bg-[#3987e5]"
                style={{ width: `${(f.n / maxFunnel) * 100}%` }} />
            </div>
          </div>
        ))}
        {kpi.tastingRate > 0 && (
          <p className="text-[13px] text-[#AEAEB2] pt-1">
            Ziyaretlerin %{kpi.tastingRate}'inde tadım yapıldı. Tadımlı ziyaretin dönüşümü{' '}
            <strong className="text-[#F0EFEC]">%{kpi.tastedConv}</strong>, tadımsızın %{kpi.untastedConv}.
            {kpi.untastedConv > 0 && kpi.tastedConv > kpi.untastedConv && (
              <> Tadım dönüşümü {Math.round((kpi.tastedConv / kpi.untastedConv) * 10) / 10}× artırıyor.</>
            )}
          </p>
        )}
      </section>

      <section className="card p-5 space-y-3">
        <p className="section-title">İtiraz: söylenen vs gerçek</p>
        <p className="text-[13px] text-[#8E8E93]">
          İkisi arasındaki fark, fiyat kararı ile tedarikçi bağı sorununu ayırmanı sağlar.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {([['Beyan edilen', objections.stated], ['Gerçek neden', objections.real]] as const).map(([title, list]) => (
            <div key={title} className="space-y-2">
              <p className="text-[13px] font-medium text-[#AEAEB2]">{title}</p>
              {list.length === 0 && <p className="text-[13px] text-[#8E8E93]">Kayıt yok.</p>}
              {list.map(o => (
                <div key={o.label} className="space-y-1">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="truncate">{o.label}</span>
                    <span className="tabular-nums text-[#AEAEB2] shrink-0 ml-2">%{o.pct}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                    <div className="h-full rounded-full bg-[#d95926]" style={{ width: `${o.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <p className="section-title">Kanal performansı</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[#8E8E93] text-[13px]">
              <tr className="text-left">
                <th className="py-2 font-medium">Kanal</th>
                <th className="py-2 font-medium text-right">Ziyaret</th>
                <th className="py-2 font-medium text-right">Sipariş</th>
                <th className="py-2 font-medium text-right">Dönüşüm</th>
              </tr>
            </thead>
            <tbody>
              {channels.map(c => (
                <tr key={c.channel} className="border-t border-white/[0.06]">
                  <td className="py-2">{CHANNEL_LABEL[c.channel] ?? c.channel}</td>
                  <td className="py-2 text-right tabular-nums">{c.n}</td>
                  <td className="py-2 text-right tabular-nums">{c.orders}</td>
                  <td className="py-2 text-right tabular-nums font-medium">%{c.conv}</td>
                </tr>
              ))}
              {channels.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-[#8E8E93]">Veri yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-5 space-y-3">
        <p className="section-title">Temsilci karnesi</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[#8E8E93] text-[13px]">
              <tr className="text-left">
                <th className="py-2 font-medium">Temsilci</th>
                <th className="py-2 font-medium text-right">Ziyaret</th>
                <th className="py-2 font-medium text-right">Nokta</th>
                <th className="py-2 font-medium text-right">Tadım</th>
                <th className="py-2 font-medium text-right">Dönüşüm</th>
              </tr>
            </thead>
            <tbody>
              {scorecard.map(s => (
                <tr key={s.name} className="border-t border-white/[0.06]">
                  <td className="py-2">{s.name}</td>
                  <td className="py-2 text-right tabular-nums">{s.n}</td>
                  <td className="py-2 text-right tabular-nums">{s.outlets}</td>
                  <td className="py-2 text-right tabular-nums">{s.tastings}</td>
                  <td className="py-2 text-right tabular-nums font-medium">%{s.conv}</td>
                </tr>
              ))}
              {scorecard.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-[#8E8E93]">Veri yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-[#8E8E93]">
          Ortalama ziyaret puanı bu tabloda bilerek yok: karnede gösterilirse temsilci kendi
          verdiği puanı şişirir ve nokta segmentleri bozulur. Puan bir planlama girdisidir.
        </p>
      </section>

      {neglected > 0 && (
        <p className="text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          {neglected} adet A/B segmenti nokta 14 günden uzun süredir ziyaret edilmedi.
        </p>
      )}
    </main>
  );
}

function Tile({ label, value, hint, tone }: {
  label: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'bad';
}) {
  const color = tone === 'good' ? 'text-emerald-300'
    : tone === 'warn' ? 'text-amber-300'
    : tone === 'bad' ? 'text-rose-300' : '';
  return (
    <div className="card p-4">
      <p className="text-[12px] text-[#8E8E93]">{label}</p>
      <p className={`text-2xl font-bold tabular-nums mt-0.5 ${color}`}>{value}</p>
      {hint && <p className="text-[12px] text-[#8E8E93]">{hint}</p>}
    </div>
  );
}
