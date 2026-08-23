'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCompany } from '@/app/(app)/admin/actions';

export default function NewCompanyForm() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [kind, setKind] = useState<'internal' | 'order_line'>('internal');
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  const isOrder = kind === 'order_line';

  return (
    <form
      ref={ref}
      action={(fd) => start(async () => {
        setError(null); setOk(null);
        fd.set('kind', kind);
        const r = await createCompany(fd);
        if (r?.error) setError(r.error);
        else {
          setOk(isOrder
            ? 'Sipariş hattı oluşturuldu. Şimdi Kullanıcılar sayfasından önce bir "Sipariş Sorumlusu", ardından müşteri hesaplarını ekleyin.'
            : 'Şirket oluşturuldu.');
          ref.current?.reset();
          router.refresh();
        }
      })}
      className="card p-4 space-y-3"
    >
      {/* tür seçimi: normal şirket mi, Lole Sipariş Hattı mı */}
      <div className="segment w-full sm:w-auto">
        <button type="button" onClick={() => setKind('internal')}
          className={`segment-item ${!isOrder ? 'segment-item-active' : ''}`}>
          🏢 Şirket
        </button>
        <button type="button" onClick={() => setKind('order_line')}
          className={`segment-item ${isOrder ? 'segment-item-active' : ''}`}>
          📦 Sipariş Hattı
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
        <div className="flex-1">
          <label className="label">{isOrder ? 'Sipariş hattı adı' : 'Yeni şirket adı'}</label>
          <input name="name" required className="input"
            placeholder={isOrder ? 'Örn: Lole Sipariş Hattı' : 'Örn: Lole Kafe'} />
        </div>
        <div>
          <label className="label">Marka rengi</label>
          <input name="accent_color" type="color" defaultValue={isOrder ? '#5E5CE6' : '#ff5a1f'}
            className="h-11 w-full sm:w-20 rounded-xl border border-white/15 cursor-pointer" />
        </div>
        <button className="btn-primary" disabled={pending}>
          {pending ? 'Ekleniyor…' : (isOrder ? '+ Sipariş Hattı Oluştur' : '+ Şirket Ekle')}
        </button>
      </div>

      <p className="text-[12px] text-[#8E8E93]">
        {isOrder
          ? 'Sipariş hattı, müşterilerinizin sipariş verdiği bağımsız bir paneldir. Görev, vardiya, mesai, departman ve ödeme talepleri bu panelde yer almaz; "Satın Alma" modülü "Sipariş Ver" adıyla çalışır.'
          : 'Grup şirketi: tüm modüller (görev, vardiya, mesai, izin, satın alma, ödeme…) açıktır.'}
      </p>

      {error && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl px-3 py-2">{error}</p>}
      {ok && <p className="text-sm text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">✔ {ok}</p>}
    </form>
  );
}
