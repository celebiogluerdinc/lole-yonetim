'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, Pencil } from 'lucide-react';
import { updateOutletBalance } from '@/app/(app)/sales/actions';
import { tl } from '@/lib/commerce-format';

/**
 * AÇIK BAKİYE ŞERİDİ
 *
 * Muhasebe bu modülde değil; ama temsilci noktaya girmeden önce tek bir
 * şeyi bilmek zorunda: "bu müşterinin ödenmemiş borcu var mı?". Borçlu
 * müşteriye yeni mal bırakmak sahadaki en pahalı hata.
 *
 * Rakam elle giriliyor (muhasebeden gelen bilgi) ve ne zaman
 * güncellendiği yanında yazıyor — eski rakam, yokmuş gibi davranmaktan
 * daha tehlikeli olduğu için tarih gizlenmiyor.
 */
export default function BalanceStrip({
  outletId, balance, overdueDays, note, updatedAt
}: {
  outletId: string;
  balance: number | null;
  overdueDays: number | null;
  note: string | null;
  updatedAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const has = balance !== null && Number(balance) > 0;
  const late = has && (overdueDays ?? 0) > 0;

  function submit(fd: FormData) {
    setErr(null);
    start(async () => {
      try {
        const r: any = await updateOutletBalance(fd);
        if (r?.error) { setErr(r.error); return; }
        setOpen(false);
        router.refresh();
      } catch {
        setErr('Kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.');
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className={`w-full min-h-[44px] flex items-center gap-2 rounded-xl px-3.5 py-2 text-left text-[13px] border ${
          late ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : has ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-white/[0.04] border-white/10 text-[#8E8E93]'}`}>
        <Wallet size={15} className="shrink-0" />
        <span className="flex-1 min-w-0">
          {has ? (
            <>
              <strong className="tabular-nums">Açık bakiye {tl(Number(balance))}</strong>
              {late ? ` · ${overdueDays} gün gecikmiş` : ' · vadesinde'}
              {note ? ` · ${note}` : ''}
              {updatedAt && (
                <span className="opacity-70">
                  {' '}· {new Date(updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </>
          ) : (
            'Açık bakiye yok / girilmedi'
          )}
        </span>
        <Pencil size={13} className="shrink-0 opacity-70" />
      </button>
    );
  }

  return (
    <form action={submit} className="card p-4 space-y-3">
      <input type="hidden" name="outlet_id" value={outletId} />
      <p className="text-[14px] font-semibold">Açık bakiye</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Tutar ₺</label>
          <input name="open_balance" inputMode="decimal" className="input tabular-nums"
            defaultValue={balance ?? ''} placeholder="0" />
        </div>
        <div>
          <label className="label">Gecikme (gün)</label>
          <input name="overdue_days" inputMode="numeric" className="input tabular-nums"
            defaultValue={overdueDays ?? ''} placeholder="0" />
        </div>
      </div>
      <input name="balance_note" className="input" defaultValue={note ?? ''}
        placeholder="Not (isteğe bağlı) — örn: çek 15'inde" />
      {err && <p className="alert-error">{err}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Vazgeç</button>
      </div>
      <p className="text-[12px] text-[#8E8E93]">Borç kapandıysa tutarı boş bırakıp kaydedin.</p>
    </form>
  );
}
