// sw.js
const CACHE_NAME = 'keepmoviez-local-v5.1.0'; // Version bumped to force update
const OFFLINE_URL = 'offline.html'; 
const SUPABASE_URL = 'https://ujnjtvlkxhdbdbngdaeb.supabase.co'; 

const CORE_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './style.css',  
  './manifest.json',
  
  // Local CSS
  './libs/css/bootstrap.min.css',
  './libs/css/all.min.css',

  // Local Fonts
  './libs/webfonts/fa-solid-900.woff2',
  './libs/webfonts/fa-brands-400.woff2',
  './libs/webfonts/fa-regular-400.woff2',
  
  // Local JS Libraries
  './libs/js/crypto-js.min.js',
  './libs/js/supabase.min.js',
  './libs/js/jquery.min.js',
  './libs/js/popper.min.js',
  './libs/js/bootstrap.min.js',
  './libs/js/papaparse.min.js',
  './libs/js/chart.js',
  './libs/js/html2canvas.min.js',
  './libs/js/jspdf.umd.min.js',
  './libs/js/jspdf.plugin.autotable.min.js',

  // App Logic Scripts
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
  
  // Icons
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache and caching local assets');
        // We explicitly allow the caching to proceed even if Google Fonts (external) fails,
        // but here we are only caching CORE_ASSETS which are all local now.
        return cache.addAll(CORE_ASSETS);
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
          // console.warn(`Network failed for ${request.url}, serving from cache.`);
          return caches.match(request);
        })
    );

  } else if (request.mode === 'navigate') {
    // Strategy: Network-First for main page navigation.
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match(OFFLINE_URL) || caches.match('./index.html');
      })
    );

  } else {
    // Strategy: Cache-First for all other static assets (Local Libs, CSS, Images, Fonts).
    event.respondWith(
      caches.match(request).then((response) => {
        return response || fetch(request).then((networkResponse) => {
            // Only cache valid responses
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
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