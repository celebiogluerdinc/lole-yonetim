'use client';

import { useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { StickyNote, Trash2 } from 'lucide-react';
import { addNote, deleteNote } from '@/app/(app)/home/actions';
import { fmtDate } from '@/lib/utils';

interface NoteT { id: string; body: string; created_at: string; }

export default function NotesPanel({ notes }: { notes: NoteT[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <section className="card p-4">
      <h2 className="font-semibold text-sm text-slate-700 flex items-center gap-2 mb-3">
        <StickyNote size={16} className="text-brand-500" /> Notlarım
      </h2>

      <form
        ref={ref}
        action={(fd) => start(async () => {
          await addNote(fd);
          ref.current?.reset();
          router.refresh();
        })}
        className="flex gap-2 mb-3"
      >
        <input name="body" required placeholder="Hızlı not ekle…" className="input" />
        <button className="btn-primary shrink-0" disabled={pending}>Ekle</button>
      </form>

      <ul className="space-y-2">
        {notes.length === 0 && (
          <li className="text-sm text-slate-400 text-center py-2">Henüz not yok.</li>
        )}
        {notes.map(n => (
          <li key={n.id} className="flex items-start gap-2 group rounded-xl bg-slate-50 px-3 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm whitespace-pre-wrap break-words">{n.body}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{fmtDate(n.created_at)}</p>
            </div>
            <button
              aria-label="Notu sil"
              onClick={() => start(async () => { await deleteNote(n.id); router.refresh(); })}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all p-1"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
