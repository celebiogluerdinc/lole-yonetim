'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Undo2, Send, X, Pencil } from 'lucide-react';
import {
  checkQuote, undoQuoteCheck, setQuoteStatus, addCommerceFollowUp
} from '@/app/(app)/sales/orders/actions';
import { tl, type QuoteStatus } from '@/components/sales/OrdersClient';
import OrderFromQuote from '@/components/sales/OrderFromQuote';

interface Line { product_id: string; product_name: string; bottles: number; unit_price: number; discount: number; net_line: number }
interface PersonLite { id: string; full_name: string }

/**
 * TEKLİF DETAYI (F05)
 *
 * İki ayrı kontrol butonu — mali ve satış. İkisi tamamlanmadan
 * "Onayla" açılmıyor; veritabanı da zaten reddediyor, arayüz bunu
 * önceden gösteriyor ki kullanıcı duvara toslamasın.
 */
export default function QuoteDetail({
  quote, lines, people, financeName, salesName, canConvert, orderProps
}: {
  quote: {
    id: string; quote_no: number | null; status: QuoteStatus; outlet_id: string;
    outlet_name: string; valid_until: string | null; price_list_version: string | null;
    subtotal_excl_vat: number; vat_rate: number; vat_amount: number; total_incl_vat: number;
    payment_method: string | null; approved_term_days: number | null;
    delivery_fee_included: boolean | null; delivery_date: string | null;
    campaign_note: string | null; written_approval_ref: string | null;
    finance_checked_at: string | null; sales_checked_at: string | null;
    reject_reason: string | null;
  };
  lines: Line[];
  people: PersonLite[];
  financeName: string | null;
  salesName: string | null;
  canConvert: boolean;
  orderProps: {
    batches: { id: string; product_id: string; batch_no: string; expiry_date: string | null }[];
    defaults: {
      delivery_address: string | null; receiver_phone: string | null;
      payment_method: string | null; delivery_date: string | null;
    };
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectText, setRejectText] = useState('');
  const [fupOpen, setFupOpen] = useState(false);

  const bothChecked = !!quote.finance_checked_at && !!quote.sales_checked_at;
  const editable = ['taslak', 'kontrolde'].includes(quote.status);

  function run(fn: () => Promise<any>) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (r?.error) { setErr(r.error); return; }
      setRejectOpen(false); setFupOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {err && <p className="alert-error">{err}</p>}

      {/* ---- KONTROLLER ---- */}
      <section className="card p-5 space-y-3">
        <p className="section-title">Kontroller</p>
        <p className="text-[12px] text-[#8E8E93]">
          Müşteriye sunulmadan önce iki kontrol tamamlanmalı. Şu an tüm departmanlar onaylayabiliyor.
        </p>

        <CheckRow
          title="Mali Kontrol" at={quote.finance_checked_at} by={financeName}
          disabled={pending || !editable}
          onCheck={() => run(() => checkQuote(quote.id, 'mali_kontrol'))}
          onUndo={() => run(() => undoQuoteCheck(quote.id, 'mali_kontrol'))}
        />
        <CheckRow
          title="Satış Kontrolü" at={quote.sales_checked_at} by={salesName}
          disabled={pending || !editable}
          onCheck={() => run(() => checkQuote(quote.id, 'satis_kontrolu'))}
          onUndo={() => run(() => undoQuoteCheck(quote.id, 'satis_kontrolu'))}
        />

        <div className="flex flex-wrap gap-2 pt-1">
          {editable && (
            <>
              <button disabled={!bothChecked || pending}
                onClick={() => run(() => setQuoteStatus(quote.id, 'onayli'))}
                className="btn-primary disabled:opacity-40"
                title={bothChecked ? '' : 'Önce iki kontrol tamamlanmalı'}>
                <ShieldCheck size={16} /> Onayla
              </button>
              <Link href={`/sales/orders/quotes/new?edit=${quote.id}`} className="btn-ghost">
                <Pencil size={15} /> Düzenle
              </Link>
            </>
          )}
          {quote.status === 'onayli' && (
            <button disabled={pending} onClick={() => run(() => setQuoteStatus(quote.id, 'sunuldu'))}
              className="btn-outline">
              <Send size={15} /> Müşteriye sunuldu
            </button>
          )}
          {['onayli', 'sunuldu'].includes(quote.status) && (
            <button disabled={pending} onClick={() => setRejectOpen(v => !v)} className="btn-ghost">
              <X size={15} /> Reddedildi
            </button>
          )}
        </div>

        {rejectOpen && (
          <div className="rounded-xl bg-white/[0.03] p-3 space-y-2">
            <input value={rejectText} onChange={e => setRejectText(e.target.value)}
              className="input" placeholder="Ret sebebi (zorunlu)" />
            <button disabled={pending} onClick={() => run(() => setQuoteStatus(quote.id, 'red', rejectText))}
              className="btn-danger">Reddi kaydet</button>
          </div>
        )}

        {quote.reject_reason && (
          <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
            Ret sebebi: {quote.reject_reason}
          </p>
        )}
      </section>

      {/* ---- KALEMLER ---- */}
      <section className="card p-5 space-y-3">
        <p className="section-title">Kalemler</p>
        {lines.length === 0 && <p className="text-[14px] text-[#8E8E93]">Kalem yok.</p>}
        {lines.map(l => (
          <div key={l.product_id} className="flex items-center justify-between gap-3 text-sm border-b border-white/[0.06] pb-2 last:border-0">
            <div className="min-w-0">
              <p className="font-medium truncate">{l.product_name}</p>
              <p className="text-[12px] text-[#8E8E93]">
                {l.bottles} şişe ({(l.bottles / 12).toFixed(2)} koli) × {tl(l.unit_price)}
                {l.discount > 0 ? ` − ${tl(l.discount)} iskonto` : ''}
              </p>
            </div>
            <span className="tabular-nums shrink-0">{tl(l.net_line)}</span>
          </div>
        ))}

        <div className="pt-2 space-y-1 text-sm">
          <Row label="KDV hariç toplam" value={tl(quote.subtotal_excl_vat)} />
          <Row label={`KDV (%${quote.vat_rate})`} value={tl(quote.vat_amount)} />
          <Row label="KDV dahil toplam" value={tl(quote.total_incl_vat)} strong />
        </div>
        {quote.price_list_version && (
          <p className="text-[12px] text-[#8E8E93]">Fiyat listesi sürümü: {quote.price_list_version}</p>
        )}
      </section>

      {/* ---- KOŞULLAR ---- */}
      <section className="card p-5 space-y-2 text-sm">
        <p className="section-title">Ticari koşullar</p>
        <Field label="Ödeme şekli" value={quote.payment_method} />
        <Field label="Onaylı vade" value={quote.approved_term_days !== null ? `${quote.approved_term_days} gün` : null} />
        <Field label="Teslimat ücreti dahil" value={
          quote.delivery_fee_included === null ? null : quote.delivery_fee_included ? 'Evet' : 'Hayır'} />
        <Field label="Kampanya / istisna" value={quote.campaign_note} />
        <Field label="Yazılı onay referansı" value={quote.written_approval_ref} />
      </section>

      {/* ---- SİPARİŞE ÇEVİR ---- */}
      {canConvert && (
        <section className="card p-5 space-y-3">
          <p className="section-title">Sipariş</p>
          <p className="text-[13px] text-[#8E8E93]">
            Bu teklif onaylı — siparişe çevrilebilir. Sipariş, teklifin kalemleriyle ön dolu gelir.
          </p>
          <OrderFromQuote
            quoteId={quote.id}
            outletName={quote.outlet_name}
            lines={lines.map(l => ({
              product_id: l.product_id, product_name: l.product_name,
              bottles: l.bottles, unit_price: l.unit_price
            }))}
            batches={orderProps.batches}
            people={people}
            defaults={orderProps.defaults}
          />
        </section>
      )}

      {/* ---- SONRAKİ ADIM ---- */}
      <section className="card p-5 space-y-3">
        <p className="section-title">Sonraki adım ve kontrol</p>
        {!fupOpen ? (
          <button onClick={() => setFupOpen(true)} className="btn-ghost text-sm">Takip ekle</button>
        ) : (
          <form action={(fd) => run(() => addCommerceFollowUp(fd))} className="space-y-3">
            <input type="hidden" name="source_type" value="quote" />
            <input type="hidden" name="source_id" value={quote.id} />
            <input type="hidden" name="outlet_id" value={quote.outlet_id} />
            <input name="action" className="input" placeholder="Yapılacak işlem" required />
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Tek sorumlu</label>
                <select name="owner_user_id" className="input" defaultValue="">
                  <option value="">Ben</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Son tarih</label>
                <input type="date" name="due_date" className="input" required />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={pending} className="btn-primary">Kaydet</button>
              <button type="button" onClick={() => setFupOpen(false)} className="btn-ghost">Vazgeç</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function CheckRow({
  title, at, by, disabled, onCheck, onUndo
}: {
  title: string; at: string | null; by: string | null;
  disabled: boolean; onCheck: () => void; onUndo: () => void;
}) {
  const done = !!at;
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[14px] font-medium">{title}</p>
        <p className="text-[12px] text-[#8E8E93]">
          {done
            ? `${by ?? 'bilinmeyen'} · ${new Date(at!).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}`
            : 'bekliyor'}
        </p>
      </div>
      {done ? (
        <button onClick={onUndo} disabled={disabled} className="btn-ghost !py-1.5 !text-[13px] disabled:opacity-30">
          <Undo2 size={14} /> Geri al
        </button>
      ) : (
        <button onClick={onCheck} disabled={disabled} className="btn-outline !py-1.5 !text-[13px] disabled:opacity-30">
          <ShieldCheck size={14} /> Kontrol et
        </button>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[#8E8E93]">{label}</span>
      <span className={`tabular-nums ${strong ? 'text-lg font-bold' : ''}`}>{value}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <p className="flex gap-2">
      <span className="text-[#8E8E93] shrink-0">{label}:</span>
      <span className={value ? '' : 'text-[#48484A]'}>{value || '—'}</span>
    </p>
  );
}

