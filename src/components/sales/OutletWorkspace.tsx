'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck, Zap, FileText, Gauge, Phone, MapPin, Clock, X,
  ChevronRight, AlertTriangle, ArrowRight, CheckCircle2
} from 'lucide-react';
import { createQuote, createDirectOrder } from '@/app/(app)/sales/orders/actions';
import SaleLines, { type SaleLinesState } from '@/components/sales/SaleLines';
import VisitQuickForm, {
  type ProductLite as VisitProduct, type CriterionLite, type ReasonLite, type PersonLite
} from '@/components/sales/VisitQuickForm';
import AssessmentForm from '@/components/sales/AssessmentForm';
import BalanceStrip from '@/components/sales/BalanceStrip';
import {
  OUTLET_STATUS_LABEL, OUTLET_STATUS_COLOR, SEGMENT_COLOR,
  OUTCOME_LABEL, OUTCOME_COLOR,
  FUNNEL_LABEL, FUNNEL_COLOR, FUNNEL_HINT, type FunnelStage
} from '@/lib/sales-types';
import { tl, ORDER_STATUS_LABEL, QUOTE_STATUS_LABEL } from '@/lib/commerce-format';

type Panel = 'ziyaret' | 'satis' | 'teklif' | 'degerlendirme' | null;

export interface WorkspaceOutlet {
  id: string; name: string; status: string; segment: string | null;
  score_pct: number | null; city: string | null; district: string | null;
  address: string | null; phone: string | null; preferred_contact_time: string | null;
  tax_number: string | null; last_visit_at: string | null;
}

/**
 * NOKTA KARTI = TEK ÇALIŞMA ALANI
 *
 * Asıl şikâyet "sayfalar arası kargaşa"ydı: ziyaret bir sayfada, teklif
 * başka sayfada, sipariş üçüncü sayfada; birinden diğerine geçerken
 * nokta seçimi baştan yapılıyor, geri dönünce yer kayboluyordu.
 *
 * Üç işlem — ziyaret, doğrudan satış, teklif — bu kartın İÇİNDE
 * açılıyor. Sayfa değişmiyor, nokta zaten seçili, kaydedince panel
 * kapanıp geçmiş güncelleniyor. Tek seferde tek panel açık.
 *
 * Aday değerlendirmesi (A/B/C puanı) işlem çubuğundan çıkarıldı: her
 * ziyarette yapılan bir iş değil, dört düğmenin biri olarak durması
 * çubuğu kalabalıklaştırıyordu. Kimlik kartındaki "değerlendir"
 * bağlantısından açılıyor.
 */
export default function OutletWorkspace({
  outlet, typeName, missing, next, visits, quotes, orders, assessments,
  products, prices, criteriaF02, criteriaF03, reasons, people, today, children,
  funnel, loadError, balance
}: {
  /** v_outlet_funnel satırı: aşama okuma anında hesaplanır */
  funnel?: {
    stage: string; order_count: number; last_order_at: string | null;
    days_since_order: number | null; cycle_days: number | null; order_total: number | null;
  } | null;
  loadError?: string | null;
  balance?: {
    open_balance: number | null; overdue_days: number | null;
    balance_note: string | null; balance_updated_at: string | null;
  };
  outlet: WorkspaceOutlet;
  typeName: string | null;
  missing: string[];
  next: { title: string; note: string; panel: Panel; href?: string; cta: string };
  visits: { id: string; visit_date: string; outcome: string; overall_score: number | null; status: string }[];
  quotes: { id: string; quote_no: number | null; status: string; total_incl_vat: number; created_at?: string }[];
  orders: { id: string; order_no: number | null; status: string; total_amount: number; delivery_date: string | null; created_at?: string }[];
  assessments: { id: string; assessed_at: string; raw_total: number; max_total: number; priority: string | null }[];
  products: VisitProduct[];
  prices: Record<string, number | null>;
  criteriaF02: { id: string; label: string; scale_min: number; scale_max: number }[];
  criteriaF03: CriterionLite[];
  reasons: ReasonLite[];
  people: PersonLite[];
  today: string;
  /** Firma bilgileri, kişiler, tedarik ayarları — sunucu bileşenleri */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const [saleLines, setSaleLines] = useState<SaleLinesState>(
    { any: false, missingPrice: false, net: 0, cases: 0 }
  );
  // Doğrudan satış kaydedilince kart yerinde kalıyor; ne olduğunu ve
  // sıradaki tek adımı (onay) gösteren not.
  const [sold, setSold] = useState<{ id: string } | null>(null);
  const [quoteLines, setQuoteLines] = useState<SaleLinesState>(
    { any: false, missingPrice: false, net: 0, cases: 0 }
  );

  const where = [typeName, outlet.district, outlet.city].filter(Boolean).join(' · ');
  const mapsHref = outlet.address
    ? `https://maps.google.com/?q=${encodeURIComponent(
        [outlet.address, outlet.district, outlet.city].filter(Boolean).join(' '))}`
    : null;

  const toggle = (p: Panel) => { setErr(null); setPanel(cur => (cur === p ? null : p)); };

  function run(fn: (fd: FormData) => Promise<any>, fd: FormData, after?: (r: any) => void) {
    setErr(null);
    start(async () => {
      let r: any;
      try { r = await fn(fd); }
      catch (e: any) { setErr(`Beklenmeyen hata: ${e?.message ?? 'bilinmiyor'}`); return; }
      if (r?.error) { setErr(r.error); return; }
      setPanel(null);
      after?.(r);
      router.refresh();
    });
  }

  const actions: { key: Panel; label: string; icon: any }[] = [
    { key: 'ziyaret', label: 'Ziyaret', icon: ClipboardCheck },
    { key: 'satis', label: 'Doğrudan satış', icon: Zap },
    { key: 'teklif', label: 'Teklif', icon: FileText }
  ];
  const stage = (funnel?.stage ?? null) as FunnelStage | null;

  const lastAssessment = assessments[0];

  return (
    <main className="py-5 space-y-4">
      {/* ---------- KİMLİK ---------- */}
      <header className="card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight leading-tight">{outlet.name}</h1>
            <p className="text-[13px] text-[#8E8E93] mt-0.5">{where || '—'}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {/* Aşama veriden hesaplanır (ziyaret, tadım, sipariş); elle
                seçilen "durum" yerine gerçekte ne olduğunu gösterir. */}
            {stage ? (
              <span className={`badge ${FUNNEL_COLOR[stage]}`} title={FUNNEL_HINT[stage]}>
                {FUNNEL_LABEL[stage]}
              </span>
            ) : (
              <span className={`badge ${OUTLET_STATUS_COLOR[outlet.status as keyof typeof OUTLET_STATUS_COLOR]}`}>
                {OUTLET_STATUS_LABEL[outlet.status as keyof typeof OUTLET_STATUS_LABEL]}
              </span>
            )}
            {outlet.segment ? (
              <button type="button" onClick={() => toggle('degerlendirme')}
                className={`badge ${SEGMENT_COLOR[outlet.segment as 'A' | 'B' | 'C']}`}
                title="Değerlendirmeyi aç">
                {outlet.segment}{outlet.score_pct !== null ? ` · %${Math.round(outlet.score_pct)}` : ''}
              </button>
            ) : (
              <button type="button" onClick={() => toggle('degerlendirme')}
                className="text-[12px] text-ios-blue flex items-center gap-1 min-h-[28px]">
                <Gauge size={12} /> değerlendir
              </button>
            )}
          </div>
        </div>

        {/* Dokununca arayan telefon, dokununca haritayı açan adres:
            sahada en çok kullanılan iki şey. */}
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-[13px]">
          {outlet.phone && (
            <a href={`tel:${outlet.phone.replace(/\s/g, '')}`}
              className="flex items-center gap-1.5 text-ios-blue">
              <Phone size={13} />{outlet.phone}
            </a>
          )}
          {outlet.address ? (
            <a href={mapsHref!} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-ios-blue min-w-0">
              <MapPin size={13} className="shrink-0" />
              <span className="truncate max-w-[22ch]">{outlet.address}</span>
            </a>
          ) : (
            <a href="#firma-bilgileri" className="flex items-center gap-1.5 text-amber-300">
              <MapPin size={13} /> adres yok — ekle
            </a>
          )}
          {outlet.preferred_contact_time && (
            <span className="flex items-center gap-1.5 text-[#AEAEB2]">
              <Clock size={13} />{outlet.preferred_contact_time}
            </span>
          )}
        </div>

        {funnel && funnel.order_count > 0 && (
          <p className="mt-2.5 text-[12.5px] text-[#8E8E93] tabular-nums">
            {funnel.order_count} sipariş · {tl(Number(funnel.order_total ?? 0))}
            {funnel.days_since_order != null ? ` · son sipariş ${funnel.days_since_order} gün önce` : ''}
            {funnel.cycle_days ? ` · döngü ~${funnel.cycle_days} gün` : ''}
          </p>
        )}
      </header>

      {loadError && (
        <p className="alert-error">Bazı bilgiler yüklenemedi: {loadError}. Sayfayı yenileyin.</p>
      )}

      {balance && (
        <BalanceStrip
          outletId={outlet.id}
          balance={balance.open_balance}
          overdueDays={balance.overdue_days}
          note={balance.balance_note}
          updatedAt={balance.balance_updated_at}
        />
      )}

      {/* ---------- SIRADAKİ ADIM ---------- */}
      <section className="card p-4 border border-ios-blue/30 bg-ios-blue/[0.06]">
        <p className="text-[11px] uppercase tracking-[0.1em] text-ios-blue font-bold">Sıradaki adım</p>
        <p className="text-[16px] font-semibold mt-1">{next.title}</p>
        <p className="text-[12.5px] text-[#AEAEB2] mt-0.5">{next.note}</p>
        <div className="mt-3">
          {next.panel ? (
            <button onClick={() => toggle(next.panel)} className="btn-primary">
              {next.cta} <ArrowRight size={15} />
            </button>
          ) : next.href ? (
            <Link href={next.href} className="btn-primary">
              {next.cta} <ArrowRight size={15} />
            </Link>
          ) : null}
        </div>

        {missing.length > 0 && (
          <p className="mt-3 text-[12.5px] text-amber-300 flex items-start gap-1.5">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              Eksik: {missing.join(', ')}.{' '}
              <a href="#firma-bilgileri" className="underline font-semibold">tamamla</a>
              {' '}— satış yapmaya engel değil, fatura için gerekli.
            </span>
          </p>
        )}
      </section>

      {/* ---------- İŞLEM ÇUBUĞU ---------- */}
      <div className="grid grid-cols-3 gap-1.5">
        {actions.map(a => {
          const on = panel === a.key;
          return (
            <button key={a.key} onClick={() => toggle(a.key)}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 min-h-[58px]
                transition-colors ${on
                  ? 'bg-ios-blue text-white'
                  : 'bg-[#1C1C1E] border border-white/10 text-[#F2F2F7] hover:bg-white/[0.06]'}`}>
              {on ? <X size={17} /> : <a.icon size={17} />}
              <span className="text-[12.5px] font-semibold leading-tight text-center px-0.5">
                {a.label}
              </span>
            </button>
          );
        })}
      </div>

      {err && <p className="alert-error">{err}</p>}

      {sold && !panel && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-3 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-300 shrink-0" />
          <p className="flex-1 min-w-0 text-[13.5px] text-emerald-300">
            Satış kaydedildi. Ziyaret ve bu noktanın koli fiyatı da yazıldı; sipariş onay bekliyor.
          </p>
          <Link href={`/sales/orders/${sold.id}`} className="btn-primary shrink-0">Siparişi aç</Link>
        </div>
      )}

      {/* ---------- AÇILAN PANEL ---------- */}
      {panel === 'ziyaret' && (
        <section className="card p-4 space-y-3">
          <p className="text-[14px] font-semibold">Ziyaret kaydı</p>
          <VisitQuickForm
            outlets={[{ id: outlet.id, name: outlet.name, city: outlet.city,
              district: outlet.district, status: outlet.status }]}
            products={products}
            criteria={criteriaF03}
            reasons={reasons}
            people={people}
            orders={orders.map(o => ({
              id: o.id, order_no: o.order_no, total_amount: o.total_amount, outlet_id: outlet.id
            }))}
            preselectedOutlet={outlet.id}
            today={today}
            embedded
            onDone={() => setPanel(null)}
            onNeedSale={() => { setErr(null); setPanel('satis'); }}
          />
        </section>
      )}

      {panel === 'satis' && (
        <section className="card p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-[14px] font-semibold">Doğrudan satış</p>
            <p className="text-[11.5px] text-[#8E8E93]">1 koli = 12 × 250 ml</p>
          </div>
          <form action={(fd) => run(createDirectOrder, fd, (r) => {
            if (r?.id) setSold({ id: r.id });
          })} className="space-y-3">
            <input type="hidden" name="outlet_id" value={outlet.id} />
            <input type="hidden" name="vat_rate" value="1" />
            <SaleLines products={products} prices={prices} field="order" onState={setSaleLines} />
            {/* Zorunlu olan yalnızca koli ve koli fiyatı. Gerisi isteğe bağlı. */}
            <details className="rounded-xl bg-white/[0.04] px-3 py-2">
              <summary className="cursor-pointer list-none text-[13px] text-[#8E8E93] min-h-[32px] flex items-center justify-between">
                Teslim, ödeme ve not <span className="text-[12px]">isteğe bağlı</span>
              </summary>
              <div className="space-y-3 mt-2 pb-1">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Teslim tarihi</label>
                    <input type="date" name="delivery_date" className="input" />
                  </div>
                  <div>
                    <label className="label">Ödeme</label>
                    <input name="payment_method" className="input" placeholder="Peşin / 30 gün" />
                  </div>
                </div>
                <div>
                  <label className="label">Kiminle anlaşıldı?</label>
                  <input name="verbal_note" className="input"
                    placeholder="Örn: Sahibi Ahmet Bey, peşin" />
                </div>
                <p className="text-[12px] text-[#8E8E93]">
                  Teslim adresi olarak noktanın kayıtlı adresi kullanılır.
                </p>
              </div>
            </details>
            <button type="submit" disabled={pending || !saleLines.any || saleLines.missingPrice}
              className="btn-primary w-full justify-center disabled:opacity-40">
              {pending ? 'Kaydediliyor…' : `Satışı kaydet${saleLines.net > 0 ? ` · ${tl(saleLines.net * 1.01)}` : ''}`}
            </button>
            {(!saleLines.any || saleLines.missingPrice) && (
              <p className="text-[12px] text-amber-300">
                {!saleLines.any ? 'Koli adedi girin.' : 'Koli fiyatı girin.'}
              </p>
            )}
          </form>
        </section>
      )}

      {panel === 'teklif' && (
        <section className="card p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <p className="text-[14px] font-semibold">Teklif</p>
            <p className="text-[11.5px] text-[#8E8E93]">onay sonrası siparişe çevrilir</p>
          </div>
          <form action={(fd) => run(createQuote, fd, (r) => {
            if (r?.id) router.push(`/sales/orders/quotes/${r.id}`);
          })} className="space-y-3">
            <input type="hidden" name="outlet_id" value={outlet.id} />
            <input type="hidden" name="vat_rate" value="1" />
            <SaleLines products={products} prices={prices} field="quote" onState={setQuoteLines} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Geçerlilik</label>
                <input type="date" name="valid_until" className="input" />
              </div>
              <div>
                <label className="label">Ödeme</label>
                <input name="payment_method" className="input" placeholder="Peşin / 30 gün" />
              </div>
            </div>
            <button type="submit" disabled={pending || !quoteLines.any || quoteLines.missingPrice}
              className="btn-primary disabled:opacity-40">
              {pending ? 'Kaydediliyor…' : 'Teklifi oluştur'}
            </button>
          </form>
        </section>
      )}

      {panel === 'degerlendirme' && (
        <section id="degerlendirme" className="card p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-semibold">Aday değerlendirmesi</p>
              <p className="text-[12.5px] text-[#8E8E93]">
                Bilinmiyorsa boş bırakın — boş kriter puanı düşürmez.
              </p>
            </div>
            {lastAssessment && (
              <p className="text-right shrink-0">
                <span className="text-[18px] font-bold tabular-nums">
                  {lastAssessment.raw_total}
                  <span className="text-[#8E8E93] text-[13px]">/{lastAssessment.max_total}</span>
                </span>
              </p>
            )}
          </div>
          <AssessmentForm
            outletId={outlet.id}
            criteria={criteriaF02 as any}
            defaults={{ preferred_contact_time: outlet.preferred_contact_time }}
          />
        </section>
      )}

      {/* ---------- GEÇMİŞ ---------- */}
      <Timeline
        outletId={outlet.id}
        visits={visits}
        quotes={quotes}
        orders={orders}
      />

      {/* firma bilgileri · kişiler · tedarik — sunucu bileşenleri */}
      {children}
    </main>
  );
}

/**
 * Tek akış çizelgesi: ziyaret, teklif ve sipariş ayrı ayrı listelerde
 * değil, zaman sırasına göre bir arada. "Bu noktada ne oldu" sorusu
 * üç listeyi karşılaştırmayı gerektirmiyor artık.
 */
function Timeline({
  outletId, visits, quotes, orders
}: {
  outletId: string;
  visits: { id: string; visit_date: string; outcome: string; overall_score: number | null; status: string }[];
  quotes: { id: string; quote_no: number | null; status: string; total_incl_vat: number; created_at?: string }[];
  orders: { id: string; order_no: number | null; status: string; total_amount: number; delivery_date: string | null; created_at?: string }[];
}) {
  const rows = useMemo(() => {
    const out: {
      key: string; href: string; date: string; kind: string;
      title: string; sub: string; badge: string; color: string;
    }[] = [];

    for (const v of visits) {
      out.push({
        key: 'v' + v.id, href: `/sales/visits/${v.id}`, date: v.visit_date, kind: 'Ziyaret',
        title: OUTCOME_LABEL[v.outcome as keyof typeof OUTCOME_LABEL] ?? v.outcome,
        sub: v.overall_score !== null ? `puan ${v.overall_score}/5` : '',
        badge: v.status === 'taslak' ? 'taslak' : '',
        color: OUTCOME_COLOR[v.outcome as keyof typeof OUTCOME_COLOR] ?? 'bg-white/10 text-[#AEAEB2]'
      });
    }
    for (const q of quotes) {
      out.push({
        key: 'q' + q.id, href: `/sales/orders/quotes/${q.id}`, date: (q.created_at ?? '').slice(0, 10), kind: 'Teklif',
        title: `${q.quote_no ? '#' + q.quote_no + ' · ' : ''}${tl(q.total_incl_vat)}`,
        sub: QUOTE_STATUS_LABEL[q.status as keyof typeof QUOTE_STATUS_LABEL] ?? q.status,
        badge: '', color: 'bg-white/10 text-[#AEAEB2]'
      });
    }
    for (const o of orders) {
      out.push({
        key: 'o' + o.id, href: `/sales/orders/${o.id}`, date: (o.created_at ?? o.delivery_date ?? '').slice(0, 10), kind: 'Sipariş',
        title: `${o.order_no ? '#' + o.order_no + ' · ' : ''}${tl(o.total_amount)}`,
        sub: ORDER_STATUS_LABEL[o.status as keyof typeof ORDER_STATUS_LABEL] ?? o.status,
        badge: '', color: 'bg-emerald-500/15 text-emerald-300'
      });
    }
    return out.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 20);
  }, [visits, quotes, orders]);

  const fmt = (iso: string) => iso
    ? new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
    : '—';

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <p className="section-title !mb-0">Bu noktada ne oldu</p>
        <Link href={`/sales/orders?outlet=${outletId}`} className="text-[12.5px] text-ios-blue">
tüm belgeler
        </Link>
      </div>
      {rows.length === 0 && (
        <p className="px-4 pb-4 text-[13.5px] text-[#8E8E93]">
          Henüz kayıt yok. Yukarıdaki düğmelerden başlayın.
        </p>
      )}
      <div className="divide-y divide-white/[0.08]">
        {rows.map(r => (
          <Link key={r.key} href={r.href}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors">
            <span className="text-[12px] text-[#8E8E93] tabular-nums w-14 shrink-0">{fmt(r.date)}</span>
            <span className="text-[11px] text-[#8E8E93] w-14 shrink-0">{r.kind}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] truncate">{r.title}</p>
              {r.sub && <p className="text-[12px] text-[#8E8E93] truncate">{r.sub}</p>}
            </div>
            {r.badge && <span className="badge bg-white/10 text-[#8E8E93] shrink-0">{r.badge}</span>}
            <ChevronRight size={14} className="text-[#C7C7CC] shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  );
}
