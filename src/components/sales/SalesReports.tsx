'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { CHANNEL_LABEL, FUNNEL_LABEL, FUNNEL_HINT, type FunnelStage } from '@/lib/sales-types';
import { BOTTLES_PER_CASE } from '@/lib/commerce-format';
import {
  addDays, previousScope, salesTotals, delta, trend, visitTotals, repCards,
  funnelCounts, objections, productChannel, priceErosion, tastingStats,
  tlShort, nf, niceMax, SEALED_LIMIT,
  type LineRow, type VisitRow, type FunnelRow, type FollowUpRow, type RoutePlanRow, type Scope
} from '@/lib/sales-metrics';
import { StatTile, ChartCard, ColumnChart, BarList, HeatTable, VIZ } from '@/components/sales/charts/Charts';
import ListExport from '@/components/sales/ListExport';
import PrintButton from '@/components/sales/PrintButton';

const PERIODS = [
  { k: '1', l: 'Bugün', days: 1 },
  { k: '7', l: '7 gün', days: 7 },
  { k: '30', l: '30 gün', days: 30 },
  { k: '90', l: '90 gün', days: 90 }
] as const;

const ENTITY_LABEL: Record<string, string> = {
  outlet: 'Nokta', quote: 'Teklif', order: 'Sipariş', visit: 'Ziyaret', follow_up: 'Takip',
  assessment: 'Değerlendirme', complaint: 'Şikâyet', route_plan: 'Rota'
};

/**
 * RAPORLAR — yöneticinin dört sorusu, sırasıyla:
 *   1. Ne sattık?            (gerçekleşen satış, eğilim)
 *   2. Kim ne yaptı?         (temsilci karnesi)
 *   3. Müşteriler nerede?    (huni, donuk, ikinci siparişi bekleyenler)
 *   4. Neden kaybediyoruz?   (itiraz, fiyat erozyonu, numune, bedelsiz)
 *
 * Bütün sayılar lib/sales-metrics'ten gelir; bu dosya yalnızca gösterir.
 * Süzgeçler tek satırda ve altındaki her şeyi birlikte daraltır — iki
 * kutu aynı dönemi farklı sayıyla göstermez.
 */
export default function SalesReports({
  lines, visits, funnel, followUps, plans, reasons, people, deletions,
  bottleListPrice, today, isManager, loadError, capped
}: {
  lines: LineRow[]; visits: VisitRow[]; funnel: FunnelRow[]; followUps: FollowUpRow[];
  plans: RoutePlanRow[]; reasons: { id: string; label: string }[];
  people: { id: string; full_name: string | null }[];
  deletions: { id: string; entity: string; label: string | null; reason: string | null; deleted_at: string; deleted_by: string | null }[];
  bottleListPrice: number; today: string; isManager: boolean;
  loadError: string | null; capped: boolean;
}) {
  const [period, setPeriod] = useState<string>('30');
  const [rep, setRep] = useState('');

  const days = PERIODS.find(p => p.k === period)!.days;
  const scope: Scope = useMemo(
    () => ({ from: addDays(today, -(days - 1)), to: today, rep }), [today, days, rep]);
  const prev = useMemo(() => previousScope(scope), [scope]);
  const caseList = bottleListPrice * BOTTLES_PER_CASE;

  const sales = useMemo(() => salesTotals(lines, scope), [lines, scope]);
  const salesPrev = useMemo(() => salesTotals(lines, prev), [lines, prev]);
  const vis = useMemo(() => visitTotals(visits, plans, scope), [visits, plans, scope]);
  const visPrev = useMemo(() => visitTotals(visits, plans, prev), [visits, plans, prev]);
  const tr = useMemo(() => trend(lines, visits, scope), [lines, visits, scope]);
  const cards = useMemo(
    () => repCards(people, lines, visits, plans, funnel, followUps, scope, today),
    [people, lines, visits, plans, funnel, followUps, scope, today]);
  const fun = useMemo(() => funnelCounts(funnel, rep), [funnel, rep]);
  const obj = useMemo(
    () => objections(visits, followUps, reasons, scope, caseList),
    [visits, followUps, reasons, scope, caseList]);
  const matrix = useMemo(() => productChannel(lines, scope, CHANNEL_LABEL as any), [lines, scope]);
  const erosion = useMemo(() => priceErosion(lines, scope), [lines, scope]);
  const tasting = useMemo(
    () => tastingStats(visits, lines, scope, today, bottleListPrice),
    [visits, lines, scope, today, bottleListPrice]);

  const newCustomers = useMemo(() => fun.rows.filter(f =>
    f.first_order_at && f.first_order_at.slice(0, 10) >= scope.from && f.first_order_at.slice(0, 10) <= scope.to
  ).length, [fun.rows, scope]);

  const erosionTotal = erosion.reduce((a, e) => a + e.lostTl, 0);
  const freeShare = sales.cases + sales.freeCases > 0
    ? Math.round((sales.freeCases / (sales.cases + sales.freeCases)) * 1000) / 10 : 0;
  const repNames = useMemo(() => {
    const ids = new Set<string>();
    lines.forEach(l => l.created_by && ids.add(l.created_by));
    visits.forEach(v => ids.add(v.user_id));
    return people.filter(p => ids.has(p.id));
  }, [lines, visits, people]);
  const nameOf = (id: string | null) => people.find(p => p.id === id)?.full_name ?? '—';
  const fmtDay = (iso: string) =>
    new Date(iso.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  const salesMax = niceMax(Math.max(0, ...tr.buckets.map(b => b.net)));
  const visitMax = niceMax(Math.max(0, ...tr.buckets.map(b => b.visits)));
  const empty = sales.orders === 0 && sales.pipelineOrders === 0 && vis.count === 0;

  // Çıktı: karne ve satış satırları — ekrandaki süzgeçle aynı kapsam
  const cardCols = useMemo(() => [
    { key: 'ad', label: 'Temsilci', get: (c: any) => c.name },
    { key: 'net', label: 'Net satış (TL)', get: (c: any) => Math.round(c.net) },
    { key: 'koli', label: 'Koli', get: (c: any) => c.cases },
    { key: 'siparis', label: 'Sipariş', get: (c: any) => c.orders },
    { key: 'yeni', label: 'Yeni müşteri', get: (c: any) => c.newCustomers },
    { key: 'ziyaret', label: 'Ziyaret', get: (c: any) => c.visits },
    { key: 'agirlik', label: 'Ağırlıklı ziyaret', get: (c: any) => c.weighted },
    { key: 'hedef', label: 'Hedef %', get: (c: any) => c.attainment ?? '' },
    { key: 'karar', label: 'Karar verici %', get: (c: any) => c.decisionRate ?? '' },
    { key: 'tadim', label: 'Tadım', get: (c: any) => c.tastings },
    { key: 'takip', label: 'Açık takip', get: (c: any) => c.openFollowUps },
    { key: 'geciken', label: 'Geciken takip', get: (c: any) => c.overdueFollowUps }
  ], []);
  const lineCols = useMemo(() => [
    { key: 'tarih', label: 'Tarih', get: (l: LineRow) => l.order_date },
    { key: 'no', label: 'Sipariş no', get: (l: LineRow) => l.order_no ?? '' },
    { key: 'durum', label: 'Durum', get: (l: LineRow) => l.status },
    { key: 'nokta', label: 'Nokta', get: (l: LineRow) => l.outlet_name ?? '' },
    { key: 'kanal', label: 'Kanal', get: (l: LineRow) => (CHANNEL_LABEL as any)[l.channel ?? ''] ?? l.channel ?? '' },
    { key: 'urun', label: 'Ürün', get: (l: LineRow) => l.product_name ?? '' },
    { key: 'koli', label: 'Ücretli koli', get: (l: LineRow) => l.paid_cases ?? 0 },
    { key: 'bedelsiz', label: 'Bedelsiz koli', get: (l: LineRow) => l.free_cases ?? 0 },
    { key: 'fiyat', label: 'Koli fiyatı', get: (l: LineRow) => l.case_price ?? '' },
    { key: 'liste', label: 'Liste koli fiyatı', get: (l: LineRow) => l.list_case_price ?? '' },
    { key: 'tutar', label: 'Net tutar', get: (l: LineRow) => l.line_total ?? 0 },
    { key: 'temsilci', label: 'Temsilci', get: (l: LineRow) => nameOf(l.created_by) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [people]);
  const scopedLineRows = useMemo(
    () => lines.filter(l => l.order_date >= scope.from && l.order_date <= scope.to
      && (!rep || l.created_by === rep) && l.status !== 'iptal'),
    [lines, scope, rep]);

  const pill = (on: boolean) =>
    `shrink-0 min-h-[40px] rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
      on ? 'bg-ios-blue text-white' : 'bg-[#1C1C1E] text-[#D1D1D6] border border-white/10'}`;

  return (
    <main id="print-area" className="py-5 space-y-4">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Raporlar</h1>
        <p className="text-[13.5px] text-[#8E8E93]">
          {fmtDay(scope.from)} – {fmtDay(scope.to)}{rep ? ` · ${nameOf(rep)}` : ''} · tutarlar KDV hariç
        </p>
      </header>

      {/* Süzgeçler tek satırda; altındaki her şeyi birlikte daraltır */}
      <div className="flex flex-wrap items-center gap-2" data-noprint>
        <div className="flex gap-1.5 overflow-x-auto">
          {PERIODS.map(p => (
            <button key={p.k} onClick={() => setPeriod(p.k)} className={pill(period === p.k)}>{p.l}</button>
          ))}
        </div>
        {isManager && repNames.length > 1 && (
          <select value={rep} onChange={e => setRep(e.target.value)} className="input !w-auto" aria-label="Temsilci">
            <option value="">Tüm temsilciler</option>
            {repNames.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        )}
        <span className="ml-auto flex items-center gap-2">
          <ListExport rows={scopedLineRows} cols={lineCols} name={`satis-satirlari-${period}g`} />
          <PrintButton label="Yazdır" />
        </span>
      </div>

      {loadError && <p className="alert-error">Rapor verisi yüklenemedi: {loadError}</p>}
      {capped && (
        <p className="text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          Kayıt sayısı çok yüksek; rapor ilk 15.000 satırla hesaplandı.
        </p>
      )}

      {empty && !loadError && (
        <div className="card p-8 text-center space-y-2">
          <p className="text-[16px] font-semibold">Bu dönemde kayıt yok</p>
          <p className="text-[13.5px] text-[#8E8E93]">
            Ziyaret ya da satış girildikçe rapor kendiliğinden dolar. Daha uzun bir dönem seçmeyi deneyin.
          </p>
          <Link href="/sales/outlets" className="btn-primary mx-auto">Noktalara git</Link>
        </div>
      )}

      {/* ---------- 1 · NE SATTIK ---------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="col-span-2">
          <StatTile hero label="Gerçekleşen satış (onaylı · sevk · teslim)"
            value={tlShort(sales.net)} delta={delta(sales.net, salesPrev.net)}
            spark={tr.buckets.map(b => b.net)}
            hint={`${nf(sales.cases)} koli · ${sales.orders} sipariş · ${sales.outlets} nokta`} />
        </div>
        <StatTile label="Onay bekleyen" value={tlShort(sales.pipelineNet)}
          hint={sales.pipelineOrders ? `${sales.pipelineOrders} sipariş — satışa dahil değil` : 'bekleyen yok'} />
        <StatTile label="Ortalama koli fiyatı"
          value={sales.avgCasePrice !== null ? tlShort(sales.avgCasePrice) : '—'}
          delta={sales.avgCasePrice !== null && salesPrev.avgCasePrice !== null
            ? delta(sales.avgCasePrice, salesPrev.avgCasePrice) : null}
          hint={`liste ${tlShort(caseList)}`} />
        <StatTile label="Ziyaret" value={nf(vis.count)} delta={delta(vis.count, visPrev.count)}
          hint={vis.attainment !== null ? `hedefin %${nf(vis.attainment, 1)}'i (${nf(vis.target)})` : `${vis.outlets} nokta`} />
        <StatTile label="Ağırlıklı ziyaret" value={nf(vis.weighted)}
          hint={`${vis.decisionMaker} karar verici · ${vis.noAuthority} yetkili yok`} />
        <StatTile label="Yeni müşteri" value={nf(newCustomers)} hint="ilk siparişi bu dönemde" />
        <StatTile label="Tadım → sipariş (30 gün)"
          value={tasting.conversion !== null ? `%${nf(tasting.conversion, 1)}` : '—'}
          hint={`${tasting.outletsConverted}/${tasting.outletsTasted} nokta${tasting.immature ? ` · ${tasting.immature} henüz erken` : ''}`} />
      </div>

      {days > 1 && (
        <div className="grid lg:grid-cols-2 gap-3">
          <ChartCard title="Satış eğilimi" note={`${tr.weekly ? 'Haftalık' : 'Günlük'} net satış, ₺`}>
            <ColumnChart max={salesMax} format={tlShort}
              data={tr.buckets.map(b => ({ key: b.key, label: b.label, value: b.net }))} />
          </ChartCard>
          <ChartCard title="Ziyaret eğilimi" note={`${tr.weekly ? 'Haftalık' : 'Günlük'} gönderilmiş ziyaret`}>
            <ColumnChart max={visitMax} format={n => nf(n)} color={VIZ.s3}
              data={tr.buckets.map(b => ({ key: b.key, label: b.label, value: b.visits }))} />
          </ChartCard>
        </div>
      )}

      {/* ---------- 2 · KİM NE YAPTI ---------- */}
      <ChartCard title="Temsilci karnesi"
        note="Ağırlıklı ziyaret: karar vericiyle tadım 2 · ilk temas 2 · diğer 1 · yetkili yoksa 0"
        right={<ListExport rows={cards} cols={cardCols} name={`temsilci-karnesi-${period}g`} />}>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-[13.5px]">
            <thead className="text-[#8E8E93] text-[12.5px]">
              <tr className="text-right">
                <th className="py-2 font-medium text-left">Temsilci</th>
                <th className="py-2 pl-3 font-medium">Net satış</th>
                <th className="py-2 pl-3 font-medium">Koli</th>
                <th className="py-2 pl-3 font-medium">Yeni</th>
                <th className="py-2 pl-3 font-medium">Ziyaret</th>
                <th className="py-2 pl-3 font-medium">Ağırlıklı</th>
                <th className="py-2 pl-3 font-medium">Hedef</th>
                <th className="py-2 pl-3 font-medium whitespace-nowrap">Karar verici</th>
                <th className="py-2 pl-3 font-medium whitespace-nowrap">Geciken takip</th>
              </tr>
            </thead>
            <tbody>
              {cards.map(c => {
                const maxNet = Math.max(1, ...cards.map(x => x.net));
                return (
                  <tr key={c.id} className="border-t border-white/[0.08] text-right tabular-nums">
                    <td className="py-2.5 text-left">
                      <span className="block truncate max-w-[18ch]">{c.name}</span>
                      <span className="block h-[4px] mt-1 rounded-r-[4px]"
                        style={{ width: `${(c.net / maxNet) * 100}%`, background: VIZ.s1, minWidth: c.net > 0 ? 2 : 0 }} />
                    </td>
                    <td className="py-2.5 pl-3 font-semibold whitespace-nowrap">{tlShort(c.net)}</td>
                    <td className="py-2.5 pl-3">{nf(c.cases)}</td>
                    <td className="py-2.5 pl-3">{c.newCustomers}</td>
                    <td className="py-2.5 pl-3">{c.visits}</td>
                    <td className="py-2.5 pl-3">{c.weighted}</td>
                    <td className="py-2.5 pl-3">{c.attainment !== null ? `%${nf(c.attainment)}` : '—'}</td>
                    <td className="py-2.5 pl-3">{c.decisionRate !== null ? `%${nf(c.decisionRate)}` : '—'}</td>
                    <td className="py-2.5 pl-3">
                      {c.overdueFollowUps > 0
                        ? <span className="badge bg-rose-500/20 text-rose-300">{c.overdueFollowUps}</span>
                        : <span className="text-[#8E8E93]">0</span>}
                    </td>
                  </tr>
                );
              })}
              {cards.length === 0 && (
                <tr><td colSpan={9} className="py-5 text-center text-[#8E8E93]">Bu dönemde kayıt yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[12px] text-[#8E8E93]">
          Ziyaret puanı ortalaması bilerek yok: karnede gösterilirse temsilci kendi verdiği puanı yükseltir
          ve nokta öncelikleri bozulur.
        </p>
      </ChartCard>

      {/* ---------- 3 · MÜŞTERİLER NEREDE ---------- */}
      <div className="grid lg:grid-cols-2 gap-3">
        <ChartCard title="Müşteri hunisi" note="Şu anki durum — dönemden bağımsız, sipariş ve ziyaret kaydından hesaplanır">
          <BarList format={n => nf(n)}
            rows={fun.stages.map(s => ({
              key: s.stage, label: FUNNEL_LABEL[s.stage as FunnelStage], value: s.n,
              sub: FUNNEL_HINT[s.stage as FunnelStage]
            }))} />
        </ChartCard>

        <ChartCard title={`Donuk müşteriler (${fun.frozen.length})`}
          note="Sipariş vermişti, olağan döngüsünü aştı — en değerliden başlayarak">
          {fun.frozen.length === 0 && <p className="text-[13px] text-[#8E8E93]">Donuk müşteri yok.</p>}
          <div className="divide-y divide-white/[0.08]">
            {fun.frozen.slice(0, 8).map(f => (
              <Link key={f.outlet_id} href={`/sales/outlets/${f.outlet_id}`}
                className="flex items-center gap-3 py-2.5 min-h-[44px] hover:bg-white/[0.04] -mx-2 px-2 rounded-lg">
                <span className="flex-1 min-w-0">
                  <span className="block text-[14px] truncate">{f.name}</span>
                  <span className="block text-[12px] text-[#8E8E93] truncate">
                    {f.days_since_order} gün önce{f.cycle_days ? ` · döngü ~${f.cycle_days} gün` : ''}
                    {f.district ? ` · ${f.district}` : ''}
                  </span>
                </span>
                <span className="text-[13.5px] font-semibold tabular-nums shrink-0">{tlShort(Number(f.order_total ?? 0))}</span>
              </Link>
            ))}
          </div>
          {fun.firstOrder.length > 0 && (
            <p className="text-[12.5px] text-[#8E8E93] pt-1">
              <strong className="text-[#F2F2F7]">{fun.firstOrder.length} nokta</strong> tek sipariş verdi, ikincisini bekliyor.{' '}
              <Link href="/sales/outlets" className="text-ios-blue hover:underline">Noktalar → İlk sipariş</Link>
            </p>
          )}
        </ChartCard>
      </div>

      {/* ---------- 4 · NEDEN KAYBEDİYORUZ ---------- */}
      <div className="grid lg:grid-cols-2 gap-3">
        <ChartCard title="İtirazlar — aylık potansiyel ağırlığıyla"
          note="Çubuk: o nedene takılan noktaların aylık potansiyeli (koli × liste fiyatı)">
          <BarList color={VIZ.s2} format={tlShort} empty="Bu dönemde itiraz kaydı yok."
            rows={obj.slice(0, 8).map(o => ({
              key: o.id, label: o.label, value: o.monthlyTl,
              sub: `${o.stated} beyan · ${o.real} gerçek${o.lost ? ` · ${o.lost} kayıp` : ''}`
            }))} />
          {obj.length > 0 && obj.every(o => o.monthlyTl === 0) && (
            <p className="text-[12.5px] text-amber-300 flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>Noktalarda aylık potansiyel (koli) girilmemiş; ağırlık hesaplanamıyor. Nokta formundan ekleyin.</span>
            </p>
          )}
        </ChartCard>

        <ChartCard title="Fiyat erozyonu"
          note={`Liste altı satışla bırakılan tutar: ${tlShort(erosionTotal)}`}>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-[13.5px]">
              <thead className="text-[#8E8E93] text-[12.5px]">
                <tr className="text-right">
                  <th className="py-2 font-medium text-left">Ürün</th>
                  <th className="py-2 pl-3 font-medium">Liste</th>
                  <th className="py-2 pl-3 font-medium">Ortalama</th>
                  <th className="py-2 pl-3 font-medium">İskonto</th>
                  <th className="py-2 pl-3 font-medium">Bırakılan</th>
                </tr>
              </thead>
              <tbody>
                {erosion.map(e => (
                  <tr key={e.id} className="border-t border-white/[0.08] text-right tabular-nums">
                    <td className="py-2.5 text-left">{e.label}
                      <span className="block text-[12px] text-[#8E8E93]">{nf(e.cases)} koli · {nf(e.belowCases)} liste altı</span>
                    </td>
                    <td className="py-2.5 pl-3">{e.listCase !== null ? tlShort(e.listCase) : '—'}</td>
                    <td className="py-2.5 pl-3">{e.avgCase !== null ? tlShort(e.avgCase) : '—'}</td>
                    <td className="py-2.5 pl-3">{e.discountPct !== null ? `%${nf(e.discountPct, 1)}` : '—'}</td>
                    <td className="py-2.5 pl-3 font-semibold whitespace-nowrap">{tlShort(e.lostTl)}</td>
                  </tr>
                ))}
                {erosion.length === 0 && (
                  <tr><td colSpan={5} className="py-5 text-center text-[#8E8E93]">Bu dönemde satış yok.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Ürün × kanal" note="Gerçekleşen ücretli koli — koyu hücre daha çok satış">
        <HeatTable rows={matrix.rows} cols={matrix.cols} max={matrix.max}
          cell={(r, c) => matrix.cell(r, c).cases} format={n => nf(n)} />
      </ChartCard>

      <div className="grid lg:grid-cols-2 gap-3">
        <ChartCard title="Tadım ve numune" note="Numune bedavadır ama maliyetsiz değildir">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
            <Fact k="Tadımlı ziyaret" v={nf(tasting.visits)} />
            <Fact k="Numune maliyeti (liste)" v={tlShort(tasting.sampleCost)} />
            <Fact k="Açılan şişe" v={nf(tasting.opened)} />
            <Fact k="Bırakılan kapalı şişe" v={nf(tasting.sealed)} />
          </dl>
          {tasting.overLimit > 0 && (
            <p className="text-[12.5px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-start gap-1.5">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{tasting.overLimit} ziyarette {SEALED_LIMIT} şişe sınırı aşıldı.</span>
            </p>
          )}
        </ChartCard>

        <ChartCard title="Bedelsiz ve silinen kayıtlar" note="Gelire girmeyen mal ve geri alınan belgeler">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
            <Fact k="Bedelsiz koli" v={nf(sales.freeCases)} />
            <Fact k="Bedelsiz payı" v={`%${nf(freeShare, 1)}`} />
            <Fact k="Bedelsiz değeri (liste)" v={tlShort(sales.freeValue)} />
            <Fact k="Doğrudan satış" v={`${sales.directOrders}/${sales.orders} sipariş`} />
          </dl>
          {isManager && (
            <div className="pt-1">
              <p className="text-[12.5px] text-[#8E8E93] mb-1">Son silinenler ({deletions.length})</p>
              {deletions.length === 0 && <p className="text-[13px] text-[#8E8E93]">Silinen kayıt yok.</p>}
              <div className="divide-y divide-white/[0.08]">
                {deletions.slice(0, 6).map(d => (
                  <p key={d.id} className="py-1.5 text-[13px]">
                    <span className="font-medium">{ENTITY_LABEL[d.entity] ?? d.entity}</span>
                    {d.label ? ` · ${d.label}` : ''}
                    <span className="block text-[12px] text-[#8E8E93]">
                      {fmtDay(d.deleted_at)} · {nameOf(d.deleted_by)}{d.reason ? ` · ${d.reason}` : ' · sebep yazılmadı'}
                    </span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
      </div>
    </main>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[12px] text-[#8E8E93]">{k}</dt>
      <dd className="text-[18px] font-semibold">{v}</dd>
    </div>
  );
}
