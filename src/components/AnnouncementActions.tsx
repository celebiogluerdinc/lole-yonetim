'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pin, PinOff, Trash2 } from 'lucide-react';
import { deleteAnnouncement, togglePinAnnouncement } from '@/app/(app)/announcements/actions';

/** Pin/unpin + delete controls on an announcement card (managers/admins). */
export default function AnnouncementActions({ id, pinned }: { id: string; pinned: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<any>) => start(async () => {
    setError(null);
    const r = await fn();
    if (r?.error) setError(r.error);
    else router.refresh();
  });

  return (
    <span className="flex items-center gap-1 shrink-0">
      {error && <span className="text-[11px] text-rose-300 mr-1">{error}</span>}
      <button
        disabled={pending}
        title={pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
        onClick={() => run(() => togglePinAnnouncement(id, !pinned))}
        className="w-7 h-7 rounded-full bg-white/10 text-[#D1D1D6] flex items-center justify-center hover:bg-white/20 transition-colors"
      >
        {pinned ? <PinOff size={13} /> : <Pin size={13} />}
      </button>
      <button
        disabled={pending}
        title="Duyuruyu sil"
        onClick={() => { if (window.confirm('Bu duyuru silinsin mi?')) run(() => deleteAnnouncement(id)); }}
        className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-300 flex items-center justify-center hover:bg-rose-500/30 transition-colors"
      >
        <Trash2 size={13} />
      </button>
    </span>
  );
}
