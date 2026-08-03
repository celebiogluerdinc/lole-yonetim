import type { TaskPriority, TaskStatus } from './types';

export const TZ = 'Europe/Istanbul';

export function fmtDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('tr-TR', {
    timeZone: TZ,
    day: 'numeric', month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {})
  });
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('tr-TR', {
    timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long'
  });
}

export function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso), n = new Date();
  const k = (x: Date) => x.toLocaleDateString('tr-TR', { timeZone: TZ });
  return k(d) === k(n);
}

export function isOverdue(iso: string | null, status: TaskStatus): boolean {
  if (!iso) return false;
  if (['completed', 'cancelled'].includes(status)) return false;
  return new Date(iso).getTime() < Date.now();
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'Açık',
  in_progress: 'Devam ediyor',
  pending_review: 'Onay bekliyor',
  completed: 'Tamamlandı',
  blocked: 'Engellendi',
  overdue: 'Gecikti',
  cancelled: 'İptal'
};

export const STATUS_COLOR: Record<TaskStatus, string> = {
  open: 'bg-slate-100 text-slate-700',
  in_progress: 'bg-blue-100 text-blue-700',
  pending_review: 'bg-amber-100 text-amber-800',
  completed: 'bg-emerald-100 text-emerald-700',
  blocked: 'bg-rose-100 text-rose-700',
  overdue: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-400'
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  low: 'Düşük', normal: 'Normal', high: 'Yüksek', urgent: 'Acil'
};

export const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: 'text-slate-400', normal: 'text-slate-500',
  high: 'text-amber-600', urgent: 'text-rose-600'
};

export const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Süper Admin', admin: 'Admin', manager: 'Müdür', staff: 'Personel'
};
