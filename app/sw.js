// Rede primeiro, cache como reserva: o app abre mesmo sem internet, mas sempre pega a versão nova quando há rede.
const VERSAO = "__VERSAO__";
const SHELL = ["./", "./shim.js", "./manifest.webmanifest", "./icone-192.png", "./icone-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/__/")) return;   // handler do login do Firebase: nunca interceptar
  e.respondWith(
    fetch(req)
      .then(r => { const copia = r.clone(); caches.open(VERSAO).then(c => c.put(req, copia)); return r; })
      .catch(() => caches.match(req).then(r => r || caches.match("./")))
  );
});
