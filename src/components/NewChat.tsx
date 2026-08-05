'use client';

import { useState, useTransition } from 'react';
import { SquarePen, X } from 'lucide-react';
import { startDm, createGroup } from '@/app/(app)/messages/actions';
import { ROLE_LABEL } from '@/lib/utils';

interface Person { id: string; full_name: string; role: string; }

export default function NewChat({ people }: { people: Person[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'dm' | 'group'>('dm');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Yeni sohbet"
        className="w-9 h-9 rounded-full bg-ios-blue text-white flex items-center justify-center active:scale-95 transition-transform">
        <SquarePen size={17} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-[2px] p-0 sm:p-6"
          onClick={() => setOpen(false)}>
          <div className="bg-[#141416] w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85dvh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-[17px] font-bold">Yeni Sohbet</h2>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-[#1C1C1E]/10 flex items-center justify-center text-[#8E8E93]">
                <X size={16} />
              </button>
            </div>

            <div className="px-4 pb-3">
              <div className="segment">
                <button type="button" onClick={() => setTab('dm')}
                  className={`segment-item ${tab === 'dm' ? 'segment-item-active' : ''}`}>Kişi</button>
                <button type="button" onClick={() => setTab('group')}
                  className={`segment-item ${tab === 'group' ? 'segment-item-active' : ''}`}>Grup</button>
              </div>
            </div>

            {error && <p className="text-[13px] text-ios-red px-4 pb-2">{error}</p>}

            <div className="overflow-y-auto px-4 pb-6">
              {tab === 'dm' ? (
                <div className="card divide-y divide-white/[0.08] overflow-hidden">
                  {people.length === 0 && (
                    <p className="p-6 text-center text-[14px] text-[#8E8E93]">Şirkette başka kullanıcı yok.</p>
                  )}
                  {people.map(p => (
                    <button key={p.id} disabled={pending}
                      onClick={() => start(async () => {
                        setError(null);
                        const r = await startDm(p.id);
                        if (r?.error) setError(r.error);
                      })}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1C1C1E]/[0.05] transition-colors text-left disabled:opacity-50">
                      <span className="w-9 h-9 rounded-full bg-ios-blue/10 text-ios-blue flex items-center justify-center font-semibold shrink-0">
                        {p.full_name[0]?.toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <p className="text-[15px] font-medium truncate">{p.full_name}</p>
                        <p className="text-[13px] text-[#8E8E93]">{ROLE_LABEL[p.role] ?? p.role}</p>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <form action={(fd) => start(async () => {
                  setError(null);
                  const r = await createGroup(fd);
                  if (r?.error) setError(r.error);
                })} className="space-y-3">
                  <input name="name" required placeholder="Grup adı" className="input !bg-[#2C2C2E]" />
                  <div className="card divide-y divide-white/[0.08] overflow-hidden max-h-64 overflow-y-auto">
                    {people.map(p => (
                      <label key={p.id} className="flex items-center justify-between px-4 py-2.5 cursor-pointer">
                        <span className="text-[15px]">{p.full_name}</span>
                        <input type="checkbox" name="members" value={p.id} className="w-5 h-5 accent-[#0A84FF]" />
                      </label>
                    ))}
                  </div>
                  <button className="btn-primary w-full" disabled={pending}>
                    {pending ? 'Oluşturuluyor…' : 'Grubu Oluştur'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
