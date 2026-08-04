'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { createTask } from '@/app/(app)/manage/actions';
import { aiDraftTask, aiSuggestAssignees } from '@/app/(app)/ai/actions';
import AiDraftBox from '@/components/AiDraftBox';
import { Sparkles } from 'lucide-react';

interface Dept { id: string; name: string; }
interface Person { id: string; full_name: string; role: string; }
interface Membership { department_id: string; user_id: string; }

const WEEKDAYS = [
  ['MO', 'Pzt'], ['TU', 'Sal'], ['WE', 'Çar'], ['TH', 'Per'],
  ['FR', 'Cum'], ['SA', 'Cmt'], ['SU', 'Paz']
] as const;

const tr = (s: string) => s.toLocaleLowerCase('tr-TR');

export default function NewTaskForm({
  departments, people, memberships, aiAvailable = false
}: { departments: Dept[]; people: Person[]; memberships: Membership[]; aiAvailable?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<'task' | 'checklist'>('task');
  const [deptId, setDeptId] = useState(departments[0]?.id ?? '');
  const [items, setItems] = useState<string[]>(['']);
  const [recur, setRecur] = useState<'none' | 'daily' | 'weekly' | 'monthly' | 'custom'>('none');
  const [draft, setDraft] = useState<any>(null);
  const [draftV, setDraftV] = useState(0);
  const [suggestion, setSuggestion] = useState<{ reason: string } | null>(null);
  const [suggestPending, startSuggest] = useTransition();

  const deptPeople = useMemo(() => {
    const ids = new Set(memberships.filter(m => m.department_id === deptId).map(m => m.user_id));
    const inDept = people.filter(p => ids.has(p.id));
    return inDept.length ? inDept : people;
  }, [deptId, people, memberships]);

  function applyDraft(d: any) {
    setDraft(d);
    setType(d.type === 'checklist' ? 'checklist' : 'task');
    setItems(Array.isArray(d.items) && d.items.length ? d.items : ['']);
    setRecur('none');
    if (d.department_name) {
      const match = departments.find(x => tr(x.name) === tr(d.department_name));
      if (match) setDeptId(match.id);
    }
    setDraftV(v => v + 1);
  }

  const isPreassigned = (p: Person) =>
    Array.isArray(draft?.assignee_names) &&
    draft.assignee_names.some((n: string) => tr(p.full_name).includes(tr(n)) || tr(n).includes(tr(p.full_name)));

  return (
    <div className="space-y-5">
      {aiAvailable && (
        <AiDraftBox
          placeholder='Örn: "Yarın 08:00 restoran açılış checklisti — buzdolabı ısıları, tezgah hijyeni, kasa sayımı — mutfak ekibine, fotoğraflı"'
          hint="Tarif edin, yapay zeka formu doldursun. Kontrol edip siz atayacaksınız."
          action={aiDraftTask}
          onDraft={applyDraft}
        />
      )}

      <form
        key={draftV}
        action={(fd) => start(async () => {
          setError(null);
          const r = await createTask(fd);
          if (r?.error) setError(r.error);
        })}
        className="space-y-5"
      >
        {error && <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="card p-5 space-y-4">
          {/* Type — iOS segmented control */}
          <div className="segment">
            {(['task', 'checklist'] as const).map(t => (
              <button key={t} type="button" onClick={() => setType(t)}
                className={`segment-item ${type === t ? 'segment-item-active' : ''}`}>
                {t === 'task' ? 'Tekil Görev' : 'Checklist'}
              </button>
            ))}
          </div>
          <input type="hidden" name="type" value={type} />

          <div>
            <label className="label">Başlık *</label>
            <input name="title" required className="input" placeholder="Örn: Depo sayımı"
              defaultValue={draft?.title ?? ''} />
          </div>
          <div>
            <label className="label">Açıklama</label>
            <textarea name="description" rows={2} className="input" placeholder="Detaylar…"
              defaultValue={draft?.description ?? ''} />
          </div>

          {type === 'checklist' && (
            <div>
              <label className="label">Checklist maddeleri *</label>
              <div className="space-y-2">
                {items.map((val, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      name="items" value={val}
                      onChange={e => setItems(arr => arr.map((v, j) => j === i ? e.target.value : v))}
                      className="input" placeholder={`Madde ${i + 1}`}
                    />
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems(arr => arr.filter((_, j) => j !== i))}
                        className="btn-ghost !px-2 text-[#AEAEB2]"><X size={16} /></button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => setItems(arr => [...arr, ''])}
                  className="btn-ghost text-ios-blue text-sm"><Plus size={15} /> Madde ekle</button>
              </div>
            </div>
          )}
        </div>

        <div className="card p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Departman *</label>
              <select name="department_id" required value={deptId}
                onChange={e => setDeptId(e.target.value)} className="input">
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Bitiş tarihi &amp; saati *</label>
              <input name="due_at" type="datetime-local" required className="input"
                defaultValue={draft?.due_at ?? ''} />
            </div>
            <div>
              <label className="label">Öncelik</label>
              <select name="priority" defaultValue={draft?.priority ?? 'normal'} className="input">
                <option value="low">Düşük</option>
                <option value="normal">Normal</option>
                <option value="high">Yüksek</option>
                <option value="urgent">Acil</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label !mb-0">Atanacak kişiler *</label>
              {aiAvailable && (
                <button
                  type="button"
                  disabled={suggestPending}
                  onClick={(e) => {
                    const form = (e.currentTarget as HTMLButtonElement).form;
                    const title = String(new FormData(form!).get('title') ?? '');
                    startSuggest(async () => {
                      setSuggestion(null);
                      const r = await aiSuggestAssignees(deptId, title);
                      if (r?.suggestion) {
                        setSuggestion({ reason: r.suggestion.reason ?? '' });
                        const rec: string[] = (r.suggestion.recommended ?? []).map((n: string) => tr(n));
                        form?.querySelectorAll<HTMLInputElement>('input[name="assignees"]').forEach(cb => {
                          const p = deptPeople.find(x => x.id === cb.value);
                          if (p && rec.some(n => tr(p.full_name).includes(n) || n.includes(tr(p.full_name)))) {
                            cb.checked = true;
                          }
                        });
                      } else if (r?.error) {
                        setSuggestion({ reason: r.error });
                      }
                    });
                  }}
                  className="flex items-center gap-1 text-[13px] font-semibold text-[#5E5CE6] disabled:opacity-40"
                >
                  <Sparkles size={13} />
                  {suggestPending ? 'Hesaplanıyor…' : 'Kime verelim?'}
                </button>
              )}
            </div>
            {suggestion && (
              <p className="text-[13px] text-[#5E5CE6] bg-[#5E5CE6]/[0.07] rounded-xl px-3 py-2 mb-2">
                ✨ {suggestion.reason}
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded-xl border border-black/[0.08] p-3">
              {deptPeople.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                  <input type="checkbox" name="assignees" value={p.id}
                    defaultChecked={isPreassigned(p)}
                    className="rounded accent-[#007AFF] w-4 h-4" />
                  <span className="truncate">{p.full_name}</span>
                </label>
              ))}
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
        </div>

        {/* Recurrence */}
        <div className="card p-5 space-y-4">
          <label className="label">Tekrar</label>
          <div className="flex flex-wrap gap-1.5">
            {([['none', 'Tek seferlik'], ['daily', 'Günlük'], ['weekly', 'Haftalık'], ['monthly', 'Aylık'], ['custom', 'Özel']] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setRecur(k)}
                className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                  recur === k ? 'bg-ios-blue text-white' : 'bg-ios-fill text-[#1c1c1e] hover:bg-black/10'}`}>
                {l}
              </button>
            ))}
          </div>
          <input type="hidden" name="recur" value={recur} />

          {recur === 'weekly' && (
            <div className="flex gap-1.5 flex-wrap">
              {WEEKDAYS.map(([k, l]) => (
                <label key={k} className="cursor-pointer">
                  <input type="checkbox" name="weekdays" value={k} className="peer hidden" />
                  <span className="inline-block rounded-lg bg-ios-fill px-3 py-1.5 text-[13px] font-medium peer-checked:bg-ios-blue peer-checked:text-white transition-colors">
                    {l}
                  </span>
                </label>
              ))}
            </div>
          )}
          {recur === 'monthly' && (
            <div className="max-w-[200px]">
              <label className="label">Ayın günü</label>
              <input name="monthday" type="number" min={1} max={31} defaultValue={1} className="input" />
            </div>
          )}
          {recur === 'custom' && (
            <div>
              <label className="label">RRULE (iCal)</label>
              <input name="custom_rrule" className="input" placeholder="FREQ=WEEKLY;INTERVAL=2;BYDAY=MO" />
            </div>
          )}
          {recur !== 'none' && (
            <div className="grid grid-cols-2 gap-4 max-w-xs">
              <div>
                <label className="label">Aralık (her N)</label>
                <input name="interval" type="number" min={1} max={90} defaultValue={1} className="input" />
              </div>
              <div>
                <label className="label">Kaç tekrar üretilsin</label>
                <input name="count" type="number" min={1} max={30} defaultValue={8} className="input" />
              </div>
            </div>
          )}
        </div>

        <button className="btn-primary w-full !py-3.5 text-base" disabled={pending}>
          {pending ? 'Oluşturuluyor…' : 'Görevi Oluştur ve Ata'}
        </button>
      </form>
    </div>
  );
}
