'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, AlertTriangle } from 'lucide-react';
import { createQuote, updateQuote, fetchOutletPrices } from '@/app/(app)/sales/orders/actions';
import { tl } from '@/components/sales/OrdersClient';

interface OutletLite { id: string; name: string; city: string | null; district: string | null }
interface ProductLite { id: string; name: string }
interface ExistingItem { product_id: string; bottles: number; unit_price: number; discount: number }

/**
 * TİCARİ TEKLİF FORMU (F05)
 *
 * Dört ürün formdaki gibi satır satır duruyor; şişe adedi girilen satır
 * teklife giriyor. Fiyat noktaya göre sunucudan geliyor (anlaşma varsa
 * anlaşma fiyatı, yoksa liste), temsilci üzerine yazabiliyor.
 *
 * Toplamları veritabanı trigger'ı hesaplıyor. Buradaki hesap yalnızca
 * CANLI ÖNİZLEME — kaydedilen değer sunucudan gelir, iki ayrı doğru olmaz.
 */
export default function QuoteForm({
  outlets, products, preselectedOutlet, quote, items, today
}: {
  outlets: OutletLite[];
  products: ProductLite[];
  preselectedOutlet?: string;
  quote?: {
    id: string; outlet_id: string; valid_until: string | null; vat_rate: number;
    payment_method: string | null; approved_term_days: number | null;
    delivery_fee_included: boolean | null; delivery_date: string | null;
    campaign_note: string | null; written_approval_ref: string | null;
  };
  items?: ExistingItem[];
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const isEdit = !!quote;
  const [outletId, setOutletId] = useState(quote?.outlet_id ?? preselectedOutlet ?? '');
  const [q, setQ] = useState('');
  const [vatRate, setVatRate] = useState<number>(quote?.vat_rate ?? 1);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  const initial = useMemo(() => {
    const m: Record<string, { bottles: string; price: string; discount: string }> = {};
    for (const p of products) {
      const ex = items?.find(i => i.product_id === p.id);
      m[p.id] = {
        bottles: ex ? String(ex.bottles) : '',
        price: ex ? String(ex.unit_price) : '',
        discount: ex && ex.discount ? String(ex.discount) : ''
      };
    }
    return m;
  }, [products, items]);

  const [lines, setLines] = useState(initial);

  // Nokta seçilince fiyatları sunucudan çek. Elle değiştirilmiş fiyatın
  // üzerine yazmıyoruz — temsilcinin girdiği değer korunur.
  useEffect(() => {
    if (!outletId) return;
    let cancelled = false;
    setLoadingPrices(true);
    fetchOutletPrices(outletId).then(r => {
      if (cancelled) return;
      setLoadingPrices(false);
      if ('prices' in r && r.prices) {
        setPrices(r.prices);
        setLines(prev => {
          const next = { ...prev };
          for (const p of products) {
            const serverPrice = r.prices[p.id];
            if (!next[p.id]) next[p.id] = { bottles: '', price: '', discount: '' };
            if (!next[p.id].price && serverPrice !== null && serverPrice !== undefined) {
              next[p.id] = { ...next[p.id], price: String(serverPrice) };
            }
          }
          return next;
        });
      }
    });
    return () => { cancelled = true; };
  }, [outletId, products]);

  const filteredOutlets = useMemo(() => {
    const t = q.toLocaleLowerCase('tr-TR');
    return outlets
      .filter(o => !t || [o.name, o.city, o.district].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR').includes(t))
      .slice(0, 30);
  }, [outlets, q]);

  const preview = useMemo(() => {
    let sub = 0;
    for (const p of products) {
      const l = lines[p.id];
      if (!l) continue;
      const b = Number(l.bottles), pr = Number(l.price), d = Number(l.discount || '0');
      if (!Number.isFinite(b) || b <= 0) continue;
      sub += Math.max((Number.isFinite(pr) ? pr : 0) * b - (Number.isFinite(d) ? d : 0), 0);
    }
    const vat = Math.round(sub * (vatRate / 100) * 100) / 100;
    return { sub, vat, total: sub + vat };
  }, [lines, products, vatRate]);

  const missingPrice = useMemo(
    () => products.filter(p => {
      const l = lines[p.id];
      return l && Number(l.bottles) > 0 && !(Number(l.price) > 0);
    }),
    [products, lines]
  );

  function setLine(pid: string, field: 'bottles' | 'price' | 'discount', v: string) {
    setLines(s => ({ ...s, [pid]: { ...(s[pid] ?? { bottles: '', price: '', discount: '' }), [field]: v } }));
  }

  function onSubmit(fd: FormData) {
    setErr(null);
    start(async () => {
      const r = isEdit ? await updateQuote(fd) : await createQuote(fd);
      if (r?.error) { setErr(r.error); return; }
      const id = (r as any)?.id ?? quote?.id;
      router.push(`/sales/orders/quotes/${id}`);
      router.refresh();
    });
  }

  const outlet = outlets.find(o => o.id === outletId);

  return (
    <form action={onSubmit} className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          {isEdit ? 'Teklifi Düzenle' : 'Yeni Teklif'}
        </h1>
        <p className="text-[14px] text-[#8E8E93]">
          {outlet ? outlet.name : 'Nokta seçin'} · Bu form fatura değildir
        </p>
      </header>

      {err && <p className="alert-error">{err}</p>}

      {isEdit && <input type="hidden" name="quote_id" value={quote!.id} />}
      <input type="hidden" name="outlet_id" value={outletId} />

      {!isEdit && !preselectedOutlet && (
        <section className="card p-5 space-y-3">
          <label className="label">Nokta *</label>
          <input value={q} onChange={e => setQ(e.target.value)} className="input" placeholder="Nokta ara…" />
          <div className="max-h-56 overflow-y-auto rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
            {filteredOutlets.map(o => (
              <button key={o.id} type="button" onClick={() => setOutletId(o.id)}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-white/[0.05] transition-colors ${
                  outletId === o.id ? 'bg-ios-blue/15' : ''}`}>
                <span className="font-medium">{o.name}</span>
                <span className="text-[#8E8E93]"> · {[o.district, o.city].filter(Boolean).join(', ') || '—'}</span>
                {outletId === o.id && <Check size={14} className="inline ml-2 text-ios-blue" />}
              </button>
            ))}
            {filteredOutlets.length === 0 && (
              <p className="px-3 py-4 text-[13px] text-[#8E8E93]">Eşleşen nokta yok.</p>
            )}
          </div>
        </section>
      )}

      {/* ---- ÜRÜN SATIRLARI ---- */}
      <section className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="section-title">Ürünler</p>
          {loadingPrices && <span className="text-[12px] text-[#8E8E93]">fiyatlar alınıyor…</span>}
        </div>
        <p className="text-[12px] text-[#8E8E93]">
          Birim fiyat ve satır tutarı KDV hariç TL. Şişe adedi boş bırakılan ürün teklife girmez.
        </p>

        {products.map(p => {
          const l = lines[p.id] ?? { bottles: '', price: '', discount: '' };
          const b = Number(l.bottles) || 0;
          const pr = Number(l.price) || 0;
          const d = Number(l.discount) || 0;
          const net = b > 0 ? Math.max(pr * b - d, 0) : 0;
          const agreed = prices[p.id];
          return (
            <div key={p.id} className="rounded-xl bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-medium">{p.name}</p>
                <span className="text-[13px] text-[#AEAEB2] tabular-nums">{net > 0 ? tl(net) : '—'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label !text-[12px]">Şişe adet</label>
                  <input type="number" min={0} inputMode="numeric"
                    name={`item_${p.id}_bottles`} value={l.bottles}
                    onChange={e => setLine(p.id, 'bottles', e.target.value)}
                    className="input !py-2 !text-[13px]" />
                </div>
                <div>
                  <label className="label !text-[12px]">Birim TL</label>
                  <input type="number" min={0} step="0.01" inputMode="decimal"
                    name={`item_${p.id}_price`} value={l.price}
                    onChange={e => setLine(p.id, 'price', e.target.value)}
                    className="input !py-2 !text-[13px]" />
                </div>
                <div>
                  <label className="label !text-[12px]">İskonto TL</label>
                  <input type="number" min={0} step="0.01" inputMode="decimal"
                    name={`item_${p.id}_discount`} value={l.discount}
                    onChange={e => setLine(p.id, 'discount', e.target.value)}
                    className="input !py-2 !text-[13px]" />
                </div>
              </div>
              {b > 0 && (
                <p className="text-[12px] text-[#8E8E93]">
                  {b} şişe ≈ {(b / 12).toFixed(2)} koli
                  {agreed !== null && agreed !== undefined && pr !== agreed
                    ? ` · geçerli fiyat ${tl(agreed)}, elle değiştirildi`
                    : ''}
                </p>
              )}
            </div>
          );
        })}

        {missingPrice.length > 0 && (
          <p className="text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Fiyatı girilmemiş ürün var: {missingPrice.map(p => p.name).join(', ')}.
              Nokta için fiyat anlaşması yapın ya da birim fiyatı elle girin.
            </span>
          </p>
        )}
      </section>

      {/* ---- TUTAR ÖNİZLEME ---- */}
      <section className="card p-5 space-y-3">
        <p className="section-title">Tutar</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <Amount label="KDV hariç" value={tl(preview.sub)} />
          <div>
            <label className="label">KDV oranı %</label>
            <input type="number" min={0} max={100} step="0.01" name="vat_rate" value={vatRate}
              onChange={e => setVatRate(Number(e.target.value))} className="input" />
          </div>
          <Amount label="KDV dahil" value={tl(preview.total)} strong />
        </div>
        <p className="text-[12px] text-[#8E8E93]">
          Kesin tutar kayıtta sunucu tarafından hesaplanır; buradaki önizlemedir.
        </p>
      </section>

      {/* ---- TİCARİ KOŞULLAR ---- */}
      <section className="card p-5 space-y-3">
        <p className="section-title">Ticari koşullar</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Geçerlilik tarihi</label>
            <input type="date" name="valid_until" className="input"
              defaultValue={quote?.valid_until ?? ''} min={today} />
          </div>
          <div>
            <label className="label">Ödeme şekli</label>
            <input name="payment_method" className="input" defaultValue={quote?.payment_method ?? ''}
              placeholder="Peşin / kapıda / havale" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Onaylı vade (gün)</label>
            <input type="number" min={0} name="approved_term_days" className="input"
              defaultValue={quote?.approved_term_days ?? ''} />
            <p className="text-[12px] text-[#8E8E93] mt-1">
              İlk siparişte vade vermemek kuraldır; vade yazılı onayla açılır.
            </p>
          </div>
          <div>
            <label className="label">Teslimat tarihi</label>
            <input type="date" name="delivery_date" className="input" defaultValue={quote?.delivery_date ?? ''} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="delivery_fee_included" className="switch"
            defaultChecked={quote?.delivery_fee_included ?? false} />
          Teslimat ücreti dahil
        </label>
        <div>
          <label className="label">Kampanya / bedelsiz ürün / istisna</label>
          <textarea name="campaign_note" rows={2} className="input" defaultValue={quote?.campaign_note ?? ''} />
        </div>
        <div>
          <label className="label">Yazılı onay referansı</label>
          <input name="written_approval_ref" className="input" defaultValue={quote?.written_approval_ref ?? ''} />
        </div>
      </section>

      <div className="flex gap-2">
        <button type="submit" disabled={!outletId || pending} className="btn-primary">
          {pending ? 'Kaydediliyor…' : isEdit ? 'Değişiklikleri kaydet' : 'Teklifi oluştur'}
        </button>
        <button type="button" onClick={() => router.back()} className="btn-ghost">Vazgeç</button>
      </div>
      <p className="text-[12px] text-[#8E8E93]">
        Teklif taslak olarak kaydedilir. Mali kontrol ve satış kontrolü tamamlanmadan onaylanamaz.
      </p>
    </form>
  );
}

function Amount({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className={`tabular-nums ${strong ? 'text-xl font-bold' : 'text-[15px]'}`}>{value}</p>
    </div>
  );
}
