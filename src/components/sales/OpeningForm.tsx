'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check } from 'lucide-react';
import { saveOpening } from '@/app/(app)/sales/execution/actions';

interface CheckItem { id: string; label: string; is_critical: boolean }
interface OutletLite { id: string; name: string; city: string | null; district: string | null }
interface PersonLite { id: string; full_name: string }

type Answer = 'evet' | 'hayir' | 'uygulanmaz';

const ANSWERS: { v: Answer; label: string; cls: string }[] = [
  { v: 'evet', label: 'Evet', cls: 'bg-emerald-500/20 text-emerald-300' },
  { v: 'hayir', label: 'Hayır', cls: 'bg-rose-500/20 text-rose-300' },
  { v: 'uygulanmaz', label: 'Uygulanmaz', cls: 'bg-white/10 text-[#AEAEB2]' }
];

/**
 * F07 — Satış noktası açılış kontrolü.
 *
 * Formun kuralı: "Tüm kritik koşullar tamamlanmadan satışa hazır olarak kapatma."
 * Arayüz bunu önceden engelliyor; veritabanı da ayrıca zorluyor. İki katman,
 * çünkü kuralın atlanması teslim edilmiş ama satılamayan ürün demek.
 */
export default function OpeningForm({
  outlets, items, people, onDone
}: {
  outlets: OutletLite[]; items: CheckItem[]; people: PersonLite[]; onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<'satisa_hazir' | 'eksik_var' | 'ertelendi'>('eksik_var');

  const blocking = useMemo(
    () => items.filter(i => i.is_critical && answers[i.id] !== 'evet' && answers[i.id] !== 'uygulanmaz'),
    [items, answers]
  );
  const canBeReady = blocking.length === 0;

  function onSubmit(fd: FormData) {
    setErr(null);
    start(async () => {
      const r = await saveOpening(fd);
      if (r?.error) { setErr(r.error); return; }
      onDone?.();
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {err && <p className="alert-error">{err}</p>}
      <input type="hidden" name="result" value={canBeReady ? result : (result === 'satisa_hazir' ? 'eksik_var' : result)} />

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Nokta *</label>
          <select name="outlet_id" required className="input" defaultValue="">
            <option value="" disabled>Seçin…</option>
            {outlets.map(o => (
              <option key={o.id} value={o.id}>
                {o.name}{o.district ? ` · ${o.district}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Sipariş / teslim belgesi no</label>
          <input name="delivery_doc_no" className="input" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">İşletme sorumlusu</label>
          <input name="outlet_manager" className="input" />
        </div>
        <div>
          <label className="label">Vardiya</label>
          <input name="shift" className="input" />
        </div>
      </div>

      <div className="space-y-2">
        {items.map(it => {
          const a = answers[it.id];
          return (
            <div key={it.id} className="rounded-xl bg-white/[0.03] p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[14px] font-medium">{it.label}</p>
                {it.is_critical && (
                  <span className="badge bg-amber-500/15 text-amber-300 shrink-0">kritik</span>
                )}
              </div>
              <div className="flex gap-1.5">
                {ANSWERS.map(opt => (
                  <button key={opt.v} type="button"
                    onClick={() => setAnswers(s => ({ ...s, [it.id]: opt.v }))}
                    className={`flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition-colors ${
                      a === opt.v ? opt.cls : 'bg-white/[0.07] text-[#D1D1D6] hover:bg-white/[0.12]'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <input type="hidden" name={`ans_${it.id}`} value={a ?? ''} />

              {a === 'hayir' && (
                <div className="space-y-2 pt-1">
                  <input name={`miss_${it.id}`} className="input !py-2 !text-[13px]"
                    placeholder="Eksik ne?" />
                  <div className="grid grid-cols-2 gap-2">
                    <select name={`owner_${it.id}`} className="input !py-2 !text-[13px]" defaultValue="">
                      <option value="">Sorumlu seç</option>
                      {people.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                    </select>
                    <input type="date" name={`due_${it.id}`} className="input !py-2 !text-[13px]" />
                  </div>
                  <p className="text-[12px] text-[#8E8E93]">
                    Sorumlu ve tarih girilirse otomatik takip kaydı açılır.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <label className="label">Sonuç</label>
        <div className="flex flex-wrap gap-1.5">
          {([
            ['satisa_hazir', 'Satışa hazır'],
            ['eksik_var', 'Eksik var'],
            ['ertelendi', 'Açılış ertelendi']
          ] as const).map(([v, l]) => {
            const disabled = v === 'satisa_hazir' && !canBeReady;
            return (
              <button key={v} type="button" disabled={disabled}
                onClick={() => setResult(v)}
                className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                  result === v ? 'bg-ios-blue text-white'
                  : disabled ? 'bg-white/[0.04] text-[#48484A] cursor-not-allowed'
                  : 'bg-white/[0.07] text-[#D1D1D6]'
                }`}>
                {l}
              </button>
            );
          })}
        </div>

        {!canBeReady ? (
          <p className="text-[13px] text-amber-300 mt-2 flex items-start gap-1.5">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {blocking.length} kritik kontrol tamamlanmadı — açılış "satışa hazır" kapatılamaz:{' '}
              {blocking.map(b => b.label).join(', ')}
            </span>
          </p>
        ) : (
          <p className="text-[13px] text-emerald-300 mt-2 flex items-center gap-1.5">
            <Check size={14} /> Tüm kritik kontroller tamam.
          </p>
        )}
      </div>

      <div>
        <label className="label">Not</label>
        <textarea name="note" rows={2} className="input" />
      </div>

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Kaydediliyor…' : 'Açılışı kaydet'}
      </button>
    </form>
  );
}
