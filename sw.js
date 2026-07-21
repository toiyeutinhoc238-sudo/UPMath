const CACHE_NAME = 'upmath-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './style.css',
  './logo.png'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // Do not cache API calls or external auth requests
  if (url.pathname.includes('/api/') || url.hostname.includes('accounts.google.com')) {
    return;
  }

  // Network-first, fallback to cache for static resources
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Cache new static resources successfully fetched
        if (e.request.method === 'GET' && res.status === 200 && !url.pathname.includes('/api/')) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, resClone);
          });
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
