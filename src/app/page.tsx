'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabaseClient';
import { makeStorage } from '@/lib/storageShim';
import { LOLE_SHELL } from '@/lib/loleShell';

// Engine tarafından kullanılan global köprü
declare global {
  interface Window {
    storage?: unknown;
    __loleBoot?: { email: string; signOut: () => Promise<void> };
    __loleBooted?: boolean;
  }
}

export default function AppPage() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'checking' | 'booting' | 'ready' | 'nosession'>(
    'checking'
  );

  useEffect(() => {
    let cancelled = false;
    const sb = getSupabase();

    (async () => {
      const { data } = await sb.auth.getSession();
      if (cancelled) return;

      if (!data.session) {
        setStatus('nosession');
        router.replace('/login');
        return;
      }

      // Zaten başlatıldıysa tekrar başlatma (aynı sekmede yeniden mount'a karşı)
      if (window.__loleBooted) {
        setStatus('ready');
        return;
      }

      const user = data.session.user;
      const userId = user.id;
      const email = user.email || '';

      // 1) window.storage'ı Supabase kv_store ile besle
      window.storage = makeStorage(sb, userId);

      // 2) Giriş/çıkış köprüsü
      window.__loleBoot = {
        email,
        signOut: async () => {
          try {
            await sb.auth.signOut();
          } catch {
            /* yoksay */
          }
          window.__loleBooted = false;
          window.location.href = '/login';
        },
      };

      // 3) Uygulama kabuğunu (DOM) yerleştir
      if (rootRef.current) {
        rootRef.current.innerHTML = LOLE_SHELL;
      }

      // 4) Motoru (klasik global script) yükle → boot IIFE çalışır
      window.__loleBooted = true;
      setStatus('booting');
      const scr = document.createElement('script');
      scr.src = '/engine.js';
      scr.async = false;
      scr.onload = () => !cancelled && setStatus('ready');
      document.body.appendChild(scr);
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <>
      {status === 'checking' && (
        <div
          style={{
            minHeight: '100dvh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#46536e',
            fontSize: 14,
          }}
        >
          Yükleniyor…
        </div>
      )}
      <div id="lole-root" ref={rootRef} />
    </>
  );
}
