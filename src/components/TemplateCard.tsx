'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, ClipboardList, Pencil, Plus, Trash2, X } from 'lucide-react';
import { instantiateTemplate, deleteTemplate, updateTemplate } from '@/app/(app)/manage/actions';
import type { Template } from '@/lib/types';

export default function TemplateCard({
  template, items, people, departmentName
}: {
  template: Template;
  items: { id: string; title: string }[];
  people: { id: string; full_name: string }[];
  departmentName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [editItems, setEditItems] = useState<string[]>(items.map(i => i.title));
  const [newItemText, setNewItemText] = useState('');

  function addEditItem() {
    const t = newItemText.trim();
    if (!t) return;
    setEditItems(a => [...a, t]);
    setNewItemText('');
  }

  function onDelete() {
    if (!window.confirm(`"${template.name}" şablonu silinsin mi? (Oluşturulmuş görevler etkilenmez)`)) return;
    start(async () => {
      setError(null);
      const r = await deleteTemplate(template.id);
      if (r?.error) setError(r.error);
      else router.refresh();
    });
  }

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
        <span className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => { setOpen(v => !v); setEditOpen(false); }} className="btn-outline text-sm">
            <CalendarPlus size={15} /> Ata
          </button>
          <button
            onClick={() => {
              setEditOpen(v => !v); setOpen(false); setError(null);
              setEditItems(items.map(i => i.title));
            }}
            title="Şablonu düzenle"
            className="w-8 h-8 rounded-full bg-white/10 text-[#D1D1D6] flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onDelete}
            disabled={pending}
            title="Şablonu sil"
            className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-300 flex items-center justify-center hover:bg-rose-500/30 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </span>
      </div>

      {/* ---- Edit panel ---- */}
      {editOpen && (
        <form
          action={(fd) => start(async () => {
            setError(null);
            fd.set('template_id', template.id);
            for (const t of editItems) fd.append('items', t);
            const r = await updateTemplate(fd);
            if (r?.error) setError(r.error);
            else { setEditOpen(false); router.refresh(); }
          })}
          className="mt-4 border-t border-white/[0.08] pt-4 space-y-3"
        >
          {error && <p className="text-sm text-rose-300 bg-rose-500/10 rounded-xl px-3 py-2">{error}</p>}
          <div>
            <label className="label">Şablon adı</label>
            <input name="name" defaultValue={template.name} required minLength={2} className="input" />
          </div>
          <div>
            <label className="label">Açıklama</label>
            <textarea name="description" defaultValue={template.description ?? ''} rows={2} className="input" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="label">Öncelik</label>
              <select name="default_priority" defaultValue={template.default_priority} className="input">
                <option value="low">Düşük</option>
                <option value="normal">Normal</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="requires_photo" defaultChecked={template.requires_photo}
                className="rounded accent-[#0A84FF] w-4 h-4" />
              📷 Fotoğraflı
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="requires_approval" defaultChecked={template.requires_approval}
                className="rounded accent-[#0A84FF] w-4 h-4" />
              ✅ Onaylı
            </label>
          </div>

          {template.type === 'checklist' && (
            <div className="space-y-2">
              <label className="label">Maddeler</label>
              {editItems.map((t, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
                  <span className="flex-1 text-sm truncate">{t}</span>
                  <button type="button" onClick={() => setEditItems(a => a.filter((_, x) => x !== i))}
                    className="w-6 h-6 rounded-full bg-rose-500/15 text-rose-300 flex items-center justify-center shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  value={newItemText}
                  onChange={e => setNewItemText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEditItem(); } }}
                  placeholder="Yeni madde…"
                  className="input"
                />
                <button type="button" onClick={addEditItem} className="btn-outline shrink-0">
                  <Plus size={14} /> Ekle
                </button>
              </div>
            </div>
          )}

          <button className="btn-primary w-full" disabled={pending}>
            {pending ? 'Kaydediliyor…' : 'Şablonu Kaydet'}
          </button>
        </form>
      )}
      {error && !open && <p className="text-sm text-rose-300 mt-2">{error}</p>}

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
                    <input type="checkbox" name="assignees" value={p.id} className="rounded accent-[#0A84FF]" />
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
