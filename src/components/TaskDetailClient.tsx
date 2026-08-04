'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Camera, Paperclip, Send, AlertTriangle, ThumbsUp, ThumbsDown } from 'lucide-react';
import type { Task, ChecklistItem } from '@/lib/types';
import { fmtDate } from '@/lib/utils';
import {
  toggleChecklistItem, completeTask, blockTask, reviewTask,
  uploadAttachment, addTaskNote
} from '@/app/(app)/tasks/actions';

interface Att { id: string; file_name: string; mime_type: string | null; url?: string; created_at: string; checklist_item_id: string | null; ai_verdict?: string | null; ai_note?: string | null; }
interface NoteT { id: string; body: string; created_at: string; profiles?: { full_name: string } | null; }

export default function TaskDetailClient({
  task, items, attachments, notes, isAssignee, canReview
}: {
  task: Task; items: ChecklistItem[]; attachments: Att[]; notes: NoteT[];
  isAssignee: boolean; canReview: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const noteRef = useRef<HTMLFormElement>(null);

  const finished = ['completed', 'cancelled'].includes(task.status);
  const inReview = task.status === 'pending_review';
  const allItemsDone = items.length === 0 || items.every(i => i.is_done);

  const run = (fn: () => Promise<any>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r?.error) {
        setError(r.error === 'photo_required' ? 'Bu adım için önce fotoğraf eklemelisiniz.' : r.error);
      } else {
        router.refresh();
      }
    });

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Checklist */}
      {task.type === 'checklist' && (
        <section className="card divide-y divide-slate-100">
          <div className="p-4 pb-3">
            <h2 className="font-semibold text-sm text-slate-700">
              Checklist — {items.filter(i => i.is_done).length}/{items.length}
            </h2>
          </div>
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <button
                disabled={pending || finished || inReview}
                onClick={() => run(() => toggleChecklistItem(item.id, !item.is_done))}
                className={`tick ${item.is_done ? 'tick-done' : ''}`}
                aria-label={item.is_done ? 'Geri al' : 'Tamamla'}
              >
                {item.is_done && <Check size={14} strokeWidth={3} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${item.is_done ? 'line-through text-[#AEAEB2]' : ''}`}>{item.title}</p>
                {item.is_done && item.done_at && (
                  <p className="text-[11px] text-[#AEAEB2]">{fmtDate(item.done_at)}</p>
                )}
              </div>
              {item.requires_photo && <Camera size={14} className="text-amber-500 shrink-0" />}
            </div>
          ))}
        </section>
      )}

      {/* Attachments */}
      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-slate-700 flex items-center gap-2">
            <Paperclip size={15} /> Fotoğraf & Dosyalar
          </h2>
          {!finished && (
            <label className="btn-outline text-xs cursor-pointer !py-1.5">
              <Camera size={14} /> Ekle
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const fd = new FormData();
                  fd.set('task_id', task.id);
                  fd.set('file', f);
                  run(() => uploadAttachment(fd));
                  if (fileRef.current) fileRef.current.value = '';
                }}
              />
            </label>
          )}
        </div>
        {attachments.length === 0 ? (
          <p className="text-sm text-[#AEAEB2]">
            {task.requires_photo ? 'Bu görev fotoğraf olmadan kapatılamaz.' : 'Henüz ek yok.'}
          </p>
        ) : (
          <>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {attachments.map(a => (
              <a key={a.id} href={a.url} target="_blank" rel="noreferrer"
                 className={`relative block rounded-xl overflow-hidden border bg-slate-50 aspect-square ${
                   canReview && a.ai_verdict === 'suspicious' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-200'}`}>
                {a.mime_type?.startsWith('image/') && a.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.url} alt={a.file_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-[#AEAEB2] p-2">
                    <Paperclip size={18} />
                    <span className="text-[10px] mt-1 text-center break-all line-clamp-2">{a.file_name}</span>
                  </div>
                )}
                {canReview && a.ai_verdict === 'suspicious' && (
                  <span className="absolute top-1 right-1 bg-amber-400 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">⚠️</span>
                )}
              </a>
            ))}
          </div>
          {canReview && attachments.some(a => a.ai_verdict === 'suspicious') && (
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[13px] text-amber-800">
              ⚠️ <b>Yapay zeka kontrolü önerdi:</b>{' '}
              {attachments.filter(a => a.ai_verdict === 'suspicious').map(a => a.ai_note).filter(Boolean).join(' · ')
                || 'İşaretli fotoğraflar göreve uygun görünmüyor olabilir.'}{' '}
              Son karar sizindir.
            </div>
          )}
          </>
        )}
      </section>

      {/* Notes */}
      <section className="card p-4">
        <h2 className="font-semibold text-sm text-slate-700 mb-3">Notlar</h2>
        <ul className="space-y-2 mb-3">
          {notes.map(n => (
            <li key={n.id} className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
              <p className="text-[11px] text-[#AEAEB2] mt-0.5">
                {n.profiles?.full_name} · {fmtDate(n.created_at)}
              </p>
            </li>
          ))}
        </ul>
        <form
          ref={noteRef}
          action={(fd) => {
            fd.set('task_id', task.id);
            run(async () => { const r = await addTaskNote(fd); noteRef.current?.reset(); return r; });
          }}
          className="flex gap-2"
        >
          <input name="body" required placeholder="Not ekle…" className="input" />
          <button className="btn-primary shrink-0" disabled={pending}><Send size={15} /></button>
        </form>
      </section>

      {/* Primary actions */}
      {!finished && !inReview && isAssignee && (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            disabled={pending || (task.type === 'checklist' && !allItemsDone)}
            onClick={() => run(() => completeTask(task.id))}
            className="btn-primary flex-1 !py-3"
          >
            <Check size={17} strokeWidth={3} />
            {task.requires_approval ? 'Tamamla ve Onaya Gönder' : 'Görevi Tamamla'}
          </button>
          <button
            disabled={pending}
            onClick={() => setBlockOpen(v => !v)}
            className="btn-outline !py-3 text-rose-600 !border-rose-200 hover:!bg-rose-50"
          >
            <AlertTriangle size={16} /> Engel Bildir
          </button>
        </div>
      )}
      {task.type === 'checklist' && !allItemsDone && !finished && !inReview && (
        <p className="text-xs text-[#AEAEB2] text-center -mt-2">Görevi kapatmak için önce tüm maddeleri tamamlayın.</p>
      )}

      {blockOpen && (
        <form
          action={(fd) => run(async () => {
            const r = await blockTask(task.id, String(fd.get('reason') ?? ''));
            if (!r?.error) setBlockOpen(false);
            return r;
          })}
          className="card p-4 space-y-3 border-rose-200"
        >
          <label className="label">Engel nedir? (yöneticinize iletilecek)</label>
          <textarea name="reason" required rows={2} className="input" placeholder="Örn: Temizlik malzemesi bitti, depo kilitli…" />
          <button className="btn-danger w-full" disabled={pending}>Engeli Bildir</button>
        </form>
      )}

      {/* Manager review */}
      {inReview && canReview && (
        <div className="card p-4 border-amber-200 bg-amber-50/50 space-y-3">
          <p className="text-sm font-medium text-amber-900">Bu görev onayınızı bekliyor.</p>
          <div className="flex gap-2">
            <button disabled={pending} onClick={() => run(() => reviewTask(task.id, true))}
              className="btn-primary flex-1 !bg-emerald-600 hover:!bg-emerald-700">
              <ThumbsUp size={15} /> Onayla
            </button>
            <button disabled={pending} onClick={() => setRejectOpen(v => !v)}
              className="btn-outline flex-1 text-rose-600 !border-rose-200">
              <ThumbsDown size={15} /> Reddet
            </button>
          </div>
          {rejectOpen && (
            <form action={(fd) => run(async () => {
              const r = await reviewTask(task.id, false, String(fd.get('note') ?? ''));
              if (!r?.error) setRejectOpen(false);
              return r;
            })} className="space-y-2">
              <textarea name="note" required rows={2} className="input" placeholder="Reddetme sebebi (personele iletilir)…" />
              <button className="btn-danger w-full" disabled={pending}>Reddet ve Geri Gönder</button>
            </form>
          )}
        </div>
      )}
      {inReview && !canReview && (
        <p className="text-sm text-center text-amber-700 bg-amber-50 rounded-xl py-3">
          ⏳ Yönetici onayı bekleniyor.
        </p>
      )}
    </div>
  );
}
