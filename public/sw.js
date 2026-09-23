const CACHE_NAME = 'wilsonix-midikey-v2';
// Precache list is resolved at runtime from the Vite build manifest
// (build.manifest: true -> /manifest.webmanifest in dist) so the hashed
// chunk/css filenames never drift out of sync with the source tree. The
// previous hardcoded /src/* paths never existed in build output, so
// addAll failed silently and every cold start re-fetched everything.
const CORE_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE_ASSETS).catch(() => {});
      try {
        const resp = await fetch('/.vite/manifest.json');
        if (resp && resp.ok) {
          const manifest = await resp.json();
          // Precache only the entry files (chunks/css load on demand and are
          // cached by the runtime fetch handler on first use).
          const entryFiles = Object.values(manifest)
            .filter((e) => e.isEntry && e.file)
            .map((e) => '/' + e.file);
          await cache.addAll(entryFiles).catch(() => {});
        }
      } catch (e) {}
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;
  if (
    request.url.includes('/samples/') ||
    request.url.includes('/soundfonts/') ||
    request.url.includes('/soundfonts-bin/') ||
    request.url.includes('/banks/') ||
    request.url.includes('/abletunes/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (
            response &&
            response.ok &&
            response.status === 200 &&
            request.url.startsWith(self.location.origin)
          ) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch(() => {});
            }).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});