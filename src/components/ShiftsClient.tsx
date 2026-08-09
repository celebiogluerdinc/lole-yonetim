'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X, Repeat } from 'lucide-react';
import { addShift, deleteShift, deleteShiftSeries } from '@/app/(app)/hr/actions';
import PrintButton, { type PrintTable } from '@/components/PrintButton';
import { useConfirm } from '@/components/ConfirmProvider';

export interface ShiftRow {
  id: string; user_id: string; name: string; dept: string | null;
  starts_at: string; ends_at: string; note: string | null; series_id: string | null;
  day: string;   // YYYY-MM-DD (Istanbul)
  t: string;     // "09:00–17:00"
}
interface Person { id: string; full_name: string; }
interface Dept { id: string; name: string; }
interface Membership { department_id: string; user_id: string; }

const WEEKDAYS = [
  ['MO', 'Pzt'], ['TU', 'Sal'], ['WE', 'Çar'], ['TH', 'Per'],
  ['FR', 'Cum'], ['SA', 'Cmt'], ['SU', 'Paz']
] as const;

export default function ShiftsClient({
  view, days, dayLabels, todayKey, shifts, people, departments, memberships, meId, isManager
}: {
  view: 'week' | 'month';
  days: string[];            // week view: 7 ISO dates
  dayLabels: string[];       // matching short labels
  todayKey: string;
  shifts: ShiftRow[];
  people: Person[];
  departments: Dept[];
  memberships: Membership[];
  meId: string;
  isManager: boolean;
}) {
  const router = useRouter();
  const confirmS = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set()); // optimistic deletes
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ userId?: string; date?: string }>({});
  const [deptId, setDeptId] = useState(departments[0]?.id ?? '');
  const [repeat, setRepeat] = useState<'none' | 'weekly'>('none');
  const formRef = useRef<HTMLFormElement>(null);

  const visible = shifts.filter(s => !hidden.has(s.id));

  const run = (fn: () => Promise<any>, okText?: string) => start(async () => {
    setError(null); setOk(null);
    const r = await fn();
    if (r?.error) setError(r.error);
    else { if (okText) setOk(okText); router.refresh(); }
  });

  function removeOne(s: ShiftRow) {
    setHidden(h => new Set(h).add(s.id));
    run(() => deleteShift(s.id));
  }
  async function removeSeries(s: ShiftRow) {
    if (!s.series_id) return;
    if (!(await confirmS({ message: 'Bu tekrarlayan serinin TÜM vardiyaları silinsin mi?', danger: true }))) return;
    setHidden(h => {
      const n = new Set(h);
      shifts.filter(x => x.series_id === s.series_id).forEach(x => n.add(x.id));
      return n;
    });
    run(() => deleteShiftSeries(s.series_id!), 'Seri silindi.');
  }

  const deptPeople = useMemo(() => {
    const ids = new Set(memberships.filter(m => m.department_id === deptId).map(m => m.user_id));
    const inDept = people.filter(p => ids.has(p.id));
    return inDept.length ? inDept : people;
  }, [deptId, people, memberships]);

  // ---------- print / PDF ----------
  const fmtDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('tr-TR', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
  const printTable: PrintTable = useMemo(() => {
    if (view === 'week' && isManager) {
      return {
        title: 'Vardiya Planı — Haftalık',
        subtitle: `${fmtDay(days[0])} – ${fmtDay(days[6])}`,
        landscape: true,
        headers: ['Personel', ...dayLabels],
        rows: people.map(p => [
          p.full_name + (p.id === meId ? ' (siz)' : ''),
          ...days.map(d =>
            visible.filter(s => s.user_id === p.id && s.day === d)
              .map(s => s.t + (s.note ? `\n${s.note}` : '')).join('\n') || '—')
        ])
      };
    }
    const sorted = [...visible].sort((a, b) =>
      a.day === b.day ? a.starts_at.localeCompare(b.starts_at) : a.day.localeCompare(b.day));
    return {
      title: view === 'month' ? 'Vardiya Listesi — Aylık' : 'Vardiya Programım',
      subtitle: sorted.length ? `${fmtDay(sorted[0].day)} – ${fmtDay(sorted[sorted.length - 1].day)}` : undefined,
      headers: ['Tarih', 'Saat', 'Personel', 'Departman', 'Not'],
      rows: sorted.map(s => [fmtDay(s.day), s.t, s.name, s.dept ?? '—', s.note ?? '—'])
    };
  }, [view, isManager, days, dayLabels, people, visible, meId]);

  function openPlanner(userId?: string, date?: string) {
    setPrefill({ userId, date });
    setPlannerOpen(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  }

  // ---------- shared chip ----------
  const Chip = ({ s, compact = false }: { s: ShiftRow; compact?: boolean }) => (
    <div className={`group relative rounded-lg bg-ios-blue/15 border border-ios-blue/25 px-1.5 py-1 ${compact ? '' : 'px-2.5 py-1.5'}`}>
      <p className="text-[11px] font-semibold text-ios-blue leading-tight flex items-center gap-1">
        {s.t}{s.series_id && <Repeat size={9} className="opacity-70" />}
      </p>
      {!compact && (
        <p className="text-[11px] text-[#D1D1D6] truncate">{s.name}</p>
      )}
      {s.note && <p className="text-[10px] text-[#8E8E93] truncate">{s.note}</p>}
      {isManager && (
        <span className="absolute -top-1.5 -right-1.5 hidden group-hover:flex gap-0.5">
          <button title="Bu vardiyayı sil" onClick={() => removeOne(s)}
            className="w-[18px] h-[18px] rounded-full bg-ios-red text-white flex items-center justify-center">
            <X size={10} strokeWidth={3} />
          </button>
          {s.series_id && (
            <button title="Tüm seriyi sil" onClick={() => removeSeries(s)}
              className="w-[18px] h-[18px] rounded-full bg-[#8E8E93] text-white flex items-center justify-center">
              <Repeat size={9} strokeWidth={3} />
            </button>
          )}
        </span>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {error && <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{error}</p>}
      {ok && <p className="text-[13px] text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">✔ {ok}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {isManager && !plannerOpen && (
          <button onClick={() => openPlanner()} className="btn-primary">
            <Plus size={16} /> Vardiya Planla
          </button>
        )}
        <PrintButton table={printTable} />
      </div>

      {/* ---------- PLANNER ---------- */}
      {isManager && plannerOpen && (
        <form
          ref={formRef}
          action={(fd) => start(async () => {
            setError(null); setOk(null);
            fd.set('department_id', deptId);
            fd.set('repeat', repeat);
            const r = await addShift(fd);
            if (r?.error) setError(r.error);
            else {
              setOk(`${r?.count ?? ''} vardiya oluşturuldu.`);
              setPlannerOpen(false);
              router.refresh();
            }
          })}
          className="card p-4 space-y-4 border border-ios-blue/25"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold">Vardiya Planla</h3>
            <button type="button" onClick={() => setPlannerOpen(false)}
              className="w-7 h-7 rounded-full bg-white/10 text-[#8E8E93] flex items-center justify-center"><X size={14} /></button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="label">Departman</label>
              <select value={deptId} onChange={e => setDeptId(e.target.value)} className="input">
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{repeat === 'weekly' ? 'Başlangıç haftası' : 'Tarih'}</label>
              <input name="date" type="date" required defaultValue={prefill.date ?? todayKey} className="input" />
            </div>
            <div>
              <label className="label">Başlangıç</label>
              <input name="start" type="time" required defaultValue="09:00" className="input" />
            </div>
            <div>
              <label className="label">Bitiş</label>
              <input name="end" type="time" required defaultValue="17:00" className="input" />
            </div>
          </div>

          <div>
            <label className="label">Personel (birden fazla seçilebilir)</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto rounded-xl border border-white/[0.10] p-3">
              {deptPeople.map(p => (
                <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" name="user_ids" value={p.id}
                    defaultChecked={prefill.userId === p.id}
                    className="rounded accent-[#0A84FF] w-4 h-4" />
                  <span className="truncate">{p.full_name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tekrar */}
          <div className="space-y-3">
            <div className="segment max-w-xs">
              <button type="button" onClick={() => setRepeat('none')}
                className={`segment-item ${repeat === 'none' ? 'segment-item-active' : ''}`}>Tek seferlik</button>
              <button type="button" onClick={() => setRepeat('weekly')}
                className={`segment-item ${repeat === 'weekly' ? 'segment-item-active' : ''}`}>🔁 Haftalık tekrar</button>
            </div>
            {repeat === 'weekly' && (
              <div className="flex flex-wrap items-end gap-3">
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
                <div className="w-28">
                  <label className="label">Kaç hafta</label>
                  <input name="weeks" type="number" min={1} max={12} defaultValue={4} className="input" />
                </div>
              </div>
            )}
          </div>

          <input name="note" className="input" placeholder="Not (opsiyonel — örn. Kapanış vardiyası)" />
          <button className="btn-primary w-full" disabled={pending}>
            {pending ? 'Oluşturuluyor…' : repeat === 'weekly' ? 'Tekrarlayan Vardiyaları Oluştur' : 'Vardiyayı Kaydet'}
          </button>
        </form>
      )}

      {/* ---------- WEEK GRID (manager) ---------- */}
      {view === 'week' && isManager && (
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse min-w-[760px]">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="text-left text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wide px-3 py-2.5 sticky left-0 bg-[#1C1C1E] z-10 w-36">
                  Personel
                </th>
                {days.map((d, i) => (
                  <th key={d} className={`text-center text-[12px] font-semibold px-1 py-2.5 ${
                    d === todayKey ? 'text-ios-blue' : 'text-[#8E8E93]'}`}>
                    {dayLabels[i]}
                    {d === todayKey && <span className="block w-1.5 h-1.5 rounded-full bg-ios-blue mx-auto mt-0.5" />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {people.map(p => {
                const isMe = p.id === meId;
                return (
                  <tr key={p.id} className={isMe ? 'bg-ios-blue/[0.05]' : ''}>
                    <td className="px-3 py-2 sticky left-0 bg-[#1C1C1E] z-10">
                      <p className="text-[13px] font-medium truncate max-w-[120px]">
                        {p.full_name}{isMe ? ' (siz)' : ''}
                      </p>
                    </td>
                    {days.map(d => {
                      const cell = visible.filter(s => s.user_id === p.id && s.day === d);
                      return (
                        <td key={d} className="px-1 py-1.5 align-top">
                          <div className="space-y-1 min-h-[34px]">
                            {cell.map(s => <Chip key={s.id} s={s} compact />)}
                            {isManager && cell.length === 0 && (
                              <button
                                onClick={() => openPlanner(p.id, d)}
                                className="w-full h-[34px] rounded-lg border border-dashed border-white/[0.10] text-[#48484A] hover:text-ios-blue hover:border-ios-blue/40 transition-colors text-[13px]"
                                title="Vardiya ekle"
                              >
                                +
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ---------- MONTH VIEW & STAFF LIST ---------- */}
      {(view === 'month' || !isManager) && (
        <MonthList shifts={visible} isManager={isManager} Chip={Chip} />
      )}
    </div>
  );
}

function MonthList({
  shifts, isManager, Chip
}: { shifts: ShiftRow[]; isManager: boolean; Chip: any }) {
  const byDay: Record<string, ShiftRow[]> = {};
  for (const s of shifts) (byDay[s.day] ??= []).push(s);
  const dayKeys = Object.keys(byDay).sort();

  if (dayKeys.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-3xl mb-2">🗓</p>
        <p className="text-[15px] text-[#8E8E93]">Bu dönemde planlanmış vardiya yok.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {dayKeys.map(day => {
        const label = new Date(day + 'T12:00:00').toLocaleDateString('tr-TR', {
          weekday: 'long', day: 'numeric', month: 'long'
        });
        return (
          <section key={day}>
            <h2 className="section-title capitalize">{label} · {byDay[day].length} vardiya</h2>
            <div className="card p-3 flex flex-wrap gap-2">
              {byDay[day]
                .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                .map(s => <Chip key={s.id} s={s} />)}
            </div>
          </section>
        );
      })}
    </div>
  );
}
