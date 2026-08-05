'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { createUser } from '@/app/(app)/admin/actions';

interface Dept { id: string; name: string; company_id: string; }
interface Comp { id: string; name: string; }

export default function NewUserForm({
  departments, companies = [], defaultCompanyId, isSuper = false
}: {
  departments: Dept[];
  companies?: Comp[];
  defaultCompanyId: string;
  isSuper?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  const deptOptions = useMemo(
    () => departments.filter(d => d.company_id === companyId),
    [departments, companyId]
  );

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
        setError(null); setOk(null);
        const r = await createUser(fd);
        if (r?.error) setError(r.error);
        else {
          setOk(r?.login ?? null);
          ref.current?.reset();
          router.refresh();
        }
      })}
      className="card p-5 space-y-4 border border-ios-blue/20"
    >
      {error && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl px-3 py-2">{error}</p>}
      {ok && (
        <p className="text-sm text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">
          ✔ Kullanıcı oluşturuldu. Giriş bilgileri: <b>{ok}</b> + belirlediğiniz parola.
          Bu bilgileri kendisine iletin.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Ad Soyad *</label>
          <input name="full_name" required className="input" placeholder="Örn: Ayşe Yılmaz" />
        </div>
        <div>
          <label className="label">Kullanıcı adı veya e-posta *</label>
          <input name="identifier" required className="input" placeholder="ayse.yilmaz" />
          <p className="text-[11px] text-[#8E8E93] mt-1">
            Sadece kullanıcı adı yazarsanız giriş <b>ad@lole.app</b> olur — e-posta gerekmez.
          </p>
        </div>
        <div>
          <label className="label">Parola * (en az 8 karakter)</label>
          <input name="password" required minLength={8} className="input" placeholder="Kullanıcıya ileteceksiniz" />
        </div>
        <div>
          <label className="label">Yetki (rol)</label>
          <select name="role" defaultValue="staff" className="input">
            <option value="staff">Personel — sadece kendi görevlerini yapar</option>
            <option value="manager">Müdür — departmanını yönetir</option>
            <option value="admin">Admin — tüm şirketi yönetir</option>
          </select>
        </div>
        {isSuper && (
          <div className="sm:col-span-2">
            <label className="label">Firma</label>
            <select name="company_id" value={companyId}
              onChange={e => setCompanyId(e.target.value)} className="input">
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Üye olduğu departmanlar</label>
          <div className="rounded-xl border border-white/[0.10] p-3 space-y-1.5 max-h-36 overflow-y-auto">
            {deptOptions.map(d => (
              <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="departments" value={d.id} className="rounded accent-[#0A84FF]" />
                {d.name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Müdürü olduğu departmanlar</label>
          <div className="rounded-xl border border-white/[0.10] p-3 space-y-1.5 max-h-36 overflow-y-auto">
            {deptOptions.map(d => (
              <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" name="manager_departments" value={d.id} className="rounded accent-[#0A84FF]" />
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
