'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ArrowUp } from 'lucide-react';
import { sendMessage, markRead } from '@/app/(app)/messages/actions';
import { TZ } from '@/lib/utils';

interface Msg { id: string; sender_id: string; body: string; created_at: string; }

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
  const [pending, start] = useTransition();
  const [text, setText] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

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
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {showName && (
                      <p className="text-[12px] text-[#8E8E93] ml-3 mb-0.5">{names[m.sender_id] ?? ''}</p>
                    )}
                    <div className={`px-3.5 py-2 text-[16px] leading-snug whitespace-pre-wrap break-words rounded-2xl ${
                      mine
                        ? 'bg-ios-blue text-white rounded-br-[6px]'
                        : 'bg-[#2C2C2E] text-[#F2F2F7] rounded-bl-[6px]'
                    }`}>
                      {m.body}
                    </div>
                    <p className={`text-[11px] text-[#AEAEB2] mt-0.5 ${mine ? 'mr-1' : 'ml-1'}`}>
                      {hhmm(m.created_at)}
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
      <form
        onSubmit={(e) => { e.preventDefault(); onSend(); }}
        className="flex items-center gap-2 px-3 py-2.5 bg-black/85 backdrop-blur border-t border-white/[0.08]"
      >
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Mesaj"
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
