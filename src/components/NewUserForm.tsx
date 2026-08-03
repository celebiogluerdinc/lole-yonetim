'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { createUser } from '@/app/(app)/admin/actions';

export default function NewUserForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <UserPlus size={16} /> Yeni Kullanıcı Ekle
      </button>
    );
  }

  return (
    <form
      ref={ref}
      action={(fd) => start(async () => {
        setError(null); setOk(false);
        const r = await createUser(fd);
        if (r?.error) setError(r.error);
        else { setOk(true); ref.current?.reset(); router.refresh(); }
      })}
      className="card p-5 space-y-4 border-brand-200"
    >
      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-3 py-2">{error}</p>}
      {ok && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2">✔ Kullanıcı oluşturuldu. Geçici parolayı kendisine iletin.</p>}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Ad Soyad *</label>
          <input name="full_name" required className="input" />
        </div>
        <div>
          <label className="label">E-posta *</label>
          <input name="email" type="email" required className="input" />
        </div>
        <div>
          <label className="label">Geçici parola * (min. 8)</label>
          <input name="password" required minLength={8} className="input" placeholder="Kullanıcıya ileteceksiniz" />
        </div>
        <div>
          <label className="label">Rol</label>
          <select name="role" defaultValue="staff" className="input">
            <option value="staff">Personel</option>
            <option value="manager">Müdür</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Üye olduğu departmanlar</label>
          <div className="rounded-xl border border-slate-200 p-3 space-y-1.5 max-h-36 overflow-y-auto">
            {departments.map(d => (
              <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="departments" value={d.id} className="rounded accent-[#ff5a1f]" />
                {d.name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Müdürü olduğu departmanlar</label>
          <div className="rounded-xl border border-slate-200 p-3 space-y-1.5 max-h-36 overflow-y-auto">
            {departments.map(d => (
              <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="manager_departments" value={d.id} className="rounded accent-[#ff5a1f]" />
                {d.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-outline flex-1">Kapat</button>
        <button className="btn-primary flex-1" disabled={pending}>
          {pending ? 'Oluşturuluyor…' : 'Kullanıcıyı Oluştur'}
        </button>
      </div>
    </form>
  );
}
