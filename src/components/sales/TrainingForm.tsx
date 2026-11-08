'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Check, AlertTriangle } from 'lucide-react';
import { saveTraining } from '@/app/(app)/sales/execution/actions';

interface OutletLite { id: string; name: string; district: string | null }

/** F08'in beş kontrolü — form bunları adıyla sayıyor, kabul 5/5. */
const CHECKS = [
  { key: 'chk_taste_match', label: 'Tat eşleşmesi' },
  { key: 'chk_recommend', label: 'Öneri' },
  { key: 'chk_label', label: 'Etiket' },
  { key: 'chk_service', label: 'Servis' },
  { key: 'chk_report', label: 'Bildirim' }
] as const;

interface Row { name: string; role: string; shift: string; checks: Record<string, boolean> }

const emptyRow = (): Row => ({
  name: '', role: '', shift: '',
  checks: Object.fromEntries(CHECKS.map(c => [c.key, false]))
});

/**
 * F08 — Garson ve satış personeli eğitimi.
 * 15 dakika; katılımcı beş kontrolün hepsini geçmeden eğitimli sayılmaz.
 */
export default function TrainingForm({
  outlets, onDone
}: { outlets: OutletLite[]; onDone?: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);

  const passedCount = useMemo(
    () => rows.filter(r => r.name.trim() && CHECKS.every(c => r.checks[c.key])).length,
    [rows]
  );
  const namedCount = rows.filter(r => r.name.trim()).length;
  const failing = namedCount - passedCount;

  function toggle(idx: number, key: string) {
    setRows(rs => rs.map((r, i) =>
      i === idx ? { ...r, checks: { ...r.checks, [key]: !r.checks[key] } } : r));
  }
  function setField(idx: number, field: 'name' | 'role' | 'shift', v: string) {
    setRows(rs => rs.map((r, i) => i === idx ? { ...r, [field]: v } : r));
  }

  function onSubmit(fd: FormData) {
    setErr(null);
    start(async () => {
      const r = await saveTraining(fd);
      if (r?.error) { setErr(r.error); return; }
      onDone?.();
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      {err && <p className="alert-error">{err}</p>}

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
          <label className="label">Süre (dk)</label>
          <input type="number" min={5} max={120} name="duration_min" defaultValue={15} className="input" />
        </div>
      </div>

      <div>
        <label className="label">İşletme eğitim sorumlusu</label>
        <input name="outlet_training_owner" className="input" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-medium">Katılımcılar</p>
          <span className="text-[13px] text-[#8E8E93]">Kabul: 5/5</span>
        </div>

        {rows.map((r, idx) => {
          const ok = r.name.trim() !== '' && CHECKS.every(c => r.checks[c.key]);
          return (
            <div key={idx} className="rounded-xl bg-white/[0.03] p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid sm:grid-cols-3 gap-2">
                  <input name="p_name" value={r.name}
                    onChange={e => setField(idx, 'name', e.target.value)}
                    className="input !py-2 !text-[13px]" placeholder="Ad soyad" />
                  <input name="p_role" value={r.role}
                    onChange={e => setField(idx, 'role', e.target.value)}
                    className="input !py-2 !text-[13px]" placeholder="Görev" />
                  <input name="p_shift" value={r.shift}
                    onChange={e => setField(idx, 'shift', e.target.value)}
                    className="input !py-2 !text-[13px]" placeholder="Vardiya" />
                </div>
                {rows.length > 1 && (
                  <button type="button" onClick={() => setRows(rs => rs.filter((_, i) => i !== idx))}
                    className="text-[#8E8E93] p-2 shrink-0"><Trash2 size={15} /></button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CHECKS.map(c => (
                  <button key={c.key} type="button" onClick={() => toggle(idx, c.key)}
                    className={`rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                      r.checks[c.key]
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-white/[0.07] text-[#8E8E93]'
                    }`}>
                    {r.checks[c.key] ? '✓ ' : ''}{c.label}
                  </button>
                ))}
              </div>
              {CHECKS.map(c => (
                <input key={c.key} type="hidden" name={`${c.key}_${idx}`}
                  value={r.checks[c.key] ? 'gecti' : 'tekrar'} />
              ))}

              {r.name.trim() && (
                <p className={`text-[12px] flex items-center gap-1 ${ok ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {ok ? <><Check size={12} /> 5/5 — eğitimli</>
                      : <><AlertTriangle size={12} /> {CHECKS.filter(c => !r.checks[c.key]).length} konu tekrar</>}
                </p>
              )}
            </div>
          );
        })}

        <button type="button" onClick={() => setRows(rs => [...rs, emptyRow()])}
          className="btn-ghost text-sm"><Plus size={15} /> Katılımcı ekle</button>
      </div>

      {namedCount > 0 && (
        <div className="rounded-xl bg-white/[0.05] px-4 py-3 text-sm">
          <strong className="tabular-nums">{passedCount}/{namedCount}</strong> katılımcı 5/5 aldı
          {failing > 0 && <span className="text-amber-300"> · {failing} kişi için tekrar eğitim gerekiyor</span>}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Eksik konu</label>
          <input name="missing_topics" className="input" />
        </div>
        <div>
          <label className="label">Tekrar eğitim tarihi</label>
          <input type="date" name="retrain_date" className="input" />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Katılmayan vardiya</label>
          <input name="absent_shift" className="input" />
        </div>
        <div>
          <label className="label">Bırakılan tat kartı / materyal</label>
          <input name="materials_left" className="input" />
        </div>
      </div>

      <div>
        <label className="label">İşletme sorumlusu kabulü</label>
        <input name="owner_accepted_by" className="input" placeholder="Kabul eden kişi" />
      </div>

      <button type="submit" disabled={pending} className="btn-primary">
        {pending ? 'Kaydediliyor…' : 'Eğitimi kaydet'}
      </button>
    </form>
  );
}
