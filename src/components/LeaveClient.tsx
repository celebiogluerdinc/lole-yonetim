'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ThumbsUp, ThumbsDown } from 'lucide-react';
import { requestLeave, decideLeave, cancelLeave } from '@/app/(app)/hr/actions';

interface Req {
  id: string; user_id: string; type: string; start_date: string; end_date: string;
  reason: string | null; status: string; decision_note: string | null;
  profiles?: { full_name: string } | null;
}

const TYPE_LABEL: Record<string, string> = {
  annual: '🏖 Yıllık izin', sick: '🤒 Hastalık', unpaid: '📄 Ücretsiz', other: '📌 Diğer'
};
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Bekliyor', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Onaylandı', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Reddedildi', cls: 'bg-rose-100 text-rose-700' },
  cancelled: { label: 'İptal', cls: 'bg-slate-100 text-slate-400' }
};

const fd = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });

export default function LeaveClient({
  requests, meId, isManager
}: { requests: Req[]; meId: string; isManager: boolean }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  const run = (fn: () => Promise<any>) => start(async () => {
    setError(null);
    const r = await fn();
    if (r?.error) setError(r.error);
    else router.refresh();
  });

  const pendingTeam = requests.filter(r => r.status === 'pending' && r.user_id !== meId);
  const mine = requests.filter(r => r.user_id === meId);
  const others = requests.filter(r => r.user_id !== meId && r.status !== 'pending');

  return (
    <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-5">
      <header className="px-1 flex items-end justify-between">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">İzinler</h1>
          <p className="text-[14px] text-[#8E8E93]">{isManager ? 'Talepler ve ekip izinleri' : 'İzin talepleriniz'}</p>
        </div>
        <button onClick={() => setOpen(v => !v)} className="btn-primary"><Plus size={16} /> İzin Talep Et</button>
      </header>

      {error && <p className="text-[13px] text-ios-red bg-rose-50 rounded-xl px-3 py-2">{error}</p>}

      {open && (
        <form
          ref={ref}
          action={(f) => run(async () => {
            const r = await requestLeave(f);
            if (!r?.error) { ref.current?.reset(); setOpen(false); }
            return r;
          })}
          className="card p-4 space-y-3 border border-ios-blue/20"
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Tür</label>
              <select name="type" className="input">
                <option value="annual">Yıllık izin</option>
                <option value="sick">Hastalık</option>
                <option value="unpaid">Ücretsiz izin</option>
                <option value="other">Diğer</option>
              </select>
            </div>
            <div>
              <label className="label">Başlangıç</label>
              <input name="start_date" type="date" required className="input" />
            </div>
            <div>
              <label className="label">Bitiş</label>
              <input name="end_date" type="date" required className="input" />
            </div>
          </div>
          <input name="reason" className="input" placeholder="Açıklama (opsiyonel)" />
          <button className="btn-primary w-full" disabled={pending}>
            {pending ? 'Gönderiliyor…' : 'Talebi Gönder'}
          </button>
        </form>
      )}

      {/* Manager: pending queue */}
      {isManager && pendingTeam.length > 0 && (
        <section>
          <h2 className="section-title" style={{ color: '#FF9500' }}>Onay Bekleyen Talepler</h2>
          <div className="card divide-y divide-black/[0.06] overflow-hidden">
            {pendingTeam.map(r => (
              <div key={r.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">{r.profiles?.full_name}</p>
                    <p className="text-[13px] text-[#8E8E93]">
                      {TYPE_LABEL[r.type] ?? r.type} · {fd(r.start_date)} – {fd(r.end_date)}
                      {r.reason ? ` · ${r.reason}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button disabled={pending} onClick={() => run(() => decideLeave(r.id, true))}
                      className="btn !py-1.5 !px-3 bg-emerald-600 text-white text-[13px]">
                      <ThumbsUp size={13} /> Onayla
                    </button>
                    <button disabled={pending} onClick={() => setRejectId(v => v === r.id ? null : r.id)}
                      className="btn !py-1.5 !px-3 bg-ios-fill text-ios-red text-[13px]">
                      <ThumbsDown size={13} /> Reddet
                    </button>
                  </div>
                </div>
                {rejectId === r.id && (
                  <form action={(f) => run(async () => {
                    const res = await decideLeave(r.id, false, String(f.get('note') ?? ''));
                    if (!res?.error) setRejectId(null);
                    return res;
                  })} className="flex gap-2">
                    <input name="note" className="input" placeholder="Reddetme sebebi (kişiye iletilir)…" />
                    <button className="btn-danger shrink-0" disabled={pending}>Gönder</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* My requests */}
      <section>
        <h2 className="section-title">Taleplerim</h2>
        <div className="card divide-y divide-black/[0.06] overflow-hidden">
          {mine.length === 0 && (
            <p className="p-8 text-center text-[15px] text-[#8E8E93]">Henüz izin talebiniz yok.</p>
          )}
          {mine.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 min-w-0">
                <p className="text-[15px] font-medium">{TYPE_LABEL[r.type] ?? r.type}</p>
                <p className="text-[13px] text-[#8E8E93]">
                  {fd(r.start_date)} – {fd(r.end_date)}
                  {r.decision_note ? ` · ${r.decision_note}` : ''}
                </p>
              </span>
              <span className={`badge ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</span>
              {r.status === 'pending' && (
                <button disabled={pending} onClick={() => run(() => cancelLeave(r.id))}
                  className="text-[12px] text-[#8E8E93] hover:text-ios-red">İptal</button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Team history (managers) */}
      {isManager && others.length > 0 && (
        <section>
          <h2 className="section-title">Ekip İzin Geçmişi</h2>
          <div className="card divide-y divide-black/[0.06] overflow-hidden">
            {others.slice(0, 20).map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 min-w-0">
                  <p className="text-[14px] truncate">{r.profiles?.full_name} — {TYPE_LABEL[r.type] ?? r.type}</p>
                  <p className="text-[12px] text-[#8E8E93]">{fd(r.start_date)} – {fd(r.end_date)}</p>
                </span>
                <span className={`badge ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
