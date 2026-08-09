'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus, Search, Camera, ClipboardList, ShieldCheck, ChevronRight, Flag,
  CheckCheck, Ban
} from 'lucide-react';
import { TZ } from '@/lib/utils';
import { managerSetTaskStatus } from '@/app/(app)/tasks/actions';
import AutoRefresh from '@/components/AutoRefresh';
import PrintButton, { type PrintTable } from '@/components/PrintButton';

interface Row {
  id: string; title: string; type: string; status: string; priority: string;
  due_at: string | null; department_id: string | null; department: string | null;
  assignees: string[]; progress: { done: number; total: number } | null;
  requires_photo: boolean; requires_approval: boolean; blocked_reason: string | null;
}

const FILTERS = [
  { key: 'active', label: 'Aktif', color: '#007AFF' },
  { key: 'today', label: 'Bugün', color: '#34C759' },
  { key: 'open', label: 'Açık', color: '#8E8E93' },
  { key: 'in_progress', label: 'Devam Eden', color: '#007AFF' },
  { key: 'pending_review', label: 'Onay Bekleyen', color: '#FF9500' },
  { key: 'blocked', label: 'Engelli', color: '#FF3B30' },
  { key: 'overdue', label: 'Geciken', color: '#FF3B30' },
  { key: 'completed', label: 'Tamamlanan', color: '#34C759' },
  { key: 'all', label: 'Tümü', color: '#8E8E93' }
] as const;

const BADGE: Record<string, { label: string; cls: string }> = {
  open: { label: 'Açık', cls: 'bg-white/[0.07] text-[#D1D1D6]' },
  in_progress: { label: 'Devam ediyor', cls: 'bg-blue-500/20 text-blue-300' },
  pending_review: { label: 'Onay bekliyor', cls: 'bg-amber-500/20 text-amber-300' },
  completed: { label: 'Tamamlandı', cls: 'bg-emerald-500/20 text-emerald-300' },
  blocked: { label: 'Engellendi', cls: 'bg-rose-500/20 text-rose-300' },
  overdue: { label: 'Gecikti', cls: 'bg-rose-500/20 text-rose-300' },
  cancelled: { label: 'İptal', cls: 'bg-white/10 text-[#8E8E93]' }
};

/** effective status: past-due open work counts as overdue even before cron flips it */
function eff(r: Row): string {
  if (['completed', 'cancelled', 'blocked', 'pending_review'].includes(r.status)) return r.status;
  if (r.due_at && new Date(r.due_at).getTime() < Date.now()) return 'overdue';
  return r.status;
}

const istDayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
/** Bugünün görevi mi? (İstanbul takvimi) */
function isTodayRow(r: Row): boolean {
  return !!r.due_at && istDayKey(new Date(r.due_at)) === istDayKey(new Date());
}

const tr = (s: string) => s.toLocaleLowerCase('tr-TR');

export default function TaskBoard({
  rows, departments, initialFilter = 'active'
}: { rows: Row[]; departments: { id: string; name: string }[]; initialFilter?: string }) {
  const router = useRouter();
  const [, startBg] = useTransition();
  const [filter, setFilter] = useState<string>(
    FILTERS.some(f => f.key === initialFilter) ? initialFilter : 'active'
  );
  const [dept, setDept] = useState<string>('');
  const [q, setQ] = useState('');
  // optimistic status overrides — quick actions feel instant
  const [override, setOverride] = useState<Record<string, string>>({});
  const [actionErr, setActionErr] = useState<string | null>(null);

  function quickSet(id: string, status: 'completed' | 'cancelled') {
    setActionErr(null);
    const prev = override[id];
    setOverride(o => ({ ...o, [id]: status })); // instant
    startBg(async () => {
      const r = await managerSetTaskStatus(id, status);
      if (r?.error) {
        setOverride(o => ({ ...o, [id]: prev ?? '' }));
        setActionErr(r.error);
      } else {
        router.refresh();
      }
    });
  }

  const effRow = (r: Row) => override[r.id] || eff(r);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, active: 0, today: 0 };
    for (const r of rows) {
      const e = effRow(r);
      c[e] = (c[e] ?? 0) + 1;
      if (!['completed', 'cancelled'].includes(e)) {
        c.active++;
        if (isTodayRow(r)) c.today++;
      }
    }
    return c;
  }, [rows, override]);

  const filtered = useMemo(() => rows.filter(r => {
    const e = effRow(r);
    if (filter === 'active' && ['completed', 'cancelled'].includes(e)) return false;
    if (filter === 'today' && (['completed', 'cancelled'].includes(e) || !isTodayRow(r))) return false;
    if (!['active', 'all', 'today'].includes(filter) && e !== filter) return false;
    if (dept && r.department_id !== dept) return false;
    if (q) {
      const hay = tr(r.title + ' ' + r.assignees.join(' ') + ' ' + (r.department ?? ''));
      if (!hay.includes(tr(q))) return false;
    }
    return true;
  }), [rows, filter, dept, q, override]);

  const fmtDue = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('tr-TR', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—';

  const printTable: PrintTable = useMemo(() => {
    const filterLabel = FILTERS.find(f => f.key === filter)?.label ?? '';
    const deptLabel = dept ? (departments.find(d => d.id === dept)?.name ?? '') : 'Tüm departmanlar';
    return {
      title: 'Görev Listesi',
      subtitle: `Filtre: ${filterLabel} · ${deptLabel}${q ? ` · Arama: "${q}"` : ''}`,
      landscape: true,
      headers: ['Görev', 'Durum', 'Bitiş', 'Departman', 'Atananlar', 'İlerleme'],
      rows: filtered.map(r => [
        r.title,
        BADGE[effRow(r)]?.label ?? effRow(r),
        fmtDue(r.due_at),
        r.department ?? '—',
        r.assignees.length ? r.assignees.join(', ') : 'Atanmamış',
        r.progress ? `${r.progress.done}/${r.progress.total}` : '—'
      ])
    };
  }, [filtered, filter, dept, q, departments, override]);

  return (
    <main className="max-w-4xl mx-auto p-4 md:p-8 space-y-5">
      <AutoRefresh seconds={15} />
      <header className="px-1 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">Görevler</h1>
          <p className="text-[14px] text-[#8E8E93] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-ios-green animate-pulse inline-block" />
            Canlı takip · {counts.active} aktif / {rows.length} toplam
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PrintButton table={printTable} label="PDF" />
          <Link href="/manage/tasks/new" className="btn-primary">
            <Plus size={16} /> Yeni Görev
          </Link>
        </div>
      </header>

      {actionErr && (
        <p className="text-[13px] text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl px-3 py-2">{actionErr}</p>
      )}

      {/* Status filter chips with counts */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors flex items-center gap-1.5 ${
              filter === f.key ? 'text-white' : 'bg-[#1C1C1E] text-[#D1D1D6] shadow-[0_0_0_0.5px_rgba(255,255,255,0.09)]'
            }`}
            style={filter === f.key ? { backgroundColor: f.color } : undefined}
          >
            {f.label}
            <span className={`text-[11px] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center ${
              filter === f.key ? 'bg-[#1C1C1E]/25' : 'bg-[#1C1C1E]/[0.10]'}`}>
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search + department */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#AEAEB2]" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Görev, kişi veya departman ara…"
            className="input !pl-10"
          />
        </div>
        <select value={dept} onChange={e => setDept(e.target.value)} className="input sm:w-56">
          <option value="">Tüm departmanlar</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="card divide-y divide-white/[0.08] overflow-hidden">
        {filtered.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-[15px] text-[#8E8E93]">Bu filtrelerle eşleşen görev yok.</p>
          </div>
        )}
        {filtered.map(r => {
          const e = effRow(r);
          const badge = BADGE[e] ?? BADGE.open;
          const overdue = e === 'overdue';
          return (
            <Link key={r.id} href={`/tasks/${r.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#1C1C1E]/[0.04] transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={`text-[15px] font-medium truncate ${e === 'completed' ? 'line-through text-[#AEAEB2]' : ''}`}>
                    {r.title}
                  </p>
                  {r.type === 'checklist' && <ClipboardList size={13} className="text-[#AEAEB2] shrink-0" />}
                  {r.requires_photo && <Camera size={13} className="text-[#AEAEB2] shrink-0" />}
                  {r.requires_approval && <ShieldCheck size={13} className="text-[#AEAEB2] shrink-0" />}
                  {['high', 'urgent'].includes(r.priority) && e !== 'completed' && (
                    <Flag size={13} className="text-ios-orange fill-ios-orange shrink-0" />
                  )}
                </div>
                <p className="text-[13px] text-[#8E8E93] truncate mt-0.5">
                  <span className={overdue ? 'text-ios-red font-medium' : ''}>{fmtDue(r.due_at)}</span>
                  {r.department ? ` · ${r.department}` : ''}
                  {r.assignees.length ? ` · 👤 ${r.assignees.join(', ')}` : ' · Atanmamış'}
                </p>
                {r.progress && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="h-[5px] w-32 rounded-full bg-[#1C1C1E]/[0.12] overflow-hidden">
                      <div className="h-full bg-ios-blue rounded-full"
                        style={{ width: `${(r.progress.done / r.progress.total) * 100}%` }} />
                    </div>
                    <span className="text-[11px] text-[#8E8E93]">{r.progress.done}/{r.progress.total}</span>
                  </div>
                )}
                {e === 'blocked' && r.blocked_reason && (
                  <p className="text-[12px] text-ios-red mt-1 truncate">🚧 {r.blocked_reason}</p>
                )}
              </div>
              {!['completed', 'cancelled'].includes(e) && (
                <span className="flex gap-1 shrink-0" onClick={ev => { ev.preventDefault(); ev.stopPropagation(); }}>
                  <button
                    title="Görevi bitir"
                    onClick={() => { if (window.confirm(`"${r.title}" tamamlandı olarak işaretlensin mi?`)) quickSet(r.id, 'completed'); }}
                    className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-300 flex items-center justify-center hover:bg-emerald-500/30 active:scale-90 transition-all"
                  >
                    <CheckCheck size={15} />
                  </button>
                  <button
                    title="Görevi iptal et"
                    onClick={() => { if (window.confirm(`"${r.title}" iptal edilsin mi?`)) quickSet(r.id, 'cancelled'); }}
                    className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-300 flex items-center justify-center hover:bg-rose-500/30 active:scale-90 transition-all"
                  >
                    <Ban size={14} />
                  </button>
                </span>
              )}
              <span className={`badge shrink-0 ${badge.cls}`}>{badge.label}</span>
              <ChevronRight size={15} className="text-[#C7C7CC] shrink-0" />
            </Link>
          );
        })}
      </div>
    </main>
  );
}
