'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { createOrderFromQuote } from '@/app/(app)/sales/orders/actions';
import { SalesStep } from '@/components/sales/OrdersClient';
import { tl, BOTTLES_PER_CASE } from '@/lib/commerce-format';

interface QuoteLine { product_id: string; product_name: string; bottles: number; unit_price: number }
interface BatchLite { id: string; product_id: string; batch_no: string; expiry_date: string | null }
interface PersonLite { id: string; full_name: string }

/**
 * SİPARİŞ VE TESLİMAT TALİMATI (F06)
 *
 * Teklif formuyla AYNI SIRA ve AYNI BİRİM: 2 Ne (koli) → 3 Kaça →
 * 4 Koşullar (ödeme/teslimat) → 5 Sonuç & Takip. Teklif ekranında koli
 * girip sipariş ekranında şişe girmek, sahada en sık yapılan hatanın
 * kaynağıydı — ikisi artık koli.
 *
 * F06'nın kritik kuralı yapısal olarak duruyor: gerçek miktar ÜCRETLİ
 * adettir, bedelsiz ayrı sütunda ve tutara girmez; koli ile şişe aynı
 * miktarın iki gösterimidir, TOPLANMAZ.
 */
export default function OrderFromQuote({
  quoteId, outletName, lines, batches, people, defaults, openInitially
}: {
  quoteId: string;
  outletName: string;
  lines: QuoteLine[];
  batches: BatchLite[];
  people: PersonLite[];
  defaults?: {
    delivery_address: string | null; receiver_phone: string | null;
    payment_method: string | null; delivery_date: string | null;
  };
  openInitially?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(!!openInitially);
  const [err, setErr] = useState<string | null>(null);
  const errRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (openInitially) setOpen(true); }, [openInitially]);

  // Teklif şişe tutar, form koli gösterir — ön dolum burada çevriliyor.
  const [rows, setRows] = useState<Record<string, { paidCases: string; freeCases: string; price: string }>>(
    () => Object.fromEntries(lines.map(l => [
      l.product_id,
      {
        paidCases: String(Math.round(l.bottles / BOTTLES_PER_CASE)),
        freeCases: '0',
        price: String(l.unit_price)
      }
    ]))
  );

  const total = useMemo(() => lines.reduce((sum, l) => {
    const r = rows[l.product_id];
    if (!r) return sum;
    const paidCases = Number(r.paidCases) || 0, price = Number(r.price) || 0;
    return sum + paidCases * BOTTLES_PER_CASE * price;
  }, 0), [rows, lines]);

  const freeCasesTotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(rows[l.product_id]?.freeCases) || 0), 0),
    [rows, lines]
  );

  const lineCount = useMemo(
    () => lines.filter(l => (Number(rows[l.product_id]?.paidCases) || 0)
      + (Number(rows[l.product_id]?.freeCases) || 0) > 0).length,
    [rows, lines]
  );

  const blocker = lineCount === 0 ? 'En az bir ürüne koli adedi girin.' : null;

  function setRow(pid: string, f: 'paidCases' | 'freeCases' | 'price', v: string) {
    setRows(s => ({
      ...s,
      [pid]: { ...(s[pid] ?? { paidCases: '0', freeCases: '0', price: '0' }), [f]: v }
    }));
  }

  function onSubmit(fd: FormData) {
    setErr(null);
    start(async () => {
      try {
        const r = await createOrderFromQuote(fd);
        if (r?.error) {
          setErr(r.error);
          errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        if ((r as any)?.id) router.push(`/sales/orders/${(r as any).id}`);
        router.refresh();
      } catch {
        setErr('Sipariş oluşturulamadı. Girdiğiniz bilgiler ekranda duruyor; tekrar deneyin.');
        errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Package size={16} /> Siparişe çevir
      </button>
    );
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <input type="hidden" name="quote_id" value={quoteId} />

      <p className="text-[13px] text-[#8E8E93]">{outletName} · teklif kalemleriyle ön dolu</p>

      {/* ---------- 2 · NE ---------- */}
      <div className="space-y-3">
        <SalesStep n={2} title="Ne" sub="Kaç koli ücretli, kaç koli bedelsiz" />
        <p className="text-[12px] text-[#8E8E93]">
          Miktar KOLİ olarak girilir; 1 koli = 12 × 250 ml şişe.
          Bedelsiz koli tutara girmez — ücretli ile toplanmaz.
        </p>
        {lines.map(l => {
          const r = rows[l.product_id] ?? { paidCases: '0', freeCases: '0', price: '0' };
          const paidCases = Number(r.paidCases) || 0;
          const freeCases = Number(r.freeCases) || 0;
          const price = Number(r.price) || 0;
          const pBatches = batches.filter(b => b.product_id === l.product_id);
          return (
            <div key={l.product_id} className="rounded-xl bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-medium">{l.product_name}</p>
                <span className="text-[13px] text-[#AEAEB2] tabular-nums">
                  {tl(paidCases * BOTTLES_PER_CASE * price)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label !text-[12px]">Ücretli koli</label>
                  <input type="number" min={0} inputMode="numeric"
                    name={`oi_${l.product_id}_paid_cases`} value={r.paidCases}
                    onChange={e => setRow(l.product_id, 'paidCases', e.target.value)}
                    className="input !py-2 !text-[13px]" />
                </div>
                <div>
                  <label className="label !text-[12px]">Bedelsiz koli</label>
                  <input type="number" min={0} inputMode="numeric"
                    name={`oi_${l.product_id}_free_cases`} value={r.freeCases}
                    onChange={e => setRow(l.product_id, 'freeCases', e.target.value)}
                    className="input !py-2 !text-[13px]" />
                </div>
                <div>
                  <label className="label !text-[12px]">Birim TL / şişe</label>
                  <input type="number" min={0} step="0.01" inputMode="decimal"
                    name={`oi_${l.product_id}_price`} value={r.price}
                    onChange={e => setRow(l.product_id, 'price', e.target.value)}
                    className="input !py-2 !text-[13px]" />
                </div>
              </div>
              {pBatches.length > 0 && (
                <div>
                  <label className="label !text-[12px]">Parti (depo kaydı · istege bağlı)</label>
                  <select name={`oi_${l.product_id}_batch`} className="input !py-2 !text-[13px]" defaultValue="">
                    <option value="">Seçilmedi</option>
                    {pBatches.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.batch_no}{b.expiry_date ? ` · TETT ${b.expiry_date}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(paidCases > 0 || freeCases > 0) && (
                <p className="text-[12px] text-[#8E8E93]">
                  {paidCases} ücretli koli = {paidCases * BOTTLES_PER_CASE} şişe
                  {freeCases > 0 ? ` · ${freeCases} bedelsiz koli (${freeCases * BOTTLES_PER_CASE} şişe)` : ''}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ---------- 3 · KAÇA ---------- */}
      <div className="space-y-3">
        <SalesStep n={3} title="Kaça" sub="Ücretli toplam ve tahsilat" />
        <div className="rounded-xl bg-white/[0.05] px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-[13px] text-[#8E8E93]">
            Ücretli toplam{freeCasesTotal > 0 ? ` · ${freeCasesTotal} bedelsiz koli (tutara girmez)` : ''}
          </span>
          <span className="text-xl font-bold tabular-nums">{tl(total)}</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Ödeme şekli</label>
            <input name="payment_method" className="input" defaultValue={defaults?.payment_method ?? ''} />
          </div>
          <div>
            <label className="label">Tahsilat referansı</label>
            <input name="collection_ref" className="input" />
          </div>
        </div>
      </div>

      {/* ---------- 4 · KOŞULLAR ---------- */}
      <div className="space-y-3">
        <SalesStep n={4} title="Koşullar" sub="Müşteri onayı ve teslimat" />
        <div>
          <label className="label">Müşteri onay tarihi</label>
          <input type="date" name="customer_approval_date" className="input" />
        </div>
        <div>
          <label className="label">Teslimat adresi</label>
          <input name="delivery_address" className="input" defaultValue={defaults?.delivery_address ?? ''} />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Teslim alan</label>
            <input name="receiver_name" className="input" />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input name="receiver_phone" className="input" defaultValue={defaults?.receiver_phone ?? ''} />
          </div>
          <div>
            <label className="label">Saat aralığı</label>
            <input name="delivery_time_window" className="input" placeholder="09:00–12:00" />
          </div>
        </div>
        <div>
          <label className="label">Teslimat tarihi</label>
          <input type="date" name="delivery_date" className="input" defaultValue={defaults?.delivery_date ?? ''} />
        </div>
      </div>

      {/* ---------- 5 · SONUÇ & TAKİP ---------- */}
      <div className="space-y-3">
        <SalesStep n={5} title="Sonuç & Takip" sub="Eğitim randevusu ve ilk takip" />
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Eğitim randevusu</label>
            <input type="datetime-local" name="training_appointment_at" className="input" />
          </div>
          <div>
            <label className="label">İlk takip tarihi</label>
            <input type="date" name="first_followup_date" className="input" />
            <p className="text-[12px] text-[#8E8E93] mt-1">48–72 saat önerilir.</p>
          </div>
          <div>
            <label className="label">Takip sorumlusu</label>
            <select name="first_followup_owner" className="input" defaultValue="">
              <option value="">Ben</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
        </div>
        <p className="text-[13px] text-[#8E8E93]">
          Sipariş <strong>taslak</strong> olarak açılır. Stok ve sevk teyidi verilmeden onaylanamaz —
          teyit sipariş kartından verilir.
        </p>
      </div>

      <div ref={errRef} className="space-y-2">
        {err && <p className="alert-error">{err}</p>}
        <div className="flex gap-2 items-center flex-wrap">
          <button type="submit" disabled={!!blocker || pending} className="btn-primary disabled:opacity-40">
            {pending ? 'Oluşturuluyor…' : 'Siparişi oluştur'}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Vazgeç</button>
          {blocker && !pending && <span className="text-[12px] text-amber-300">{blocker}</span>}
        </div>
      </div>
    </form>
  );
}
