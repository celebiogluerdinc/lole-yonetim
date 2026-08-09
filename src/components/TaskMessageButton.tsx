'use client';

import { useState, useTransition } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { startDm } from '@/app/(app)/messages/actions';

interface Person { id: string; name: string; tag: string; }

/** "💬 Mesaj Gönder" on the task page — starts a DM with a task participant. */
export default function TaskMessageButton({ people }: { people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (people.length === 0) return null;

  function go(id: string) {
    start(async () => {
      setError(null);
      const r = await startDm(id); // başarıda sohbete yönlendirir
      if (r?.error) setError(r.error);
    });
  }

  // tek kişi varsa direkt aç
  if (people.length === 1) {
    return (
      <span>
        <button onClick={() => go(people[0].id)} disabled={pending} className="btn-outline text-sm">
          <MessageCircle size={14} /> {pending ? 'Açılıyor…' : `Mesaj Gönder (${people[0].name.split(' ')[0]})`}
        </button>
        {error && <span className="text-[12px] text-rose-300 ml-2">{error}</span>}
      </span>
    );
  }

  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen(v => !v)} disabled={pending} className="btn-outline text-sm">
        <MessageCircle size={14} /> {pending ? 'Açılıyor…' : 'Mesaj Gönder'}
      </button>
      {open && (
        <div className="absolute z-30 mt-1.5 left-0 min-w-[220px] rounded-2xl bg-[#2C2C2E] border border-white/[0.10] shadow-xl shadow-black/40 p-1.5">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-[11px] font-semibold text-[#8E8E93] uppercase">Kime?</p>
            <button onClick={() => setOpen(false)} className="text-[#8E8E93]"><X size={12} /></button>
          </div>
          {people.map(p => (
            <button key={p.id}
              onClick={() => { setOpen(false); go(p.id); }}
              className="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-white/10 transition-colors">
              <span className="w-7 h-7 rounded-full bg-ios-blue/20 text-ios-blue flex items-center justify-center text-[12px] font-bold shrink-0">
                {p.name[0]?.toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] truncate">{p.name}</span>
                <span className="block text-[11px] text-[#8E8E93]">{p.tag}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-[12px] text-rose-300 mt-1">{error}</p>}
    </div>
  );
}
