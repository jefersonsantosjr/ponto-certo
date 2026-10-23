// Service worker do Ponto Certo: guarda o app (HTML, JS, CSS, ícones) para abrir sem internet.
// Nunca guarda as chamadas ao robô (outro domínio): os dados ficam no cache do próprio app.
const CACHE = 'ponto-certo-v1';
const BASICOS = ['./', './index.html', './manifest.webmanifest', './icones/icone-192.png'];

self.addEventListener('install', (evento) => {
  self.skipWaiting();
  evento.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(BASICOS)).catch(() => undefined));
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((chave) => chave !== CACHE).map((chave) => caches.delete(chave))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return;

  // Páginas: tenta a rede primeiro (pra pegar versão nova) e cai no cache sem internet.
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((resposta) => {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put('./index.html', copia));
          return resposta;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // Arquivos com hash no nome (JS/CSS) e ícones: cache primeiro.
  evento.respondWith(
    caches.match(pedido).then(
      (guardado) =>
        guardado ||
        fetch(pedido).then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE).then((cache) => cache.put(pedido, copia));
          }
          return resposta;
        }),
    ),
  );
});
