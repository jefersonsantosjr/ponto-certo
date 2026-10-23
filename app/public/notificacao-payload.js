// Lê o push que o robô manda pelo Firebase (FCM "data message") e decide o que a notificação mostra.
// JS puro: o sw.js carrega com importScripts e os testes do app carregam como texto.
(function (global) {
  function texto(valor) {
    return typeof valor === 'string' ? valor : '';
  }

  function objeto(valor) {
    return valor && typeof valor === 'object' ? valor : {};
  }

  /**
   * @param bruto  o JSON do push (evento.data.json())
   * @param escopo escopo do service worker (ex.: https://…/ponto-certo/); links fora dele são trocados pela tela Hoje
   */
  function lerPayloadFcm(bruto, escopo) {
    var pacote = objeto(bruto);
    var dados = pacote.data && typeof pacote.data === 'object' ? pacote.data : pacote;
    var aviso = objeto(pacote.notification);
    var linkPadrao = escopo + '#/hoje';
    var link = texto(dados.link) || texto(objeto(pacote.fcmOptions).link) || texto(aviso.click_action);
    if (!link || link.indexOf(escopo) !== 0) link = linkPadrao;
    return {
      titulo: texto(dados.titulo) || texto(aviso.title) || 'Ponto Certo',
      corpo: texto(dados.corpo) || texto(aviso.body),
      link: link,
      tag: texto(dados.tag) || 'ponto-certo',
    };
  }

  global.PontoCertoNotificacao = { lerPayloadFcm: lerPayloadFcm };
})(typeof self !== 'undefined' ? self : globalThis);
