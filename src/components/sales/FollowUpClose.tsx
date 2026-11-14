'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { closeFollowUp } from '@/app/(app)/sales/actions';
import { FOLLOWUP_RESULT_LABEL } from '@/lib/sales-types';

type Result = 'kazanildi' | 'devam' | 'kaybedildi';

/**
 * TAKİBİ YERİNDE KAPAT
 *
 * Bugün ekranında ve Takipler listesinde aynı bileşen. Eskiden geciken
 * takibi gören temsilci kapatmak için ayrı ekrana gidiyordu; söz verilen
 * iş yapıldığı an, görüldüğü yerde kapanmalı.
 *
 * Kanıt zorunlu (kanıtsız kapanış kapanmamış takiple aynı şeydir).
 * Sonuç isteğe bağlı ama tek dokunuş: "kaybedildi" seçilince sebep
 * sorulur — itiraz analizinin kör noktası, ziyaretten haftalar sonra
 * kaybedilen noktaların hiçbir sebebe bağlanmamasıydı.
 */
export default function FollowUpClose({
  id, reasons, onCancel, onDone
}: {
  id: string;
  reasons: { id: string; label: string }[];
  onCancel: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [evidence, setEvidence] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  function submit() {
    setErr(null);
    start(async () => {
      let r: { ok?: boolean; error?: string } | undefined;
      try {
        r = await closeFollowUp(id, evidence, result, result === 'kaybedildi' ? (reason || null) : null);
      } catch {
        setErr('İşlem tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.');
        return;
      }
      if (r?.error) { setErr(r.error); return; }
      onDone?.();
      router.refresh();
    });
  }

  const chip = (on: boolean, tone: string) =>
    `min-h-[44px] rounded-lg px-3 text-[13px] font-semibold transition-colors ${
      on ? tone : 'bg-white/[0.07] text-[#D1D1D6]'}`;

  return (
    <div className="space-y-2.5 rounded-xl bg-white/[0.04] p-3">
      <input value={evidence} onChange={e => setEvidence(e.target.value)} autoFocus
        className="input" placeholder="Ne yapıldı? (kapanış kanıtı — zorunlu)" />

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setResult(result === 'kazanildi' ? null : 'kazanildi')}
          className={chip(result === 'kazanildi', 'bg-emerald-500/20 text-emerald-300')}>
          {FOLLOWUP_RESULT_LABEL.kazanildi}
        </button>
        <button type="button" onClick={() => setResult(result === 'devam' ? null : 'devam')}
          className={chip(result === 'devam', 'bg-ios-blue/20 text-ios-blue')}>
          {FOLLOWUP_RESULT_LABEL.devam}
        </button>
        <button type="button" onClick={() => setResult(result === 'kaybedildi' ? null : 'kaybedildi')}
          className={chip(result === 'kaybedildi', 'bg-rose-500/20 text-rose-300')}>
          {FOLLOWUP_RESULT_LABEL.kaybedildi}
        </button>
      </div>

      {result === 'kaybedildi' && (
        <select value={reason} onChange={e => setReason(e.target.value)} className="input">
          <option value="">Kayıp sebebi…</option>
          {reasons.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      )}

      {err && <p className="text-[12.5px] text-rose-300">{err}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={submit}
          disabled={pending || evidence.trim().length < 3}
          className="btn-primary disabled:opacity-40">
          <Check size={15} /> {pending ? 'Kapatılıyor…' : 'Takibi kapat'}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">Vazgeç</button>
      </div>
    </div>
  );
}
