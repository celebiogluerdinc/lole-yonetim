'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { saveVisit } from '@/app/(app)/sales/actions';
import {
  VISIT_TYPE_LABEL, OUTCOME_LABEL, AUTHORITY_LABEL, VERDICT_LABEL
} from '@/lib/sales-types';

interface OutletLite { id: string; name: string; city: string | null; district: string | null; status: string }
interface ProductLite { id: string; name: string; taste_reference: string | null }
interface BatchLite { id: string; product_id: string; batch_no: string; expiry_date: string | null }
interface CriterionLite { id: string; label: string; grp: string; applies_to: string }
interface ReasonLite { id: string; label: string; requires_note: boolean }
interface PersonLite { id: string; full_name: string }
interface OrderLite { id: string; order_no: number | null; total_amount: number | null; outlet_id: string }

/**
 * ZİYARET FORMU (F03 + F04)
 *
 * Beş adım, tek sayfa değil. Temsilci bunu sahada ayakta, acele ederek
 * dolduruyor; tek uzun form yarım kalır. Adımlar arası geçiş veri
 * kaybetmez — hepsi aynı <form> içinde, yalnızca görünürlük değişir.
 */
const STEPS = ['Nokta & Kişi', 'İhtiyaç & Çözüm', 'Tadım', 'Puanlama', 'Sonuç'] as const;

export default function VisitForm({
  outlets, products, batches, criteria, reasons, people, preselectedOutlet, today, orders = []
}: {
  outlets: OutletLite[];
  products: ProductLite[];
  batches: BatchLite[];
  criteria: CriterionLite[];
  reasons: ReasonLite[];
  people: PersonLite[];
  preselectedOutlet?: string;
  today: string;
  orders?: OrderLite[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const [outletId, setOutletId] = useState(preselectedOutlet ?? '');
  const [q, setQ] = useState('');
  const [outcome, setOutcome] = useState<string>('takip');
  const [tasted, setTasted] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [objStated, setObjStated] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const draftRef = useRef<HTMLInputElement>(null);

  const outlet = outlets.find(o => o.id === outletId);
  const outletOrders = useMemo(
    () => orders.filter(o => o.outlet_id === outletId),
    [orders, outletId]
  );
  const isProspect = !outlet || outlet.status === 'aday';

  // Aday noktada "Saha İcra" kriterleri sorulmaz — henüz rafta ürün yok.
  const activeCriteria = useMemo(
    () => criteria.filter(c => c.applies_to === 'hepsi' || c.applies_to === (isProspect ? 'aday' : 'musteri')),
    [criteria, isProspect]
  );

  const filteredOutlets = useMemo(() => {
    const t = q.toLocaleLowerCase('tr-TR');
    return outlets
      .filter(o => !t || [o.name, o.city, o.district].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR').includes(t))
      .slice(0, 30);
  }, [outlets, q]);

  const liveScore = useMemo(() => {
    const vals = activeCriteria.map(c => scores[c.id]).filter(v => typeof v === 'number') as number[];
    if (!vals.length) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }, [scores, activeCriteria]);

  const canNext = step !== 0 || !!outletId;

  function submit(fd: FormData) {
    setErr(null);
    start(async () => {
      const r = await saveVisit(fd);
      if (r?.error) { setErr(r.error); return; }
      router.push('/sales/visits');
      router.refresh();
    });
  }

  /** Taslak: gizli alanı 0 yapıp formu normal yoldan gönderiyoruz.
   *  Buton üzerinde formAction kullanmak React sürümüne bağımlı; bu değil. */
  function saveDraft() {
    if (draftRef.current) draftRef.current.value = '0';
    formRef.current?.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      action={submit}
      className="max-w-3xl mx-auto p-4 md:p-8 space-y-5"
    >
      <input ref={draftRef} type="hidden" name="submit" defaultValue="1" />
      <header className="px-1">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">Yeni Ziyaret</h1>
        <p className="text-[14px] text-[#8E8E93]">{outlet ? outlet.name : 'Nokta seçin'}</p>
      </header>

      {/* adım göstergesi */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {STEPS.map((s, idx) => (
          <button key={s} type="button" onClick={() => idx === 0 || outletId ? setStep(idx) : null}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              idx === step ? 'bg-ios-blue text-white'
              : idx < step ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-[#1C1C1E] text-[#8E8E93]'
            }`}>
            {idx + 1}. {s}
          </button>
        ))}
      </div>

      {err && <p className="alert-error">{err}</p>}

      <input type="hidden" name="outlet_id" value={outletId} />
      <input type="hidden" name="outcome" value={outcome} />

      {/* ---------- 1 · NOKTA & KİŞİ ---------- */}
      <section className={step === 0 ? 'card p-5 space-y-4' : 'hidden'}>
        {!preselectedOutlet && (
          <div>
            <label className="label">Nokta *</label>
            <input value={q} onChange={e => setQ(e.target.value)} className="input"
              placeholder="Nokta ara…" />
            <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-white/[0.08] divide-y divide-white/[0.06]">
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
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Tarih *</label>
            <input type="date" name="visit_date" required defaultValue={today} className="input" />
          </div>
          <div>
            <label className="label">Ziyaret tipi</label>
            <select name="visit_type" className="input" defaultValue={isProspect ? 'ilk_ziyaret' : 'rutin'}>
              {Object.entries(VISIT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Görüşülen kişi</label>
            <input name="met_person_name" className="input" />
          </div>
          <div>
            <label className="label">Görevi</label>
            <input name="met_person_role" className="input" />
          </div>
        </div>

        <div>
          <label className="label">Karar yetkisi</label>
          <select name="met_decision_authority" className="input" defaultValue="">
            <option value="">Bilinmiyor</option>
            {Object.entries(AUTHORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <p className="text-[12px] text-[#8E8E93] mt-1">
            Karar verici yoksa bu ziyaret hedefe sayılmaz — randevu alıp tarihi not edin.
          </p>
        </div>
      </section>

      {/* ---------- 2 · İHTİYAÇ & ÇÖZÜM ---------- */}
      <section className={step === 1 ? 'card p-5 space-y-4' : 'hidden'}>
        <div>
          <label className="label">Asıl ihtiyaç (servis, dolap, menü, ödeme koşulları)</label>
          <textarea name="main_need" rows={3} className="input" />
        </div>
        <div>
          <label className="label">Sunulan çözüm / önerilen ürünler</label>
          <textarea name="offered_solution" rows={3} className="input" />
        </div>
        <div>
          <label className="label">İşletmenin yorumu</label>
          <textarea name="outlet_comment" rows={2} className="input" />
        </div>

        <div className="rounded-xl bg-white/[0.03] p-3 space-y-3">
          <p className="text-[14px] font-medium">İtiraz</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Beyan edilen itiraz</label>
              <select name="objection_stated_id" className="input" value={objStated}
                onChange={e => setObjStated(e.target.value)}>
                <option value="">Yok</option>
                {reasons.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Gerçek neden (değerlendirmeniz)</label>
              <select name="objection_real_id" className="input" defaultValue="">
                <option value="">Belirtilmedi</option>
                {reasons.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <p className="text-[12px] text-[#8E8E93]">
            Söylenen ile gerçek neden çoğu zaman farklıdır. İkisini ayrı tutmak,
            fiyat kararı ile tedarikçi bağı sorununu birbirinden ayırmayı sağlar.
          </p>
          <input name="objection_note" className="input !py-2 !text-[13px]" placeholder="Kısa açıklama" />
          <div>
            <label className="label">Verdiğimiz yanıt</label>
            <textarea name="our_answer" rows={2} className="input" />
          </div>
        </div>
      </section>

      {/* ---------- 3 · TADIM (F04) ---------- */}
      <section className={step === 2 ? 'card p-5 space-y-4' : 'hidden'}>
        <p className="text-[13px] text-[#8E8E93]">
          Tadım yapılan ürünleri işaretleyin. Müşterinin sözünü <strong>kendi ifadesiyle</strong> yazın —
          özetlemeyin; raporda alıntı olarak çıkacak.
        </p>

        {products.map(p => {
          const on = tasted.includes(p.id);
          const pBatches = batches.filter(b => b.product_id === p.id);
          return (
            <div key={p.id} className="rounded-xl bg-white/[0.03] p-3 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" name="tasted" value={p.id} checked={on}
                  onChange={e => setTasted(s => e.target.checked ? [...s, p.id] : s.filter(x => x !== p.id))}
                  className="mt-1" />
                <span>
                  <span className="text-[15px] font-medium">{p.name}</span>
                  {p.taste_reference && (
                    <span className="block text-[12px] text-[#8E8E93]">Tat referansı: {p.taste_reference}</span>
                  )}
                </span>
              </label>

              {on && (
                <div className="space-y-3 pl-7">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="label !text-[12px]">Parti</label>
                      <select name={`batch_${p.id}`} className="input !py-2 !text-[13px]" defaultValue="">
                        <option value="">Seçilmedi</option>
                        {pBatches.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.batch_no}{b.expiry_date ? ` · ${b.expiry_date}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label !text-[12px]">Açılan şişe</label>
                      <input type="number" min={0} name={`opened_${p.id}`} defaultValue={0}
                        className="input !py-2 !text-[13px]" />
                    </div>
                    <div>
                      <label className="label !text-[12px]">Bırakılan kapalı</label>
                      <input type="number" min={0} name={`sealed_${p.id}`} defaultValue={0}
                        className="input !py-2 !text-[13px]" />
                    </div>
                    <div>
                      <label className="label !text-[12px]">Karar</label>
                      <select name={`verdict_${p.id}`} className="input !py-2 !text-[13px]" defaultValue="">
                        <option value="">—</option>
                        {Object.entries(VERDICT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[['taste', 'Lezzet'], ['pack', 'Ambalaj'], ['price', 'Fiyat algısı']].map(([k, lbl]) => (
                      <div key={k}>
                        <label className="label !text-[12px]">{lbl}</label>
                        <select name={`${k}_${p.id}`} className="input !py-2 !text-[13px]" defaultValue="">
                          <option value="">—</option>
                          {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>

                  <input name={`verbatim_${p.id}`} className="input !py-2 !text-[13px]"
                    placeholder="Müşterinin kendi sözü (birebir)" />
                </div>
              )}
            </div>
          );
        })}

        {tasted.length > 0 && (
          <div className="rounded-xl bg-white/[0.03] p-3 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">En çok tercih edilen</label>
                <select name="preferred_product_id" className="input" defaultValue="">
                  <option value="">—</option>
                  {products.filter(p => tasted.includes(p.id)).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Eşleşebilecek menü</label>
                <input name="menu_match" className="input" />
              </div>
            </div>
            <input name="preference_reason" className="input !py-2 !text-[13px]" placeholder="Tercih gerekçesi" />
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Teslim alan</label>
                <input name="received_by" className="input" />
              </div>
              <div>
                <label className="label">Kullanılmayan ürünün akıbeti</label>
                <select name="unused_disposition" className="input" defaultValue="">
                  <option value="">—</option>
                  <option value="isletmede_kapali">İşletmede bırakıldı (kapalı)</option>
                  <option value="tuketildi">Tüketildi</option>
                  <option value="geri_alindi">Temsilci geri aldı</option>
                  <option value="imha">İmha edildi</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ---------- 4 · PUANLAMA ---------- */}
      <section className={step === 3 ? 'card p-5 space-y-4' : 'hidden'}>
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-[#8E8E93]">
            {isProspect ? 'Aday nokta — saha icra kriterleri sorulmaz.' : 'Aktif müşteri'}
          </p>
          {liveScore !== null && (
            <span className="badge bg-ios-blue/20 text-ios-blue text-base px-3 py-1.5 tabular-nums">
              {liveScore}/5
            </span>
          )}
        </div>

        {activeCriteria.map(c => (
          <div key={c.id} className="space-y-1.5">
            <p className="text-[14px]">{c.label}</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} type="button"
                  onClick={() => setScores(s => ({ ...s, [c.id]: n }))}
                  className={`flex-1 rounded-lg py-2.5 text-[15px] font-semibold transition-colors ${
                    scores[c.id] === n ? 'bg-ios-blue text-white' : 'bg-white/[0.07] text-[#D1D1D6] hover:bg-white/[0.12]'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
            <input type="hidden" name={`score_${c.id}`} value={scores[c.id] ?? ''} />
          </div>
        ))}
      </section>

      {/* ---------- 5 · SONUÇ & TAKİP ---------- */}
      <section className={step === 4 ? 'card p-5 space-y-4' : 'hidden'}>
        <div>
          <label className="label">Sonuç *</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(OUTCOME_LABEL).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setOutcome(v)}
                className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  outcome === v ? 'bg-ios-blue text-white' : 'bg-white/[0.07] text-[#D1D1D6]'
                }`}>
                {l}
              </button>
            ))}
          </div>
          {outcome === 'siparis' && (
            <div className="mt-2 space-y-2">
              {outletOrders.length > 0 ? (
                <>
                  <label className="label">Bağlanacak sipariş *</label>
                  <select name="sales_order_id" className="input" defaultValue="">
                    <option value="">Seçiniz…</option>
                    {outletOrders.map(o => (
                      <option key={o.id} value={o.id}>
                        #{o.order_no ?? '—'} · {new Intl.NumberFormat('tr-TR').format(o.total_amount ?? 0)} TL
                      </option>
                    ))}
                  </select>
                  <p className="text-[12px] text-[#8E8E93]">
                    Ziyaret "sipariş" olarak kapatılabilmesi için sipariş kaydına bağlanmalı.
                  </p>
                </>
              ) : (
                <p className="text-[12px] text-amber-300">
                  Bu nokta için henüz sipariş kaydı yok. Önce Teklif &amp; Sipariş bölümünden
                  siparişi oluşturun, sonra bu ziyarete bağlayın. Şimdilik taslak kaydedebilirsiniz.
                </p>
              )}
            </div>
          )}
          {outcome === 'olumsuz' && !objStated && (
            <p className="text-[12px] text-rose-300 mt-2">
              Olumsuz sonuç için 2. adımda itiraz nedeni seçmelisiniz.
            </p>
          )}
        </div>

        <div>
          <label className="label">Müşteri görüşü</label>
          <textarea name="customer_comment" rows={2} className="input" />
        </div>
        <div>
          <label className="label">Özel not (yalnızca iç kullanım)</label>
          <textarea name="private_note" rows={2} className="input" />
        </div>

        <div className="rounded-xl bg-white/[0.03] p-3 space-y-3">
          <p className="text-[14px] font-medium">Sonraki adım ve kontrol</p>
          <input name="followup_action" className="input" placeholder="Yapılacak işlem" />
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Tek sorumlu</label>
              <select name="followup_owner" className="input" defaultValue="">
                <option value="">Ben</option>
                {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Son tarih</label>
              <input type="date" name="followup_due" className="input" />
            </div>
          </div>
        </div>
      </section>

      {/* gezinme */}
      <div className="flex items-center justify-between gap-2">
        <button type="button" disabled={step === 0} onClick={() => setStep(s => s - 1)}
          className="btn-ghost disabled:opacity-30">
          <ChevronLeft size={16} /> Geri
        </button>

        <div className="flex gap-2">
          <button type="button" onClick={saveDraft} disabled={!outletId || pending}
            className="btn-outline">
            Taslak kaydet
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" disabled={!canNext} onClick={() => setStep(s => s + 1)}
              className="btn-primary disabled:opacity-40">
              İleri <ChevronRight size={16} />
            </button>
          ) : (
            <button type="submit" disabled={!outletId || pending} className="btn-primary"
              onClick={() => { if (draftRef.current) draftRef.current.value = '1'; }}>
              {pending ? 'Kaydediliyor…' : 'Ziyareti gönder'}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
