'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Check, Camera, ChevronRight, ClipboardList, Flag } from 'lucide-react';
import type { Task } from '@/lib/types';
import { fmtDate, isOverdue, STATUS_LABEL, STATUS_COLOR } from '@/lib/utils';
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
  const flagged = ['high', 'urgent'].includes(task.priority);

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

  const specialStatus = !['open', 'completed', 'in_progress'].includes(task.status);

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-black/[0.02] transition-colors">
      <button
        onClick={onTick}
        disabled={pending || done}
        aria-label={done ? 'Tamamlandı' : 'Tamamla'}
        className={`tick mt-0.5 ${done ? 'tick-done' : ''} ${pending ? 'opacity-50' : ''}`}
      >
        {done && <Check size={13} strokeWidth={3} />}
      </button>

      <Link href={`/tasks/${task.id}`} className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-1.5">
          <p className={`text-[15px] leading-snug truncate ${done ? 'line-through text-[#AEAEB2]' : ''}`}>
            {task.title}
          </p>
          {task.requires_photo && <Camera size={13} className="text-[#AEAEB2] shrink-0" />}
          {isChecklist && <ClipboardList size={13} className="text-[#AEAEB2] shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[13px]">
          <span className={overdue ? 'text-ios-red font-medium' : 'text-[#8E8E93]'}>
            {fmtDate(task.due_at)}
          </span>
          {specialStatus && (
            <span className={`badge ${STATUS_COLOR[task.status]}`}>{STATUS_LABEL[task.status]}</span>
          )}
        </div>
        {progress && progress.total > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="h-[5px] flex-1 max-w-[140px] rounded-full bg-black/[0.08] overflow-hidden">
              <div
                className="h-full bg-ios-blue rounded-full transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
            <span className="text-[12px] text-[#8E8E93]">{progress.done}/{progress.total}</span>
          </div>
        )}
      </Link>

      <div className="flex items-center gap-1.5 mt-1 shrink-0">
        {flagged && !done && <Flag size={14} className="text-ios-orange fill-ios-orange" />}
        <ChevronRight size={15} className="text-[#C7C7CC]" />
      </div>
    </div>
  );
}
