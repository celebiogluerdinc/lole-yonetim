'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { addOutletContact } from '@/app/(app)/sales/actions';
import { CONTACT_ROLE_LABEL, AUTHORITY_LABEL } from '@/lib/sales-types';

export default function OutletContacts({ outletId }: { outletId: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(fd: FormData) {
    setErr(null);
    start(async () => {
      const r = await addOutletContact(fd);
      if (r?.error) { setErr(r.error); return; }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost text-sm">
        <Plus size={15} /> Kişi ekle
      </button>
    );
  }

  return (
    <form action={onSubmit} className="space-y-3 rounded-xl bg-white/[0.03] p-3">
      <input type="hidden" name="outlet_id" value={outletId} />
      {err && <p className="alert-error">{err}</p>}

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Ad soyad *</label>
          <input name="full_name" required className="input" />
        </div>
        <div>
          <label className="label">Görevi</label>
          <select name="role" className="input" defaultValue="sahip">
            {Object.entries(CONTACT_ROLE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="label">Telefon</label><input name="phone" className="input" /></div>
        <div><label className="label">E-posta</label><input name="email" type="email" className="input" /></div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Karar yetkisi</label>
          <select name="decision_authority" className="input" defaultValue="">
            <option value="">Bilinmiyor</option>
            {Object.entries(AUTHORITY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Uygun görüşme saati</label>
          <input name="preferred_contact_time" className="input" placeholder="Öğleden sonra" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_primary" className="switch" />
        Ana muhatap
      </label>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary">Ekle</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Vazgeç</button>
      </div>
    </form>
  );
}
