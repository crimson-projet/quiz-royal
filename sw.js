self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('crimson-quiz-v2').then((cache) => { // Passe de v1 à v2 ici
      return cache.addAll(['./index.html', './manifest.json']);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
