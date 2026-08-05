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
          ? 'bg-white/10 text-[#8E8E93] hover:bg-rose-500/10 hover:text-rose-300'
          : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-100'
      }`}
    >
      {active ? 'Pasifleştir' : 'Aktifleştir'}
    </button>
  );
}
