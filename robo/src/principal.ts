import {
  calcularPeriodo, configPadrao, formatarHora, formatarHorasPlanilha, formatarSaldoPlanilha, gerarNotificacao, manuaisSubstituidas,
  NOMES_DIAS, dataValida, diaDaSemana, respostasVigentes, segundosEntre,
} from '../../motor/src/index';
import type { AlertaGravado, Ajuste, BatidaRegistrada, ConfigCalculo, Estado, Papel, Resposta } from '../../motor/src/index';
import { tratarRequisicao, type DependenciasApi } from './nucleo/api';
import {
  avisosDeAlertas, avisosDeBatidas, avisosDePendencias, avisosDoDia, pendenciasAbertas, tagDoEvento, type Aviso, type DadosAviso,
} from './nucleo/notificar';
import * as sessoes from './nucleo/sessoes';
import { sincronizar, type ModoSincronizacao } from './nucleo/sincronizar';
import * as fcm from './gas/fcm';
import { gmailReal } from './gas/gmail';
import * as planilha from './gas/planilha';
import * as props from './gas/propriedades';
import { agoraLocal, momentoDeTexto, segundosDesde } from './gas/tempoLocal';

declare const __URL_ROBO__: string;
declare const __URL_APP__: string;

const INICIO_EXPEDIENTE = 6 * 3600 + 30 * 60;
const FIM_EXPEDIENTE = 21 * 3600 + 30 * 60;

// ---------------------------------------------------------------- utilidades

function json(dados: unknown): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify(dados)).setMimeType(ContentService.MimeType.JSON);
}

function comTrava<T>(fn: () => T, esperaMs = 20000): T | null {
  const trava = LockService.getScriptLock();
  if (!trava.tryLock(esperaMs)) return null;
  try {
    return fn();
  } finally {
    trava.releaseLock();
  }
}

function nomeExibicao(): string {
  const salvo = props.lerTexto('NOME_EXIBICAO');
  if (salvo) return salvo;
  const primeiro = (props.lerIdentidade()?.nome ?? '').trim().split(/\s+/)[0] ?? '';
  return primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : 'Você';
}

/** Config de cálculo; na primeira vez, o banco começa na data do primeiro comprovante, com saldo zero. */
function config(): ConfigCalculo {
  const salva = props.lerConfig();
  if (salva) return salva;
  const datas = planilha.lerBatidas().filter((b) => b.origem !== 'manual').map((b) => b.data).sort();
  const inicio = datas[0] ?? agoraLocal().momento.data;
  const nova = configPadrao(inicio);
  props.gravarConfig(nova);
  return nova;
}

function urlRobo(): string {
  return __URL_ROBO__ || ScriptApp.getService().getUrl() || '';
}

// ---------------------------------------------------------------- sincronização

function executarSincronizacao(modo: ModoSincronizacao): void {
  comTrava(() => {
    const agora = agoraLocal();
    const r = sincronizar(
      gmailReal,
      { mensagens: planilha.lerMensagens(), batidas: planilha.lerBatidas() },
      { modo, agoraTexto: agora.iso, identidade: props.lerIdentidade() },
    );
    if (r.identidadeAprendida) props.gravarIdentidade(r.identidadeAprendida);
    planilha.acrescentarMensagens(r.novasMensagens);
    planilha.acrescentarBatidas(r.novasBatidas);
    planilha.atualizarBatidas(r.batidasAlteradas);
    const novosAlertas = planilha.acrescentarAlertas(r.alertas, agora.iso);
    if (r.conferencia) {
      planilha.acrescentarConferencia(r.conferencia);
      props.gravarUltimaConferencia(r.conferencia);
    }
    for (const f of r.falhas) console.warn(`Não consegui ler a mensagem ${f.id}: ${f.erro}`);
    props.gravarUltimaSincronizacao(agora.iso);
    if (r.novasBatidas.length || r.batidasAlteradas.length) atualizarDias();
    if (modo === 'completa') avisarVigiaExterno(Boolean(r.conferencia?.ok) && r.falhas.length === 0);
    try {
      notificar(r.novasBatidas, novosAlertas);
    } catch (erro) {
      console.warn(`Notificações: ${String(erro)}`);
    }
  }, 25000);
}

// ---------------------------------------------------------------- notificações

const URL_APP_DESTINO = (destino: string): string => `${__URL_APP__}${destino}`;

function lerEnviados(): Record<string, string> {
  try {
    return JSON.parse(props.lerTexto('AVISOS_ENVIADOS') ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

/** Decide e envia os avisos desta rodada; cada aviso (pela chave) sai uma vez só. */
function notificar(novasBatidas: BatidaRegistrada[], novosAlertas: AlertaGravado[]): void {
  if (!fcm.servidorPronto() || fcm.quantidadeAparelhos() === 0) return;
  const agora = agoraLocal();
  const d: DadosAviso = {
    batidas: planilha.lerBatidas(), respostas: planilha.lerRespostas(), ajustes: planilha.lerAjustes(),
    config: config(), hoje: agora.momento.data, agora: agora.momento.segundos,
  };
  const abertas = pendenciasAbertas(d);
  const avisos: Aviso[] = [
    ...avisosDeBatidas(novasBatidas, d),
    ...avisosDeAlertas(novosAlertas),
    ...avisosDePendencias(abertas),
    ...avisosDoDia(d, abertas),
  ];
  const enviados = lerEnviados();
  const limite = agora.momento.data;
  let mudou = false;
  for (const aviso of avisos) {
    if (enviados[aviso.chave]) continue;
    const n = gerarNotificacao(aviso.evento, { nome: nomeExibicao(), agora: agora.momento.segundos });
    fcm.enviarParaTodos({ titulo: n.titulo, corpo: n.corpo, link: URL_APP_DESTINO(n.destino), tag: tagDoEvento(aviso.evento) });
    enviados[aviso.chave] = limite;
    mudou = true;
  }
  if (mudou) {
    // Esquece chaves de mais de 10 dias (as de pendência continuam valendo enquanto a pendência existir).
    for (const [chave, data] of Object.entries(enviados)) {
      if (!chave.startsWith('pendencia|') && segundosEntre({ data, segundos: 0 }, { data: limite, segundos: 0 }) > 10 * 86400) delete enviados[chave];
    }
    props.gravarTexto('AVISOS_ENVIADOS', JSON.stringify(enviados));
  }
}

function avisarVigiaExterno(ok: boolean): void {
  const url = props.lerTexto('URL_HEALTHCHECK');
  if (!url) return;
  try {
    UrlFetchApp.fetch(ok ? url : `${url}/fail`, { muteHttpExceptions: true });
  } catch (erro) {
    console.warn(`Vigia externo indisponível: ${String(erro)}`);
  }
}

/** Reescreve a aba "Dias" com a conta de cada dia (para conferir pela planilha). */
function atualizarDias(): void {
  const cfg = config();
  const hoje = agoraLocal().momento.data;
  const batidas = planilha.lerBatidas();
  const periodo = calcularPeriodo({
    de: cfg.inicioBanco, ate: hoje, hoje, batidas,
    respostas: respostasVigentes(planilha.lerRespostas()), ajustes: planilha.lerAjustes(), config: cfg,
  });
  planilha.gravarDias(
    periodo.dias.map((d) => [
      d.data,
      NOMES_DIAS[diaDaSemana(d.data)],
      d.batidas.filter((b) => b.status === 'ativa').map((b) => formatarHora(b.segundos) + (b.duplicada ? '(dup)' : '')).join(' '),
      formatarHorasPlanilha(d.trabalhado),
      formatarHorasPlanilha(d.carga),
      formatarSaldoPlanilha(d.saldo),
      periodo.bancoPorDia[d.data] === undefined ? '' : formatarSaldoPlanilha(periodo.bancoPorDia[d.data]),
      d.status,
      String(d.pendencias.length),
    ]),
  );
}

// ---------------------------------------------------------------- estado para o app

function montarEstado(usuario: { nome: string; papel: Papel }): Estado {
  const agora = agoraLocal();
  const identidade = props.lerIdentidade();
  const ultimaConferencia = props.lerUltimaConferencia();
  const problemas: string[] = [];
  if (!identidade) problemas.push('Ainda não encontrei nenhum comprovante no Gmail.');
  if (ultimaConferencia && !ultimaConferencia.ok) problemas.push(`Conferência com o Gmail: ${ultimaConferencia.detalhe ?? 'divergência'}`);
  return {
    geradoEm: agora.iso,
    hoje: agora.momento.data,
    agora: agora.momento.segundos,
    usuario,
    nomeExibicao: nomeExibicao(),
    identidade: identidade
      ? {
          cpfMascarado: `***.${identidade.cpf.slice(3, 6)}.${identidade.cpf.slice(6, 9)}-**`,
          nome: identidade.nome,
          cnpj: identidade.cnpj,
        }
      : null,
    config: config(),
    batidas: planilha.lerBatidas(),
    mensagens: planilha.lerMensagens(),
    respostas: planilha.lerRespostas(),
    ajustes: planilha.lerAjustes(),
    alertas: planilha.lerAlertas(),
    saude: { ultimaSincronizacao: props.lerUltimaSincronizacao(), ultimaConferencia, problemas },
    notificacoes: { servidorPronto: fcm.servidorPronto(), aparelhos: fcm.quantidadeAparelhos() },
  };
}

const dependencias: DependenciasApi = {
  ativar: (codigo, aparelho) => sessoes.ativar(props.armazem, props.cripto, codigo, aparelho, Date.now()),
  validarToken: (token) => sessoes.validarToken(props.armazem, props.cripto, token, Date.now()),
  encerrar: (token) => sessoes.encerrar(props.armazem, props.cripto, token),
  estado: montarEstado,
  sincronizar: () => executarSincronizacao('incremental'),
  gravarResposta: (resposta: Resposta, autor: string) => {
    comTrava(() => {
      planilha.acrescentarResposta({ id: Utilities.getUuid(), criadaEm: agoraLocal().iso, autor, resposta });
      atualizarDias();
    });
  },
  gravarBatidaManual: (dados, autor) => {
    comTrava(() => {
      const nova: BatidaRegistrada = {
        id: `man-${Utilities.getUuid()}`, data: dados.data, segundos: dados.segundos, origem: 'manual', status: 'ativa',
        hora: dados.hora, cpfConfere: true, nomeConfere: true, cnpjConfere: true, atraso: 0, recebidoEm: '',
        justificativa: `${dados.justificativa} (lançada por ${autor})`,
      };
      if (manuaisSubstituidas([...planilha.lerBatidas(), nova]).includes(nova.id)) nova.status = 'substituida';
      planilha.acrescentarBatidas([nova]);
      atualizarDias();
    });
  },
  gravarAjuste: (ajuste: Pick<Ajuste, 'data' | 'tipo' | 'segundos' | 'justificativa'>, autor: string) => {
    comTrava(() => {
      planilha.acrescentarAjuste({ ...ajuste, id: Utilities.getUuid(), ativo: true, criadoEm: agoraLocal().iso, autor });
      atualizarDias();
    });
  },
  marcarAlertasLidos: (ids) => {
    comTrava(() => planilha.marcarAlertasLidos(ids));
  },
  registrarDispositivo: (fcmToken, aparelho, usuario) => {
    comTrava(() => fcm.registrarAparelho(fcmToken, { nome: usuario.nome, papel: usuario.papel, aparelho }, agoraLocal().iso));
  },
  testarNotificacao: (fcmToken, usuario) =>
    fcm.enviarPara(fcmToken, {
      titulo: '🔔 Notificações ligadas!',
      corpo: `Pronto, ${usuario.papel === 'dona' ? nomeExibicao() : usuario.nome}! A partir de agora eu aviso aqui cada batida, o resumo do dia e as pendências 😉`,
      link: URL_APP_DESTINO('#/hoje'),
      tag: 'teste',
    }),
};

// ---------------------------------------------------------------- funções chamadas pelo Google

export function doGet(): GoogleAppsScript.Content.TextOutput {
  return json({ ok: true, app: 'Ponto Certo', hora: agoraLocal().iso });
}

export function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    return json(tratarRequisicao(e?.postData?.contents ?? '', dependencias));
  } catch (erro) {
    console.error(erro);
    return json({ ok: false, erro: 'interno', mensagem: 'Algo deu errado no robô. Tente de novo em instantes.' });
  }
}

export function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu('Ponto Certo')
    .addItem('1. Configurar e importar tudo', 'configurar')
    .addSeparator()
    .addItem('Gerar link de ativação (dona)', 'menuLinkDona')
    .addItem('Gerar link de ativação (só leitura)', 'menuLinkLeitura')
    .addSeparator()
    .addItem('Sincronizar agora', 'menuSincronizar')
    .addItem('Ajustar início do banco', 'menuInicioBanco')
    .addItem('Configurar notificações (Firebase)', 'menuNotificacoes')
    .addToUi();
}

function garantirGatilhos(): void {
  const existentes = new Set(ScriptApp.getProjectTriggers().map((t) => t.getHandlerFunction()));
  if (!existentes.has('tick')) ScriptApp.newTrigger('tick').timeBased().everyMinutes(1).create();
  if (!existentes.has('vigia')) ScriptApp.newTrigger('vigia').timeBased().everyMinutes(10).create();
  if (!existentes.has('checkupDiario')) ScriptApp.newTrigger('checkupDiario').timeBased().atHour(3).everyDays(1).create();
}

export function configurar(): void {
  PropertiesService.getScriptProperties().setProperty('PLANILHA_ID', SpreadsheetApp.getActiveSpreadsheet().getId());
  planilha.prepararAbas();
  garantirGatilhos();
  executarSincronizacao('completa');
  config();
  atualizarDias();
  const c = props.lerUltimaConferencia();
  const id = props.lerIdentidade();
  const linhas = [
    c ? `E-mails do RHiD no Gmail: ${c.totalGmail} · registrados: ${c.totalPlanilha} · conferência: ${c.ok ? 'OK ✓' : `ATENÇÃO — ${c.detalhe ?? ''}`}` : 'Conferência ainda não rodou.',
    c ? `Por tipo: ${Object.entries(c.porClassificacao).map(([k, v]) => `${k}=${v}`).join(', ')}` : '',
    id ? `Identidade aprendida: CPF ***.${id.cpf.slice(3, 6)}.${id.cpf.slice(6, 9)}-** · ${id.nome}` : 'Nenhum comprovante com CPF encontrado ainda.',
    `Início do banco: ${config().inicioBanco} · gatilhos ativos: ${ScriptApp.getProjectTriggers().length}`,
  ].filter(Boolean);
  try {
    SpreadsheetApp.getUi().alert('Ponto Certo configurado', linhas.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  } catch {
    console.log(linhas.join('\n'));
  }
}

export function tick(): void {
  const agora = agoraLocal().momento.segundos;
  const completa = Math.floor(agora / 60) % 15 === 0;
  const noExpediente = agora >= INICIO_EXPEDIENTE && agora <= FIM_EXPEDIENTE;
  if (!noExpediente && !completa) return;
  executarSincronizacao(completa ? 'completa' : 'incremental');
}

export function vigia(): void {
  garantirGatilhos();
  const agora = agoraLocal();
  const ultima = props.lerUltimaSincronizacao();
  const atraso = ultima ? segundosDesde(ultima, agora) : Number.POSITIVE_INFINITY;
  const noExpediente = agora.momento.segundos >= INICIO_EXPEDIENTE && agora.momento.segundos <= FIM_EXPEDIENTE;
  if (atraso > (noExpediente ? 180 : 1200)) {
    console.warn(`Vigia: última sincronização há ${atraso}s; rodando agora.`);
    executarSincronizacao('completa');
  }
}

export function checkupDiario(): void {
  executarSincronizacao('completa');
  atualizarDias();
}

function mostrarLink(papel: Papel, nome: string): void {
  const ui = SpreadsheetApp.getUi();
  const robo = urlRobo();
  if (!robo) {
    ui.alert('O robô ainda não foi publicado como app da web. Publique e tente de novo.');
    return;
  }
  const codigo = sessoes.gerarCodigo(props.armazem, props.cripto, papel, nome, Date.now());
  const link = `${__URL_APP__}#/ativar?u=${encodeURIComponent(robo)}&c=${codigo}`;
  const html = HtmlService.createHtmlOutput(
    `<div style="font-family:Arial,sans-serif;font-size:14px;padding:4px">` +
      `<p>Envie este link para <b>${nome}</b> abrir <b>no celular, no Chrome</b>. Ele vale por 24 horas e só funciona uma vez.</p>` +
      `<textarea id="l" style="width:100%;height:110px;font-size:12px" readonly>${link}</textarea>` +
      `<p><button onclick="var t=document.getElementById('l');t.select();document.execCommand('copy');this.textContent='Copiado ✓'">Copiar link</button></p></div>`,
  ).setWidth(560).setHeight(270);
  ui.showModalDialog(html, `Link de ativação (${papel === 'dona' ? 'dona' : 'só leitura'})`);
}

export function menuLinkDona(): void {
  mostrarLink('dona', nomeExibicao());
}

export function menuLinkLeitura(): void {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Acesso só de leitura', 'Nome de quem vai usar este acesso:', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK || !r.getResponseText().trim()) return;
  mostrarLink('leitura', r.getResponseText().trim());
}

export function menuSincronizar(): void {
  executarSincronizacao('completa');
  const c = props.lerUltimaConferencia();
  SpreadsheetApp.getUi().alert(
    c ? `Conferido: ${c.totalGmail} e-mails no Gmail = ${c.totalPlanilha} registros ${c.ok ? '✓' : `(ATENÇÃO: ${c.detalhe ?? ''})`}` : 'Sincronizado.',
  );
}

/** Muda a data em que o banco começa e o saldo inicial (ex.: primeiro dia completo no FaceID). */
export function menuInicioBanco(): void {
  const ui = SpreadsheetApp.getUi();
  const atual = config();
  const r = ui.prompt(
    'Início do banco de horas',
    `Data em que o banco começa, no formato AAAA-MM-DD (hoje está ${atual.inicioBanco}).`,
    ui.ButtonSet.OK_CANCEL,
  );
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const data = r.getResponseText().trim();
  if (!dataValida(data)) {
    ui.alert('Data inválida. Use AAAA-MM-DD, por exemplo 2026-10-20.');
    return;
  }
  const s = ui.prompt('Saldo inicial', 'Saldo do banco nesse dia, em minutos (ex.: 0, -90, 45). Use 0 se não souber.', ui.ButtonSet.OK_CANCEL);
  if (s.getSelectedButton() !== ui.Button.OK) return;
  const minutos = Number((s.getResponseText().trim() || '0').replace(',', '.'));
  if (!Number.isFinite(minutos)) {
    ui.alert('Saldo inválido. Digite só o número de minutos, com sinal de menos se for negativo.');
    return;
  }
  const nova: ConfigCalculo = {
    ...atual,
    inicioBanco: data,
    saldoInicial: Math.round(minutos * 60),
    jornadas: atual.jornadas.map((j, i) => (i === 0 && j.inicio > data ? { ...j, inicio: data } : j)),
  };
  props.gravarConfig(nova);
  atualizarDias();
  ui.alert(`Pronto: o banco começa em ${data}, com saldo inicial de ${minutos} min. A aba "Dias" foi recalculada.`);
}

/** Janela para colar o conteúdo do .json da conta de serviço do Firebase (fica só nas Propriedades do Script). */
export function menuNotificacoes(): void {
  const situacao = fcm.servidorPronto() ? '✅ Já existe uma chave salva; colar outra substitui.' : 'Ainda não há chave salva.';
  const html = HtmlService.createHtmlOutput(
    `<div style="font-family:Arial,sans-serif;font-size:14px">` +
      `<p>Abra o arquivo <b>.json</b> que o Firebase baixou (Contas de serviço → Gerar nova chave privada), copie <b>todo</b> o conteúdo e cole aqui.</p>` +
      `<p style="color:#666">${situacao}</p>` +
      `<textarea id="t" style="width:100%;height:150px;font-size:11px;font-family:monospace" placeholder='{ "type": "service_account", ... }'></textarea>` +
      `<p><button id="b" onclick="var b=this;b.disabled=true;b.textContent='Salvando…';google.script.run.withSuccessHandler(function(m){document.getElementById('r').textContent=m;b.textContent='Salvar';b.disabled=false;}).withFailureHandler(function(e){document.getElementById('r').textContent='Erro: '+e.message;b.disabled=false;b.textContent='Salvar';}).salvarContaServico(document.getElementById('t').value)">Salvar</button></p>` +
      `<p id="r" style="font-weight:bold"></p></div>`,
  ).setWidth(560).setHeight(360);
  SpreadsheetApp.getUi().showModalDialog(html, 'Notificações — chave do Firebase');
}

export function salvarContaServico(texto: string): string {
  return fcm.salvarConta(String(texto ?? '').trim());
}

// Mantém os imports de utilidades usados só em alguns caminhos.
void momentoDeTexto;
void segundosEntre;
