import { readFileSync } from 'node:fs';
import { paraSegundos } from '../src/tempo';
import type { Batida, DataISO, OrigemBatida, StatusBatida } from '../src/tipos';

export const h = paraSegundos;

export function lerFixture(nome: string): string {
  return readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), 'utf8');
}

let sequencia = 0;
export function batida(data: DataISO, hora: string, origem: OrigemBatida = 'comprovante', status: StatusBatida = 'ativa'): Batida {
  sequencia += 1;
  return { id: `b${sequencia}`, data, segundos: paraSegundos(hora), origem, status };
}
