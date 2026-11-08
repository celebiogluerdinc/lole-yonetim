'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Package } from 'lucide-react';
import { createOrderFromQuote } from '@/app/(app)/sales/orders/actions';
import { tl } from '@/components/sales/OrdersClient';

interface QuoteLine { product_id: string; product_name: string; bottles: number; unit_price: number }
interface BatchLite { id: string; product_id: string; batch_no: string; expiry_date: string | null }
interface PersonLite { id: string; full_name: string }

/**
 * SİPARİŞ VE TESLİMAT TALİMATI (F06)
 *
 * Teklifin kalemleriyle ön dolu gelir. F06'nın kritik kuralı burada
 * yapısal olarak uygulanıyor: GERÇEK miktar ücretli ŞİŞE adedidir,
 * koli yalnızca gösterim (1 koli = 12 şişe) ve ikisi TOPLANMAZ.
 * Bedelsiz şişe ayrı sütunda durur, tutara girmez.
 */
export default function OrderFromQuote({
  quoteId, outletName, lines, batches, people, defaults
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
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<Record<string, { paid: string; free: string; price: string }>>(
    () => Object.fromEntries(lines.map(l => [
      l.product_id, { paid: String(l.bottles), free: '0', price: String(l.unit_price) }
    ]))
  );

  const total = useMemo(() => lines.reduce((sum, l) => {
    const r = rows[l.product_id];
    if (!r) return sum;
    const paid = Number(r.paid) || 0, price = Number(r.price) || 0;
    return sum + paid * price;
  }, 0), [rows, lines]);

  const freeTotal = useMemo(
    () => lines.reduce((s, l) => s + (Number(rows[l.product_id]?.free) || 0), 0),
    [rows, lines]
  );

  function setRow(pid: string, f: 'paid' | 'free' | 'price', v: string) {
    setRows(s => ({ ...s, [pid]: { ...(s[pid] ?? { paid: '0', free: '0', price: '0' }), [f]: v } }));
  }

  function onSubmit(fd: FormData) {
    setErr(null);
    start(async () => {
      const r = await createOrderFromQuote(fd);
      if (r?.error) { setErr(r.error); return; }
      if ((r as any)?.id) router.push(`/sales/orders/${(r as any).id}`);
      router.refresh();
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
    <form action={onSubmit} className="space-y-4">
      <input type="hidden" name="quote_id" value={quoteId} />
      {err && <p className="alert-error">{err}</p>}

      <p className="text-[13px] text-[#8E8E93]">{outletName} · teklif kalemleriyle ön dolu</p>

      <div className="space-y-2">
        {lines.map(l => {
          const r = rows[l.product_id] ?? { paid: '0', free: '0', price: '0' };
          const paid = Number(r.paid) || 0;
          const pBatches = batches.filter(b => b.product_id === l.product_id);
          return (
            <div key={l.product_id} className="rounded-xl bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-medium">{l.product_name}</p>
                <span className="text-[13px] text-[#AEAEB2] tabular-nums">
                  {tl(paid * (Number(r.price) || 0))}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label !text-[12px]">Ücretli şişe</label>
                  <input type="number" min={0} name={`oi_${l.product_id}_paid`} value={r.paid}
                    onChange={e => setRow(l.product_id, 'paid', e.target.value)}
                    className="input !py-2 !text-[13px]" />
                </div>
                <div>
                  <label className="label !text-[12px]">Bedelsiz şişe</label>
                  <input type="number" min={0} name={`oi_${l.product_id}_free`} value={r.free}
                    onChange={e => setRow(l.product_id, 'free', e.target.value)}
                    className="input !py-2 !text-[13px]" />
                </div>
                <div>
                  <label className="label !text-[12px]">Birim TL</label>
                  <input type="number" min={0} step="0.01" name={`oi_${l.product_id}_price`} value={r.price}
                    onChange={e => setRow(l.product_id, 'price', e.target.value)}
                    className="input !py-2 !text-[13px]" />
                </div>
              </div>
              {pBatches.length > 0 && (
                <div>
                  <label className="label !text-[12px]">Parti</label>
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
              <p className="text-[12px] text-[#8E8E93]">
                {paid} ücretli şişe = {(paid / 12).toFixed(2)} koli · koli ve şişe aynı miktarın gösterimidir, toplanmaz
              </p>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl bg-white/[0.05] px-4 py-3 flex items-center justify-between">
        <span className="text-[13px] text-[#8E8E93]">
          Ücretli toplam{freeTotal > 0 ? ` · ${freeTotal} bedelsiz şişe (tutara girmez)` : ''}
        </span>
        <span className="text-xl font-bold tabular-nums">{tl(total)}</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Müşteri onay tarihi</label>
          <input type="date" name="customer_approval_date" className="input" />
        </div>
        <div>
          <label className="label">Ödeme şekli</label>
          <input name="payment_method" className="input" defaultValue={defaults?.payment_method ?? ''} />
        </div>
      </div>
      <div>
        <label className="label">Tahsilat referansı</label>
        <input name="collection_ref" className="input" />
      </div>

      <div className="rounded-xl bg-white/[0.03] p-3 space-y-3">
        <p className="text-[14px] font-medium">Teslimat</p>
        <div>
          <label className="label">Adres</label>
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

      {/* F06'nın zincir bağları: eğitim randevusu ve ilk takip */}
      <div className="rounded-xl bg-white/[0.03] p-3 space-y-3">
        <p className="text-[14px] font-medium">Sonraki halkalar</p>
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
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Oluşturuluyor…' : 'Siparişi oluştur'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Vazgeç</button>
      </div>
      <p className="text-[12px] text-[#8E8E93]">
        Sipariş taslak olarak açılır. Stok ve sevk teyidi verilmeden onaylanamaz.
      </p>
    </form>
  );
}
