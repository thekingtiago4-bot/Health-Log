/* Health Path · service worker: abre mesmo sem internet (o cálculo em si precisa de internet). Troque CACHE a cada versão. */
const CACHE = 'hp-v3';
const ARQUIVOS = ['index.html', 'path.css', 'path.js', 'manifest.webmanifest', 'icons/icone.svg', 'icons/icon-192.png', 'icons/icon-512.png', '../data/municipios.json', '../fonts/Barlow-400.woff2', '../fonts/Barlow-500.woff2', '../fonts/Barlow-600.woff2', '../fonts/BarlowSemiCondensed-600.woff2', '../fonts/BarlowSemiCondensed-700.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url); if (u.origin !== location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ch => ch.put(e.request, c)); } return r; }).catch(() => caches.match(e.request)));
});
