import { calcularDia, type EntradaDia } from '../src/calculo/dia';
import { configPadrao } from '../src/calculo/jornada';
import type { DataISO, ResultadoDia } from '../src/tipos';
import { batida } from './ajuda';

export const HOJE = '2026-10-23';
export const CONFIG = configPadrao('2026-09-01');

export function diaDeTeste(data: DataISO, horas: string[], extra: Partial<EntradaDia> = {}): ResultadoDia {
  return calcularDia({
    data,
    hoje: HOJE,
    batidas: horas.map((hora) => batida(data, hora)),
    respostas: [],
    ajustes: [],
    config: CONFIG,
    ...extra,
  });
}
