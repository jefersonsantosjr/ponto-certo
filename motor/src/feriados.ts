import { criarData, somarDias } from './tempo';
import type { DataISO, FeriadosConfig } from './tipos';

const FIXOS: ReadonlyArray<readonly [number, number, string]> = [
  [1, 1, 'Confraternização Universal'],
  [4, 21, 'Tiradentes'],
  [5, 1, 'Dia do Trabalho'],
  [9, 7, 'Independência do Brasil'],
  [10, 12, 'Nossa Senhora Aparecida'],
  [11, 2, 'Finados'],
  [11, 15, 'Proclamação da República'],
  [11, 20, 'Dia Nacional de Zumbi e da Consciência Negra'],
  [12, 25, 'Natal'],
];

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): DataISO {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return criarData(ano, mes, dia);
}

const cache = new Map<number, Map<DataISO, string>>();

export function feriadosNacionais(ano: number): ReadonlyMap<DataISO, string> {
  let mapa = cache.get(ano);
  if (!mapa) {
    mapa = new Map();
    for (const [mes, dia, nome] of FIXOS) mapa.set(criarData(ano, mes, dia), nome);
    mapa.set(somarDias(pascoa(ano), -2), 'Sexta-feira Santa');
    cache.set(ano, mapa);
  }
  return mapa;
}

export function nomeFeriado(data: DataISO, config: FeriadosConfig): string | null {
  if (config.excluir.includes(data)) return null;
  const local = config.incluir.find((f) => f.data === data);
  if (local) return local.nome;
  return feriadosNacionais(Number(data.slice(0, 4))).get(data) ?? null;
}
