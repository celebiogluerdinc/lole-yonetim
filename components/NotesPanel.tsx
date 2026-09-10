'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { addNote, deleteNote } from '@/app/(app)/home/actions';
import { fmtDate } from '@/lib/utils';

interface NoteT { id: string; body: string; created_at: string; }

export default function NotesPanel({ notes }: { notes: NoteT[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);

  return (
    <section>
      <h2 className="section-title">Notlarım</h2>
      <div className="card divide-y divide-white/[0.08] overflow-hidden">
        {notes.map(n => (
          <div key={n.id} className="flex items-start gap-3 px-4 py-2.5 group">
            <div className="flex-1 min-w-0">
              <p className="text-[15px] whitespace-pre-wrap break-words leading-snug">{n.body}</p>
              <p className="text-[12px] text-[#8E8E93] mt-0.5">{fmtDate(n.created_at)}</p>
            </div>
            <button
              aria-label="Notu sil"
              onClick={() => start(async () => {
                setError(null);
                const r = await deleteNote(n.id);
                if (r?.error) setError(r.error); else router.refresh();
              })}
              className="opacity-0 group-hover:opacity-100 text-[#AEAEB2] hover:text-ios-red transition-all p-1 mt-0.5"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}

        {/* Apple-style "+ Yeni Anımsatıcı" quick-add row */}
        {error && (
          <p className="text-[12px] text-rose-300 bg-rose-500/10 px-4 py-2">{error}</p>
        )}
        <form
          ref={ref}
          action={(fd) => start(async () => {
            setError(null);
            const r = await addNote(fd);
            if (r?.error) setError(r.error);
            else { ref.current?.reset(); router.refresh(); }
          })}
          className="flex items-center gap-3 px-4 py-2.5"
        >
          <span className="w-[22px] h-[22px] rounded-full bg-ios-blue text-white flex items-center justify-center shrink-0">
            <Plus size={14} strokeWidth={2.6} />
          </span>
          <input
            name="body"
            required
            disabled={pending}
            placeholder="Yeni not"
            className="flex-1 bg-transparent outline-none text-[15px] placeholder:text-[#AEAEB2]"
          />
          <button className="text-ios-blue text-[15px] font-semibold disabled:opacity-40" disabled={pending}>
            Ekle
          </button>
        </form>
      </div>
    </section>
  );
}
