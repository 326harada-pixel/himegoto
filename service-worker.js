// service-worker.js
const CACHE_NAME = 'himegoto-static-v6.6'; // ← 数字を必ず上げる
const STATIC_ASSETS = [
  '/', '/index.html', '/style.css', '/manifest.json', '/app.js'
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

  // 外部(GAS)は毎回ネット
  if (!sameOrigin) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // HTMLはネット優先→失敗時キャッシュ
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

  // CSS/JS/画像は キャッシュ→なければネット取得して保存
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
