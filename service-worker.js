// PWAキャッシュ：静的のみ。API(GAS)は常にネット。
const CACHE_NAME = 'himegoto-static-v7.0';
const STATIC_ASSETS = [
  '/', '/index.html', '/style.css', '/app.js', '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const sameOrigin = url.origin === location.origin;

  // 外部（GAS等）は毎回ネット・キャッシュ禁止
  if (!sameOrigin) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // HTMLはネット優先→失敗でキャッシュ
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // それ以外（CSS/JS等）はキャッシュ優先
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
        return res;
      });
    })
  );
});