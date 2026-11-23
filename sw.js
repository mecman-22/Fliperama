// Deixa o Fliperama instalável e jogável sem internet.
// Páginas: tenta a rede primeiro (para ver sempre a versão nova) e usa o cache se estiver offline.
// Imagens, fontes e demais arquivos: serve do cache e atualiza em segundo plano.
const V = 'fliperama-v15';
const BASE = ['./', 'index.html', 'style.css?v=15', 'games.js?v=15', 'ranking-config.js?v=15', 'cloud.js?v=15', 'manifest.webmanifest',
  'assets/banner.webp', 'assets/icon-192.png', 'assets/icon-512.png',
  'games/coletor-estelar/index.html', 'games/memoria-cores/index.html', 'games/sudoku/index.html',
  'games/role-neon/index.html', 'games/mira-afiada/index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  // apaga só caches antigos do próprio portal (o Jogo da Velha tem o dele)
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('fliperama-') && k !== V).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  const fonts = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (u.origin !== location.origin && !fonts) return;
  const save = r => { if (r && (r.ok || r.type === 'opaque')) { const c = r.clone(); caches.open(V).then(x => x.put(req, c)); } return r; };

  if (req.mode === 'navigate' || req.destination === 'iframe' || req.destination === 'document') {
    e.respondWith(fetch(req).then(save).catch(() => caches.match(req, { ignoreSearch: true }).then(h => h || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(save).catch(() => hit);
    return hit || net;
  }));
});
