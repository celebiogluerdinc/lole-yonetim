'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createDepartment } from '@/app/(app)/admin/actions';

export default function NewDepartmentForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={ref}
      action={(fd) => start(async () => {
        setError(null);
        const r = await createDepartment(fd);
        if (r?.error) setError(r.error);
        else { ref.current?.reset(); router.refresh(); }
      })}
      className="flex gap-2"
    >
      <input name="name" required className="input" placeholder="Yeni departman adı…" />
      <button className="btn-primary shrink-0" disabled={pending}>
        {pending ? 'Ekleniyor…' : 'Departman Ekle'}
      </button>
      {error && <p className="text-sm text-rose-300 self-center">{error}</p>}
    </form>
  );
}
