'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ChevronDown, Save, Camera, Zap, CloudOff, AlertTriangle } from 'lucide-react';
import { saveVisit, uploadVisitPhotos } from '@/app/(app)/sales/actions';
import {
  OUTCOME_LABEL, VISIT_TYPE_LABEL, AUTHORITY_LABEL, VERDICT_LABEL
} from '@/lib/sales-types';
import { enqueueVisit, looksOffline } from '@/lib/offline-queue';
import { shrinkImage } from '@/lib/image-shrink';

export interface OutletLite {
  id: string; name: string; city: string | null; district: string | null; status: string;
}
export interface ProductLite { id: string; name: string; taste_reference: string | null }
export interface CriterionLite { id: string; label: string; grp: string | null; applies_to: string }
export interface ReasonLite { id: string; label: string; requires_note: boolean }
export interface PersonLite { id: string; full_name: string | null }
export interface OrderLite { id: string; order_no: number | null; total_amount: number | null; outlet_id: string }

const tr = (s: string) => s.toLocaleLowerCase('tr-TR');

/** Sonuca göre önerilen takip — sunucudaki DEFAULT_FOLLOWUP ile aynı. */
const FOLLOWUP_DEFAULT: Record<string, { action: string; days: number }> = {
  takip: { action: 'Tekrar ziyaret', days: 7 },
  tadim_planlandi: { action: 'Tadım yap', days: 3 }
};
const plusDays = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
/** Numune kuralı: bir ziyarette en fazla 4 kapalı şişe bırakılır. */
const SEALED_LIMIT = 4;
const MAX_PHOTOS = 8;

/**
 * ZİYARET — TEK SAYFA
 *
 * Önceki form beş adımlı sihirbazdı. Sahada en sık duyulan şikâyet
 * buydu: "bir formdan diğerine geçmek çok zor". Adımlar arasında
 * gezinmek, hangi adımda ne kaldığını hatırlamak ve her adımda
 * doğrulama engeline çarpmak 30 saniyelik işi dakikalara çıkarıyordu.
 *
 * Artık tek sayfa. Zorunlu olan iki şey var: nokta ve sonuç.
 * Görünen alanlar: sonuç, kiminle görüşüldü (tek dokunuş), tek bir not
 * ve — sonuç bir söz içeriyorsa — hazır doldurulmuş takip. Puanlama,
 * tadım, fotoğraf ve ayrıntılar katlanmış.
 *
 * BAĞLANTI YOKSA kayıt kaybolmaz: form cihazda kuyruğa alınır,
 * bağlantı gelince OfflineQueueBanner gönderir. Her form açılışında
 * üretilen client_uuid aynı ziyaretin iki kez yazılmasını engeller.
 *
 * Nokta kartının içinde de açılıyor (OutletWorkspace): o zaman
 * `embedded` ile başlık ve dış boşluk kalkıyor.
 */
export default function VisitQuickForm({
  outlets, products, criteria, reasons, people, orders = [],
  preselectedOutlet, today, embedded = false, onDone, onNeedSale
}: {
  /** Sonuç "sipariş" ise satış panelini açar (nokta kartında) */
  onNeedSale?: () => void;
  outlets: OutletLite[];
  products: ProductLite[];
  criteria: CriterionLite[];
  reasons: ReasonLite[];
  people: PersonLite[];
  orders?: OrderLite[];
  preselectedOutlet?: string;
  today: string;
  embedded?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);
  const errRef = useRef<HTMLDivElement>(null);

  const [outletId, setOutletId] = useState(preselectedOutlet ?? '');
  const [q, setQ] = useState('');
  const [outcome, setOutcome] = useState('takip');
  const [objStated, setObjStated] = useState('');
  const [orderId, setOrderId] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [tasted, setTasted] = useState<string[]>([]);
  const [sealed, setSealed] = useState<Record<string, string>>({});
  const [authority, setAuthority] = useState('');
  const [visitDate, setVisitDate] = useState(today);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoKind, setPhotoKind] = useState('raf');
  const [queued, setQueued] = useState(false);

  // Tekilleştirme anahtarı ve ziyaret süresi: form açıldığı an başlar.
  // useState başlatıcısı yalnız istemcide çalışsın diye useEffect'te atanıyor
  // (sunucu ile istemci farklı değer üretirse hydration uyarısı çıkar).
  const [clientUuid, setClientUuid] = useState('');
  const [startedAt, setStartedAt] = useState('');
  useEffect(() => {
    setClientUuid(typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0').slice(-12));
    setStartedAt(new Date().toISOString());
  }, []);

  // TAKİP: sonuç bir söz içeriyorsa ("tekrar geleceğim", "tadım yapacağım")
  // alan açık ve dolu gelir. Kullanıcı elle değiştirdiyse dokunmuyoruz.
  const [fAction, setFAction] = useState(FOLLOWUP_DEFAULT.takip.action);
  const [fDue, setFDue] = useState(plusDays(today, FOLLOWUP_DEFAULT.takip.days));
  const fTouched = useRef(false);
  const [fupOpen, setFupOpen] = useState(true);
  useEffect(() => {
    const def = FOLLOWUP_DEFAULT[outcome];
    setFupOpen(!!def || fTouched.current);
    if (fTouched.current) return;
    setFAction(def ? def.action : '');
    setFDue(def ? plusDays(visitDate, def.days) : '');
  }, [outcome, visitDate]);

  const sealedTotal = useMemo(
    () => tasted.reduce((s, pid) => s + (Number(sealed[pid]) || 0), 0),
    [tasted, sealed]
  );

  const outlet = outlets.find(o => o.id === outletId);
  const isProspect = !outlet || outlet.status === 'aday';

  const activeCriteria = useMemo(
    () => criteria.filter(c => c.applies_to === 'hepsi' || c.applies_to === (isProspect ? 'aday' : 'musteri')),
    [criteria, isProspect]
  );

  const outletOrders = useMemo(
    () => orders.filter(o => o.outlet_id === outletId), [orders, outletId]
  );

  const filteredOutlets = useMemo(() => {
    const t = tr(q);
    return outlets
      .filter(o => !t || tr([o.name, o.city, o.district].filter(Boolean).join(' ')).includes(t))
      .slice(0, 25);
  }, [outlets, q]);

  const liveScore = useMemo(() => {
    const vals = activeCriteria.map(c => scores[c.id]).filter(v => typeof v === 'number') as number[];
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }, [scores, activeCriteria]);

  const blocker = !outletId ? 'Nokta seçin'
    : outcome === 'olumsuz' && !objStated ? 'Olumsuz sonuç için itiraz nedeni seçin'
    : outcome === 'siparis' && !orderId
      ? (outletOrders.length ? 'Bağlanacak siparişi seçin ya da doğrudan satış açın' : 'Sipariş için doğrudan satışı açın')
    : null;

  const showErr = (m: string) => {
    setErr(m);
    queueMicrotask(() => errRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  };

  function submit(fd: FormData) {
    setErr(null);
    const isDraft = fd.get('submit') !== '1';
    fd.set('ended_at', new Date().toISOString());
    start(async () => {
      let r: { ok?: boolean; error?: string; id?: string } | undefined;
      try {
        r = await saveVisit(fd);
      } catch (e: any) {
        // Bağlantı yok: kaydı cihazda sakla, kullanıcı formu baştan yazmasın.
        if (looksOffline(e) && enqueueVisit(fd, outlet?.name ?? '')) {
          setQueued(true);
          if (onDone) onDone();
          return;
        }
        showErr(looksOffline(e)
          ? 'Bağlantı yok ve kayıt cihazda saklanamadı. Bilgiler ekranda duruyor; bağlantı gelince tekrar deneyin.'
          : `Beklenmeyen hata: ${e?.message ?? 'bilinmiyor'}`);
        return;
      }
      if (r?.error) { showErr(r.error); return; }

      // Fotoğraflar ziyaret yazıldıktan sonra, küçültülerek tek tek gider:
      // biri takılırsa diğerleri ve ziyaretin kendisi kaybolmaz.
      if (photos.length && r?.id) {
        let failed = 0;
        for (const f of photos) {
          try {
            const pf = new FormData();
            pf.set('visit_id', r.id);
            pf.set('kind', photoKind);
            pf.append('photos', await shrinkImage(f));
            const up: any = await uploadVisitPhotos(pf);
            if (up?.error) failed++;
          } catch { failed++; }
        }
        if (failed > 0) {
          setPhotos([]);
          showErr(`Ziyaret kaydedildi ama ${failed} fotoğraf yüklenemedi. Ziyaret kartından tekrar ekleyebilirsiniz.`);
          router.refresh();
          return;
        }
      }
      if (onDone) { onDone(); router.refresh(); return; }
      // Akış kesilmesin: teklif istendiyse teklif formu, sipariş ise
      // satış listesi, diğer durumda nokta kartı.
      if (!isDraft && outcome === 'teklif_istendi') {
        const qs = new URLSearchParams({ outlet: outletId });
        if (r?.id) qs.set('visit', r.id);
        router.push(`/sales/orders/quotes/new?${qs.toString()}`);
      } else if (!isDraft && outletId) {
        router.push(`/sales/outlets/${outletId}`);
      } else {
        router.push('/sales/visits');
      }
      router.refresh();
    });
  }

  function saveDraft() {
    if (draftRef.current) draftRef.current.value = '0';
    formRef.current?.requestSubmit();
  }

  if (queued) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-amber-300">
          <CloudOff size={16} /> Bağlantı yok — ziyaret cihazda saklandı
        </p>
        <p className="text-[13px] text-amber-300">
          Bağlantı gelince kendiliğinden gönderilecek; bu sekmeyi kapatmanız sorun değil.
          {photos.length > 0 ? ' Fotoğraflar saklanmadı; ziyaret gönderildikten sonra ziyaret kartından ekleyin.' : ''}
        </p>
      </div>
    );
  }

  const chip = (on: boolean) =>
    `min-h-[44px] rounded-lg px-3.5 text-[13.5px] font-semibold transition-colors ${
      on ? 'bg-ios-blue text-white' : 'bg-white/[0.07] text-[#D1D1D6]'}`;

  return (
    <form ref={formRef} action={submit} className={embedded ? 'space-y-4' : 'py-5 space-y-4'}>
      <input ref={draftRef} type="hidden" name="submit" defaultValue="1" />
      <input type="hidden" name="outlet_id" value={outletId} />
      <input type="hidden" name="outcome" value={outcome} />
      <input type="hidden" name="client_uuid" value={clientUuid} />
      <input type="hidden" name="started_at" value={startedAt} />
      <input type="hidden" name="met_decision_authority" value={authority} />

      {!embedded && (
        <header className="px-1">
          <h1 className="text-[26px] leading-tight font-bold tracking-tight">Ziyaret</h1>
          <p className="text-[13.5px] text-[#8E8E93]">
            {outlet ? outlet.name : 'Nokta seçin'} · zorunlu olan yalnızca nokta ve sonuç
          </p>
        </header>
      )}

      {/* ---------- NOKTA · TARİH · TİP ---------- */}
      <section className={embedded ? 'space-y-3' : 'card p-4 space-y-3'}>
        {!preselectedOutlet && (
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
                placeholder="Nokta ara…" />
              <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
                {filteredOutlets.map(o => (
                  <button key={o.id} type="button" onClick={() => setOutletId(o.id)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/[0.05]">
                    <span className="font-medium">{o.name}</span>
                    <span className="text-[#8E8E93]"> · {[o.district, o.city].filter(Boolean).join(', ') || '—'}</span>
                  </button>
                ))}
                {filteredOutlets.length === 0 && (
                  <p className="px-3 py-4 text-[13px] text-[#8E8E93]">Eşleşen nokta yok.</p>
                )}
              </div>
            </div>
          )
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tarih</label>
            <input type="date" name="visit_date" required value={visitDate}
              onChange={e => setVisitDate(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">Tip</label>
            <select name="visit_type" className="input" defaultValue={isProspect ? 'ilk_ziyaret' : 'rutin'}>
              {Object.entries(VISIT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
      </section>

      {/* ---------- SONUÇ ---------- */}
      <section className={embedded ? 'space-y-3' : 'card p-4 space-y-3'}>
        <label className="label">Sonuç *</label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(OUTCOME_LABEL).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setOutcome(v)} className={chip(outcome === v)}>
              {l}
            </button>
          ))}
        </div>

        {outcome === 'olumsuz' && (
          <div className="space-y-2 rounded-xl bg-white/[0.03] p-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Beyan edilen itiraz *</label>
                <select name="objection_stated_id" className="input" value={objStated}
                  onChange={e => setObjStated(e.target.value)}>
                  <option value="">Seçiniz…</option>
                  {reasons.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Gerçek neden</label>
                <select name="objection_real_id" className="input" defaultValue="">
                  <option value="">Bilinmiyor</option>
                  {reasons.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <input name="objection_note" className="input !py-2 !text-[13px]"
              placeholder="Açıklama (kısa)" />
          </div>
        )}

        {outcome === 'siparis' && (
          <div className="rounded-xl bg-white/[0.03] p-3 space-y-2.5">
            {/* Sipariş aldıysanız ziyareti ayrıca yazmaya gerek yok:
                doğrudan satış ziyareti kendisi kaydediyor. */}
            <p className="text-[13px] text-[#D1D1D6]">
              Sipariş aldıysanız <strong>doğrudan satış</strong> yeterli — ziyaret kaydı kendiliğinden yazılır.
            </p>
            {onNeedSale ? (
              <button type="button" onClick={onNeedSale} className="btn-primary">
                <Zap size={15} /> Doğrudan satışı aç
              </button>
            ) : outletId ? (
              <Link href={`/sales/orders/direct/new?outlet=${outletId}`} className="btn-primary">
                <Zap size={15} /> Doğrudan satışı aç
              </Link>
            ) : null}
            {outletOrders.length > 0 && (
              <div>
                <label className="label">ya da mevcut siparişe bağla</label>
                <select name="sales_order_id" className="input" value={orderId}
                  onChange={e => setOrderId(e.target.value)}>
                  <option value="">Seçiniz…</option>
                  {outletOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      #{o.order_no ?? '—'} · {new Intl.NumberFormat('tr-TR').format(o.total_amount ?? 0)} TL
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* KİMİNLE GÖRÜŞÜLDÜ — tek dokunuş. Karar vericiyle yapılan
            ziyaret ile kapıdan dönülen ziyaret raporda aynı sayılmıyor. */}
        <div>
          <label className="label">Kiminle görüştünüz?</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(AUTHORITY_LABEL).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setAuthority(authority === v ? '' : v)}
                className={chip(authority === v)}>
                {v === 'karar_verir' ? 'Karar verici' : v === 'etkiler' ? 'Etkileyen kişi' : 'Yetkili yoktu'}
              </button>
            ))}
          </div>
          {authority === 'yok' && (
            <p className="text-[12px] text-[#8E8E93] mt-1.5">
              Yetkili yokken yapılan ziyaret hedefe sayılmaz; takip tarihi verin.
            </p>
          )}
        </div>

        <div>
          <label className="label">Not</label>
          <textarea name="customer_comment" rows={2} className="input"
            placeholder="Müşteri ne dedi, ne konuşuldu?" />
        </div>

        {/* ---------- SONRAKİ ADIM (söz varsa açık ve dolu) ---------- */}
        <details open={fupOpen} onToggle={e => setFupOpen((e.target as HTMLDetailsElement).open)}
          className="rounded-xl bg-white/[0.04] px-3 py-2">
          <summary className="cursor-pointer list-none min-h-[32px] flex items-center gap-2">
            <span className="text-[13.5px] font-semibold">Sonraki adım</span>
            <span className="text-[12px] text-[#8E8E93] truncate">
              {fAction ? `${fAction}${fDue ? ' · ' + new Date(fDue + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : ''}` : 'takip yok'}
            </span>
            <ChevronDown size={15} className="text-[#8E8E93] ml-auto shrink-0" />
          </summary>
          <div className="space-y-3 mt-2 pb-1">
            <input name="followup_action" className="input" placeholder="Yapılacak işlem"
              value={fAction} onChange={e => { fTouched.current = true; setFAction(e.target.value); }} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Son tarih</label>
                <input type="date" name="followup_due" className="input"
                  value={fDue} onChange={e => { fTouched.current = true; setFDue(e.target.value); }} />
              </div>
              <div>
                <label className="label">Sorumlu</label>
                <select name="followup_owner" className="input" defaultValue="">
                  <option value="">Ben</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
            </div>
          </div>
        </details>
      </section>

      {/* ---------- KATLANMIŞ: PUANLAMA ---------- */}
      {activeCriteria.length > 0 && (
        <Fold title="Puanlama"
          hint={liveScore !== null ? `ortalama ${liveScore}/5` : `${activeCriteria.length} kriter · 1–5`}>
          <div className="space-y-3">
            {activeCriteria.map(c => (
              <div key={c.id}>
                <p className="text-[13px] text-[#D1D1D6] mb-1.5">{c.label}</p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button"
                      onClick={() => setScores(s => ({ ...s, [c.id]: s[c.id] === n ? 0 : n }))}
                      className={`flex-1 min-h-[44px] rounded-lg py-2 text-[14px] font-semibold transition-colors ${
                        scores[c.id] === n ? 'bg-ios-blue text-white' : 'bg-white/[0.07] text-[#D1D1D6]'
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
                <input type="hidden" name={`score_${c.id}`} value={scores[c.id] || ''} />
              </div>
            ))}
          </div>
        </Fold>
      )}

      {/* ---------- KATLANMIŞ: TADIM ---------- */}
      {products.length > 0 && (
        <Fold title="Tadım" hint={tasted.length ? `${tasted.length} ürün` : 'ürün seçin'}>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {products.map(p => {
                const on = tasted.includes(p.id);
                return (
                  <button key={p.id} type="button"
                    onClick={() => setTasted(s => on ? s.filter(x => x !== p.id) : [...s, p.id])}
                    className={chip(on)}>
                    {on && <Check size={12} className="inline mr-1 -mt-0.5" />}{p.name}
                  </button>
                );
              })}
            </div>

            {tasted.map(pid => {
              const p = products.find(x => x.id === pid)!;
              return (
                <div key={pid} className="rounded-xl bg-white/[0.03] p-3 space-y-2">
                  <input type="hidden" name="tasted" value={pid} />
                  <p className="text-[13.5px] font-medium">
                    {p.name}
                    {p.taste_reference && (
                      <span className="text-[#8E8E93] font-normal"> · {p.taste_reference}</span>
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="block text-[11px] text-[#8E8E93] mb-1">Lezzet 1–5</span>
                      <input name={`taste_${pid}`} inputMode="numeric"
                        className="input !py-2 !text-[14px]" placeholder="—" />
                    </label>
                    <label className="block">
                      <span className="block text-[11px] text-[#8E8E93] mb-1">Karar</span>
                      <select name={`verdict_${pid}`} className="input !py-2 !text-[14px]" defaultValue="">
                        <option value="">—</option>
                        {Object.entries(VERDICT_LABEL).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="block text-[11px] text-[#8E8E93] mb-1">Açılan şişe</span>
                      <input name={`opened_${pid}`} inputMode="numeric"
                        className="input !py-2 !text-[14px]" placeholder="0" />
                    </label>
                    <label className="block">
                      <span className="block text-[11px] text-[#8E8E93] mb-1">Bırakılan kapalı</span>
                      <input name={`sealed_${pid}`} inputMode="numeric"
                        value={sealed[pid] ?? ''}
                        onChange={e => setSealed(m => ({ ...m, [pid]: e.target.value }))}
                        className="input !py-2 !text-[14px]" placeholder="0" />
                    </label>
                  </div>
                  <input name={`verbatim_${pid}`} className="input !py-2 !text-[13px]"
                    placeholder="Müşterinin birebir sözü" />
                </div>
              );
            })}

            {sealedTotal > SEALED_LIMIT && (
              <p className="text-[12.5px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  {sealedTotal} kapalı şişe bırakılıyor — kural ziyaret başına en fazla {SEALED_LIMIT}.
                  Kayda engel değil; numune raporunda işaretlenir.
                </span>
              </p>
            )}

            {tasted.length > 1 && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">En çok tercih edilen</label>
                  <select name="preferred_product_id" className="input" defaultValue="">
                    <option value="">—</option>
                    {tasted.map(pid => (
                      <option key={pid} value={pid}>{products.find(p => p.id === pid)?.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Tercih sebebi</label>
                  <input name="preference_reason" className="input" />
                </div>
              </div>
            )}
          </div>
        </Fold>
      )}

      {/* ---------- KATLANMIŞ: FOTOĞRAF ---------- */}
      <Fold title="Fotoğraf" hint={photos.length ? `${photos.length} fotoğraf` : 'raf, dolap, teşhir'}>
        <div className="space-y-3">
          <label className="btn-outline cursor-pointer w-full justify-center">
            <Camera size={16} /> Fotoğraf çek / seç
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={e => {
                const list = Array.from(e.target.files ?? []);
                setPhotos(p => [...p, ...list].slice(0, MAX_PHOTOS));
                e.target.value = '';
              }} />
          </label>
          {photos.length > 0 && (
            <>
              <ul className="space-y-1">
                {photos.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="truncate text-[#D1D1D6]">{f.name}</span>
                    <button type="button" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}
                      className="text-ios-red text-[12.5px] shrink-0 min-h-[32px] px-2">kaldır</button>
                  </li>
                ))}
              </ul>
              <div>
                <label className="label">Ne fotoğrafı?</label>
                <select className="input" value={photoKind} onChange={e => setPhotoKind(e.target.value)}>
                  <option value="raf">Raf</option>
                  <option value="dolap">Dolap</option>
                  <option value="teshir">Teşhir</option>
                  <option value="tadim">Tadım</option>
                  <option value="diger">Diğer</option>
                </select>
              </div>
            </>
          )}
          <p className="text-[12px] text-[#8E8E93]">
            En fazla {MAX_PHOTOS} fotoğraf. Gönderilmeden önce küçültülür; mobil veride de hızlı yüklenir.
          </p>
        </div>
      </Fold>

      {/* ---------- KATLANMIŞ: AYRINTILAR ---------- */}
      <Fold title="Ayrıntılar" hint="kişi adı, ihtiyaç, çözüm, iç not">
        <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Görüşülen kişi</label>
              <input name="met_person_name" className="input" placeholder="Ad soyad" />
            </div>
            <div>
              <label className="label">Görevi</label>
              <input name="met_person_role" className="input" />
            </div>
          </div>
          <div>
            <label className="label">Asıl ihtiyaç</label>
            <input name="main_need" className="input" />
          </div>
          <div>
            <label className="label">Sunulan çözüm</label>
            <input name="offered_solution" className="input" />
          </div>
          <div>
            <label className="label">Özel not (yalnız ekip görür)</label>
            <textarea name="private_note" rows={2} className="input" />
          </div>
        </div>
      </Fold>

      <div ref={errRef} className="space-y-2">
        {err && <p className="alert-error">{err}</p>}
        <div className="flex gap-2 items-center flex-wrap">
          <button type="submit" disabled={!!blocker || pending}
            className="btn-primary disabled:opacity-40">
            {pending ? (photos.length ? 'Kaydediliyor, fotoğraflar yükleniyor…' : 'Kaydediliyor…') : <><Check size={16} /> Ziyareti kaydet</>}
          </button>
          <button type="button" onClick={saveDraft} disabled={!outletId || pending}
            className="btn-ghost">
            <Save size={15} /> Taslak
          </button>
          {blocker && !pending && (
            <span className="text-[12px] text-amber-300">{blocker}</span>
          )}
        </div>
      </div>
    </form>
  );
}

/**
 * Katlanmış bölüm. Varsayılan kapalı: ziyaretin yüzde doksanında
 * doldurulmayan alanlar ekranı uzatıp "form çok zor" algısı yaratıyordu.
 */
function Fold({
  title, hint, children
}: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <details>
        <summary className="flex items-center gap-2 cursor-pointer list-none">
          <span className="text-[14px] font-semibold">{title}</span>
          {hint && <span className="text-[12px] text-[#8E8E93] truncate">{hint}</span>}
          <ChevronDown size={16} className="text-[#8E8E93] ml-auto shrink-0" />
        </summary>
        <div className="mt-4">{children}</div>
      </details>
    </section>
  );
}
