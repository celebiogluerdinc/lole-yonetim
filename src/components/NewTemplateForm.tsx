'use client';

import { useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { createTemplate } from '@/app/(app)/manage/actions';
import { aiDraftTemplate } from '@/app/(app)/ai/actions';
import AiDraftBox from '@/components/AiDraftBox';

export default function NewTemplateForm({
  departments, aiAvailable = false
}: { departments: { id: string; name: string }[]; aiAvailable?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<'task' | 'checklist'>('checklist');
  const [items, setItems] = useState<string[]>(['']);
  const [draft, setDraft] = useState<any>(null);
  const [draftV, setDraftV] = useState(0);

  function applyDraft(d: any) {
    setDraft(d);
    setType(d.type === 'task' ? 'task' : 'checklist');
    setItems(Array.isArray(d.items) && d.items.length ? d.items : ['']);
    setDraftV(v => v + 1);
  }

  return (
    <div className="space-y-5">
    {aiAvailable && (
      <AiDraftBox
        placeholder='Örn: "Patisserie mutfağı için aylık derin temizlik şablonu hazırla"'
        hint="Yapay zeka sektör iyi uygulamalarından madde madde bir şablon önerir; düzenleyip kaydedersiniz."
        action={aiDraftTemplate}
        onDraft={applyDraft}
      />
    )}
    <form
      key={draftV}
      action={(fd) => start(async () => {
        setError(null);
        const r = await createTemplate(fd);
        if (r?.error) setError(r.error);
      })}
      className="space-y-5"
    >
      {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

      <div className="card p-5 space-y-4">
        <div className="segment">
          {(['checklist', 'task'] as const).map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`segment-item ${type === t ? 'segment-item-active' : ''}`}>
              {t === 'task' ? 'Tekil Görev' : 'Checklist'}
            </button>
          ))}
        </div>
        <input type="hidden" name="type" value={type} />

        <div>
          <label className="label">Şablon adı *</label>
          <input name="name" required className="input" placeholder="Örn: Günlük Açılış Checklisti"
            defaultValue={draft?.name ?? ''} />
        </div>
        <div>
          <label className="label">Açıklama</label>
          <textarea name="description" rows={2} className="input" defaultValue={draft?.description ?? ''} />
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
            <select name="default_priority" defaultValue={draft?.default_priority ?? 'normal'} className="input">
              <option value="low">Düşük</option>
              <option value="normal">Normal</option>
              <option value="high">Yüksek</option>
              <option value="urgent">Acil</option>
            </select>
          </div>
        </div>
        <div className="divide-y divide-black/[0.06]">
          <label className="flex items-center justify-between py-2.5 cursor-pointer">
            <span className="text-[15px]">📷 Fotoğraf zorunlu</span>
            <input type="checkbox" name="requires_photo" className="switch"
              defaultChecked={!!draft?.requires_photo} />
          </label>
          <label className="flex items-center justify-between py-2.5 cursor-pointer">
            <span className="text-[15px]">✅ Yönetici onayı gerekli</span>
            <input type="checkbox" name="requires_approval" className="switch"
              defaultChecked={!!draft?.requires_approval} />
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
                className="btn-ghost text-ios-blue text-sm"><Plus size={15} /> Madde ekle</button>
            </div>
          </div>
        )}
      </div>

      <button className="btn-primary w-full !py-3" disabled={pending}>
        {pending ? 'Kaydediliyor…' : 'Şablonu Kaydet'}
      </button>
    </form>
    </div>
  );
}
