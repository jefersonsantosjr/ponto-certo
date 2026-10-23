import type {
  AjusteGravado, Alerta, AlertaGravado, BatidaRegistrada, Conferencia, MensagemRegistrada, RespostaGravada,
} from '../../../motor/src/index';

const ABAS = {
  Mensagens: ['id_gmail', 'recebido_em', 'classificacao', 'assunto', 'remetente', 'batida_id'],
  Batidas: ['id', 'data', 'hora', 'origem', 'status', 'nsr', 'hash', 'atraso_s', 'recebido_em', 'json'],
  Respostas: ['id', 'criada_em', 'autor', 'tipo', 'data', 'justificativa', 'json'],
  Ajustes: ['id', 'criado_em', 'autor', 'data', 'tipo', 'segundos', 'justificativa', 'ativo', 'json'],
  Alertas: ['id', 'quando', 'tipo', 'lido', 'json'],
  Conferencias: ['quando', 'tipo', 'total_gmail', 'total_planilha', 'ok', 'detalhe', 'json'],
  Dias: ['data', 'dia', 'batidas', 'trabalhado', 'carga', 'saldo', 'banco', 'situacao', 'pendencias'],
} as const;
type NomeAba = keyof typeof ABAS;

let cache: GoogleAppsScript.Spreadsheet.Spreadsheet | null = null;

export function planilha(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  if (!cache) {
    const id = PropertiesService.getScriptProperties().getProperty('PLANILHA_ID');
    cache = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  }
  return cache;
}

export function prepararAbas(): void {
  const p = planilha();
  for (const nome of Object.keys(ABAS) as NomeAba[]) {
    const colunas = ABAS[nome];
    const s = p.getSheetByName(nome) ?? p.insertSheet(nome);
    s.getRange(1, 1, s.getMaxRows(), Math.max(s.getMaxColumns(), colunas.length)).setNumberFormat('@');
    s.getRange(1, 1, 1, colunas.length).setValues([[...colunas]]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  const padrao = p.getSheetByName('Página1') ?? p.getSheetByName('Sheet1');
  if (padrao && p.getSheets().length > 1) p.deleteSheet(padrao);
}

function aba(nome: NomeAba): GoogleAppsScript.Spreadsheet.Sheet {
  const s = planilha().getSheetByName(nome);
  if (!s) throw new Error(`A aba ${nome} não existe. Use o menu Ponto Certo → Configurar.`);
  return s;
}

function linhas(nome: NomeAba): string[][] {
  const s = aba(nome);
  const n = s.getLastRow();
  return n < 2 ? [] : s.getRange(2, 1, n - 1, ABAS[nome].length).getDisplayValues();
}

function acrescentar(nome: NomeAba, valores: string[][]): void {
  if (valores.length === 0) return;
  const s = aba(nome);
  const r = s.getRange(s.getLastRow() + 1, 1, valores.length, ABAS[nome].length);
  r.setNumberFormat('@');
  r.setValues(valores);
}

/** Reescreve linhas já existentes, achando cada uma pelo valor da 1ª coluna. */
function reescrever(nome: NomeAba, valores: string[][]): void {
  if (valores.length === 0) return;
  const s = aba(nome);
  const ids = linhas(nome).map((l) => l[0]);
  for (const linha of valores) {
    const i = ids.indexOf(linha[0]);
    if (i >= 0) s.getRange(i + 2, 1, 1, ABAS[nome].length).setNumberFormat('@').setValues([linha]);
  }
}

const sim = (v: boolean): string => (v ? 'sim' : 'não');

// ---------- Mensagens ----------
export function lerMensagens(): MensagemRegistrada[] {
  return linhas('Mensagens').map(([idGmail, recebidoEm, classificacao, assunto, remetente, batidaId]) => ({
    idGmail, recebidoEm, assunto, remetente,
    classificacao: classificacao as MensagemRegistrada['classificacao'],
    ...(batidaId ? { batidaId } : {}),
  }));
}
export function acrescentarMensagens(ms: MensagemRegistrada[]): void {
  acrescentar('Mensagens', ms.map((m) => [m.idGmail, m.recebidoEm, m.classificacao, m.assunto, m.remetente, m.batidaId ?? '']));
}

// ---------- Batidas ----------
const linhaBatida = (b: BatidaRegistrada): string[] => [
  b.id, b.data, b.hora, b.origem, b.status, b.nsr ?? '', b.hash ?? '', String(b.atraso), b.recebidoEm, JSON.stringify(b),
];
export function lerBatidas(): BatidaRegistrada[] {
  return linhas('Batidas').map((l) => JSON.parse(l[9]) as BatidaRegistrada);
}
export function acrescentarBatidas(bs: BatidaRegistrada[]): void {
  acrescentar('Batidas', bs.map(linhaBatida));
}
export function atualizarBatidas(bs: BatidaRegistrada[]): void {
  reescrever('Batidas', bs.map(linhaBatida));
}

// ---------- Respostas ----------
export function lerRespostas(): RespostaGravada[] {
  return linhas('Respostas').map((l) => JSON.parse(l[6]) as RespostaGravada);
}
export function acrescentarResposta(r: RespostaGravada): void {
  acrescentar('Respostas', [[r.id, r.criadaEm, r.autor, r.resposta.tipo, r.resposta.data, r.resposta.justificativa, JSON.stringify(r)]]);
}

// ---------- Ajustes ----------
export function lerAjustes(): AjusteGravado[] {
  return linhas('Ajustes').map((l) => JSON.parse(l[8]) as AjusteGravado);
}
export function acrescentarAjuste(a: AjusteGravado): void {
  acrescentar('Ajustes', [[a.id, a.criadoEm, a.autor, a.data, a.tipo, String(a.segundos), a.justificativa, sim(a.ativo), JSON.stringify(a)]]);
}

// ---------- Alertas ----------
const linhaAlerta = (a: AlertaGravado): string[] => [a.id, a.quando, a.alerta.tipo, sim(a.lido), JSON.stringify(a)];
export function lerAlertas(): AlertaGravado[] {
  return linhas('Alertas').map((l) => JSON.parse(l[4]) as AlertaGravado);
}
/** Grava só os alertas ainda não registrados (o id é "origem|tipo") e devolve os que entraram agora. */
export function acrescentarAlertas(novos: Array<{ origem: string; alerta: Alerta }>, quando: string): AlertaGravado[] {
  if (novos.length === 0) return [];
  const existentes = new Set(lerAlertas().map((a) => a.id));
  const gravados: AlertaGravado[] = [];
  for (const { origem, alerta } of novos) {
    const id = `${origem}|${alerta.tipo}`;
    if (existentes.has(id)) continue;
    existentes.add(id);
    gravados.push({ id, quando, alerta, lido: false });
  }
  acrescentar('Alertas', gravados.map(linhaAlerta));
  return gravados;
}
export function marcarAlertasLidos(ids: string[]): void {
  const alvo = new Set(ids);
  reescrever('Alertas', lerAlertas().filter((a) => alvo.has(a.id)).map((a) => linhaAlerta({ ...a, lido: true })));
}

// ---------- Conferências ----------
export function acrescentarConferencia(c: Conferencia): void {
  acrescentar('Conferencias', [[c.quando, c.tipo, String(c.totalGmail), String(c.totalPlanilha), sim(c.ok), c.detalhe ?? '', JSON.stringify(c)]]);
}

// ---------- Dias (visão para conferência humana) ----------
export function gravarDias(valores: string[][]): void {
  const s = aba('Dias');
  const n = s.getLastRow();
  if (n > 1) s.getRange(2, 1, n - 1, ABAS.Dias.length).clearContent();
  if (valores.length) {
    const r = s.getRange(2, 1, valores.length, ABAS.Dias.length);
    r.setNumberFormat('@');
    r.setValues(valores);
  }
}
