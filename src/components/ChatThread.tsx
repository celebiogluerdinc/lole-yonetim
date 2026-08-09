'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ArrowUp, ChevronDown, Pencil, Trash2, X } from 'lucide-react';
import { sendMessage, editMessage, deleteMessage, markRead } from '@/app/(app)/messages/actions';
import { useConfirm } from '@/components/ConfirmProvider';
import { TZ } from '@/lib/utils';

interface Msg {
  id: string; sender_id: string; body: string; created_at: string;
  edited_at?: string | null; deleted_at?: string | null;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const key = (x: Date) => x.toLocaleDateString('tr-TR', { timeZone: TZ });
  if (key(d) === key(today)) return 'Bugün';
  const y = new Date(today); y.setDate(y.getDate() - 1);
  if (key(d) === key(y)) return 'Dün';
  return d.toLocaleDateString('tr-TR', { timeZone: TZ, day: 'numeric', month: 'long', weekday: 'long' });
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString('tr-TR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

export default function ChatThread({
  conversationId, meId, title, subtitle, isGroup, names, messages
}: {
  conversationId: string; meId: string; title: string; subtitle: string;
  isGroup: boolean; names: Record<string, string>; messages: Msg[];
}) {
  const router = useRouter();
  const confirmS = useConfirm();
  const [pending, start] = useTransition();
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);          // hangi mesajın menüsü açık
  const [editing, setEditing] = useState<Msg | null>(null);             // düzenlenen mesaj
  const [hidden, setHidden] = useState<Set<string>>(new Set());         // iyimser silinen
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  useEffect(() => {
    markRead(conversationId).catch(() => {});
  }, [conversationId, messages.length]);

  // lightweight polling — new messages appear within a few seconds
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [router, conversationId]);

  function onSend() {
    const body = text.trim();
    if (!body || pending) return;
    setText('');
    setSendError(null);
    if (editing) {
      const target = editing;
      setEditing(null);
      start(async () => {
        const r = await editMessage(target.id, body);
        if (r?.error) {
          setText(body);
          setEditing(target);
          setSendError(r.error);
        } else {
          router.refresh();
        }
      });
      return;
    }
    start(async () => {
      const r = await sendMessage(conversationId, body);
      if (r?.error) {
        setText(body); // yazılan metni geri getir — kaybolmasın
        setSendError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  function startEdit(m: Msg) {
    setMenuFor(null);
    setEditing(m);
    setText(m.body);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function onDelete(m: Msg) {
    setMenuFor(null);
    if (!(await confirmS({ message: 'Bu mesaj silinsin mi?', danger: true }))) return;
    setHidden(h => new Set(h).add(m.id)); // iyimser: anında "silindi" göster
    start(async () => {
      const r = await deleteMessage(m.id);
      if (r?.error) {
        setHidden(h => { const n = new Set(h); n.delete(m.id); return n; });
        setSendError(r.error);
      } else {
        router.refresh();
      }
    });
  }

  // group messages by day
  const groups: { day: string; items: Msg[] }[] = [];
  for (const m of messages) {
    const day = dayLabel(m.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4.5rem)] md:h-dvh max-w-3xl mx-auto w-full">
      {/* Header */}
      <header className="flex items-center gap-2 px-3 py-2.5 bg-black/80 backdrop-blur sticky top-0 z-10 border-b border-white/[0.08]">
        <Link href="/messages" className="flex items-center text-ios-blue text-[16px] -ml-1">
          <ChevronLeft size={24} strokeWidth={2.4} />
        </Link>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-[16px] font-semibold truncate">{title}</p>
          {subtitle && <p className="text-[12px] text-[#8E8E93]">{subtitle}</p>}
        </div>
        <span className="w-6" />
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-[14px] text-[#8E8E93] pt-10">
            Henüz mesaj yok. İlk mesajı siz gönderin 👋
          </p>
        )}
        {groups.map(g => (
          <div key={g.day} className="space-y-1.5">
            <p className="text-center text-[12px] font-medium text-[#8E8E93] py-1 capitalize">{g.day}</p>
            {g.items.map((m, i) => {
              const mine = m.sender_id === meId;
              const prev = g.items[i - 1];
              const showName = isGroup && !mine && (!prev || prev.sender_id !== m.sender_id);
              const isDeleted = !!m.deleted_at || hidden.has(m.id);
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {showName && (
                      <p className="text-[12px] text-[#8E8E93] ml-3 mb-0.5">{names[m.sender_id] ?? ''}</p>
                    )}
                    {isDeleted ? (
                      <div className={`px-3.5 py-2 text-[14px] italic rounded-2xl border border-white/[0.08] text-[#8E8E93] ${
                        mine ? 'rounded-br-[6px]' : 'rounded-bl-[6px]'}`}>
                        🚫 Bu mesaj silindi
                      </div>
                    ) : (
                      <div className={`group relative px-3.5 py-2 text-[16px] leading-snug whitespace-pre-wrap break-words rounded-2xl ${
                        mine
                          ? 'bg-ios-blue text-white rounded-br-[6px]'
                          : 'bg-[#2C2C2E] text-[#F2F2F7] rounded-bl-[6px]'
                      }`}>
                        {m.body}
                        {mine && (
                          <button
                            aria-label="Mesaj seçenekleri"
                            onClick={() => setMenuFor(v => v === m.id ? null : m.id)}
                            className={`absolute -left-7 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#2C2C2E] text-[#8E8E93] items-center justify-center
                              hover:text-white transition-colors flex md:opacity-0 md:group-hover:opacity-100 ${menuFor === m.id ? 'md:opacity-100' : ''}`}
                          >
                            <ChevronDown size={14} />
                          </button>
                        )}
                      </div>
                    )}
                    {mine && menuFor === m.id && !isDeleted && (
                      <div className="flex gap-1.5 mt-1">
                        <button onClick={() => startEdit(m)}
                          className="flex items-center gap-1 rounded-full bg-[#2C2C2E] px-2.5 py-1 text-[12px] font-medium text-[#D1D1D6] hover:bg-white/15">
                          <Pencil size={11} /> Düzenle
                        </button>
                        <button onClick={() => onDelete(m)}
                          className="flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-[12px] font-medium text-rose-300 hover:bg-rose-500/30">
                          <Trash2 size={11} /> Sil
                        </button>
                      </div>
                    )}
                    <p className={`text-[11px] text-[#AEAEB2] mt-0.5 ${mine ? 'mr-1' : 'ml-1'}`}>
                      {hhmm(m.created_at)}{m.edited_at && !isDeleted ? ' · düzenlendi' : ''}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      {sendError && (
        <p className="text-[12px] text-rose-300 bg-rose-500/10 px-4 py-1.5 text-center">
          Mesaj gönderilemedi: {sendError}
        </p>
      )}
      {editing && (
        <div className="flex items-center gap-2 px-4 py-2 bg-ios-blue/10 border-t border-ios-blue/25">
          <Pencil size={13} className="text-ios-blue shrink-0" />
          <p className="flex-1 text-[12px] text-ios-blue truncate">
            Mesaj düzenleniyor: <span className="text-[#D1D1D6]">{editing.body.slice(0, 60)}</span>
          </p>
          <button
            aria-label="Düzenlemeyi iptal et"
            onClick={() => { setEditing(null); setText(''); }}
            className="w-6 h-6 rounded-full bg-white/10 text-[#8E8E93] flex items-center justify-center shrink-0"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => { e.preventDefault(); onSend(); }}
        className="flex items-center gap-2 px-3 py-2.5 bg-black/85 backdrop-blur border-t border-white/[0.08]"
      >
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={editing ? 'Mesajı düzenleyin…' : 'Mesaj'}
          className="flex-1 rounded-full bg-[#1C1C1E] border border-white/[0.10] px-4 py-2 text-[16px] outline-none focus:border-ios-blue/40"
        />
        <button
          type="submit"
          disabled={!text.trim() || pending}
          aria-label="Gönder"
          className="w-9 h-9 rounded-full bg-ios-blue text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shrink-0"
        >
          <ArrowUp size={18} strokeWidth={2.6} />
        </button>
      </form>
    </div>
  );
}
