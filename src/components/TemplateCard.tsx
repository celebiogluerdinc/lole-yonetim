'use client';

import { useState, useTransition } from 'react';
import { CalendarPlus, ClipboardList } from 'lucide-react';
import { instantiateTemplate } from '@/app/(app)/manage/actions';
import type { Template } from '@/lib/types';

export default function TemplateCard({
  template, items, people, departmentName
}: {
  template: Template;
  items: { id: string; title: string }[];
  people: { id: string; full_name: string }[];
  departmentName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold flex items-center gap-2">
            {template.type === 'checklist' && <ClipboardList size={16} className="text-ios-blue" />}
            {template.name}
          </h3>
          {template.description && <p className="text-sm text-[#8E8E93] mt-0.5">{template.description}</p>}
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-[#AEAEB2]">
            {departmentName && <span>🏷 {departmentName}</span>}
            {template.requires_photo && <span>📷 Fotoğraflı</span>}
            {template.requires_approval && <span>✅ Onaylı</span>}
            {items.length > 0 && <span>{items.length} madde</span>}
          </div>
        </div>
        <button onClick={() => setOpen(v => !v)} className="btn-outline shrink-0 text-sm">
          <CalendarPlus size={15} /> Ata
        </button>
      </div>

      {items.length > 0 && (
        <ul className="mt-3 space-y-1">
          {items.slice(0, 4).map(it => (
            <li key={it.id} className="text-sm text-[#8E8E93] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1C1C1E]/25 shrink-0" /> {it.title}
            </li>
          ))}
          {items.length > 4 && <li className="text-xs text-[#AEAEB2]">+{items.length - 4} madde daha</li>}
        </ul>
      )}

      {open && (
        <form
          action={(fd) => start(async () => {
            setError(null);
            fd.set('template_id', template.id);
            const r = await instantiateTemplate(fd);
            if (r?.error) setError(r.error);
          })}
          className="mt-4 border-t border-white/[0.08] pt-4 space-y-3"
        >
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Tarih &amp; saat</label>
              <input name="due_at" type="datetime-local" required className="input" />
            </div>
            <div>
              <label className="label">Kime atansın</label>
              <div className="max-h-32 overflow-y-auto rounded-xl border border-white/10 p-2 space-y-1">
                {people.map(p => (
                  <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" name="assignees" value={p.id} className="rounded accent-[#ff5a1f]" />
                    {p.full_name}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <button className="btn-primary w-full" disabled={pending}>
            {pending ? 'Atanıyor…' : 'Görev Olarak Ata'}
          </button>
        </form>
      )}
    </div>
  );
}
