'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Send, X, Pencil, Package } from 'lucide-react';
import {
  approveQuote, setQuoteStatus, addCommerceFollowUp
} from '@/app/(app)/sales/orders/actions';
import { SalesStep, NextStepCard } from '@/components/sales/OrdersClient';
import { tl, casesOf, casePriceFromBottle, type QuoteStatus } from '@/lib/commerce-format';
import OrderFromQuote from '@/components/sales/OrderFromQuote';
import PrintButton from '@/components/sales/PrintButton';
import { QuoteDeleteButton } from '@/components/sales/DocDeleteButtons';

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
 * Onay TEK ADIM. Eskiden mali ve satış kontrolü iki ayrı düğmeydi ve
 * ikisine de aynı kişi basıyordu; teklif → sipariş dokuz dokunuş
 * sürüyordu. Artık: Onayla → Siparişe çevir. Liste altı fiyatta onayı
 * yalnız admin/müdür verebilir (kural sunucuda).
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
  const convertRef = useRef<HTMLElement | null>(null);
  // Form sayfanın altında açılıyor; kullanıcı düğmeye basıp hiçbir şey
  // olmadığını sanmasın diye görünür alana getiriyoruz.
  useEffect(() => {
    if (convertOpen) convertRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [convertOpen]);

  const editable = ['taslak', 'kontrolde'].includes(quote.status);
  const [note, setNote] = useState<string | null>(null);

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

  /**
   * Tek adımda onay. Sunucu iki kontrol damgasını birlikte yazıyor;
   * fiyat listenin altındaysa onayı yalnız admin/müdür verebiliyor ve
   * bunu burada not olarak gösteriyoruz.
   */
  function approve() {
    setErr(null); setNote(null);
    start(async () => {
      try {
        const r: any = await approveQuote(quote.id);
        if (r?.error) { setErr(r.error); return; }
        if (r?.belowList) setNote('Liste fiyatının altında bir kalem var — onay yönetici yetkisiyle verildi.');
        router.refresh();
      } catch {
        setErr('İşlem tamamlanamadı. Sayfayı yenileyip tekrar deneyin.');
      }
    });
  }

  // ---- Sıradaki adım: tek birincil buton, duruma göre ----
  // Akış kısaldı: Onayla → Siparişe çevir. "Sunuldu" ve "Kabul edildi"
  // ara durakları zorunlu değil; müşteri evet dediyse doğrudan siparişe
  // çevrilir, teklif kendiliğinden "kabul" olur.
  const nextStep = (() => {
    if (hasOrder) {
      return {
        title: 'Siparişi takip et',
        hint: 'Bu teklifin siparişi oluşturuldu — onay ve sevk sipariş kartından yürür.',
        blocked: null as string | null,
        button: null as React.ReactNode
      };
    }
    if (editable) {
      return {
        title: 'Teklifi onayla',
        hint: 'Tek dokunuş. Onaylanan teklif müşteriye sunulur ve siparişe çevrilebilir.',
        blocked: null,
        button: (
          <button disabled={pending} onClick={approve} className="btn-primary">
            <ShieldCheck size={16} /> {pending ? 'Onaylanıyor…' : 'Teklifi onayla'}
          </button>
        )
      };
    }
    if (['onayli', 'sunuldu', 'kabul'].includes(quote.status)) {
      return {
        title: 'Siparişe çevir',
        hint: 'Müşteri kabul ettiyse siparişe çevirin: kalemler ve koli fiyatı tekliften hazır gelir.',
        blocked: expired ? 'Geçerlilik tarihi geçmiş — fiyatı müşteriyle yeniden teyit edin.' : null,
        button: (
          <>
            <button onClick={() => setConvertOpen(true)} className="btn-primary">
              <Package size={16} /> Siparişe çevir
            </button>
            {quote.status === 'onayli' && (
              <button disabled={pending} onClick={() => run(() => setQuoteStatus(quote.id, 'sunuldu'))}
                className="btn-ghost">
                <Send size={15} /> Sunuldu, yanıt bekleniyor
              </button>
            )}
          </>
        )
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
    <div id="print-area" className="space-y-5">
      {err && <p className="alert-error">{err}</p>}
      {note && (
        <p className="text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
          {note}
        </p>
      )}

      <div className="flex flex-wrap gap-2" data-noprint>
        <PrintButton label="Teklifi yazdır" />
        <QuoteDeleteButton quoteId={quote.id} quoteNo={quote.quote_no} />
      </div>

      <NextStepCard title={nextStep.title} hint={nextStep.hint} blocked={nextStep.blocked}>
        {nextStep.button}
        {['onayli', 'sunuldu'].includes(quote.status) && !hasOrder && (
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
                {casesOf(l.bottles)} koli × {tl(casePriceFromBottle(l.unit_price))}
                <span className="text-[#AEAEB2]"> · {l.bottles} şişe</span>
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

      {/* Onay izi: kim, ne zaman. Düğme yok — onay tepedeki tek adımda. */}
      {quote.finance_checked_at && (
        <p className="text-[12.5px] text-[#8E8E93] px-1">
          Onaylayan: {financeName ?? salesName ?? 'bilinmiyor'} ·{' '}
          {new Date(quote.finance_checked_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      )}

      {/* ---------- SİPARİŞE ÇEVİR ---------- */}
      {canConvert && convertOpen && (
        <section ref={convertRef} className="card p-5 space-y-3 scroll-mt-24">
          <p className="section-title">Sipariş</p>
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
            openInitially
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
      <span className={value ? '' : 'text-[#AEAEB2]'}>{value || '—'}</span>
    </p>
  );
}
