'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { addShift, deleteShift } from '@/app/(app)/hr/actions';

interface Dept { id: string; name: string; }
interface Person { id: string; full_name: string; }
interface Membership { department_id: string; user_id: string; }

function ShiftAdmin({
  departments, people, memberships, defaultDate
}: { departments: Dept[]; people: Person[]; memberships: Membership[]; defaultDate: string }) {
  const [open, setOpen] = useState(false);
  const [deptId, setDeptId] = useState(departments[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  const deptPeople = useMemo(() => {
    const ids = new Set(memberships.filter(m => m.department_id === deptId).map(m => m.user_id));
    const inDept = people.filter(p => ids.has(p.id));
    return inDept.length ? inDept : people;
  }, [deptId, people, memberships]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={16} /> Vardiya Ekle
      </button>
    );
  }

  return (
    <form
      ref={ref}
      action={(fd) => start(async () => {
        setError(null);
        fd.set('department_id', deptId);
        const r = await addShift(fd);
        if (r?.error) setError(r.error);
        else { ref.current?.reset(); router.refresh(); }
      })}
      className="card p-4 space-y-3 border border-ios-blue/20"
    >
      {error && <p className="text-[13px] text-ios-red">{error}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Departman</label>
          <select value={deptId} onChange={e => setDeptId(e.target.value)} className="input">
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label">Kişi</label>
          <select name="user_id" required className="input">
            {deptPeople.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tarih</label>
          <input name="date" type="date" required defaultValue={defaultDate} className="input" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Başlangıç</label>
            <input name="start" type="time" required defaultValue="09:00" className="input" />
          </div>
          <div>
            <label className="label">Bitiş</label>
            <input name="end" type="time" required defaultValue="17:00" className="input" />
          </div>
        </div>
      </div>
      <input name="note" className="input" placeholder="Not (opsiyonel)" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-outline flex-1">Kapat</button>
        <button className="btn-primary flex-1" disabled={pending}>
          {pending ? 'Ekleniyor…' : 'Vardiyayı Kaydet'}
        </button>
      </div>
    </form>
  );
}

function DeleteShift({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await deleteShift(id); router.refresh(); })}
      aria-label="Vardiyayı sil"
      className="text-[#AEAEB2] hover:text-ios-red p-1.5 transition-colors shrink-0"
    >
      <Trash2 size={15} />
    </button>
  );
}

ShiftAdmin.Delete = DeleteShift;
export default ShiftAdmin;
