/* Lole Yönetim — service worker (Web Push + çevrimdışı sayfa) */
const OFFLINE_CACHE = 'lole-offline-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(OFFLINE_CACHE).then((c) => c.add('/offline.html')).then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// sayfa gezinmelerinde: önce ağ, bağlantı yoksa çevrimdışı sayfası
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.open(OFFLINE_CACHE).then((c) => c.match('/offline.html'))
    )
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
