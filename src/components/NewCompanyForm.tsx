'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createCompany } from '@/app/(app)/admin/actions';

export default function NewCompanyForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={(fd) => start(async () => {
        setError(null);
        const r = await createCompany(fd);
        if (r?.error) setError(r.error);
        else { ref.current?.reset(); router.refresh(); }
      })}
      className="card p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
    >
      <div className="flex-1">
        <label className="label">Yeni şirket adı</label>
        <input name="name" required className="input" placeholder="Örn: Lole Kafe" />
      </div>
      <div>
        <label className="label">Marka rengi</label>
        <input name="accent_color" type="color" defaultValue="#ff5a1f" className="h-11 w-full sm:w-20 rounded-xl border border-white/15 cursor-pointer" />
      </div>
      <button className="btn-primary" disabled={pending}>
        {pending ? 'Ekleniyor…' : '+ Şirket Ekle'}
      </button>
      {error && <p className="text-sm text-rose-300">{error}</p>}
    </form>
  );
}
