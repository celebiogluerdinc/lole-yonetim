'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { createTask } from '@/app/(app)/manage/actions';

interface Dept { id: string; name: string; }
interface Person { id: string; full_name: string; role: string; }
interface Membership { department_id: string; user_id: string; }

const WEEKDAYS = [
  ['MO', 'Pzt'], ['TU', 'Sal'], ['WE', 'Çar'], ['TH', 'Per'],
  ['FR', 'Cum'], ['SA', 'Cmt'], ['SU', 'Paz']
] as const;

export default function NewTaskForm({
  departments, people, memberships
}: { departments: Dept[]; people: Person[]; memberships: Membership[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<'task' | 'checklist'>('task');
  const [deptId, setDeptId] = useState(departments[0]?.id ?? '');
  const [items, setItems] = useState<string[]>(['']);
  const [recur, setRecur] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'custom'>('none');

  const deptPeople = useMemo(() => {
    const ids = new Set(memberships.filter(m => m.department_id === deptId).map(m => m.user_id));
    const inDept = people.filter(p => ids.has(p.id));
    return inDept.length ? inDept : people;
  }, [deptId, people, memberships]);

  return (
    <form
      action={(fd) => start(async () => {
        setError(null);
        const r = await createTask(fd);
        if (r?.error) setError(r.error);
      })}
      className="space-y-5"
    >
      {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="card p-5 space-y-4">
        {/* Type toggle */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(['task', 'checklist'] as const).map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                type === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
              {t === 'task' ? 'Tekil Görev' : 'Checklist'}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />

        <div>
          <label className="label">Başlık *</label>
          <input name="title" required className="input" placeholder="Örn: Depo sayımı" />
        </div>
        <div>
          <label className="label">Açıklama</label>
          <textarea name="description" rows={2} className="input" placeholder="Detaylar…" />
        </div>

        {type === 'checklist' && (
          <div>
            <label className="label">Checklist maddeleri *</label>
            <div className="space-y-2">
              {items.map((val, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    name="items" value={val}
                    onChange={e => setItems(arr => arr.map((v, j) => j === i ? e.target.value : v))}
                    className="input" placeholder={`Madde ${i + 1}`}
                  />
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems(arr => arr.filter((_, j) => j !== i))}
                      className="btn-ghost !px-2 text-slate-400"><X size={16} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setItems(arr => [...arr, ''])}
                className="btn-ghost text-brand-600 text-sm"><Plus size={15} /> Madde ekle</button>
            </div>
          </div>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Departman *</label>
            <select name="department_id" required value={deptId}
              onChange={e => setDeptId(e.target.value)} className="input">
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Bitiş tarihi &amp; saati *</label>
            <input name="due_at" type="datetime-local" required className="input" />
          </div>
          <div>
            <label className="label">Öncelik</label>
            <select name="priority" defaultValue="normal" className="input">
              <option value="low">Düşük</option>
              <option value="normal">Normal</option>
              <option value="high">Yüksek</option>
              <option value="urgent">Acil</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label">Atanacak kişiler *</label>
          <div className="grid sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-3">
            {deptPeople.map(p => (
              <label key={p.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                <input type="checkbox" name="assignees" value={p.id}
                  className="rounded accent-[#ff5a1f] w-4 h-4" />
                <span className="truncate">{p.full_name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="requires_photo" className="rounded accent-[#ff5a1f] w-4 h-4" />
            📷 Fotoğraf zorunlu
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="requires_approval" className="rounded accent-[#ff5a1f] w-4 h-4" />
            ✅ Yönetici onayı gerekli
          </label>
        </div>
      </div>

      {/* Recurrence */}
      <div className="card p-5 space-y-4">
        <label className="label">Tekrar</label>
        <div className="flex flex-wrap gap-1.5">
          {([['none', 'Tek seferlik'], ['daily', 'Günlük'], ['weekly', 'Haftalık'], ['monthly', 'Aylık'], ['custom', 'Özel']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setRecur(k)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                recur === k ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {l}
            </button>
          ))}
        </div>
        <input type="hidden" name="recur" value={recur} />

        {recur === 'weekly' && (
          <div className="flex gap-1.5 flex-wrap">
            {WEEKDAYS.map(([k, l]) => (
              <label key={k} className="cursor-pointer">
                <input type="checkbox" name="weekdays" value={k} className="peer hidden" />
                <span className="inline-block rounded-lg border border-slate-200 px-3 py-1.5 text-sm peer-checked:bg-brand-500 peer-checked:text-white peer-checked:border-brand-500 transition-colors">
                  {l}
                </span>
              </label>
            ))}
          </div>
        )}
        {recur === 'monthly' && (
          <div className="max-w-[200px]">
            <label className="label">Ayın günü</label>
            <input name="monthday" type="number" min={1} max={31} defaultValue={1} className="input" />
          </div>
        )}
        {recur === 'custom' && (
          <div>
            <label className="label">RRULE (iCal)</label>
            <input name="custom_rrule" className="input" placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO" />
          </div>
        )}
        {recur !== 'none' && (
          <div className="grid grid-cols-2 gap-4 max-w-xs">
            <div>
              <label className="label">Aralık (her N)</label>
              <input name="interval" type="number" min={1} max={90} defaultValue={1} className="input" />
            </div>
            <div>
              <label className="label">Kaç tekrar üretilsin</label>
              <input name="count" type="number" min={1} max={30} defaultValue={8} className="input" />
            </div>
          </div>
        )}
      </div>

      <button className="btn-primary w-full !py-3.5 text-base" disabled={pending}>
        {pending ? 'Oluşturuluyor…' : 'Görevi Oluştur ve Ata'}
      </button>
    </form>
  );
}
