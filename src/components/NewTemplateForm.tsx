'use client';

import { useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { createTemplate } from '@/app/(app)/manage/actions';

export default function NewTemplateForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<'task' | 'checklist'>('checklist');
  const [items, setItems] = useState<string[]>(['']);

  return (
    <form
      action={(fd) => start(async () => {
        setError(null);
        const r = await createTemplate(fd);
        if (r?.error) setError(r.error);
      })}
      className="space-y-5"
    >
      {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="card p-5 space-y-4">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {(['checklist', 'task'] as const).map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                type === t ? 'bg-white shadow-sm' : 'text-slate-500'}`}>
              {t === 'task' ? 'Tekil Görev' : 'Checklist'}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />

        <div>
          <label className="label">Şablon adı *</label>
          <input name="name" required className="input" placeholder="Örn: Günlük Açılış Checklisti" />
        </div>
        <div>
          <label className="label">Açıklama</label>
          <textarea name="description" rows={2} className="input" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Departman (opsiyonel)</label>
            <select name="department_id" className="input">
              <option value="">Tüm şirket</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Varsayılan öncelik</label>
            <select name="default_priority" defaultValue="normal" className="input">
              <option value="low">Düşük</option>
              <option value="normal">Normal</option>
              <option value="high">Yüksek</option>
              <option value="urgent">Acil</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="requires_photo" className="rounded accent-[#ff5a1f] w-4 h-4" />
            📷 Fotoğraf zorunlu
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" name="requires_approval" className="rounded accent-[#ff5a1f] w-4 h-4" />
            ✅ Yönetici onayı gerekli
          </label>
        </div>

        {type === 'checklist' && (
          <div>
            <label className="label">Maddeler</label>
            <div className="space-y-2">
              {items.map((val, i) => (
                <div key={i} className="flex gap-2">
                  <input name="items" value={val}
                    onChange={e => setItems(arr => arr.map((v, j) => j === i ? e.target.value : v))}
                    className="input" placeholder={`Madde ${i + 1}`} />
                  {items.length > 1 && (
                    <button type="button" onClick={() => setItems(arr => arr.filter((_, j) => j !== i))}
                      className="btn-ghost !px-2 text-slate-400"><X size={16} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setItems(arr => [...arr, ''])}
                className="btn-ghost text-brand-600 text-sm"><Plus size={15} /> Madde ekle</button>
            </div>
          </div>
        )}
      </div>

      <button className="btn-primary w-full !py-3" disabled={pending}>
        {pending ? 'Kaydediliyor…' : 'Şablonu Kaydet'}
      </button>
    </form>
  );
}
