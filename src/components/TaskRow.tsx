'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
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
  const [, start] = useTransition();
  const [localDone, setLocalDone] = useState(false);
  const [failed, setFailed] = useState(false);

  const done = task.status === 'completed' || localDone;
  const overdue = isOverdue(task.due_at, task.status) && !done;
  const isChecklist = task.type === 'checklist';
  const needsDetail = isChecklist || task.requires_photo;
  const flagged = ['high', 'urgent'].includes(task.priority);

  function onTick() {
    if (done) return;
    if (needsDetail) {
      router.push(`/tasks/${task.id}`);
      return;
    }
    // optimistic: fill the circle INSTANTLY, sync with the server in the background
    setLocalDone(true);
    setFailed(false);
    start(async () => {
      const r = await quickComplete(task.id);
      if (r?.error) {
        setLocalDone(false);
        setFailed(true);
        if (r.error === 'photo_required') router.push(`/tasks/${task.id}`);
      } else {
        router.refresh();
      }
    });
  }

  const specialStatus = !['open', 'completed', 'in_progress'].includes(task.status) && !localDone;

  return (
    <div className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors">
      <button
        onClick={onTick}
        disabled={done}
        aria-label={done ? 'Tamamlandı' : 'Tamamla'}
        className={`tick mt-0.5 ${done ? 'tick-done' : ''}`}
      >
        {done && <Check size={13} strokeWidth={3} />}
      </button>

      <Link href={`/tasks/${task.id}`} className="flex-1 min-w-0 py-0.5">
        <div className="flex items-center gap-1.5">
          <p className={`text-[15px] leading-snug truncate ${done ? 'line-through text-[#8E8E93]' : ''}`}>
            {task.title}
          </p>
          {task.requires_photo && <Camera size={13} className="text-[#8E8E93] shrink-0" />}
          {isChecklist && <ClipboardList size={13} className="text-[#8E8E93] shrink-0" />}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[13px]">
          <span className={overdue ? 'text-ios-red font-medium' : 'text-[#8E8E93]'}>
            {fmtDate(task.due_at)}
          </span>
          {specialStatus && (
            <span className={`badge ${STATUS_COLOR[task.status]}`}>{STATUS_LABEL[task.status]}</span>
          )}
          {failed && <span className="text-ios-red text-[12px]">tekrar deneyin</span>}
        </div>
        {progress && progress.total > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="h-[5px] flex-1 max-w-[140px] rounded-full bg-white/[0.12] overflow-hidden">
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
        <ChevronRight size={15} className="text-[#48484A]" />
      </div>
    </div>
  );
}
