// Service worker do Ponto Certo: guarda o app (HTML, JS, CSS, ícones) para abrir sem internet
// e mostra as notificações que o robô manda pelo Firebase.
// Nunca guarda as chamadas ao robô (outro domínio): os dados ficam no cache do próprio app.
importScripts('./notificacao-payload.js');

const CACHE = 'ponto-certo-v2';
const BASICOS = ['./', './index.html', './manifest.webmanifest', './icones/icone-192.png', './notificacao-payload.js'];

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

// Push do robô (FCM data message): sempre mostra uma notificação (exigência do Chrome).
self.addEventListener('push', (evento) => {
  let bruto = {};
  try {
    bruto = evento.data ? evento.data.json() : {};
  } catch (erro) {
    bruto = { data: { corpo: evento.data ? evento.data.text() : '' } };
  }
  const escopo = self.registration.scope;
  const aviso = self.PontoCertoNotificacao.lerPayloadFcm(bruto, escopo);
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo, {
      body: aviso.corpo,
      icon: escopo + 'icones/icone-192.png',
      badge: escopo + 'icones/icone-192.png',
      tag: aviso.tag,
      renotify: true,
      data: { link: aviso.link },
    }),
  );
});

// Toque na notificação: foca o app (indo para a tela certa) ou abre uma janela nova.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const escopo = self.registration.scope;
  const pedido = evento.notification.data && evento.notification.data.link;
  const link = typeof pedido === 'string' && pedido.indexOf(escopo) === 0 ? pedido : escopo + '#/hoje';
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const doApp = janelas.find((janela) => janela.url.indexOf(escopo) === 0);
      if (doApp) {
        doApp.postMessage({ tipo: 'navegar', link: link });
        return doApp.focus();
      }
      return self.clients.openWindow(link);
    }),
  );
});
