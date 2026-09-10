'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

interface ConfirmOpts {
  title?: string;
  message: string;
  okText?: string;
  cancelText?: string;
  danger?: boolean;
}

const ConfirmCtx = createContext<(opts: ConfirmOpts) => Promise<boolean>>(
  // sağlayıcı yoksa (olmamalı) tarayıcı onayına düş
  async (o) => typeof window !== 'undefined' ? window.confirm(o.message) : false
);

/** iOS tarzı, koyu temayla uyumlu onay paneli — window.confirm yerine. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((o: ConfirmOpts) => {
    return new Promise<boolean>(resolve => {
      resolver.current = resolve;
      setOpts(o);
    });
  }, []);

  function close(result: boolean) {
    resolver.current?.(result);
    resolver.current = null;
    setOpts(null);
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => close(false)}>
          <div
            className="w-full max-w-sm rounded-3xl bg-[#2C2C2E] border border-white/[0.10] shadow-2xl shadow-black/50 p-5 mb-[env(safe-area-inset-bottom)]"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[16px] font-semibold text-center">
              {opts.title ?? (opts.danger ? 'Emin misiniz?' : 'Onay')}
            </p>
            <p className="text-[14px] text-[#B0B0B5] text-center mt-1.5 whitespace-pre-wrap">{opts.message}</p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => close(false)}
                className="flex-1 rounded-2xl bg-white/10 text-[#F2F2F7] px-4 py-2.5 text-[15px] font-semibold hover:bg-white/15 transition-colors"
              >
                {opts.cancelText ?? 'Vazgeç'}
              </button>
              <button
                autoFocus
                onClick={() => close(true)}
                className={`flex-1 rounded-2xl px-4 py-2.5 text-[15px] font-semibold text-white transition-all ${
                  opts.danger
                    ? 'bg-gradient-to-b from-[#ff453a] to-[#d70015] shadow-lg shadow-red-500/25'
                    : 'bg-gradient-to-b from-[#0a84ff] to-[#0064d2] shadow-lg shadow-blue-500/25'
                }`}
              >
                {opts.okText ?? (opts.danger ? 'Evet, Devam Et' : 'Onayla')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmCtx);
}
