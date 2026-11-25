/* Health Route · service worker. Troque o nome do cache a cada versão publicada. */
const CACHE = 'hr-app-v045';
const ARQUIVOS = ['./', 'index.html', 'tema.js', 'app.css', 'fontes.css', 'nucleo.js', 'ui.js', 'mapa.js', 'vias.js', 'fundo.js', 'vendor/maplibre-gl.css', 'app.js', 'relatorios.js', 'bipagem.js', 'situacao.js', 'romaneio.js', 'turno.js', 'feriados.js', 'geoeditor.js', 'geoalimentar.js', 'abertura.js', 'manifest.webmanifest',
  'data/municipios.json', 'data/malha.json', 'data/regioes.json', 'icons/marca.png', 'icons/healthlog.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/icone.svg',
  'fonts/Barlow-400.woff2', 'fonts/Barlow-500.woff2', 'fonts/Barlow-600.woff2', 'fonts/BarlowSemiCondensed-600.woff2', 'fonts/BarlowSemiCondensed-700.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'hr-vendor-v1').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin !== location.origin) return;
  if (u.pathname.endsWith('version.json')) return; // sempre da rede
  if (u.pathname.includes('/vendor/')) { // PDF/OCR (pesados): guarda na 1ª vez, num cache que sobrevive às versões
    e.respondWith(caches.open('hr-vendor-v1').then(c => c.match(e.request).then(r => r || fetch(e.request).then(resp => { if (resp.ok) c.put(e.request, resp.clone()); return resp; }))));
    return;
  }
  /* rede primeiro (sempre a versão mais nova); sem internet, usa a cópia guardada */
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(resp => { if (resp.ok) { const c = resp.clone(); caches.open(CACHE).then(ch => ch.put(e.request, c)); } return resp; }).catch(() => caches.match(e.request)));
});
