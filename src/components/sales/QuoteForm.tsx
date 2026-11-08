'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, AlertTriangle, Lock } from 'lucide-react';
import { createQuote, updateQuote, fetchOutletPrices } from '@/app/(app)/sales/orders/actions';
import { SalesStep } from '@/components/sales/OrdersClient';
import { tl, BOTTLES_PER_CASE } from '@/lib/commerce-format';

interface OutletLite { id: string; name: string; city: string | null; district: string | null }
interface ProductLite { id: string; name: string }
interface ExistingItem { product_id: string; bottles: number; unit_price: number; discount: number }

/**
 * TİCARİ TEKLİF FORMU (F05)
 *
 * Nokta formuyla AYNI SIRA: 1 Kim & Nerede → 2 Ne → 3 Kaça →
 * 4 Koşullar → 5 Sonuç & Takip. Temsilci dört ayrı formda dört ayrı
 * sıra öğrenmek zorunda kalmasın diye başlıklar birebir aynı.
 *
 * Miktar KOLİ girilir (1 koli = 12 × 250 ml şişe), veritabanı şişe tutar.
 * Fiyat noktaya göre sunucudan gelir (anlaşma varsa anlaşma fiyatı,
 * yoksa liste); temsilci üzerine yazabilir.
 *
 * Toplamları veritabanı trigger'ı hesaplıyor. Buradaki hesap yalnızca
 * CANLI ÖNİZLEME — kaydedilen değer sunucudan gelir, iki ayrı doğru olmaz.
 */
export default function QuoteForm({
  outlets, products, preselectedOutlet, preselectedVisit, quote, items, today
}: {
  outlets: OutletLite[];
  products: ProductLite[];
  preselectedOutlet?: string;
  preselectedVisit?: string;
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
  const errRef = useRef<HTMLDivElement | null>(null);

  const isEdit = !!quote;
  const [outletId, setOutletId] = useState(quote?.outlet_id ?? preselectedOutlet ?? '');
  const [q, setQ] = useState('');
  const [vatRate, setVatRate] = useState<number>(quote?.vat_rate ?? 1);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);

  const initial = useMemo(() => {
    const m: Record<string, { cases: string; price: string; discount: string }> = {};
    for (const p of products) {
      const ex = items?.find(i => i.product_id === p.id);
      m[p.id] = {
        cases: ex ? String(Math.round(ex.bottles / BOTTLES_PER_CASE)) : '',   // şişe → koli
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
            if (!next[p.id]) next[p.id] = { cases: '', price: '', discount: '' };
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
      // alan KOLİ tutuyor, fiyat ŞİŞE başına → çevrim burada
      const c = Number(l.cases), pr = Number(l.price), d = Number(l.discount || '0');
      if (!Number.isFinite(c) || c <= 0) continue;
      const bottles = Math.round(c) * BOTTLES_PER_CASE;
      sub += Math.max((Number.isFinite(pr) ? pr : 0) * bottles - (Number.isFinite(d) ? d : 0), 0);
    }
    const vat = Math.round(sub * (vatRate / 100) * 100) / 100;
    return { sub, vat, total: sub + vat };
  }, [lines, products, vatRate]);

  const lineCount = useMemo(
    () => products.filter(p => Number(lines[p.id]?.cases) > 0).length,
    [products, lines]
  );

  const missingPrice = useMemo(
    () => products.filter(p => {
      const l = lines[p.id];
      return l && Number(l.cases) > 0 && !(Number(l.price) > 0);
    }),
    [products, lines]
  );

  // Butonun neden kilitli olduğunu kullanıcıya SÖYLÜYORUZ — sessiz
  // kilitli buton, sahada "sayfa dondu" diye bildirilen şeyin kendisi.
  const blocker =
    !outletId ? 'Önce nokta seçin.'
    : lineCount === 0 ? 'En az bir ürüne koli adedi girin.'
    : missingPrice.length > 0 ? 'Koli adedi girilen her ürün için birim fiyat gerekli.'
    : null;

  function setLine(pid: string, field: 'cases' | 'price' | 'discount', v: string) {
    setLines(s => ({ ...s, [pid]: { ...(s[pid] ?? { cases: '', price: '', discount: '' }), [field]: v } }));
  }

  function onSubmit(fd: FormData) {
    setErr(null);
    start(async () => {
      try {
        const r = isEdit ? await updateQuote(fd) : await createQuote(fd);
        if (r?.error) {
          setErr(r.error);
          errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        const id = (r as any)?.id ?? quote?.id;
        router.push(`/sales/orders/quotes/${id}`);
        router.refresh();
      } catch {
        setErr('Kayıt sırasında beklenmeyen bir hata oluştu. Girdiğiniz bilgiler ekranda duruyor; tekrar deneyin.');
        errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  const outlet = outlets.find(o => o.id === outletId);
  const locked = !isEdit && !!preselectedOutlet;

  return (
    <form action={onSubmit} className="py-5 space-y-5">
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          {isEdit ? 'Teklifi Düzenle' : 'Yeni Teklif'}
        </h1>
        <p className="text-[14px] text-[#8E8E93]">
          {outlet ? outlet.name : 'Nokta seçin'} · Bu form fatura değildir
        </p>
      </header>

      {isEdit && <input type="hidden" name="quote_id" value={quote!.id} />}
      {preselectedVisit && <input type="hidden" name="visit_id" value={preselectedVisit} />}
      <input type="hidden" name="outlet_id" value={outletId} />

      {/* ---------- 1 · KİM & NEREDE ---------- */}
      <section className="card p-5 space-y-3">
        <SalesStep n={1} title="Kim & Nerede" sub="Teklif hangi noktaya veriliyor" />

        {locked || isEdit ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-[15px] font-medium truncate">{outlet?.name ?? 'Seçili nokta'}</p>
              <p className="text-[12px] text-[#8E8E93] truncate">
                {[outlet?.district, outlet?.city].filter(Boolean).join(', ') || '—'}
              </p>
            </div>
            <span className="text-[12px] text-[#8E8E93] flex items-center gap-1 shrink-0">
              <Lock size={12} /> kilitli
            </span>
          </div>
        ) : (
          <>
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
                <p className="px-3 py-4 text-[13px] text-[#8E8E93]">
                  Eşleşen nokta yok. Nokta henüz açılmadıysa{' '}
                  <Link href="/sales/outlets" className="text-ios-blue hover:underline">Noktalar</Link>{' '}
                  ekranından açın.
                </p>
              )}
            </div>
          </>
        )}

        {outletId && (
          <Link href={`/sales/outlets/${outletId}`} className="text-[13px] text-ios-blue hover:underline">
            Nokta kartını aç →
          </Link>
        )}
      </section>

      {/* ---------- 2 · NE ---------- */}
      <section className="card p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <SalesStep n={2} title="Ne" sub="Hangi ürün, kaç koli" />
          {loadingPrices && <span className="text-[12px] text-[#8E8E93] shrink-0 mt-1">fiyatlar alınıyor…</span>}
        </div>
        <p className="text-[12px] text-[#8E8E93]">
          Miktar KOLİ olarak girilir; 1 koli = 12 × 250 ml şişe.
          Koli adedi boş bırakılan ürün teklife girmez.
        </p>

        {products.map(p => {
          const l = lines[p.id] ?? { cases: '', price: '', discount: '' };
          const c = Number(l.cases) || 0;
          const pr = Number(l.price) || 0;
          const d = Number(l.discount) || 0;
          const net = c > 0 ? Math.max(pr * c * BOTTLES_PER_CASE - d, 0) : 0;
          const agreed = prices[p.id];
          return (
            <div key={p.id} className="rounded-xl bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[15px] font-medium">{p.name}</p>
                <span className="text-[13px] text-[#AEAEB2] tabular-nums">{net > 0 ? tl(net) : '—'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="label !text-[12px]">Koli adet</label>
                  <input type="number" min={0} inputMode="numeric"
                    name={`item_${p.id}_cases`} value={l.cases}
                    onChange={e => setLine(p.id, 'cases', e.target.value)}
                    className="input !py-2 !text-[13px]" />
                </div>
                <div>
                  <label className="label !text-[12px]">Birim TL / şişe</label>
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
              {c > 0 && (
                <p className="text-[12px] text-[#8E8E93]">
                  {c} koli = {c * BOTTLES_PER_CASE} şişe
                  {pr > 0 ? ` · koli tutarı ${tl(pr * BOTTLES_PER_CASE)}` : ''}
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

      {/* ---------- 3 · KAÇA ---------- */}
      <section className="card p-5 space-y-3">
        <SalesStep n={3} title="Kaça" sub="KDV oranı ve toplam tutar" />
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

      {/* ---------- 4 · KOŞULLAR ---------- */}
      <section className="card p-5 space-y-3">
        <SalesStep n={4} title="Koşullar" sub="Ödeme, vade, teslimat ve geçerlilik" />
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

      {/* ---------- 5 · SONUÇ & TAKİP ---------- */}
      <section className="card p-5 space-y-3">
        <SalesStep n={5} title="Sonuç & Takip" sub="Kayıttan sonraki adım" />
        <p className="text-[13px] text-[#8E8E93]">
          Teklif <strong>taslak</strong> olarak kaydedilir ve kartı hemen açılır.
          Sıradaki adımlar aynı karttan yürür: mali kontrol → satış kontrolü →
          onay → müşteriye sunum → sipariş. Takip kaydı da o karttan eklenir.
        </p>
      </section>

      {/* Hata ve kilit nedeni butonun YANINDA — uzun formun tepesinde
          gösterilen hata, sayfanın dibindeki kullanıcıya görünmüyor. */}
      <div ref={errRef} className="space-y-2">
        {err && <p className="alert-error">{err}</p>}
        <div className="flex gap-2 items-center flex-wrap">
          <button type="submit" disabled={!!blocker || pending} className="btn-primary disabled:opacity-40">
            {pending ? 'Kaydediliyor…' : isEdit ? 'Değişiklikleri kaydet' : 'Teklifi oluştur'}
          </button>
          <button type="button" onClick={() => router.back()} className="btn-ghost">Vazgeç</button>
          {blocker && !pending && <span className="text-[12px] text-amber-300">{blocker}</span>}
        </div>
      </div>
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
