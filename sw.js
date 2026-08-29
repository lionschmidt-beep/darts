// Service Worker: macht die App offline lauffaehig, OHNE Updates zu verstecken.
// Strategie bewusst "network first": beim naechsten Oeffnen mit Netz kommt immer
// der frische Stand; ohne Netz kommt der letzte gecachte. Ein cache-first-SW
// wuerde auf dem Handy eine alte Version festnageln, die niemand mehr loswird.
var CACHE = "darts-v2";
var ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg",
              "./icon-192.png", "./icon-512.png", "./icon-512-maskable.png",
              "./apple-touch-icon.png"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).catch(function(){}));
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ return k===CACHE ? null : caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  e.respondWith(
    fetch(req).then(function(res){
      if(res && res.status === 200 && res.type !== "opaque"){
        var copy = res.clone();
        caches.open(CACHE).then(function(c){ c.put(req, copy); }).catch(function(){});
      }
      return res;
    }).catch(function(){
      return caches.match(req).then(function(hit){
        return hit || caches.match("./index.html");
      });
    })
  );
});
