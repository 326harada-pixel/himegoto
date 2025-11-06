/* ===== ﾋﾒｺﾞﾄ SW v30 =====
   - ネットワーク優先 / オフライン時はキャッシュ
   - SKIP_WAITING メッセージで即時有効化
*/
const CACHE = 'hime-cache-v30';
const ASSETS = [
  '/', '/index.html',
  '/style.css', '/app.js',
  '/logo_himegoto.png',
  '/icon-192.png', '/icon-512.png',
  '/manifest.json'
  // 必要なら各HTMLを列挙: '/help.html','/qa.html','/register.html','/privacy.html','/terms.html','/customer.html'
];

self.addEventListener('install', (event)=>{
  event.waitUntil(
    caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (event)=>{
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event)=>{
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event)=>{
  const req = event.request;
  // APIなどは素通し
  if(req.method !== 'GET') return;

  event.respondWith((async ()=>{
    try{
      // ネットワーク優先
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE);
      cache.put(req, fresh.clone());
      return fresh;
    }catch(_){
      // オフライン時はキャッシュ
      const cached = await caches.match(req, {ignoreVary:true, ignoreSearch:false});
      if(cached) return cached;
      // ルートへフォールバック
      if(req.mode === 'navigate'){
        const fallback = await caches.match('/index.html');
        if(fallback) return fallback;
      }
      throw _;
    }
  })());
});