'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ChevronRight, FileText, Package, AlertTriangle, X } from 'lucide-react';
import {
  tl, QUOTE_STATUS_LABEL, QUOTE_STATUS_COLOR, ORDER_STATUS_LABEL, ORDER_STATUS_COLOR,
  QUOTE_CLOSED, ORDER_CLOSED, type QuoteStatus, type OrderStatus
} from '@/lib/commerce-format';

/**
 * TEKLİF VE SİPARİŞ LİSTESİ (F05 · F06)
 *
 * İki iç sekme: aynı ticari zincirin iki halkası olduğu için ayrı
 * sayfalara bölmek yerine tek ekranda tutuldu.
 *
 * Durum etiketleri ve birim çevrimi `@/lib/commerce-format` dosyasında —
 * sunucu bileşenleri de aynı sözlüğü kullanabilsin diye. Burada yalnızca
 * istemci tarafı arayüz var: liste, filtreler ve ortak form dili.
 */

/**
 * ORTAK FORM DİLİ — nokta, ziyaret, teklif ve sipariş formları aynı
 * sırayı ve aynı başlık biçimini kullanıyor:
 *   1 Kim & Nerede · 2 Ne · 3 Kaça · 4 Koşullar · 5 Sonuç & Takip
 * Nokta formunda para adımı olmadığı için orada 4 başlık var; başlık
 * METİNLERİ aynı kaldığı sürece temsilci her formda aynı yerde aynı
 * şeyi arıyor — kritik olan sıra, numara değil.
 */
export function SalesStep({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="shrink-0 w-6 h-6 mt-0.5 rounded-full bg-ios-blue/20 text-ios-blue text-[12px] font-bold flex items-center justify-center tabular-nums">
        {n}
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-tight">{title}</p>
        <p className="text-[12px] text-[#8E8E93] mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

/**
 * SIRADAKİ ADIM kartı — her belge durumunda TEK birincil buton.
 * Temsilci ekrana bakıp "şimdi ne yapmam gerekiyor" diye düşünmesin;
 * ekran bunu söylüyor. Buton kilitliyse NEDENİ de yazıyor.
 */
export function NextStepCard({
  title, hint, blocked, children
}: { title: string; hint?: string; blocked?: string | null; children?: React.ReactNode }) {
  return (
    <section className="card p-5 space-y-3 border border-ios-blue/25">
      <div>
        <p className="text-[12px] uppercase tracking-wide text-ios-blue font-semibold">Sıradaki adım</p>
        <p className="text-[17px] font-semibold leading-tight mt-1">{title}</p>
        {hint && <p className="text-[13px] text-[#8E8E93] mt-1">{hint}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2 items-center">{children}</div>}
      {blocked && (
        <p className="text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{blocked}</span>
        </p>
      )}
    </section>
  );
}

interface QuoteRow {
  id: string; quote_no: number | null; status: QuoteStatus;
  total_incl_vat: number; valid_until: string | null; created_at: string;
  finance_checked_at: string | null; sales_checked_at: string | null;
  outlets: { name: string; district: string | null } | null;
}
interface OrderRow {
  id: string; order_no: number | null; status: OrderStatus;
  total_amount: number; delivery_date: string | null; created_at: string;
  stock_confirmed_at: string | null;
  outlets: { name: string; district: string | null } | null;
}

const tr = (s: string) => s.toLocaleLowerCase('tr-TR');
const fmtD = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Teklif listesi filtreleri — noktalar ekranındaki pillerle aynı dil. */
const QUOTE_FILTERS = [
  { key: 'acik', label: 'Açık' },
  { key: 'kontrol', label: 'Kontrol bekleyen' },
  { key: 'onayli', label: 'Onaylı' },
  { key: 'kapali', label: 'Kapanmış' },
  { key: 'tum', label: 'Tümü' }
] as const;
type QuoteFilter = typeof QUOTE_FILTERS[number]['key'];

const ORDER_FILTERS = [
  { key: 'acik', label: 'Açık' },
  { key: 'teyit', label: 'Teyit bekleyen' },
  { key: 'yolda', label: 'Yolda' },
  { key: 'kapali', label: 'Kapanmış' },
  { key: 'tum', label: 'Tümü' }
] as const;
type OrderFilter = typeof ORDER_FILTERS[number]['key'];

/** Belgenin sıradaki adımı — listede tek satır olarak gösteriliyor. */
function quoteNext(x: QuoteRow, todayIso: string): string {
  const checks = (x.finance_checked_at ? 1 : 0) + (x.sales_checked_at ? 1 : 0);
  if (['taslak', 'kontrolde'].includes(x.status)) {
    return checks < 2 ? `kontrol ${checks}/2 — tamamlanmalı` : 'onaylanmaya hazır';
  }
  if (x.status === 'onayli') return 'müşteriye sunulmalı';
  if (x.status === 'sunuldu') {
    return x.valid_until && x.valid_until < todayIso ? 'süresi geçti — yenile' : 'müşteri yanıtı bekleniyor';
  }
  if (x.status === 'kabul') return 'siparişe çevrilmeli';
  return '';
}

function orderNext(x: OrderRow): string {
  if (!x.stock_confirmed_at && !ORDER_CLOSED.includes(x.status)) return 'stok ve sevk teyidi bekliyor';
  if (['taslak', 'onay_bekliyor'].includes(x.status)) return 'onaylanmaya hazır';
  if (x.status === 'onayli') return 'sevk edilmeli';
  if (x.status === 'sevk_edildi') return 'teslim teyidi bekliyor';
  return '';
}

export default function OrdersClient({
  quotes, orders, todayIso, outletId, outletName, initialTab
}: {
  quotes: QuoteRow[];
  orders: OrderRow[];
  todayIso: string;
  outletId?: string;
  outletName?: string | null;
  initialTab?: 'quotes' | 'orders';
}) {
  const [tab, setTab] = useState<'quotes' | 'orders'>(initialTab ?? 'quotes');
  const [q, setQ] = useState('');
  const [qf, setQf] = useState<QuoteFilter>('acik');
  const [of, setOf] = useState<OrderFilter>('acik');

  const pendingChecks = useMemo(
    () => quotes.filter(x => ['taslak', 'kontrolde'].includes(x.status)
      && (!x.finance_checked_at || !x.sales_checked_at)).length,
    [quotes]
  );
  const expired = useMemo(
    () => quotes.filter(x => ['onayli', 'sunuldu'].includes(x.status)
      && x.valid_until && x.valid_until < todayIso).length,
    [quotes, todayIso]
  );
  const awaitingStock = useMemo(
    () => orders.filter(o => !o.stock_confirmed_at && !ORDER_CLOSED.includes(o.status)).length,
    [orders]
  );

  const quoteMatches = (x: QuoteRow, f: QuoteFilter) => {
    const checks = (x.finance_checked_at ? 1 : 0) + (x.sales_checked_at ? 1 : 0);
    switch (f) {
      case 'acik': return !QUOTE_CLOSED.includes(x.status);
      case 'kontrol': return ['taslak', 'kontrolde'].includes(x.status) && checks < 2;
      case 'onayli': return ['onayli', 'sunuldu'].includes(x.status);
      case 'kapali': return QUOTE_CLOSED.includes(x.status);
      default: return true;
    }
  };

  const orderMatches = (x: OrderRow, f: OrderFilter) => {
    switch (f) {
      case 'acik': return !ORDER_CLOSED.includes(x.status);
      case 'teyit': return !x.stock_confirmed_at && !ORDER_CLOSED.includes(x.status);
      case 'yolda': return ['onayli', 'sevk_edildi'].includes(x.status);
      case 'kapali': return ORDER_CLOSED.includes(x.status);
      default: return true;
    }
  };

  const searchHit = (parts: (string | number | null | undefined)[]) =>
    !q || tr(parts.filter(Boolean).join(' ')).includes(tr(q));

  const fQuotes = useMemo(
    () => quotes.filter(x => quoteMatches(x, qf)
      && searchHit([x.outlets?.name, x.outlets?.district, x.quote_no])),
    [quotes, qf, q]
  );
  const fOrders = useMemo(
    () => orders.filter(x => orderMatches(x, of)
      && searchHit([x.outlets?.name, x.outlets?.district, x.order_no])),
    [orders, of, q]
  );

  const newQuoteHref = outletId
    ? `/sales/orders/quotes/new?outlet=${outletId}`
    : '/sales/orders/quotes/new';

  return (
    <main className="py-5 space-y-5">
      <header className="px-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Teklif &amp; Sipariş</h1>
          <p className="text-[14px] text-[#8E8E93] truncate">
            {quotes.length} teklif · {orders.length} sipariş
          </p>
        </div>
        <Link href={newQuoteHref} className="btn-primary shrink-0">
          <Plus size={16} /> Yeni Teklif
        </Link>
      </header>

      {/* Nokta kartından gelindiyse kapsam görünür ve tek tıkla kaldırılır. */}
      {outletId && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-ios-blue/10 border border-ios-blue/30 px-3 py-2">
          <p className="text-[13px] min-w-0 truncate">
            <span className="text-[#8E8E93]">Nokta:</span>{' '}
            <Link href={`/sales/outlets/${outletId}`} className="text-ios-blue hover:underline">
              {outletName ?? 'seçili nokta'}
            </Link>
          </p>
          <Link href="/sales/orders" className="text-[12px] text-[#AEAEB2] flex items-center gap-1 shrink-0">
            <X size={13} /> kapsamı kaldır
          </Link>
        </div>
      )}

      {(pendingChecks > 0 || expired > 0 || awaitingStock > 0) && (
        <div className="space-y-2">
          {pendingChecks > 0 && (
            <button onClick={() => { setTab('quotes'); setQf('kontrol'); }}
              className="w-full text-left text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
              {pendingChecks} teklif kontrol bekliyor — mali kontrol ve satış kontrolü tamamlanmadan onaylanamaz.
            </button>
          )}
          {expired > 0 && (
            <button onClick={() => { setTab('quotes'); setQf('onayli'); }}
              className="w-full text-left text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              {expired} teklifin geçerlilik tarihi geçmiş — yenilenmeli.
            </button>
          )}
          {awaitingStock > 0 && (
            <button onClick={() => { setTab('orders'); setOf('teyit'); }}
              className="w-full text-left text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
              {awaitingStock} sipariş stok ve sevk teyidi bekliyor.
            </button>
          )}
        </div>
      )}

      <div className="segment">
        <button onClick={() => setTab('quotes')}
          className={`segment-item ${tab === 'quotes' ? 'segment-item-active' : ''} flex items-center justify-center gap-1.5`}>
          <FileText size={14} /> Teklifler ({quotes.length})
        </button>
        <button onClick={() => setTab('orders')}
          className={`segment-item ${tab === 'orders' ? 'segment-item-active' : ''} flex items-center justify-center gap-1.5`}>
          <Package size={14} /> Siparişler ({orders.length})
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
        <input value={q} onChange={e => setQ(e.target.value)} className="input !pl-10"
          placeholder="Nokta veya belge no ara…" />
      </div>

      {/* Filtre pilleri — noktalar ekranındakiyle aynı biçim ve aynı yer. */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {tab === 'quotes'
          ? QUOTE_FILTERS.map(f => (
              <Pill key={f.key} label={f.label} active={qf === f.key}
                count={quotes.filter(x => quoteMatches(x, f.key)).length}
                onClick={() => setQf(f.key)} />
            ))
          : ORDER_FILTERS.map(f => (
              <Pill key={f.key} label={f.label} active={of === f.key}
                count={orders.filter(x => orderMatches(x, f.key)).length}
                onClick={() => setOf(f.key)} />
            ))}
      </div>

      <div className="card divide-y divide-white/[0.08] overflow-hidden">
        {tab === 'quotes' ? (
          fQuotes.length === 0 ? (
            <Empty icon="📄" text="Bu filtrede teklif yok." />
          ) : fQuotes.map(x => {
            const overdue = !!x.valid_until && x.valid_until < todayIso
              && ['onayli', 'sunuldu'].includes(x.status);
            const next = quoteNext(x, todayIso);
            return (
              <Link key={x.id} href={`/sales/orders/quotes/${x.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium truncate">
                    {x.quote_no ? `#${x.quote_no} · ` : ''}{x.outlets?.name ?? 'Nokta'}
                  </p>
                  <p className="text-[13px] text-[#8E8E93] truncate mt-0.5">
                    {tl(x.total_incl_vat)}
                    {x.valid_until ? ` · geçerlilik ${fmtD(x.valid_until)}` : ''}
                  </p>
                  {next && (
                    <p className={`text-[12px] mt-0.5 truncate ${overdue ? 'text-rose-300' : 'text-ios-blue'}`}>
                      → {next}
                    </p>
                  )}
                </div>
                <span className={`badge shrink-0 ${QUOTE_STATUS_COLOR[x.status]}`}>
                  {QUOTE_STATUS_LABEL[x.status]}
                </span>
                <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />
              </Link>
            );
          })
        ) : (
          fOrders.length === 0 ? (
            <Empty icon="📦" text="Bu filtrede sipariş yok. Sipariş onaylı bir tekliften oluşturulur." />
          ) : fOrders.map(x => {
            const next = orderNext(x);
            return (
              <Link key={x.id} href={`/sales/orders/${x.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium truncate">
                    {x.order_no ? `#${x.order_no} · ` : ''}{x.outlets?.name ?? 'Nokta'}
                  </p>
                  <p className="text-[13px] text-[#8E8E93] truncate mt-0.5">
                    {tl(x.total_amount)}
                    {x.delivery_date ? ` · teslim ${fmtD(x.delivery_date)}` : ''}
                  </p>
                  {next && <p className="text-[12px] text-ios-blue mt-0.5 truncate">→ {next}</p>}
                </div>
                <span className={`badge shrink-0 ${ORDER_STATUS_COLOR[x.status]}`}>
                  {ORDER_STATUS_LABEL[x.status]}
                </span>
                <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}

function Pill({
  label, count, active, onClick
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${
        active ? 'bg-ios-blue text-white' : 'bg-[#1C1C1E] text-[#D1D1D6] shadow-[0_0_0_0.5px_rgba(255,255,255,0.09)]'
      }`}>
      {label}
      <span className={`text-[11px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ${
        active ? 'bg-white/25' : 'bg-white/10'}`}>
        {count}
      </span>
    </button>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="p-10 text-center">
      <p className="text-3xl mb-2">{icon}</p>
      <p className="text-[15px] text-[#8E8E93]">{text}</p>
    </div>
  );
}
