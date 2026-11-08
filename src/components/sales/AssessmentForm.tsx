'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveAssessment } from '@/app/(app)/sales/actions';
import { SCALE_LABEL } from '@/lib/sales-types';

interface Criterion { id: string; label: string; scale_min: number; scale_max: number }

/** Ortak ölçek: 1–5, artı "bilinmiyor" (boş). */
const OPTIONS = [
  ...[1, 2, 3, 4, 5].map(n => ({ v: String(n), label: SCALE_LABEL[n] })),
  { v: '', label: 'Bilinmiyor' }
];

export default function AssessmentForm({
  outletId, criteria, defaults
}: {
  outletId: string;
  criteria: Criterion[];
  defaults?: { contact_name?: string | null; preferred_contact_time?: string | null; customer_profile?: string | null };
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});

  // Canlı toplam — veritabanındaki formülün birebir aynısı.
  // Yüzde ölçeğin TABANINI dikkate alır: (toplam − taban) / (tavan − taban).
  // 1–5 ölçeğinde hepsine 1 vermek %0, hepsine 5 vermek %100 eder.
  // Yanıtlanmayan kriter paydaya girmez: bilgi eksikliği puanı düşürmemeli.
  const live = useMemo(() => {
    let raw = 0, max = 0, min = 0, answered = 0;
    for (const c of criteria) {
      const v = scores[c.id];
      if (v === undefined || v === '') continue;
      raw += Number(v); max += c.scale_max; min += c.scale_min; answered++;
    }
    const span = max - min;
    const pct = span > 0 ? Math.round(((raw - min) / span) * 1000) / 10 : null;
    const priority = pct === null ? null : pct >= 80 ? 'A' : pct >= 50 ? 'B' : 'C';
    return { raw, max, answered, pct, priority };
  }, [scores, criteria]);

  if (!criteria.length) {
    return <p className="text-[13px] text-[#8E8E93]">Puanlama kriterleri tanımlı değil (Ayarlar).</p>;
  }

  async function onSubmit(fd: FormData) {
    setErr(null);
    start(async () => {
      const r = await saveAssessment(fd);
      if (r?.error) { setErr(r.error); return; }
      setOpen(false); setScores({});
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-outline w-full">
        Yeni değerlendirme yap
      </button>
    );
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <input type="hidden" name="outlet_id" value={outletId} />
      {err && <p className="alert-error">{err}</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Yetkili / rol</label>
          <input name="contact_name" className="input" placeholder="İşletme sahibi" />
        </div>
        <div>
          <label className="label">Uygun görüşme saati</label>
          <input name="preferred_contact_time" className="input"
            defaultValue={defaults?.preferred_contact_time ?? ''} placeholder="Sabah 08:00–10:00" />
        </div>
      </div>
      <div>
        <label className="label">Müşteri profili / mevcut içecekler / ihtiyaç</label>
        <textarea name="customer_profile" rows={2} className="input"
          defaultValue={defaults?.customer_profile ?? ''} />
      </div>

      <div className="space-y-3">
        {criteria.map(c => (
          <div key={c.id} className="rounded-xl bg-white/[0.03] p-3 space-y-2">
            <p className="text-[14px] font-medium">{c.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {OPTIONS.map(o => {
                const active = (scores[c.id] ?? '') === o.v && scores[c.id] !== undefined;
                return (
                  <button key={o.v || 'none'} type="button"
                    onClick={() => setScores(s => ({ ...s, [c.id]: o.v }))}
                    className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                      active ? 'bg-ios-blue text-white' : 'bg-white/[0.07] text-[#D1D1D6] hover:bg-white/[0.12]'
                    }`}>
                    {o.v !== '' ? `${o.v} · ` : ''}{o.label}
                  </button>
                );
              })}
            </div>
            <input type="hidden" name={`score_${c.id}`} value={scores[c.id] ?? ''} />
            <input name={`evidence_${c.id}`} className="input !py-2 !text-[13px]"
              placeholder="Gözlem / kanıt" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.05] px-4 py-3">
        <div>
          <p className="text-[13px] text-[#8E8E93]">
            {live.answered}/{criteria.length} kriter yanıtlandı
          </p>
          <p className="text-xl font-bold tabular-nums">
            {live.raw}<span className="text-[#8E8E93] text-base">/{live.max || 0}</span>
            {live.pct !== null && <span className="text-[#8E8E93] text-base ml-2">%{live.pct}</span>}
          </p>
        </div>
        {live.priority && (
          <span className={`badge text-base px-3 py-1.5 ${
            live.priority === 'A' ? 'bg-emerald-500/20 text-emerald-300'
            : live.priority === 'B' ? 'bg-blue-500/20 text-blue-300'
            : 'bg-white/10 text-[#AEAEB2]'}`}>
            Öncelik {live.priority}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary">Değerlendirmeyi kaydet</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Vazgeç</button>
      </div>
    </form>
  );
}
