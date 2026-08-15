/* C7: PWA asgari service worker — YALNIZCA uygulama kabuğu (statik dosyalar).
   Veri istekleri (Supabase, /api/*) ASLA önbelleğe alınmaz ve kuyruklanmaz (bkz. plan D1):
   offline yazma kuyruğu bilinçli olarak YOKTUR — çakışma penceresini büyütür. */
const CACHE = 'lole-shell-v2'; // v14-S3: sürüm artırıldı — eski önbellek activate'te temizlenir
/* v14-S3: eskiden yalnız manifest+ikonlar vardı; uygulamanın kendisi (/ ve /engine.js)
   önbellekte olmadığı için "standalone" PWA çevrimdışı açıldığında boş ekran veriyordu. */
const SHELL = ['/', '/engine.js', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return; // yazmalar her zaman ağa gider
  if (url.origin !== self.location.origin) return; // Supabase/Anthropic vb. dokunulmaz
  if (url.pathname.startsWith('/api/')) return; // API her zaman ağdan
  // yalnızca kabuk dosyaları: cache-first; diğer her şey ağ (başarısızsa cache'e bakılır)
  if (SHELL.indexOf(url.pathname) !== -1) {
    // stale-while-revalidate: anında cache'ten aç, arka planda tazele (engine.js güncellemesi bir sonraki açılışta gelir)
    e.respondWith(
      caches.match(e.request).then((r) => {
        const net = fetch(e.request)
          .then((resp) => {
            if (resp && resp.ok) caches.open(CACHE).then((c) => c.put(e.request, resp.clone())).catch(() => {});
            return resp;
          })
          .catch(() => r);
        return r || net;
      })
    );
  }
});
