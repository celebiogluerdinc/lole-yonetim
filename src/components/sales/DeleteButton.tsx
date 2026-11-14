'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmProvider';

/**
 * ORTAK SİL DÜĞMESİ
 *
 * Tek bir yerde durmasının sebebi: silme her bölümde aynı davranmalı —
 * aynı onay metni, aynı hata yeri, aynı sonuç. Üç ekranda üç ayrı silme
 * davranışı, kullanıcının "sildim mi acaba" diye geri dönüp bakmasına
 * yol açıyor.
 *
 * Akış: onay → sunucu action → sonuç. Sunucu `blocked` döndürürse
 * (bağlı kaydı olan nokta gibi) kayıt silinmedi ama bir şey YAPILDI
 * (pasife alındı); mesajı olduğu gibi gösteriyoruz.
 */
export default function DeleteButton({
  label, title, message, action, redirectTo, size = 'sm', askReason = false
}: {
  /** Düğme metni. Boşsa yalnızca çöp kutusu ikonu. */
  label?: string;
  /** Onay panelinin başlığı */
  title?: string;
  /** Onay panelinde gösterilecek açıklama — ne silinecek, geri dönüşü var mı */
  message: string;
  /** Sunucu action'ı: başarıysa { ok } , engellendiyse { blocked, message } */
  action: (reason?: string) => Promise<{ ok?: boolean; error?: string; blocked?: boolean; message?: string } | void>;
  /** Silindikten sonra gidilecek adres (detay sayfasından silerken şart) */
  redirectTo?: string;
  size?: 'sm' | 'md';
  /** Ticari belge siliyorsak sebep sorulur — denetim kaydına yazılır */
  askReason?: boolean;
}) {
  const confirm = useConfirm();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Sebep sorulan silmelerde kendi panelimizi açıyoruz. Eskiden tarayıcının
  // window.prompt kutusu çıkıyordu: telefonda klavyeyle birlikte ekranın
  // yarısını kaplıyor, uygulamanın diline uymuyor ve PWA'da bazen hiç
  // açılmıyordu.
  const [sheet, setSheet] = useState(false);
  const [reason, setReason] = useState('');

  function fire(r?: string) {
    start(async () => {
      let res: any;
      try {
        res = await action(r);
      } catch (e: any) {
        setErr(`Beklenmeyen hata: ${e?.message ?? 'bilinmiyor'}`);
        return;
      }
      setSheet(false);
      if (res?.error) { setErr(res.error); return; }
      if (res?.blocked) { setNote(res.message ?? 'Kayıt silinemedi.'); router.refresh(); return; }
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    });
  }

  async function onClick() {
    setErr(null); setNote(null);
    if (askReason) { setReason(''); setSheet(true); return; }
    const ok = await confirm({
      title: title ?? 'Silinsin mi?',
      message,
      okText: 'Sil',
      danger: true
    });
    if (!ok) return;
    fire();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1" data-noprint>
      <button type="button" onClick={onClick} disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors
          text-ios-red hover:bg-ios-red/15 disabled:opacity-40 ${
          size === 'md' ? 'px-3 py-2 text-[14px]' : 'px-2.5 py-1.5 text-[12.5px]'
        }`}
        title={label ?? 'Sil'}>
        {pending ? <Loader2 size={size === 'md' ? 15 : 13} className="animate-spin" />
                 : <Trash2 size={size === 'md' ? 15 : 13} />}
        {label}
      </button>
      {sheet && (
        <span className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-3"
          onClick={() => !pending && setSheet(false)}>
          <span className="card w-full max-w-md p-5 space-y-3 block" onClick={e => e.stopPropagation()}>
            <span className="block text-[17px] font-semibold">{title ?? 'Silinsin mi?'}</span>
            <span className="block text-[13.5px] text-[#8E8E93]">{message}</span>
            <input value={reason} onChange={e => setReason(e.target.value)} autoFocus
              className="input" placeholder="Silme sebebi (isteğe bağlı — denetim kaydına yazılır)" />
            <span className="flex gap-2">
              <button type="button" disabled={pending} onClick={() => fire(reason.trim() || undefined)}
                className="btn-danger min-h-[44px] disabled:opacity-40">
                <Trash2 size={15} /> {pending ? 'Siliniyor…' : 'Sil'}
              </button>
              <button type="button" disabled={pending} onClick={() => setSheet(false)}
                className="btn-ghost min-h-[44px]">Vazgeç</button>
            </span>
          </span>
        </span>
      )}
      {err && <span className="text-[12px] text-ios-red max-w-[34ch]">{err}</span>}
      {note && <span className="text-[12px] text-amber-300 max-w-[42ch]">{note}</span>}
    </span>
  );
}
