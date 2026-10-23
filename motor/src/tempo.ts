import type { DataISO, Momento, Segundos } from './tipos';

export const SEGUNDOS_POR_DIA = 86_400;
/** Sinal de menos tipográfico, usado em todas as telas e relatórios. */
export const MENOS = '−';
export const NOMES_DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

const dois = (n: number): string => String(n).padStart(2, '0');

export function paraSegundos(hora: string): Segundos {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hora.trim());
  if (!m) throw new Error(`Horário inválido: ${hora}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = Number(m[3] ?? '0');
  if (h > 23 || min > 59 || s > 59) throw new Error(`Horário inválido: ${hora}`);
  return h * 3600 + min * 60 + s;
}

export function formatarHora(segundos: Segundos): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${dois(h)}:${dois(m)}:${dois(segundos % 60)}`;
}

export function formatarHoraCurta(segundos: Segundos): string {
  return formatarHora(segundos).slice(0, 5);
}

export function arredondarParaMinutoSeguinte(segundos: Segundos): Segundos {
  return Math.ceil(segundos / 60) * 60;
}

/** Duração sem sinal: 45s, 13min, 13min05s, 1h27, 1h27min12s, 0min. */
export function formatarDuracao(segundos: Segundos): string {
  const abs = Math.abs(segundos);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return `${h}h${dois(m)}${s > 0 ? `min${dois(s)}s` : ''}`;
  if (m > 0) return `${m}min${s > 0 ? `${dois(s)}s` : ''}`;
  return s > 0 ? `${s}s` : '0min';
}

/** Saldo com sinal: +13min05s, −1h27min12s, 0min. */
export function formatarSaldo(segundos: Segundos): string {
  if (segundos === 0) return '0min';
  return (segundos > 0 ? '+' : MENOS) + formatarDuracao(segundos);
}

/** Duração estilo planilha, sem sinal: 8:23:41, 132:38:00. */
export function formatarHorasPlanilha(segundos: Segundos): string {
  const abs = Math.abs(segundos);
  return `${Math.floor(abs / 3600)}:${dois(Math.floor((abs % 3600) / 60))}:${dois(abs % 60)}`;
}

/** Saldo estilo planilha: +0:12:05, −8:48:00, 0:00:00. */
export function formatarSaldoPlanilha(segundos: Segundos): string {
  if (segundos === 0) return '0:00:00';
  return (segundos > 0 ? '+' : MENOS) + formatarHorasPlanilha(segundos);
}

export function criarData(ano: number, mes: number, dia: number): DataISO {
  return `${String(ano).padStart(4, '0')}-${dois(mes)}-${dois(dia)}`;
}

function partes(data: DataISO): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) throw new Error(`Data inválida: ${data}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function utc(data: DataISO): number {
  const [a, m, d] = partes(data);
  return Date.UTC(a, m - 1, d);
}

function deUtc(ms: number): DataISO {
  const dt = new Date(ms);
  return criarData(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  return deUtc(utc(data)) === data;
}

export function diaDaSemana(data: DataISO): number {
  return new Date(utc(data)).getUTCDay();
}

export function somarDias(data: DataISO, dias: number): DataISO {
  return deUtc(utc(data) + dias * SEGUNDOS_POR_DIA * 1000);
}

export function diasEntre(de: DataISO, ate: DataISO): number {
  return Math.round((utc(ate) - utc(de)) / (SEGUNDOS_POR_DIA * 1000));
}

export function listarDatas(de: DataISO, ate: DataISO): DataISO[] {
  const datas: DataISO[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) datas.push(d);
  return datas;
}

export function segundosEntre(inicio: Momento, fim: Momento): Segundos {
  return diasEntre(inicio.data, fim.data) * SEGUNDOS_POR_DIA + (fim.segundos - inicio.segundos);
}

export function dataBR(data: DataISO): string {
  const [a, m, d] = partes(data);
  return `${dois(d)}/${dois(m)}/${a}`;
}

export function dataCurtaBR(data: DataISO): string {
  return dataBR(data).slice(0, 5);
}
