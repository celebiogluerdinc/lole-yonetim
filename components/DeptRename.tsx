'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import { renameDepartment } from '@/app/(app)/admin/actions';

export default function DeptRename({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="Adı değiştir"
        className="w-7 h-7 rounded-full bg-white/10 text-[#8E8E93] flex items-center justify-center hover:bg-white/20 transition-colors shrink-0">
        <Pencil size={12} />
      </button>
    );
  }

  return (
    <form
      action={(fd) => start(async () => {
        setError(null);
        fd.set('department_id', id);
        const r = await renameDepartment(fd);
        if (r?.error) setError(r.error);
        else { setOpen(false); router.refresh(); }
      })}
      className="flex items-center gap-1.5 flex-1 min-w-0"
    >
      <input name="name" defaultValue={name} required minLength={2} className="input !py-1.5 !text-sm" autoFocus />
      <button className="btn-primary !py-1.5 !px-3 text-sm shrink-0" disabled={pending}>Kaydet</button>
      <button type="button" onClick={() => setOpen(false)}
        className="w-7 h-7 rounded-full bg-white/10 text-[#8E8E93] flex items-center justify-center shrink-0">
        <X size={12} />
      </button>
      {error && <span className="text-[11px] text-rose-300">{error}</span>}
    </form>
  );
}
