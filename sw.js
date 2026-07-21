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

// Push Notification Event
self.addEventListener('push', (e) => {
  let data = { title: 'Thông báo từ UPMath', body: 'Bạn có thông báo mới!' };
  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data = { title: 'Thông báo từ UPMath', body: e.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: 'logo.png',
    badge: 'logo.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const urlToOpen = new URL(e.notification.data.url, self.location.origin).href;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with this app
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
