'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Camera, Paperclip, Send, AlertTriangle, ThumbsUp, ThumbsDown, Ban, CheckCheck, LayoutTemplate, Play, Clock3, Repeat } from 'lucide-react';
import type { Task, ChecklistItem } from '@/lib/types';
import { fmtDate } from '@/lib/utils';
import {
  toggleChecklistItem, completeTask, blockTask, reviewTask,
  uploadAttachment, addTaskNote, managerSetTaskStatus,
  startTask, requestPostpone, cancelTaskSeries
} from '@/app/(app)/tasks/actions';
import { saveTaskAsTemplate } from '@/app/(app)/manage/actions';
import { useConfirm } from '@/components/ConfirmProvider';

interface Att { id: string; file_name: string; mime_type: string | null; url?: string; created_at: string; checklist_item_id: string | null; ai_verdict?: string | null; ai_note?: string | null; }
interface NoteT { id: string; author_id?: string; body: string; created_at: string; profiles?: { full_name: string } | null; }

const TZ = 'Europe/Istanbul';
function dueDayInfo(iso: string | null) {
  if (!iso) return null;
  const key = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
  const k = key(new Date(iso));
  const today = key(new Date());
  if (k === today) return { future: false, label: 'Bugün' };
  if (k < today) return { future: false, label: null };
  const label = new Date(iso).toLocaleDateString('tr-TR', {
    timeZone: TZ, day: 'numeric', month: 'long', weekday: 'long'
  });
  return { future: true, label };
}

export default function TaskDetailClient({
  task, items, attachments, notes, isAssignee, canReview, meId
}: {
  task: Task; items: ChecklistItem[]; attachments: Att[]; notes: NoteT[];
  isAssignee: boolean; canReview: boolean; meId?: string;
}) {
  const router = useRouter();
  const confirmS = useConfirm();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tplOk, setTplOk] = useState<string | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [postponeOk, setPostponeOk] = useState(false);
  const isSeries = !!((task as any).recurrence_rule || (task as any).parent_recurring_id);
  const [rejectOpen, setRejectOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const itemFileRef = useRef<HTMLInputElement>(null);
  const [photoItemId, setPhotoItemId] = useState<string | null>(null);
  const noteRef = useRef<HTMLFormElement>(null);

  const itemPhotoCount = (itemId: string) =>
    attachments.filter(a => a.checklist_item_id === itemId).length;

  // optimistic checklist state — ticks render instantly, server syncs in background
  const [itemOverride, setItemOverride] = useState<Record<string, boolean>>({});
  const itemDone = (i: ChecklistItem) => itemOverride[i.id] ?? i.is_done;

  const finished = ['completed', 'cancelled'].includes(task.status);
  const inReview = task.status === 'pending_review';
  const allItemsDone = items.length === 0 || items.every(i => itemDone(i));
  const dueInfo = dueDayInfo(task.due_at);

  const confirmFuture = async () =>
    !dueInfo?.future ||
    (await confirmS({ message: `Bu görev İLERİ TARİHLİ: ${dueInfo.label}.\nBugünün görevi değil — yine de tamamlansın mı?`, okText: 'Onayla' }));

  async function onToggleItem(item: ChecklistItem) {
    const next = !itemDone(item);
    if (next && !(await confirmFuture())) return; // ileri tarihli görevin maddesi onaysız işaretlenmesin
    setItemOverride(o => ({ ...o, [item.id]: next })); // instant
    start(async () => {
      const r = await toggleChecklistItem(item.id, next);
      if (r?.error) {
        setItemOverride(o => ({ ...o, [item.id]: !next })); // revert
        setError(r.error === 'photo_required' ? 'Bu madde için önce fotoğraf eklemelisiniz.' : r.error);
      } else {
        router.refresh();
      }
    });
  }

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
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-3 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* ileri tarihli görev uyarı afişi — yanlış günün görevi yapılmasın */}
      {dueInfo?.future && !finished && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-300">
          📅 <b>Bu görev ileri tarihli:</b> {dueInfo.label}. Bugünün görevi değil —
          bugünün görevlerini Ana Sayfa &gt; &quot;Bugün&quot; sekmesinde bulabilirsiniz.
        </div>
      )}

      {/* Checklist */}
      {task.type === 'checklist' && (
        <section className="card divide-y divide-white/[0.08]">
          <div className="p-4 pb-3">
            <h2 className="font-semibold text-sm text-[#D1D1D6]">
              Checklist — {items.filter(i => itemDone(i)).length}/{items.length}
            </h2>
          </div>
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <button
                disabled={finished || inReview}
                onClick={() => onToggleItem(item)}
                className={`tick ${itemDone(item) ? 'tick-done' : ''}`}
                aria-label={itemDone(item) ? 'Geri al' : 'Tamamla'}
              >
                {itemDone(item) && <Check size={14} strokeWidth={3} />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${itemDone(item) ? 'line-through text-[#AEAEB2]' : ''}`}>{item.title}</p>
                {item.is_done && item.done_at && (
                  <p className="text-[11px] text-[#AEAEB2]">{fmtDate(item.done_at)}</p>
                )}
              </div>
              {item.requires_photo && (
                itemPhotoCount(item.id) > 0 ? (
                  <span className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-emerald-300 bg-emerald-500/15 rounded-full px-2 py-1">
                    <Camera size={12} /> {itemPhotoCount(item.id)}
                  </span>
                ) : finished || inReview ? (
                  <Camera size={14} className="text-amber-500 shrink-0" />
                ) : (
                  <button
                    onClick={() => { setPhotoItemId(item.id); itemFileRef.current?.click(); }}
                    className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-full px-2.5 py-1 hover:bg-amber-500/25 transition-colors"
                    title="Bu madde fotoğraf gerektirir"
                  >
                    <Camera size={12} /> Fotoğraf ekle
                  </button>
                )
              )}
            </div>
          ))}
          {/* hidden input for per-item required photos */}
          <input
            ref={itemFileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f || !photoItemId) return;
              const fd = new FormData();
              fd.set('task_id', task.id);
              fd.set('item_id', photoItemId);
              fd.set('file', f);
              run(() => uploadAttachment(fd));
              setPhotoItemId(null);
              if (itemFileRef.current) itemFileRef.current.value = '';
            }}
          />
        </section>
      )}

      {/* Attachments */}
      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-sm text-[#D1D1D6] flex items-center gap-2">
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
                 className={`relative block rounded-xl overflow-hidden border bg-[#1C1C1E]/[0.06] aspect-square ${
                   canReview && a.ai_verdict === 'suspicious' ? 'border-amber-400 ring-2 ring-amber-500/40' : 'border-white/10'}`}>
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
            <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-[13px] text-amber-300">
              ⚠️ <b>Yapay zeka kontrolü önerdi:</b>{' '}
              {attachments.filter(a => a.ai_verdict === 'suspicious').map(a => a.ai_note).filter(Boolean).join(' · ')
                || 'İşaretli fotoğraflar göreve uygun görünmüyor olabilir.'}{' '}
              Son karar sizindir.
            </div>
          )}
          </>
        )}
      </section>

      {/* Görev içi sohbet / notlar */}
      <section className="card p-4">
        <h2 className="font-semibold text-sm text-[#D1D1D6] mb-3">💬 Görev Sohbeti</h2>
        {notes.length === 0 && (
          <p className="text-[13px] text-[#8E8E93] mb-3">
            Henüz mesaj yok — görevle ilgili soru ve notlarınızı buraya yazın, görevi görebilen herkes okur.
          </p>
        )}
        <ul className="space-y-1.5 mb-3">
          {notes.map(n => {
            const mine = !!meId && n.author_id === meId;
            return (
              <li key={n.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                  mine ? 'bg-ios-blue/20 rounded-br-[6px]' : 'bg-white/[0.06] rounded-bl-[6px]'}`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{n.body}</p>
                  <p className="text-[11px] text-[#AEAEB2] mt-0.5">
                    {mine ? 'Siz' : n.profiles?.full_name} · {fmtDate(n.created_at)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <form
          ref={noteRef}
          action={(fd) => {
            fd.set('task_id', task.id);
            run(async () => {
              const r = await addTaskNote(fd);
              if (!r?.error) noteRef.current?.reset(); // sadece başarıda temizle
              return r;
            });
          }}
          className="flex gap-2"
        >
          <input name="body" required placeholder="Mesaj yazın…" className="input" />
          <button className="btn-primary shrink-0" disabled={pending}><Send size={15} /></button>
        </form>
      </section>

      {/* Primary actions */}
      {!finished && !inReview && isAssignee && (
        <>
        <div className="flex flex-col sm:flex-row gap-2">
          {task.status === 'open' && (
            <button
              disabled={pending}
              onClick={() => run(() => startTask(task.id))}
              className="btn-outline !py-3 !text-ios-blue"
              title="Göreve başladığınızı işaretler — yöneticiniz devam ettiğinizi görür"
            >
              <Play size={16} /> Başla
            </button>
          )}
          <button
            disabled={pending || (task.type === 'checklist' && !allItemsDone)}
            onClick={async () => { if (await confirmFuture()) run(() => completeTask(task.id, dueInfo?.future === true)); }}
            className="btn-primary flex-1 !py-3"
          >
            <Check size={17} strokeWidth={3} />
            {task.requires_approval ? 'Tamamla ve Onaya Gönder' : 'Görevi Tamamla'}
          </button>
          <button
            disabled={pending}
            onClick={() => { setBlockOpen(v => !v); setPostponeOpen(false); }}
            className="btn-outline !py-3 text-rose-300 !border-rose-500/30 hover:!bg-rose-500/15"
          >
            <AlertTriangle size={16} /> Engel Bildir
          </button>
          <button
            disabled={pending}
            onClick={() => { setPostponeOpen(v => !v); setBlockOpen(false); }}
            className="btn-outline !py-3 !text-amber-300 !border-amber-500/30"
          >
            <Clock3 size={16} /> Erteleme Talep Et
          </button>
        </div>
        {postponeOk && (
          <p className="text-[13px] text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">
            ✔ Erteleme talebiniz yöneticinize iletildi — görev tarihi yönetici onaylarsa değiştirilir.
          </p>
        )}
        {postponeOpen && (
          <form
            action={(fd) => run(async () => {
              const r = await requestPostpone(task.id, String(fd.get('reason') ?? ''));
              if (!r?.error) { setPostponeOpen(false); setPostponeOk(true); }
              return r;
            })}
            className="card p-4 space-y-3 border-amber-500/30"
          >
            <label className="label">Neden erteleme istiyorsunuz? (yöneticinize iletilecek)</label>
            <textarea name="reason" required rows={2} className="input"
              placeholder="Örn: Malzeme yarın geliyor, bir gün erteleme rica ediyorum…" />
            <button className="btn-primary w-full !bg-none !bg-amber-600" disabled={pending}>Erteleme Talebini Gönder</button>
          </form>
        )}
        </>
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
          className="card p-4 space-y-3 border-rose-500/30"
        >
          <label className="label">Engel nedir? (yöneticinize iletilecek)</label>
          <textarea name="reason" required rows={2} className="input" placeholder="Örn: Temizlik malzemesi bitti, depo kilitli…" />
          <button className="btn-danger w-full" disabled={pending}>Engeli Bildir</button>
        </form>
      )}

      {/* Manager review */}
      {inReview && canReview && (
        <div className="card p-4 border-amber-500/30 bg-amber-500/10 space-y-3">
          <p className="text-sm font-medium text-amber-200">Bu görev onayınızı bekliyor.</p>
          <div className="flex gap-2">
            <button disabled={pending} onClick={() => run(() => reviewTask(task.id, true))}
              className="btn-success flex-1">
              <ThumbsUp size={15} /> Onayla
            </button>
            <button disabled={pending} onClick={() => setRejectOpen(v => !v)}
              className="btn-outline flex-1 text-rose-300 !border-rose-500/30">
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
        <p className="text-sm text-center text-amber-300 bg-amber-500/10 rounded-xl py-3">
          ⏳ Yönetici onayı bekleniyor.
        </p>
      )}

      {/* Manager controls: finish / cancel / save as template */}
      {canReview && (
        <>
          {tplOk && (
            <p className="text-[13px] text-emerald-300 bg-emerald-500/10 rounded-xl px-3 py-2">
              ✔ &quot;{tplOk}&quot; şablonlara eklendi — Şablonlar sayfasından tekrar tekrar atayabilirsiniz.
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            {!finished && !inReview && (
              <>
                <button
                  disabled={pending}
                  onClick={() => run(() => managerSetTaskStatus(task.id, 'completed'))}
                  className="btn-outline flex-1 !text-emerald-300"
                >
                  <CheckCheck size={15} /> Görevi Bitir (yönetici)
                </button>
                <button
                  disabled={pending}
                  onClick={async () => {
                    if (await confirmS({ message: 'Bu görev iptal edilsin mi?', danger: true })) {
                      run(() => managerSetTaskStatus(task.id, 'cancelled'));
                    }
                  }}
                  className="btn-outline flex-1 !text-rose-300"
                >
                  <Ban size={15} /> İptal Et
                </button>
              </>
            )}
            <button
              disabled={pending}
              onClick={() => start(async () => {
                setError(null); setTplOk(null);
                const r = await saveTaskAsTemplate(task.id);
                if (r?.error) setError(r.error);
                else setTplOk((r as any)?.name ?? task.title);
              })}
              className="btn-outline flex-1 !text-[#9F9CFF]"
              title="Bu görevi (checklist maddeleriyle birlikte) yeniden kullanılabilir bir şablona dönüştürür"
            >
              <LayoutTemplate size={15} /> Şablonlara Ekle
            </button>
          </div>
          {isSeries && (
            <button
              disabled={pending}
              onClick={async () => {
                if (await confirmS({ message: 'Bu tekrarlayan serinin GELECEKTEKİ tüm açık görevleri iptal edilsin mi?\n(Geçmiş ve tamamlanmış olanlar korunur.)', danger: true })) {
                  run(() => cancelTaskSeries(task.id));
                }
              }}
              className="btn-outline w-full !text-rose-300 !border-rose-500/30"
            >
              <Repeat size={15} /> Serinin Kalanını İptal Et
            </button>
          )}
        </>
      )}
    </div>
  );
}
