/* Health Path · service worker SÓ PARA PERMITIR A INSTALAÇÃO. O aplicativo precisa de internet: nada é guardado para uso sem rede
   (as páginas e cada consulta de rota sempre vêm da rede, na hora). Se mudar o comportamento, troque a versão. */
const VERSAO = 'hp-v5-rede';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => { if (e.request.method === 'GET') e.respondWith(fetch(e.request, { cache: 'no-store' })); });
