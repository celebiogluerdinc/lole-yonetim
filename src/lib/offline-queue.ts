/**
 * ÇEVRİMDIŞI ZİYARET KUYRUĞU
 *
 * Sahada şebeke gidip geliyor (bodrum kat, depo, kırsal). Eskiden
 * bağlantı yokken "kaydet"e basan temsilci hata görüyor, formu baştan
 * yazıyordu. Artık ziyaret cihazda saklanıyor ve bağlantı gelince
 * kendiliğinden gönderiliyor.
 *
 * Tarayıcıya özel (localStorage) — yalnız istemci bileşenlerinden çağrılır.
 * Aynı ziyaretin iki kez yazılmasını sunucu engelliyor: her form açılışı
 * bir client_uuid üretir, saveVisit aynı uuid'yi görünce günceller.
 *
 * Yalnız METİN alanları saklanır; fotoğraf kuyruğa girmez (boyut) —
 * ziyaret gönderildikten sonra ziyaret kartından eklenir.
 */

export const VISIT_QUEUE_KEY = 'lole.sales.visitQueue.v1';
export const VISIT_QUEUE_EVENT = 'lole:visit-queue';

export interface QueuedVisit {
  /** client_uuid ile aynı — tekilleştirme anahtarı */
  id: string;
  /** Kuyruğa alındığı an (ISO) */
  at: string;
  outletName: string;
  fields: [string, string][];
  /** Sunucu kaydı reddettiyse (doğrulama hatası) son mesaj */
  lastError?: string;
}

function safeRead(): QueuedVisit[] {
  try {
    const raw = window.localStorage.getItem(VISIT_QUEUE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function safeWrite(rows: QueuedVisit[]): boolean {
  try {
    window.localStorage.setItem(VISIT_QUEUE_KEY, JSON.stringify(rows));
    window.dispatchEvent(new Event(VISIT_QUEUE_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function readVisitQueue(): QueuedVisit[] {
  if (typeof window === 'undefined') return [];
  return safeRead();
}

/** Formu kuyruğa alır. Saklanamadıysa (gizli sekme, dolu depolama) false. */
export function enqueueVisit(fd: FormData, outletName: string): boolean {
  if (typeof window === 'undefined') return false;
  const fields: [string, string][] = [];
  fd.forEach((v, k) => { if (typeof v === 'string') fields.push([k, v]); });
  const id = fields.find(([k]) => k === 'client_uuid')?.[1];
  if (!id) return false;
  const rows = safeRead().filter(r => r.id !== id);
  rows.push({ id, at: new Date().toISOString(), outletName, fields });
  return safeWrite(rows);
}

export function removeQueuedVisit(id: string) {
  if (typeof window === 'undefined') return;
  safeWrite(safeRead().filter(r => r.id !== id));
}

export function markQueuedVisitError(id: string, message: string) {
  if (typeof window === 'undefined') return;
  safeWrite(safeRead().map(r => (r.id === id ? { ...r, lastError: message } : r)));
}

export function queuedVisitToFormData(q: QueuedVisit): FormData {
  const fd = new FormData();
  for (const [k, v] of q.fields) fd.append(k, v);
  return fd;
}

/**
 * Hata "bağlantı yok" mu? Sunucu action'ı ağa çıkamadığında tarayıcı
 * TypeError fırlatır; navigator.onLine tek başına güvenilir değil
 * (Wi-Fi bağlı ama internet yok), o yüzden ikisine birlikte bakılıyor.
 */
export function looksOffline(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String((e as any)?.message ?? e ?? '').toLowerCase();
  return e instanceof TypeError
    || msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed');
}
