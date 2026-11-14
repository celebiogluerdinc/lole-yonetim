'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CloudOff, RefreshCw, Trash2 } from 'lucide-react';
import { saveVisit } from '@/app/(app)/sales/actions';
import {
  readVisitQueue, removeQueuedVisit, markQueuedVisitError, queuedVisitToFormData,
  looksOffline, VISIT_QUEUE_EVENT, type QueuedVisit
} from '@/lib/offline-queue';

/**
 * BEKLEYEN ZİYARETLER ŞERİDİ
 *
 * Bağlantı yokken kaydedilen ziyaretler cihazda duruyor; bu şerit
 * onları gösterir ve bağlantı gelince kendiliğinden gönderir.
 * Kuyruk boşsa ve cihaz çevrimiçiyse hiçbir şey çizmez.
 *
 * Sunucu bir kaydı REDDEDERSE (ör. itiraz nedeni eksik) kayıt
 * silinmez: sebebiyle birlikte listede kalır, kullanıcı düzeltip
 * yeniden girer ya da siler. Sessizce atılan kayıt, kayıp ziyarettir.
 */
export default function OfflineQueueBanner() {
  const router = useRouter();
  const [rows, setRows] = useState<QueuedVisit[]>([]);
  const [online, setOnline] = useState(true);
  const [sending, setSending] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(() => setRows(readVisitQueue()), []);

  const flush = useCallback(async () => {
    if (busy.current) return;
    const queue = readVisitQueue();
    if (!queue.length) return;
    busy.current = true; setSending(true);
    let sent = 0;
    for (const q of queue) {
      try {
        const r: any = await saveVisit(queuedVisitToFormData(q));
        if (r?.error) { markQueuedVisitError(q.id, r.error); continue; }
        removeQueuedVisit(q.id);
        sent++;
      } catch (e) {
        // Hâlâ bağlantı yok: sıradakileri denemenin anlamı yok.
        if (looksOffline(e)) break;
        markQueuedVisitError(q.id, 'Gönderilemedi, tekrar denenecek.');
      }
    }
    busy.current = false; setSending(false);
    refresh();
    if (sent > 0) router.refresh();
  }, [refresh, router]);

  useEffect(() => {
    refresh();
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine !== false);
    const on = () => { setOnline(true); flush(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener(VISIT_QUEUE_EVENT, refresh);
    // Sayfa açıldığında bekleyen varsa ve bağlantı varsa hemen dene
    if (navigator.onLine !== false) flush();
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener(VISIT_QUEUE_EVENT, refresh);
    };
  }, [flush, refresh]);

  if (online && rows.length === 0) return null;

  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 space-y-2" data-noprint>
      <div className="flex items-center gap-2.5">
        <CloudOff size={16} className="text-amber-300 shrink-0" />
        <p className="flex-1 min-w-0 text-[13px] text-amber-300">
          {!online && rows.length === 0 && 'Bağlantı yok. Ziyaret kaydederseniz cihazda saklanır, bağlantı gelince gönderilir.'}
          {rows.length > 0 && (
            <>
              <strong>{rows.length} ziyaret</strong> gönderilmeyi bekliyor
              {!online ? ' — bağlantı gelince kendiliğinden gidecek.' : '.'}
            </>
          )}
        </p>
        {rows.length > 0 && online && (
          <button type="button" onClick={flush} disabled={sending}
            className="shrink-0 min-h-[40px] rounded-lg bg-amber-500/20 text-amber-300 px-3 text-[13px] font-semibold flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw size={14} className={sending ? 'animate-spin' : ''} />
            {sending ? 'Gönderiliyor' : 'Şimdi gönder'}
          </button>
        )}
      </div>

      {rows.filter(r => r.lastError).map(r => (
        <div key={r.id} className="flex items-start gap-2 text-[12.5px] text-rose-300">
          <p className="flex-1 min-w-0">
            <strong>{r.outletName || 'Ziyaret'}</strong> gönderilemedi: {r.lastError}
          </p>
          <button type="button" onClick={() => { removeQueuedVisit(r.id); refresh(); }}
            className="shrink-0 flex items-center gap-1 underline min-h-[32px]">
            <Trash2 size={12} /> sil
          </button>
        </div>
      ))}
    </div>
  );
}
