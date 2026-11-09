'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Zap, AlertTriangle } from 'lucide-react';
import { createDirectOrder, fetchOutletPrices } from '@/app/(app)/sales/orders/actions';
import { SalesStep } from '@/components/sales/OrdersClient';
import { tl } from '@/lib/commerce-format';

interface OutletLite {
  id: string; name: string; city: string | null; district: string | null;
  tax_number: string | null;
}
interface ProductLite { id: string; name: string }
interface PersonLite { id: string; full_name: string | null }

const BOTTLES_PER_CASE = 12;
const tr = (s: string) => s.toLocaleLowerCase('tr-TR');

/**
 * DOĞRUDAN SİPARİŞ FORMU
 *
 * Tek ekran, tek gönderim. Teklif formunun uzun koşul bölümü yok:
 * sahada sözlü anlaşma yapıldıysa gereken yalnızca kim onay verdi,
 * ne kadar ve nereye.
 *
 * Alan sırası diğer formlarla aynı: 1 Kim & Nerede · 2 Ne · 3 Kaça ·
 * 4 Koşullar · 5 Sonuç & Takip. Böylece temsilci her formda aynı
 * yerde aynı şeyi arıyor.
 *
 * Birim: ekranda KOLİ (1 koli = 12 × 250 ml), veritabanında şişe.
 * Çevrim sunucuda tek yerde yapılıyor.
 */
export default function DirectOrderForm({
  outlets, products, people, preselectedOutlet, preselectedVisit, today
}: {
  outlets: OutletLite[];
  products: ProductLite[];
  people: PersonLite[];
  preselectedOutlet?: string;
  preselectedVisit?: string;
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const errRef = useRef<HTMLDivElement>(null);

  const [outletId, setOutletId] = useState(preselectedOutlet ?? '');
  const [q, setQ] = useState('');
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [cases, setCases] = useState<Record<string, string>>({});
  const [free, setFree] = useState<Record<string, string>>({});
  const [vat, setVat] = useState('1');
  const [note, setNote] = useState('');

  const outlet = outlets.find(o => o.id === outletId);

  const filtered = useMemo(() => {
    const t = tr(q);
    return outlets
      .filter(o => !t || tr([o.name, o.city, o.district].filter(Boolean).join(' ')).includes(t))
      .slice(0, 30);
  }, [outlets, q]);

  // Fiyatlar nokta seçilince TEK çağrıda geliyor (fn_prices_for_outlet).
  useEffect(() => {
    if (!outletId) { setPrices({}); return; }
    let alive = true;
    setLoadingPrices(true);
    fetchOutletPrices(outletId).then(r => {
      if (!alive) return;
      setPrices((r as any)?.prices ?? {});
      setLoadingPrices(false);
    }).catch(() => alive && setLoadingPrices(false));
    return () => { alive = false; };
  }, [outletId]);

  const lines = useMemo(() => products.map(p => {
    const paid = Math.max(0, Math.round(Number(cases[p.id] ?? '') || 0));
    const bedelsiz = Math.max(0, Math.round(Number(free[p.id] ?? '') || 0));
    const price = prices[p.id] ?? 0;
    return { p, paid, bedelsiz, price, total: paid * BOTTLES_PER_CASE * price };
  }), [products, cases, free, prices]);

  const net = lines.reduce((s, l) => s + l.total, 0);
  const vatRate = Number(vat) || 0;
  const gross = net * (1 + vatRate / 100);
  const anyLine = lines.some(l => l.paid > 0 || l.bedelsiz > 0);
  const missingPrice = lines.some(l => l.paid > 0 && !(l.price > 0));

  const blocker = !outletId ? 'Nokta seçin'
    : !anyLine ? 'En az bir ürün için koli adedi girin'
    : missingPrice ? 'Fiyatı olmayan ürün var — Ayarlar\'dan fiyat tanımlanmalı'
    : note.trim().length < 3 ? 'Sözlü onayı kimin verdiğini yazın'
    : null;

  function submit(fd: FormData) {
    setErr(null);
    start(async () => {
      let r: any;
      try {
        r = await createDirectOrder(fd);
      } catch (e: any) {
        setErr(`Beklenmeyen hata: ${e?.message ?? 'bilinmiyor'}`);
        queueMicrotask(() => errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        return;
      }
      if (r?.error) {
        setErr(r.error);
        queueMicrotask(() => errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        return;
      }
      router.push(`/sales/orders/${r.id}`);
      router.refresh();
    });
  }

  return (
    <form action={submit} className="py-5 space-y-5">
      <input type="hidden" name="outlet_id" value={outletId} />
      {preselectedVisit && <input type="hidden" name="visit_id" value={preselectedVisit} />}

      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight flex items-center gap-2">
          <Zap size={22} className="text-ios-blue" /> Doğrudan Sipariş
        </h1>
        <p className="text-[14px] text-[#8E8E93]">
          Fiyat sahada sözlü verildiyse teklif belgesi beklenmez. Arkada sözlü
          teklif kaydı açılır; sipariş “onay bekliyor” olarak düşer.
        </p>
      </header>

      {/* ---------- 1 · KİM & NEREDE ---------- */}
      <section className="card p-5 space-y-4">
        <SalesStep n={1} title="Kim & Nerede" sub="Siparişi veren nokta" />
        {!preselectedOutlet ? (
          <div>
            <label className="label">Nokta *</label>
            <input value={q} onChange={e => setQ(e.target.value)} className="input"
              placeholder="Nokta ara…" />
            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
              {filtered.map(o => (
                <button key={o.id} type="button" onClick={() => setOutletId(o.id)}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-white/[0.05] transition-colors ${
                    outletId === o.id ? 'bg-ios-blue/15' : ''}`}>
                  <span className="font-medium">{o.name}</span>
                  <span className="text-[#8E8E93]"> · {[o.district, o.city].filter(Boolean).join(', ') || '—'}</span>
                  {!o.tax_number && <span className="text-amber-300 text-[12px]"> · vergi no yok</span>}
                  {outletId === o.id && <Check size={14} className="inline ml-2 text-ios-blue" />}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-[13px] text-[#8E8E93]">Eşleşen nokta yok.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-[15px] font-medium">
            {outlet?.name ?? 'Seçili nokta'}
            <span className="text-[#8E8E93] font-normal">
              {' '}· {[outlet?.district, outlet?.city].filter(Boolean).join(', ') || '—'}
            </span>
          </p>
        )}

        {outlet && !outlet.tax_number && (
          <p className="text-[13px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Bu noktanın vergi numarası yok — fatura kesilemez.{' '}
              <Link href={`/sales/outlets/${outlet.id}#firma-bilgileri`} className="underline font-semibold">
                Firma bilgilerini tamamla
              </Link>
            </span>
          </p>
        )}
      </section>

      {/* ---------- 2 · NE / 3 · KAÇA ---------- */}
      <section className="card p-5 space-y-4">
        <SalesStep n={2} title="Ne &amp; Kaça" sub="Koli adedi — 1 koli = 12 × 250 ml" />
        {loadingPrices && <p className="text-[13px] text-[#8E8E93]">Fiyatlar alınıyor…</p>}

        <div className="space-y-3">
          {products.map(p => {
            const price = prices[p.id];
            const l = lines.find(x => x.p.id === p.id)!;
            return (
              <div key={p.id} className="rounded-xl bg-white/[0.03] p-3 space-y-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[14px] font-semibold">{p.name}</p>
                  <p className="text-[12px] text-[#8E8E93]">
                    {price ? `${tl(price)} / şişe` : 'fiyat tanımsız'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Ücretli koli</label>
                    <input name={`oi_${p.id}_paid_cases`} inputMode="numeric" className="input"
                      value={cases[p.id] ?? ''} placeholder="0"
                      onChange={e => setCases(s => ({ ...s, [p.id]: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Bedelsiz koli</label>
                    <input name={`oi_${p.id}_free_cases`} inputMode="numeric" className="input"
                      value={free[p.id] ?? ''} placeholder="0"
                      onChange={e => setFree(s => ({ ...s, [p.id]: e.target.value }))} />
                  </div>
                </div>
                <input type="hidden" name={`oi_${p.id}_price`} value={price ?? 0} />
                {(l.paid > 0 || l.bedelsiz > 0) && (
                  <p className="text-[12px] text-[#AEAEB2] tabular-nums">
                    {l.paid > 0 && <>{l.paid} koli = {l.paid * BOTTLES_PER_CASE} şişe · {tl(l.total)}</>}
                    {l.bedelsiz > 0 && <> {l.paid > 0 ? '· ' : ''}{l.bedelsiz} koli bedelsiz</>}
                  </p>
                )}
              </div>
            );
          })}
          {products.length === 0 && (
            <p className="text-[13px] text-[#8E8E93]">Tanımlı ürün yok.</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">KDV %</label>
            <input name="vat_rate" inputMode="decimal" className="input"
              value={vat} onChange={e => setVat(e.target.value)} />
          </div>
          <div className="rounded-xl bg-white/[0.03] p-3 flex flex-col justify-center">
            <p className="text-[12px] text-[#8E8E93]">Toplam</p>
            <p className="text-[17px] font-bold tabular-nums">{tl(gross)}</p>
            <p className="text-[12px] text-[#8E8E93] tabular-nums">
              net {tl(net)} + KDV %{vatRate}
            </p>
          </div>
        </div>
      </section>

      {/* ---------- 4 · KOŞULLAR ---------- */}
      <section className="card p-5 space-y-4">
        <SalesStep n={3} title="Koşullar" sub="Sözlü onay, ödeme ve teslim" />

        <div>
          <label className="label">Sözlü onayı kim verdi? *</label>
          <input name="verbal_note" className="input" value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Örn: Sahibi Ahmet Yılmaz, 56 TL/şişe, 30 gün vade kabul etti" />
          <p className="text-[12px] text-[#8E8E93] mt-1">
            Teklif belgesi yok; bu not belgenin yerine geçiyor ve denetimde okunuyor.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Ödeme şekli</label>
            <input name="payment_method" className="input" placeholder="Peşin / 30 gün vade" />
          </div>
          <div>
            <label className="label">Müşteri onay tarihi</label>
            <input type="date" name="customer_approval_date" className="input" defaultValue={today} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Teslim tarihi</label>
            <input type="date" name="delivery_date" className="input" />
          </div>
          <div>
            <label className="label">Teslim saat aralığı</label>
            <input name="delivery_time_window" className="input" placeholder="09:00–12:00" />
          </div>
        </div>

        <div>
          <label className="label">Teslim adresi</label>
          <input name="delivery_address" className="input" placeholder="Boş bırakılırsa noktanın adresi" />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Teslim alacak kişi</label>
            <input name="receiver_name" className="input" />
          </div>
          <div>
            <label className="label">Telefon</label>
            <input name="receiver_phone" type="tel" inputMode="tel" className="input" />
          </div>
        </div>
      </section>

      {/* ---------- 5 · SONUÇ & TAKİP ---------- */}
      <section className="card p-5 space-y-4">
        <SalesStep n={4} title="Sonuç &amp; Takip" sub="İlk kontrol ne zaman, kimde" />
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">İlk kontrol tarihi</label>
            <input type="date" name="first_followup_date" className="input" />
          </div>
          <div>
            <label className="label">Sorumlu</label>
            <select name="first_followup_owner" className="input" defaultValue="">
              <option value="">Ben</option>
              {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
        </div>
      </section>

      <div ref={errRef} className="space-y-2">
        {err && <p className="alert-error">{err}</p>}
        <div className="flex gap-2 items-center flex-wrap">
          <button type="submit" disabled={!!blocker || pending}
            className="btn-primary disabled:opacity-40">
            {pending ? 'Kaydediliyor…' : 'Siparişi oluştur'}
          </button>
          <Link href="/sales/orders" className="btn-ghost">Vazgeç</Link>
          {blocker && !pending && (
            <span className="text-[12px] text-amber-300">{blocker}</span>
          )}
        </div>
        {!blocker && !pending && (
          <p className="text-[12px] text-[#8E8E93]">
            Kaydedince siparişin kartı açılır; stok ve sevk teyidi oradan verilir.
          </p>
        )}
      </div>
    </form>
  );
}
