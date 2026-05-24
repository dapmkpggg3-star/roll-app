const CACHE_NAME = 'roll-app-v6';
const urlsToCache = [
  '/roll-app/',
  '/roll-app/index.html',
  '/roll-app/manifest.json',
  '/roll-app/404.html'
];

// Service Worker インストール
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Cache opened');
      return cache.addAll(urlsToCache).catch(err => {
        console.log('Cache addAll error:', err);
        // Some resources may fail to cache, continue anyway
      });
    })
  );
  self.skipWaiting();
});

// Service Worker アクティベーション
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
  // 自動更新: すべてのクライアントに更新を通知
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'SW_UPDATED' });
    });
  });
});

// ネットワークリクエストのハンドリング - 常にネットワーク優先
self.addEventListener('fetch', event => {
  if (event.request.method === 'GET') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 成功したらキャッシュに保存（オプション）
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // ネットワークエラー時はキャッシュから返す
          return caches.match(event.request)
            .then(response => response || caches.match('/roll-app/404.html'));
        })
    );
  }
});

// メッセージハンドリング
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
