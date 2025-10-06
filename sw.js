// sw.js
const CACHE_NAME = 'keepmoviez-cache-v4.2.3'; // <<-- IMPORTANT: Version number incremented
const OFFLINE_URL = 'offline.html'; 
const SUPABASE_URL = 'https://ujnjtvlkxhdbdbngdaeb.supabase.co'; // Define Supabase URL for easy checking

const CORE_ASSETS = [
  './', // Alias for index.html
  './index.html',
  './offline.html',
  './style.css',  
  './manifest.json',
  './js/constant.js',
  './js/utils.js',
  './js/indexeddb.js',
  './js/data.js',
  './js/io1.js',
  './js/io2.js',
  './js/tmdb.js',
  './js/genre.js',
  './js/analysis.js',
  './js/ui.js',
  './js/reporting.js',
  './js/app.js',
  './js/supabase.js',
  './js/main.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png', 
  'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700;900&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js',
  'https://code.jquery.com/jquery-3.5.1.slim.min.js',
  'https://cdn.jsdelivr.net/npm/@popperjs/core@2.9.2/dist/umd/popper.min.js',
  'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/js/bootstrap.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.3.0/papaparse.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching core assets');
        const googleFontsRequest = new Request(
          'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700;900&display=swap',
          { mode: 'no-cors' }
        );
        const assetsToCache = CORE_ASSETS.filter(url => !url.includes('fonts.googleapis.com'));
        assetsToCache.push(googleFontsRequest);

        return cache.addAll(assetsToCache);
      })
      .then(() => {
        console.log('Core assets cached successfully');
      })
      .catch(error => {
        console.error('Failed to cache core assets:', error);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// << START OF CORRECTED FETCH LOGIC >>
self.addEventListener('fetch', (event) => {
  const { request } = event;

  const criticalAppScripts = [
    'app.js', 'data.js', 'main.js', 'supabase.js',
    'indexeddb.js', 'ui.js', 'utils.js'
  ];
  const isAppScript = criticalAppScripts.some(script => request.url.endsWith(script));
  const isApiRequest = request.url.startsWith(SUPABASE_URL);

  if (isApiRequest) {
    // Strategy: Network-Only for all API calls to ensure data freshness.
    // This is the key fix for the bug.
    event.respondWith(fetch(request));

  } else if (isAppScript) {
    // Strategy: Network-First for critical app logic to prevent race conditions.
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          console.warn(`Network failed for ${request.url}, serving from cache.`);
          return caches.match(request);
        })
    );

  } else if (request.mode === 'navigate') {
    // Strategy: Network-First for main page navigation.
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL);
      })
    );

  } else {
    // Strategy: Cache-First for all other static assets (CSS, libraries, images, fonts).
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
        });
      })
    );
  }
});
// << END OF CORRECTED FETCH LOGIC >>