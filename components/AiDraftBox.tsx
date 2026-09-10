'use client';

import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Reusable "✨ Yapay zeka ile taslak" box.
 * Calls the given server action with free text and hands the draft to the parent.
 */
export default function AiDraftBox({
  placeholder, action, onDraft, hint
}: {
  placeholder: string;
  action: (text: string) => Promise<{ error?: string; ok?: boolean; draft?: any }>;
  onDraft: (draft: any) => void;
  hint?: string;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="card p-4 border border-[#5E5CE6]/40 bg-gradient-to-br from-[#5E5CE6]/[0.18] to-[#AF52DE]/[0.18]">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5E5CE6] to-[#AF52DE] text-white flex items-center justify-center shrink-0">
          <Sparkles size={14} />
        </span>
        <p className="text-[14px] font-semibold">Yapay zeka ile oluştur</p>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="input !bg-[#2C2C2E]"
      />
      {hint && <p className="text-[12px] text-[#8E8E93] mt-1.5">{hint}</p>}
      {error && <p className="text-[13px] text-ios-red mt-1.5">{error}</p>}
      <button
        type="button"
        disabled={pending || text.trim().length < 5}
        onClick={() => start(async () => {
          setError(null);
          const r = await action(text);
          if (r?.error) setError(r.error);
          else if (r?.draft) onDraft(r.draft);
        })}
        className="btn w-full mt-2.5 text-white bg-gradient-to-br from-[#5E5CE6] to-[#AF52DE] disabled:opacity-40"
      >
        {pending ? 'Taslak hazırlanıyor…' : '✨ Taslak Oluştur'}
      </button>
    </div>
  );
}
