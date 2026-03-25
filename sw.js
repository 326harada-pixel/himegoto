// himegoto Service Worker
// PWAインストールを可能にするための最小構成
// キャッシュは使わず、インストール可能条件を満たすだけ

const CACHE_NAME = 'himegoto-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // ネットワークをそのまま使う（キャッシュなし）
  event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
});
