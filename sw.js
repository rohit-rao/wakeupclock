var RESOURCE_VERSION = 1;

var URLS_TO_CACHE = [
  '.',
  'index.html',
  'main.css',
  'main.js'
]

function getCacheName() {
  return "wakeupclock-v" + RESOURCE_VERSION;
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(getCacheName()).then(function (cache) {
      return cache.addAll(URLS_TO_CACHE);
    }));
});

self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (response) {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener('activate', event => {
  // delete any old caches
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key != getCacheName()) {
          return caches.delete(key);
        }
      })
    )).then(() => {
      console.log('V' + RESOURCE_VERSION + ' now ready to handle fetches!');
    })
  );
});
