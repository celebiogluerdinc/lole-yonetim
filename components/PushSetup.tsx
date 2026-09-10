'use client';

import { useEffect, useState } from 'react';
import { BellRing } from 'lucide-react';
import { savePushSubscription } from '@/app/(app)/notifications/actions';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw.split('').map(c => c.charCodeAt(0)));
}

export default function PushSetup() {
  const [state, setState] = useState<'unsupported' | 'ios-install' | 'ask' | 'on' | 'denied' | 'loading'>('loading');

  useEffect(() => {
    (async () => {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key || !('serviceWorker' in navigator)) return setState('unsupported');

      // iOS: push only works when installed to home screen
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches
        || (navigator as any).standalone === true;
      if (isIos && !standalone) return setState('ios-install');
      if (!('PushManager' in window) || !('Notification' in window)) return setState('unsupported');

      const reg = await navigator.serviceWorker.register('/sw.js');
      if (Notification.permission === 'denied') return setState('denied');
      const existing = await reg.pushManager.getSubscription();
      if (existing && Notification.permission === 'granted') {
        // keep server in sync
        savePushSubscription(existing.toJSON() as any).catch(() => {});
        return setState('on');
      }
      setState('ask');
    })().catch(() => setState('unsupported'));
  }, []);

  async function enable() {
    try {
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState('denied');
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key)
      });
      const json = sub.toJSON() as any;
      await savePushSubscription({ ...json, userAgent: navigator.userAgent });
      setState('on');
    } catch {
      setState('unsupported');
    }
  }

  if (state === 'loading' || state === 'on' || state === 'unsupported') return null;

  if (state === 'ios-install') {
    return (
      <div className="card p-4 flex items-start gap-3">
        <span className="smart-icon !w-8 !h-8 shrink-0" style={{ backgroundColor: '#007AFF' }}>
          <BellRing size={15} />
        </span>
        <p className="text-[13px] text-[#A8A8AD] leading-relaxed">
          iPhone&apos;da anlık bildirim almak için: Safari&apos;de <b>Paylaş</b> düğmesine basıp{' '}
          <b>&quot;Ana Ekrana Ekle&quot;</b> deyin, ardından uygulamayı ana ekrandan açın.
        </p>
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="card p-4">
        <p className="text-[13px] text-[#A8A8AD]">
          Bildirim izni reddedilmiş. Tarayıcı ayarlarından bu site için bildirimlere izin verirseniz anlık bildirim alabilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <button onClick={enable} className="card p-4 w-full flex items-center gap-3 text-left hover:bg-white/[0.04] transition-colors">
      <span className="smart-icon !w-9 !h-9 shrink-0" style={{ backgroundColor: '#FF3B30' }}>
        <BellRing size={17} />
      </span>
      <span className="flex-1">
        <p className="text-[15px] font-semibold">Anlık bildirimleri aç</p>
        <p className="text-[13px] text-[#8E8E93]">Görev, mesaj ve duyurular uygulama kapalıyken de telefonunuza düşsün.</p>
      </span>
      <span className="text-ios-blue text-[15px] font-semibold shrink-0">Aç</span>
    </button>
  );
}
