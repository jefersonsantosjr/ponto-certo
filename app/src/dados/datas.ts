import { criarData, diaDaSemana, somarDias } from '@ponto-certo/motor';
import type { DataISO, Segundos } from '@ponto-certo/motor';

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Data e hora locais do aparelho. */
export interface Relogio {
  hoje: DataISO;
  agora: Segundos;
}

export function relogioDe(data: Date): Relogio {
  return {
    hoje: criarData(data.getFullYear(), data.getMonth() + 1, data.getDate()),
    agora: data.getHours() * 3600 + data.getMinutes() * 60 + data.getSeconds(),
  };
}

/** Converte 'AAAA-MM-DDTHH:MM:SS' ou 'AAAA-MM-DD HH:MM:SS' (hora local) em Date. */
export function dataHoraLocal(texto: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(texto);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? '0'));
}

export function mesDe(data: DataISO): number {
  return Number(data.slice(5, 7));
}

export function anoDe(data: DataISO): number {
  return Number(data.slice(0, 4));
}

export function primeiroDiaDoMes(data: DataISO): DataISO {
  return `${data.slice(0, 7)}-01`;
}

export function ultimoDiaDoMes(data: DataISO): DataISO {
  const ano = anoDe(data);
  const mes = mesDe(data);
  const proximo = mes === 12 ? criarData(ano + 1, 1, 1) : criarData(ano, mes + 1, 1);
  return somarDias(proximo, -1);
}

/** Segunda-feira da semana da data. */
export function inicioDaSemana(data: DataISO): DataISO {
  return somarDias(data, -((diaDaSemana(data) + 6) % 7));
}

/** "Sexta, 23 de outubro" */
export function dataPorExtenso(data: DataISO): string {
  return `${DIAS_SEMANA[diaDaSemana(data)]}, ${Number(data.slice(8, 10))} de ${MESES[mesDe(data) - 1]}`;
}

/** "Outubro 2026" */
export function mesAno(data: DataISO): string {
  const nome = MESES[mesDe(data) - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)} ${anoDe(data)}`;
}

/** Soma meses a uma data (vai para o dia 1 do mês resultante). */
export function somarMeses(data: DataISO, meses: number): DataISO {
  const total = anoDe(data) * 12 + (mesDe(data) - 1) + meses;
  return criarData(Math.floor(total / 12), (total % 12) + 1, 1);
}
