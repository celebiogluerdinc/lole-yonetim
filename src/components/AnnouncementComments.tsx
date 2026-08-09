'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { addAnnouncementComment, deleteAnnouncementComment } from '@/app/(app)/announcements/actions';

export interface AnnComment {
  id: string; author_id: string; body: string; created_at: string;
  profiles?: { full_name: string } | null;
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString('tr-TR', {
  timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
});

/** Comment thread under an announcement card. */
export default function AnnouncementComments({
  annId, comments, meId, isAdmin
}: { annId: string; comments: AnnComment[]; meId: string; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  return (
    <div className="mt-3 border-t border-white/[0.08] pt-2.5">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[13px] font-medium text-ios-blue">
        <MessageCircle size={14} />
        {comments.length ? `${comments.length} yorum` : 'Yorum yap'}
        <span className="text-[#8E8E93]">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="mt-2.5 space-y-2">
          {comments.map(c => (
            <div key={c.id} className="flex items-start gap-2 rounded-xl bg-white/[0.04] px-3 py-2 group">
              <div className="w-6 h-6 rounded-full bg-ios-blue/15 text-ios-blue flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                {(c.profiles?.full_name ?? '?')[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#8E8E93]">
                  <b className="text-[#D1D1D6]">{c.profiles?.full_name ?? 'Kullanıcı'}</b> · {fmtTime(c.created_at)}
                </p>
                <p className="text-[14px] whitespace-pre-wrap break-words">{c.body}</p>
              </div>
              {(isAdmin || c.author_id === meId) && (
                <button
                  title="Yorumu sil"
                  onClick={() => start(async () => {
                    setError(null);
                    const r = await deleteAnnouncementComment(c.id);
                    if (r?.error) setError(r.error); else router.refresh();
                  })}
                  className="opacity-0 group-hover:opacity-100 text-[#8E8E93] hover:text-ios-red transition-all p-1 shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}

          {error && <p className="text-[12px] text-rose-300 bg-rose-500/10 rounded-lg px-3 py-1.5">{error}</p>}

          <form
            ref={ref}
            action={(fd) => start(async () => {
              setError(null);
              fd.set('announcement_id', annId);
              const r = await addAnnouncementComment(fd);
              if (r?.error) setError(r.error);
              else { ref.current?.reset(); router.refresh(); }
            })}
            className="flex gap-2"
          >
            <input name="body" required maxLength={1000} placeholder="Yorum yazın…"
              className="input !py-2 !text-[14px]" />
            <button className="btn-primary !px-3 shrink-0" disabled={pending} aria-label="Gönder">
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
