'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateMyName, changeMyPassword } from '@/app/(app)/profile/actions';

export default function ProfileForms({ currentName }: { currentName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [nameMsg, setNameMsg] = useState<{ ok?: string; error?: string }>({});
  const [passMsg, setPassMsg] = useState<{ ok?: string; error?: string }>({});
  const passRef = useRef<HTMLFormElement>(null);

  return (
    <div className="space-y-5">
      {/* Ad Soyad */}
      <form
        action={(fd) => start(async () => {
          setNameMsg({});
          const r = await updateMyName(fd);
          if (r?.error) setNameMsg({ error: r.error });
          else { setNameMsg({ ok: 'Adınız güncellendi.' }); router.refresh(); }
        })}
        className="card p-5 space-y-3"
      >
        <h2 className="text-[15px] font-semibold">Ad Soyad</h2>
        <input name="full_name" defaultValue={currentName} required minLength={2} className="input" />
        {nameMsg.error && <p className="text-[13px] text-rose-300 bg-rose-500/10 rounded-xl px-3 py-2">{nameMsg.error}</p>}
        {nameMsg.ok && <p className="text-[13px] text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">✔ {nameMsg.ok}</p>}
        <button className="btn-primary" disabled={pending}>{pending ? 'Kaydediliyor…' : 'Kaydet'}</button>
      </form>

      {/* Parola */}
      <form
        ref={passRef}
        action={(fd) => start(async () => {
          setPassMsg({});
          const r = await changeMyPassword(fd);
          if (r?.error) setPassMsg({ error: r.error });
          else { setPassMsg({ ok: 'Parolanız değiştirildi.' }); passRef.current?.reset(); }
        })}
        className="card p-5 space-y-3"
      >
        <h2 className="text-[15px] font-semibold">Parola Değiştir</h2>
        <div>
          <label className="label">Mevcut parola</label>
          <input name="current" type="password" required autoComplete="current-password" className="input" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Yeni parola (en az 8 karakter)</label>
            <input name="next" type="password" required minLength={8} autoComplete="new-password" className="input" />
          </div>
          <div>
            <label className="label">Yeni parola (tekrar)</label>
            <input name="next2" type="password" required minLength={8} autoComplete="new-password" className="input" />
          </div>
        </div>
        {passMsg.error && <p className="text-[13px] text-rose-300 bg-rose-500/10 rounded-xl px-3 py-2">{passMsg.error}</p>}
        {passMsg.ok && <p className="text-[13px] text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">✔ {passMsg.ok}</p>}
        <button className="btn-primary" disabled={pending}>{pending ? 'Değiştiriliyor…' : 'Parolayı Değiştir'}</button>
        <p className="text-[12px] text-[#8E8E93]">
          Parolanızı unuttuysanız şirket yöneticiniz Kullanıcılar sayfasından yeni parola belirleyebilir.
        </p>
      </form>
    </div>
  );
}
