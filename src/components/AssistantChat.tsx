'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowUp, Trash2 } from 'lucide-react';
import { askAssistant, clearAssistantThread } from '@/app/(app)/ai/actions';

interface Msg { id: string; role: 'user' | 'assistant'; content: string; }

const SUGGESTIONS = [
  'Bugün nelerim var, önce hangisini yapayım?',
  'Geciken görevlerim var mı?',
  'Son duyuruları özetler misin?',
  'Bu hafta ekibim nasıl gidiyor?'
];

export default function AssistantChat({ messages, userName }: { messages: Msg[]; userName: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, optimistic, pending]);

  useEffect(() => { setOptimistic(null); }, [messages.length]);

  function ask(q: string) {
    const body = q.trim();
    if (!body || pending) return;
    setText('');
    setError(null);
    setOptimistic(body);
    start(async () => {
      const r = await askAssistant(body);
      if (r?.error) { setError(r.error); setOptimistic(null); }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4.5rem)] md:h-dvh max-w-3xl mx-auto w-full">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-[#F2F2F7]/90 backdrop-blur sticky top-0 z-10 border-b border-black/[0.06]">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#5E5CE6] to-[#AF52DE] text-white flex items-center justify-center shrink-0">
          <Sparkles size={18} />
        </span>
        <div className="flex-1">
          <p className="text-[16px] font-semibold leading-tight">Lole Asistan</p>
          <p className="text-[12px] text-[#8E8E93]">Görevleriniz ve şirket verinizle çalışan yapay zeka</p>
        </div>
        {messages.length > 0 && (
          <button
            aria-label="Sohbeti temizle"
            onClick={() => start(async () => { await clearAssistantThread(); router.refresh(); })}
            className="text-[#AEAEB2] hover:text-ios-red p-2 transition-colors">
            <Trash2 size={17} />
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        {messages.length === 0 && !optimistic && (
          <div className="pt-8 text-center space-y-4">
            <p className="text-[17px] font-semibold">Merhaba {userName} 👋</p>
            <p className="text-[14px] text-[#8E8E93] max-w-sm mx-auto">
              Görevlerinizi sorabilir, gününüzü planlatabilir, duyuruları özetletebilirsiniz.
            </p>
            <div className="flex flex-col gap-2 max-w-sm mx-auto pt-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => ask(s)}
                  className="card px-4 py-2.5 text-[14px] text-ios-blue text-left hover:bg-black/[0.02] transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(m => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5E5CE6] to-[#AF52DE] text-white flex items-center justify-center shrink-0 mr-2 mt-1">
                <Sparkles size={13} />
              </span>
            )}
            <div className={`max-w-[82%] px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap break-words rounded-2xl ${
              m.role === 'user'
                ? 'bg-ios-blue text-white rounded-br-[6px]'
                : 'bg-white rounded-bl-[6px] shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)]'
            }`}>
              {m.content}
            </div>
          </div>
        ))}

        {optimistic && (
          <div className="flex justify-end">
            <div className="max-w-[82%] px-3.5 py-2 text-[15px] rounded-2xl rounded-br-[6px] bg-ios-blue text-white">
              {optimistic}
            </div>
          </div>
        )}
        {pending && (
          <div className="flex justify-start">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5E5CE6] to-[#AF52DE] text-white flex items-center justify-center shrink-0 mr-2 mt-1">
              <Sparkles size={13} />
            </span>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-[6px] bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.06)]">
              <span className="flex gap-1">
                <i className="w-1.5 h-1.5 rounded-full bg-[#AEAEB2] animate-bounce [animation-delay:0ms]" />
                <i className="w-1.5 h-1.5 rounded-full bg-[#AEAEB2] animate-bounce [animation-delay:150ms]" />
                <i className="w-1.5 h-1.5 rounded-full bg-[#AEAEB2] animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
        {error && (
          <p className="text-center text-[13px] text-ios-red">{error}</p>
        )}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => { e.preventDefault(); ask(text); }}
        className="flex items-center gap-2 px-3 py-2.5 bg-[#F2F2F7]/95 backdrop-blur border-t border-black/[0.06]"
      >
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Lole Asistan'a sorun…"
          className="flex-1 rounded-full bg-white border border-black/[0.08] px-4 py-2 text-[16px] outline-none focus:border-[#5E5CE6]/50"
        />
        <button
          type="submit"
          disabled={!text.trim() || pending}
          aria-label="Gönder"
          className="w-9 h-9 rounded-full bg-gradient-to-br from-[#5E5CE6] to-[#AF52DE] text-white flex items-center justify-center disabled:opacity-30 active:scale-95 transition-all shrink-0"
        >
          <ArrowUp size={18} strokeWidth={2.6} />
        </button>
      </form>
    </div>
  );
}
