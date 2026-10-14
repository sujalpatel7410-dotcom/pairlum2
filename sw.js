// Pairlum service worker — makes the installed PWA work offline-ish and
// installable, without risking the stale-code problem a cache-first
// strategy would cause (this app ships changes often pre-launch). Strategy:
// network-first for everything same-origin, falling back to the cache only
// when the network is unreachable. Cross-origin requests (Supabase, fonts,
// the supabase-js CDN script) are never intercepted — they always go
// straight to the network, since caching auth/data responses would be wrong.
var CACHE_NAME = "pairlum-shell-v1";
var SHELL_FILES = [
  "/", "/index.html", "/auth.html", "/app.html", "/pricing.html", "/legal.html",
  "/app.js", "/book.js", "/pairlum-backend.js", "/pairlum-sync.js", "/pairlum-config.js",
  "/pairlum-core.js", "/styles.css", "/pairlum-core.css", "/pairlum-pages.css",
  "/manifest.json", "/assets/pwa/icon-192.png", "/assets/pwa/icon-512.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(SHELL_FILES); }).catch(function(){})
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(names){
      return Promise.all(names.filter(function(n){ return n !== CACHE_NAME; }).map(function(n){ return caches.delete(n); }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  var req = event.request;
  if(req.method !== "GET") return; // never cache writes
  var url = new URL(req.url);
  if(url.origin !== self.location.origin) return; // let Supabase/CDN/fonts pass straight through

  event.respondWith(
    fetch(req).then(function(res){
      var copy = res.clone();
      caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); }).catch(function(){});
      return res;
    }).catch(function(){
      return caches.match(req).then(function(cached){ return cached || caches.match("/app.html"); });
    })
  );
});
