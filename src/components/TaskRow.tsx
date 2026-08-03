'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Check, Camera, ChevronRight, ClipboardList } from 'lucide-react';
import type { Task } from '@/lib/types';
import { fmtDate, isOverdue, STATUS_LABEL, STATUS_COLOR, PRIORITY_COLOR, PRIORITY_LABEL } from '@/lib/utils';
import { quickComplete } from '@/app/(app)/tasks/actions';

export default function TaskRow({
  task, progress
}: {
  task: Task;
  progress?: { done: number; total: number };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const done = task.status === 'completed';
  const overdue = isOverdue(task.due_at, task.status);
  const isChecklist = task.type === 'checklist';
  const needsDetail = isChecklist || task.requires_photo;

  function onTick() {
    if (done) return;
    if (needsDetail) {
      router.push(`/tasks/${task.id}`);
      return;
    }
    start(async () => {
      await quickComplete(task.id);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3 p-4 hover:bg-slate-50/60 transition-colors">
      <button
        onClick={onTick}
        disabled={pending || done}
        aria-label={done ? 'Tamamlandı' : 'Tamamla'}
        className={`tick ${done ? 'tick-done' : ''} ${pending ? 'opacity-50' : ''}`}
      >
        {done && <Check size={14} strokeWidth={3} />}
      </button>

      <Link href={`/tasks/${task.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium truncate ${done ? 'line-through text-slate-400' : ''}`}>
            {task.title}
          </p>
          {task.requires_photo && <Camera size={13} className="text-slate-400 shrink-0" />}
          {isChecklist && <ClipboardList size={13} className="text-slate-400 shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs">
          <span className={overdue ? 'text-rose-600 font-medium' : 'text-slate-400'}>
            {fmtDate(task.due_at)}
          </span>
          <span className={PRIORITY_COLOR[task.priority]}>•</span>
          <span className="text-slate-400">{PRIORITY_LABEL[task.priority]}</span>
          {!['open', 'completed'].includes(task.status) && (
            <span className={`badge ${STATUS_COLOR[task.status]}`}>{STATUS_LABEL[task.status]}</span>
          )}
        </div>
        {progress && progress.total > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="h-1.5 flex-1 max-w-[140px] rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-400">{progress.done}/{progress.total}</span>
          </div>
        )}
      </Link>

      <ChevronRight size={16} className="text-slate-300 shrink-0" />
    </div>
  );
}
