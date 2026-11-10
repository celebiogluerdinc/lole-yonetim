/* Lole Yönetim — service worker (Web Push + çevrimdışı teşhis sayfası)
 *
 * SÜRÜM NOTU (v2): çevrimdışı sayfası artık teşhis yapıyor ve başarısız
 * isteğin GERÇEK hatası sayfaya enjekte ediliyor. Önceki sürüm her
 * başarısız gezinmede "İnternet bağlantısı yok" diyordu; internet varken
 * sunucuya ulaşılamadığında da aynı metin çıktığı için sorunun ağda mı
 * sunucuda mı olduğu anlaşılamıyordu.
 *
 * Önbellek adı v1'den v2'ye alındı: yoksa tarayıcıdaki ESKİ offline.html
 * kullanılmaya devam ederdi.
 */
const OFFLINE_CACHE = 'lole-offline-v2';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(OFFLINE_CACHE)
      // cache: 'reload' — araya giren HTTP önbelleği eski sayfayı vermesin
      .then((c) => c.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k.startsWith('lole-offline-') && k !== OFFLINE_CACHE)
            .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/**
 * Sayfa gezinmelerinde: önce ağ, yanıt alınamazsa teşhis sayfası.
 *
 * Dikkat: buraya yalnızca istek HİÇ YANIT ALAMADIĞINDA düşülüyor
 * (DNS, TLS, bağlantı sıfırlanması, zaman aşımı). HTTP 500/404 bir
 * yanıttır ve buraya düşmez — o yüzden bu sayfanın görünmesi her zaman
 * "adrese ulaşılamıyor" demektir.
 */
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(async (err) => {
      const cache = await caches.open(OFFLINE_CACHE);
      const cached = await cache.match(OFFLINE_URL);
      if (!cached) return Response.error();

      // Hatanın kendisini sayfaya veri olarak geçiriyoruz: teşhis
      // ekranı "neden" sorusunu ancak bununla yanıtlayabiliyor.
      try {
        const html = await cached.text();
        const inject = '<script>window.__lole_err=' + JSON.stringify(String(err && err.message || err))
          + ';window.__lole_url=' + JSON.stringify(event.request.url) + ';</script>';
        return new Response(html.replace('</head>', inject + '</head>'), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
        });
      } catch {
        return cached;
      }
    })
  );
});

self.addEventListener('push', (event) => {
  let data = { title: 'Lole Yönetim', body: '', url: '/notifications' };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/notifications';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.navigate(url); return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});
