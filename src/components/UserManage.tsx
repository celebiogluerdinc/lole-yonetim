'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, KeyRound } from 'lucide-react';
import { updateUser, toggleUserActive } from '@/app/(app)/admin/actions';
import { ROLE_LABEL } from '@/lib/utils';

interface Dept { id: string; name: string; }
export interface ManagedUser {
  id: string; full_name: string; email: string; role: string; is_active: boolean;
  memberIds: string[];    // departments the user belongs to
  managerIds: string[];   // departments the user manages
}

export default function UserManage({
  user, departments, meId
}: { user: ManagedUser; departments: Dept[]; meId: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const isSelf = user.id === meId;

  const deptNames = departments
    .filter(d => user.memberIds.includes(d.id) || user.managerIds.includes(d.id))
    .map(d => `${d.name}${user.managerIds.includes(d.id) ? ' (Müdür)' : ''}`)
    .join(', ');

  return (
    <div>
      {/* Row — click to edit */}
      <button
        onClick={() => { setOpen(v => !v); setError(null); setOk(null); }}
        className="w-full flex items-center gap-3 p-4 hover:bg-white/[0.04] transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-full bg-ios-blue/15 text-ios-blue flex items-center justify-center text-sm font-bold shrink-0">
          {(user.full_name || user.email)[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${user.is_active ? '' : 'text-[#8E8E93] line-through'}`}>
            {user.full_name || user.email}{isSelf ? ' (siz)' : ''}
          </p>
          <p className="text-xs text-[#8E8E93] truncate">
            {ROLE_LABEL[user.role]} · {user.email}{deptNames ? ` · ${deptNames}` : ''}
          </p>
        </div>
        <ChevronDown size={16} className={`text-[#8E8E93] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Editor */}
      {open && (
        <form
          action={(fd) => start(async () => {
            setError(null); setOk(null);
            fd.set('user_id', user.id);
            const r = await updateUser(fd);
            if (r?.error) setError(r.error);
            else {
              setOk(r?.password_changed
                ? 'Kaydedildi. Yeni parolayı kullanıcıya iletin — bir daha görüntülenemez.'
                : 'Kaydedildi.');
              router.refresh();
            }
          })}
          className="px-4 pb-5 pt-1 space-y-4 bg-white/[0.03] border-t border-white/[0.06]"
        >
          {error && <p className="text-[13px] text-rose-300 bg-rose-500/10 rounded-xl px-3 py-2">{error}</p>}
          {ok && <p className="text-[13px] text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">✔ {ok}</p>}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Ad Soyad</label>
              <input name="full_name" defaultValue={user.full_name} required className="input" />
            </div>
            <div>
              <label className="label">Yetki (rol)</label>
              <select name="role" defaultValue={user.role} disabled={isSelf} className="input disabled:opacity-50">
                <option value="staff">Personel</option>
                <option value="manager">Müdür</option>
                <option value="admin">Admin</option>
              </select>
              {isSelf && <p className="text-[11px] text-[#8E8E93] mt-1">Kendi rolünüzü değiştiremezsiniz.</p>}
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1.5"><KeyRound size={12} /> Yeni parola belirle</label>
            <input name="new_password" minLength={8} className="input"
              placeholder="Boş bırakılırsa parola değişmez (min. 8 karakter)" autoComplete="new-password" />
            <p className="text-[11px] text-[#8E8E93] mt-1">
              Güvenlik gereği mevcut parolalar görüntülenemez; buradan yenisini belirleyip kullanıcıya iletebilirsiniz.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Üye olduğu departmanlar</label>
              <div className="rounded-xl border border-white/[0.10] p-3 space-y-1.5 max-h-36 overflow-y-auto">
                {departments.map(d => (
                  <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="departments" value={d.id}
                      defaultChecked={user.memberIds.includes(d.id)} className="rounded accent-[#0A84FF]" />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Müdürü olduğu departmanlar</label>
              <div className="rounded-xl border border-white/[0.10] p-3 space-y-1.5 max-h-36 overflow-y-auto">
                {departments.map(d => (
                  <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="manager_departments" value={d.id}
                      defaultChecked={user.managerIds.includes(d.id)} className="rounded accent-[#0A84FF]" />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isSelf && (
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => {
                  await toggleUserActive(user.id, !user.is_active);
                  router.refresh();
                })}
                className={`btn-outline ${user.is_active ? '!text-rose-300' : '!text-emerald-300'}`}
              >
                {user.is_active ? 'Pasifleştir' : 'Aktifleştir'}
              </button>
            )}
            <button className="btn-primary flex-1" disabled={pending}>
              {pending ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
