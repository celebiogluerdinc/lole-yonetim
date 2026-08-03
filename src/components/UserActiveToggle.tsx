'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleUserActive } from '@/app/(app)/admin/actions';

export default function UserActiveToggle({ userId, active }: { userId: string; active: boolean }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => start(async () => { await toggleUserActive(userId, !active); router.refresh(); })}
      className={`text-xs font-medium rounded-full px-3 py-1.5 transition-colors ${
        active
          ? 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600'
          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      }`}
    >
      {active ? 'Pasifleştir' : 'Aktifleştir'}
    </button>
  );
}
