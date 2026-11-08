'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, ChevronRight, FileText, Package, AlertTriangle } from 'lucide-react';

/**
 * TEKLİF VE SİPARİŞ LİSTESİ (F05 · F06)
 * İki iç sekme: aynı ticari zincirin iki halkası olduğu için ayrı
 * sayfalara bölmek yerine tek ekranda tutuldu.
 *
 * Durum etiketleri buradan dışa veriliyor — detay sayfaları da
 * aynı sözlüğü kullansın diye (iki yerde ayrı liste tutmak, er geç
 * birinin eksik kalması demek).
 */

export type QuoteStatus =
  | 'taslak' | 'kontrolde' | 'onayli' | 'sunuldu' | 'kabul' | 'red' | 'suresi_doldu' | 'iptal';
export type OrderStatus =
  | 'taslak' | 'onay_bekliyor' | 'onayli' | 'sevk_edildi' | 'teslim' | 'iptal';

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  taslak: 'Taslak',
  kontrolde: 'Kontrolde',
  onayli: 'Onaylı',
  sunuldu: 'Sunuldu',
  kabul: 'Kabul edildi',
  red: 'Reddedildi',
  suresi_doldu: 'Süresi doldu',
  iptal: 'İptal'
};

export const QUOTE_STATUS_COLOR: Record<QuoteStatus, string> = {
  taslak: 'bg-white/10 text-[#8E8E93]',
  kontrolde: 'bg-amber-500/20 text-amber-300',
  onayli: 'bg-blue-500/20 text-blue-300',
  sunuldu: 'bg-indigo-500/20 text-indigo-300',
  kabul: 'bg-emerald-500/20 text-emerald-300',
  red: 'bg-rose-500/20 text-rose-300',
  suresi_doldu: 'bg-white/10 text-[#AEAEB2]',
  iptal: 'bg-white/10 text-[#8E8E93]'
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  taslak: 'Taslak',
  onay_bekliyor: 'Onay bekliyor',
  onayli: 'Onaylı',
  sevk_edildi: 'Sevk edildi',
  teslim: 'Teslim edildi',
  iptal: 'İptal'
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  taslak: 'bg-white/10 text-[#8E8E93]',
  onay_bekliyor: 'bg-amber-500/20 text-amber-300',
  onayli: 'bg-blue-500/20 text-blue-300',
  sevk_edildi: 'bg-indigo-500/20 text-indigo-300',
  teslim: 'bg-emerald-500/20 text-emerald-300',
  iptal: 'bg-white/10 text-[#8E8E93]'
};

/** Tutarı Türk Lirası biçiminde gösterir. */
export function tl(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';
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

export default function OrdersClient({
  quotes, orders, todayIso
}: { quotes: QuoteRow[]; orders: OrderRow[]; todayIso: string }) {
  const [tab, setTab] = useState<'quotes' | 'orders'>('quotes');
  const [q, setQ] = useState('');

  const pendingChecks = useMemo(
    () => quotes.filter(x => ['taslak', 'kontrolde'].includes(x.status)
      && (!x.finance_checked_at || !x.sales_checked_at)).length,
    [quotes]
  );
  const expiring = useMemo(
    () => quotes.filter(x => ['onayli', 'sunuldu'].includes(x.status)
      && x.valid_until && x.valid_until < todayIso).length,
    [quotes, todayIso]
  );
  const awaitingStock = useMemo(
    () => orders.filter(o => !o.stock_confirmed_at && !['iptal', 'teslim'].includes(o.status)).length,
    [orders]
  );

  const fQuotes = useMemo(() => quotes.filter(x => {
    if (!q) return true;
    return tr([x.outlets?.name, x.outlets?.district, x.quote_no].filter(Boolean).join(' ')).includes(tr(q));
  }), [quotes, q]);

  const fOrders = useMemo(() => orders.filter(x => {
    if (!q) return true;
    return tr([x.outlets?.name, x.outlets?.district, x.order_no].filter(Boolean).join(' ')).includes(tr(q));
  }), [orders, q]);

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Teklif &amp; Sipariş</h1>
          <p className="text-[14px] text-[#8E8E93]">
            {quotes.length} teklif · {orders.length} sipariş
          </p>
        </div>
        <Link href="/sales/orders/quotes/new" className="btn-primary shrink-0">
          <Plus size={16} /> Yeni Teklif
        </Link>
      </header>

      {(pendingChecks > 0 || expiring > 0 || awaitingStock > 0) && (
        <div className="space-y-2">
          {pendingChecks > 0 && (
            <p className="text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
              {pendingChecks} teklif kontrol bekliyor — mali kontrol ve satış kontrolü tamamlanmadan onaylanamaz.
            </p>
          )}
          {expiring > 0 && (
            <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={14} /> {expiring} teklifin geçerlilik tarihi geçmiş.
            </p>
          )}
          {awaitingStock > 0 && (
            <p className="text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
              {awaitingStock} sipariş stok ve sevk teyidi bekliyor.
            </p>
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

      <div className="card divide-y divide-white/[0.08] overflow-hidden">
        {tab === 'quotes' ? (
          fQuotes.length === 0 ? (
            <Empty icon="📄" text="Teklif yok." />
          ) : fQuotes.map(x => {
            const checks = (x.finance_checked_at ? 1 : 0) + (x.sales_checked_at ? 1 : 0);
            const overdue = x.valid_until && x.valid_until < todayIso && ['onayli', 'sunuldu'].includes(x.status);
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
                    {['taslak', 'kontrolde'].includes(x.status) ? ` · kontrol ${checks}/2` : ''}
                  </p>
                </div>
                {overdue && <span className="badge bg-rose-500/20 text-rose-300 shrink-0">süresi geçti</span>}
                <span className={`badge shrink-0 ${QUOTE_STATUS_COLOR[x.status]}`}>
                  {QUOTE_STATUS_LABEL[x.status]}
                </span>
                <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />
              </Link>
            );
          })
        ) : (
          fOrders.length === 0 ? (
            <Empty icon="📦" text="Sipariş yok. Sipariş onaylı bir tekliften oluşturulur." />
          ) : fOrders.map(x => (
            <Link key={x.id} href={`/sales/orders/${x.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-medium truncate">
                  {x.order_no ? `#${x.order_no} · ` : ''}{x.outlets?.name ?? 'Nokta'}
                </p>
                <p className="text-[13px] text-[#8E8E93] truncate mt-0.5">
                  {tl(x.total_amount)}
                  {x.delivery_date ? ` · teslim ${fmtD(x.delivery_date)}` : ''}
                  {!x.stock_confirmed_at ? ' · stok teyidi bekliyor' : ''}
                </p>
              </div>
              <span className={`badge shrink-0 ${ORDER_STATUS_COLOR[x.status]}`}>
                {ORDER_STATUS_LABEL[x.status]}
              </span>
              <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />
            </Link>
          ))
        )}
      </div>
    </main>
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
