'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Zap, AlertTriangle, ChevronDown } from 'lucide-react';
import { createDirectOrder, fetchOutletPrices } from '@/app/(app)/sales/orders/actions';
import SaleLines, { type SaleLinesState } from '@/components/sales/SaleLines';
import { tl } from '@/lib/commerce-format';

interface OutletLite {
  id: string; name: string; city: string | null; district: string | null;
  tax_number: string | null;
}
interface ProductLite { id: string; name: string }
interface PersonLite { id: string; full_name: string | null }

const tr = (s: string) => s.toLocaleLowerCase('tr-TR');

/**
 * DOĞRUDAN SATIŞ — tek ekran
 *
 * Sahada fiyat sözlü veriliyor, müşteri kabul ediyor, sipariş orada
 * alınıyor. Zorunlu olan üç şey var: nokta, koli adedi, koli fiyatı.
 * Geri kalan her şey (kiminle anlaşıldı, ödeme, teslim, takip) isteğe
 * bağlı. Kayıtla birlikte sunucu ziyareti ve noktanın koli fiyatını da
 * yazıyor — temsilci aynı satışı üç ekrana girmiyor.
 *
 * Birim: ekranda KOLİ, veritabanında şişe. Çevrim SaleLines içinde
 * tek yerde yapılıyor.
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
  const [lines, setLines] = useState<SaleLinesState>({ any: false, missingPrice: false, net: 0, cases: 0 });
  const [vat, setVat] = useState('1');
  const [note, setNote] = useState('');

  const outlet = outlets.find(o => o.id === outletId);

  const filtered = useMemo(() => {
    const t = tr(q);
    return outlets
      .filter(o => !t || tr([o.name, o.city, o.district].filter(Boolean).join(' ')).includes(t))
      .slice(0, 25);
  }, [outlets, q]);

  // Fiyatlar nokta seçilince tek çağrıda geliyor (fn_prices_for_outlet)
  useEffect(() => {
    if (!outletId) { setPrices({}); return; }
    let alive = true;
    fetchOutletPrices(outletId)
      .then(r => { if (alive) setPrices((r as any)?.prices ?? {}); })
      .catch(() => {});
    return () => { alive = false; };
  }, [outletId]);

  const vatRate = Number(String(vat).replace(',', '.')) || 0;
  const gross = lines.net * (1 + vatRate / 100);

  const blocker = !outletId ? 'Nokta seçin'
    : !lines.any ? 'Koli adedi girin'
    : lines.missingPrice ? 'Koli fiyatı girin'
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
    <form action={submit} className="py-5 space-y-4">
      <input type="hidden" name="outlet_id" value={outletId} />
      {preselectedVisit && <input type="hidden" name="visit_id" value={preselectedVisit} />}

      <header className="px-1">
        <h1 className="text-[26px] leading-tight font-bold tracking-tight flex items-center gap-2">
          <Zap size={21} className="text-ios-blue" /> Doğrudan Satış
        </h1>
        <p className="text-[13.5px] text-[#8E8E93]">
          Nokta, koli ve koli fiyatı yeter. Ziyaret kaydı ve noktanın koli fiyatı kendiliğinden yazılır.
        </p>
      </header>

      {/* ---------- NOKTA ---------- */}
      <section className="card p-4 space-y-3">
        {!preselectedOutlet ? (
          outlet ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-medium min-w-0 truncate">
                {outlet.name}
                <span className="text-[#8E8E93] font-normal">
                  {' '}· {[outlet.district, outlet.city].filter(Boolean).join(', ') || '—'}
                </span>
              </p>
              <button type="button" onClick={() => { setOutletId(''); setQ(''); }}
                className="text-[12.5px] text-ios-blue shrink-0">değiştir</button>
            </div>
          ) : (
            <div>
              <input value={q} onChange={e => setQ(e.target.value)} className="input"
                placeholder="Nokta ara…" autoFocus />
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
                {filtered.map(o => (
                  <button key={o.id} type="button" onClick={() => setOutletId(o.id)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/[0.05]">
                    <span className="font-medium">{o.name}</span>
                    <span className="text-[#8E8E93]"> · {[o.district, o.city].filter(Boolean).join(', ') || '—'}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="px-3 py-4 text-[13px] text-[#8E8E93]">Eşleşen nokta yok.</p>
                )}
              </div>
            </div>
          )
        ) : (
          <p className="text-[15px] font-medium">
            {outlet?.name ?? 'Seçili nokta'}
            <span className="text-[#8E8E93] font-normal">
              {' '}· {[outlet?.district, outlet?.city].filter(Boolean).join(', ') || '—'}
            </span>
          </p>
        )}

        {outlet && !outlet.tax_number && (
          <p className="text-[12.5px] text-amber-300 flex items-start gap-1.5">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>
              Vergi no yok — fatura kesilemez.{' '}
              <Link href={`/sales/outlets/${outlet.id}#firma-bilgileri`} className="underline">
                tamamla
              </Link>
            </span>
          </p>
        )}
      </section>

      {/* ---------- ÜRÜNLER ---------- */}
      <section className="card p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-[14px] font-semibold">Ürünler</p>
          <p className="text-[11.5px] text-[#8E8E93]">1 koli = 12 × 250 ml</p>
        </div>
        <SaleLines products={products} prices={prices} field="order" onState={setLines} />

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-[13px] text-[#8E8E93]">
            KDV %
            <input name="vat_rate" inputMode="decimal" value={vat}
              onChange={e => setVat(e.target.value)}
              className="input !w-16 !py-1.5 !text-[13px] tabular-nums" />
          </label>
          {lines.any && (
            <p className="ml-auto text-right">
              <span className="block text-[11px] text-[#8E8E93]">KDV dahil</span>
              <span className="text-[18px] font-bold tabular-nums">{tl(gross)}</span>
            </p>
          )}
        </div>
      </section>

      {/* ---------- SÖZLÜ ONAY ---------- */}
      <section className="card p-4 space-y-2">
        <label className="label">Kiminle anlaşıldı? <span className="font-normal text-[#8E8E93]">(isteğe bağlı)</span></label>
        <input name="verbal_note" className="input" value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Örn: Sahibi Ahmet Yılmaz, koli 700, peşin" />
      </section>

      {/* ---------- GERİSİ: KATLANMIŞ ---------- */}
      <section className="card p-4">
        <details>
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <span className="text-[14px] font-semibold">Ödeme, teslim ve takip</span>
            <ChevronDown size={16} className="text-[#8E8E93]" />
          </summary>

          <div className="space-y-3 mt-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Ödeme şekli</label>
                <input name="payment_method" className="input" placeholder="Peşin / 30 gün" />
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
                <label className="label">Teslim saati</label>
                <input name="delivery_time_window" className="input" placeholder="09:00–12:00" />
              </div>
            </div>
            <div>
              <label className="label">Teslim adresi</label>
              <input name="delivery_address" className="input"
                placeholder="Boş bırakılırsa noktanın adresi kullanılır" />
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
          </div>
        </details>
      </section>

      <div ref={errRef} className="space-y-2">
        {err && <p className="alert-error">{err}</p>}
        <div className="flex gap-2 items-center flex-wrap">
          <button type="submit" disabled={!!blocker || pending}
            className="btn-primary disabled:opacity-40">
            {pending ? 'Kaydediliyor…' : <><Check size={16} /> Satışı kaydet</>}
          </button>
          <Link href="/sales/orders" className="btn-ghost">Vazgeç</Link>
          {blocker && !pending && (
            <span className="text-[12px] text-amber-300">{blocker}</span>
          )}
        </div>
      </div>
    </form>
  );
}
