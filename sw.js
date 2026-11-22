/* Health Route · service worker. Troque o nome do cache a cada versão publicada. */
const CACHE = 'hr-app-v001';
const ARQUIVOS = ['./', 'index.html', 'app.css', 'fontes.css', 'nucleo.js', 'ui.js', 'mapa.js', 'app.js', 'abertura.js', 'manifest.webmanifest',
  'data/municipios.json', 'data/malha.json', 'icons/marca.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/Barlow-400.woff2', 'fonts/Barlow-500.woff2', 'fonts/Barlow-600.woff2', 'fonts/BarlowSemiCondensed-600.woff2', 'fonts/BarlowSemiCondensed-700.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  if (u.pathname.endsWith('version.json')) return; // sempre da rede
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
