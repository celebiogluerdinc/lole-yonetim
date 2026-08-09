'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { updateTask, deleteChecklistItem } from '@/app/(app)/tasks/actions';
import { useConfirm } from '@/components/ConfirmProvider';

interface Person { id: string; full_name: string; }
interface Item { id: string; title: string; is_done: boolean; }

/** Manager-only "Düzenle" panel on the task detail page:
 *  date/time, title, priority, assignees, and checklist items (add/remove). */
export default function TaskEdit({
  task, dueLocal, items, people, assigneeIds
}: {
  task: { id: string; title: string; description: string | null; priority: string;
          requires_photo: boolean; requires_approval: boolean; type: string;
          recurrence_rule?: string | null; parent_recurring_id?: string | null };
  dueLocal: string;            // "YYYY-MM-DDTHH:mm" (Istanbul)
  items: Item[];
  people: Person[];
  assigneeIds: string[];
}) {
  const router = useRouter();
  const confirmS = useConfirm();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [newItems, setNewItems] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());

  function addNewItem() {
    const t = newItemText.trim();
    if (!t) return;
    setNewItems(a => [...a, t]);
    setNewItemText('');
  }

  async function removeExistingItem(it: Item) {
    if (!(await confirmS({ message: `"${it.title}" maddesi silinsin mi?`, danger: true }))) return;
    setRemovedItems(s => new Set(s).add(it.id)); // optimistic
    start(async () => {
      const r = await deleteChecklistItem(it.id);
      if (r?.error) {
        setRemovedItems(s => { const n = new Set(s); n.delete(it.id); return n; });
        setError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-outline w-full">
        <Pencil size={15} /> Görevi Düzenle (tarih, saat, kişiler…)
      </button>
    );
  }

  return (
    <form
      action={(fd) => start(async () => {
        setError(null); setOk(false);
        fd.set('task_id', task.id);
        for (const t of newItems) fd.append('new_items', t);
        const r = await updateTask(fd);
        if (r?.error) setError(r.error);
        else {
          setOk(true);
          setNewItems([]);
          setOpen(false);
          router.refresh();
        }
      })}
      className="card p-4 space-y-4 border border-ios-blue/25"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold flex items-center gap-2"><Pencil size={14} /> Görevi Düzenle</h3>
        <button type="button" onClick={() => setOpen(false)}
          className="w-7 h-7 rounded-full bg-white/10 text-[#8E8E93] flex items-center justify-center"><X size={14} /></button>
      </div>

      {error && <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>}
      {ok && <p className="text-[13px] text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">✔ Kaydedildi.</p>}

      <div>
        <label className="label">Başlık</label>
        <input name="title" defaultValue={task.title} required minLength={2} className="input" />
      </div>
      <div>
        <label className="label">Açıklama</label>
        <textarea name="description" defaultValue={task.description ?? ''} rows={2} className="input" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Bitiş tarihi &amp; saati</label>
          <input name="due_at" type="datetime-local" defaultValue={dueLocal} required className="input" />
        </div>
        <div>
          <label className="label">Öncelik</label>
          <select name="priority" defaultValue={task.priority} className="input">
            <option value="low">Düşük</option>
            <option value="normal">Normal</option>
            <option value="high">Yüksek</option>
            <option value="urgent">Acil</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" name="requires_photo" defaultChecked={task.requires_photo}
            className="rounded accent-[#0A84FF] w-4 h-4" />
          📷 Fotoğraf zorunlu
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" name="requires_approval" defaultChecked={task.requires_approval}
            className="rounded accent-[#0A84FF] w-4 h-4" />
          ✅ Yönetici onayı gereksin
        </label>
      </div>

      <div>
        <label className="label">Atanan kişiler</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto rounded-xl border border-white/[0.10] p-3">
          {people.map(p => (
            <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="assignees" value={p.id}
                defaultChecked={assigneeIds.includes(p.id)}
                className="rounded accent-[#0A84FF] w-4 h-4" />
              <span className="truncate">{p.full_name}</span>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-[#8E8E93] mt-1">Yeni eklenen kişilere bildirim gönderilir.</p>
      </div>

      {task.type === 'checklist' && (
        <div className="space-y-2">
          <label className="label">Checklist maddeleri</label>
          {items.filter(it => !removedItems.has(it.id)).map(it => (
            <div key={it.id} className="flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2">
              <span className={`flex-1 text-sm truncate ${it.is_done ? 'line-through text-[#8E8E93]' : ''}`}>
                {it.title}
              </span>
              <button type="button" onClick={() => removeExistingItem(it)} title="Maddeyi sil"
                className="w-7 h-7 rounded-full bg-rose-500/15 text-rose-300 flex items-center justify-center hover:bg-rose-500/30 shrink-0">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {newItems.map((t, i) => (
            <div key={`n${i}`} className="flex items-center gap-2 rounded-xl bg-ios-blue/10 border border-ios-blue/25 px-3 py-2">
              <span className="flex-1 text-sm truncate">{t} <em className="text-[11px] text-ios-blue">(yeni)</em></span>
              <button type="button" onClick={() => setNewItems(a => a.filter((_, x) => x !== i))}
                className="w-7 h-7 rounded-full bg-white/10 text-[#8E8E93] flex items-center justify-center shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              value={newItemText}
              onChange={e => setNewItemText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addNewItem(); } }}
              placeholder="Yeni madde yazın…"
              className="input"
            />
            <button type="button" onClick={addNewItem} className="btn-outline shrink-0">
              <Plus size={14} /> Ekle
            </button>
          </div>
        </div>
      )}

      {(task.recurrence_rule || task.parent_recurring_id) && (
        <label className="flex items-start gap-2 text-sm cursor-pointer rounded-xl bg-ios-blue/10 border border-ios-blue/25 px-3 py-2.5">
          <input type="checkbox" name="apply_series" className="rounded accent-[#0A84FF] w-4 h-4 mt-0.5" />
          <span>
            🔁 <b>Serinin kalanına da uygula</b>
            <span className="block text-[12px] text-[#8E8E93]">
              Başlık, açıklama, öncelik, gereksinimler ve atanan kişiler bu serinin GELECEKTEKİ açık
              tekrarlarına da işlenir. Tarihler değişmez.
            </span>
          </span>
        </label>
      )}

      <button className="btn-primary w-full" disabled={pending}>
        {pending ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
      </button>
    </form>
  );
}
