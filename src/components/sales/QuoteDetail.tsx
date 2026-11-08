'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Undo2, Send, X, Pencil } from 'lucide-react';
import {
  checkQuote, undoQuoteCheck, setQuoteStatus, addCommerceFollowUp
} from '@/app/(app)/sales/orders/actions';
import { SalesStep, NextStepCard } from '@/components/sales/OrdersClient';
import { tl, casesOf, type QuoteStatus } from '@/lib/commerce-format';
import OrderFromQuote from '@/components/sales/OrderFromQuote';

interface Line { product_id: string; product_name: string; bottles: number; unit_price: number; discount: number; net_line: number }
interface PersonLite { id: string; full_name: string }

/**
 * TEKLİF DETAYI (F05)
 *
 * Ekran formla aynı sırayı izliyor: Ne → Kaça → Koşullar → Onay/Kontrol
 * → Takip. En tepede "Sıradaki adım" kartı var: her durumda TEK birincil
 * buton ve buton kilitliyse NEDENİ. Temsilcinin ekrana bakıp "şimdi ne
 * yapacağım" diye düşünmesi gerekmiyor.
 *
 * İki ayrı kontrol — mali ve satış. İkisi tamamlanmadan "Onayla"
 * açılmıyor; veritabanı da zaten reddediyor, arayüz bunu önceden
 * gösteriyor ki kullanıcı duvara toslamasın.
 */
export default function QuoteDetail({
  quote, lines, people, financeName, salesName, canConvert, hasOrder, expired, orderProps
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
  hasOrder: boolean;
  expired: boolean;
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
  const [convertOpen, setConvertOpen] = useState(false);

  const bothChecked = !!quote.finance_checked_at && !!quote.sales_checked_at;
  const editable = ['taslak', 'kontrolde'].includes(quote.status);
  const checks = (quote.finance_checked_at ? 1 : 0) + (quote.sales_checked_at ? 1 : 0);

  function run(fn: () => Promise<any>) {
    setErr(null);
    start(async () => {
      try {
        const r = await fn();
        if (r?.error) { setErr(r.error); return; }
        setRejectOpen(false); setFupOpen(false);
        router.refresh();
      } catch {
        setErr('İşlem tamamlanamadı. Sayfayı yenileyip tekrar deneyin.');
      }
    });
  }

  // ---- Sıradaki adım: tek birincil buton, duruma göre ----
  const nextStep = (() => {
    if (editable && !bothChecked) {
      return {
        title: `Kontroller tamamlanmalı (${checks}/2)`,
        hint: 'Mali kontrol ve satış kontrolü verilmeden teklif onaylanamaz. Tüm departmanlar kontrol verebilir.',
        blocked: null as string | null,
        button: null as React.ReactNode
      };
    }
    if (editable && bothChecked) {
      return {
        title: 'Teklifi onayla',
        hint: 'İki kontrol tamam. Onaylanan teklif müşteriye sunulabilir.',
        blocked: null,
        button: (
          <button disabled={pending} onClick={() => run(() => setQuoteStatus(quote.id, 'onayli'))}
            className="btn-primary">
            <ShieldCheck size={16} /> Onayla
          </button>
        )
      };
    }
    if (quote.status === 'onayli') {
      return {
        title: 'Müşteriye sun',
        hint: 'Sunumdan sonra müşterinin yanıtını bu karttan işleyin.',
        blocked: expired ? 'Geçerlilik tarihi geçmiş — sunmadan önce tarihi güncelleyin.' : null,
        button: (
          <button disabled={pending} onClick={() => run(() => setQuoteStatus(quote.id, 'sunuldu'))}
            className="btn-primary">
            <Send size={16} /> Müşteriye sunuldu
          </button>
        )
      };
    }
    if (quote.status === 'sunuldu') {
      return {
        title: 'Müşteri yanıtını işle',
        hint: 'Kabul edildiyse siparişe çevirin; olmadıysa ret sebebini kaydedin.',
        blocked: expired ? 'Geçerlilik tarihi geçmiş — yeni teklif gerekebilir.' : null,
        button: (
          <button disabled={pending} onClick={() => run(() => setQuoteStatus(quote.id, 'kabul'))}
            className="btn-primary">
            <ShieldCheck size={16} /> Kabul edildi
          </button>
        )
      };
    }
    if (quote.status === 'kabul' && !hasOrder) {
      return {
        title: 'Siparişe çevir',
        hint: 'Kalemler teklifin kendisinden ön dolu gelir; yalnızca teslimat bilgisini girmeniz yeterli.',
        blocked: null,
        button: (
          <button onClick={() => setConvertOpen(true)} className="btn-primary">Siparişe çevir</button>
        )
      };
    }
    if (hasOrder) {
      return {
        title: 'Siparişi takip et',
        hint: 'Bu teklifin siparişi oluşturuldu — stok teyidi ve sevk oradan yürür.',
        blocked: null,
        button: null
      };
    }
    return {
      title: 'Bu teklif kapandı',
      hint: 'Kapanmış teklifte yapılacak işlem yok. Yeni görüşme için nokta kartından yeni teklif açın.',
      blocked: null,
      button: (
        <Link href={`/sales/orders/quotes/new?outlet=${quote.outlet_id}`} className="btn-outline">
          Yeni teklif aç
        </Link>
      )
    };
  })();

  return (
    <div className="space-y-5">
      {err && <p className="alert-error">{err}</p>}

      <NextStepCard title={nextStep.title} hint={nextStep.hint} blocked={nextStep.blocked}>
        {nextStep.button}
        {['onayli', 'sunuldu'].includes(quote.status) && (
          <button disabled={pending} onClick={() => setRejectOpen(v => !v)} className="btn-ghost">
            <X size={15} /> Reddedildi
          </button>
        )}
        {editable && (
          <Link href={`/sales/orders/quotes/new?edit=${quote.id}`} className="btn-ghost">
            <Pencil size={15} /> Düzenle
          </Link>
        )}
      </NextStepCard>

      {rejectOpen && (
        <section className="card p-5 space-y-2">
          <p className="section-title">Ret sebebi</p>
          <input value={rejectText} onChange={e => setRejectText(e.target.value)}
            className="input" placeholder="Ret sebebi (zorunlu)" />
          <div className="flex gap-2">
            <button disabled={pending || !rejectText.trim()}
              onClick={() => run(() => setQuoteStatus(quote.id, 'red', rejectText))}
              className="btn-danger disabled:opacity-40">Reddi kaydet</button>
            <button onClick={() => setRejectOpen(false)} className="btn-ghost">Vazgeç</button>
          </div>
        </section>
      )}

      {quote.reject_reason && (
        <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">
          Ret sebebi: {quote.reject_reason}
        </p>
      )}

      {/* ---------- 2 · NE ---------- */}
      <section className="card p-5 space-y-3">
        <SalesStep n={2} title="Ne" sub="Teklifin kalemleri" />
        {lines.length === 0 && <p className="text-[14px] text-[#8E8E93]">Kalem yok.</p>}
        {lines.map(l => (
          <div key={l.product_id} className="flex items-center justify-between gap-3 text-sm border-b border-white/[0.06] pb-2 last:border-0">
            <div className="min-w-0">
              <p className="font-medium truncate">{l.product_name}</p>
              <p className="text-[12px] text-[#8E8E93]">
                {casesOf(l.bottles)} koli ({l.bottles} şişe) × {tl(l.unit_price)}
                {l.discount > 0 ? ` − ${tl(l.discount)} iskonto` : ''}
              </p>
            </div>
            <span className="tabular-nums shrink-0">{tl(l.net_line)}</span>
          </div>
        ))}
      </section>

      {/* ---------- 3 · KAÇA ---------- */}
      <section className="card p-5 space-y-1 text-sm">
        <SalesStep n={3} title="Kaça" sub="Tutar ve KDV" />
        <div className="pt-2 space-y-1">
          <Row label="KDV hariç toplam" value={tl(quote.subtotal_excl_vat)} />
          <Row label={`KDV (%${quote.vat_rate})`} value={tl(quote.vat_amount)} />
          <Row label="KDV dahil toplam" value={tl(quote.total_incl_vat)} strong />
        </div>
        {quote.price_list_version && (
          <p className="text-[12px] text-[#8E8E93] pt-1">Fiyat listesi sürümü: {quote.price_list_version}</p>
        )}
      </section>

      {/* ---------- 4 · KOŞULLAR ---------- */}
      <section className="card p-5 space-y-2 text-sm">
        <SalesStep n={4} title="Koşullar" sub="Ödeme, vade, teslimat" />
        <div className="pt-1 space-y-2">
          <Field label="Ödeme şekli" value={quote.payment_method} />
          <Field label="Onaylı vade" value={quote.approved_term_days !== null ? `${quote.approved_term_days} gün` : null} />
          <Field label="Teslimat ücreti dahil" value={
            quote.delivery_fee_included === null ? null : quote.delivery_fee_included ? 'Evet' : 'Hayır'} />
          <Field label="Kampanya / istisna" value={quote.campaign_note} />
          <Field label="Yazılı onay referansı" value={quote.written_approval_ref} />
        </div>
      </section>

      {/* ---------- ONAY & KONTROL ---------- */}
      <section className="card p-5 space-y-3">
        <p className="section-title">Onay ve kontrol</p>
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
        {!editable && (
          <p className="text-[12px] text-[#8E8E93]">
            Teklif taslak aşamasını geçtiği için kontroller artık değiştirilemiyor.
          </p>
        )}
      </section>

      {/* ---------- SİPARİŞE ÇEVİR ---------- */}
      {canConvert && (
        <section className="card p-5 space-y-3">
          <p className="section-title">Sipariş</p>
          <p className="text-[13px] text-[#8E8E93]">
            Bu teklif siparişe çevrilebilir. Sipariş, teklifin kalemleriyle ön dolu gelir —
            koli adetleri aynı sırada, aynı birimde.
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
            openInitially={convertOpen}
          />
        </section>
      )}

      {/* ---------- 5 · SONUÇ & TAKİP ---------- */}
      <section className="card p-5 space-y-3">
        <SalesStep n={5} title="Sonuç & Takip" sub="Tek sorumlu ve son tarih" />
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
