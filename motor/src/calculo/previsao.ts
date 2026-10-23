import type { Lacuna, ResultadoDia, Segundos, VersaoJornada } from '../tipos';
import { lacunasEntrePares } from './intervalos';

/**
 * Horário (em segundos) em que ela fecha o dia no zero, se sair nele.
 * Só existe quando ela está "dentro" (a última batida foi uma entrada) e o dia tem carga.
 * Se ainda não houve almoço (nenhum intervalo começando no horário de almoço), soma o almoço padrão.
 */
export function previsaoSaida(dia: ResultadoDia, jornada: Pick<VersaoJornada, 'almocoPadrao' | 'janelaAlmoco'>): Segundos | null {
  const mantidas = dia.batidas.filter((b) => b.status === 'ativa' && !b.duplicada);
  if (dia.carga === 0 || mantidas.length % 2 === 0) return null;

  const ultimaEntrada = mantidas[mantidas.length - 1].segundos;
  const lacunas: Lacuna[] = lacunasEntrePares(dia.pares);
  if (mantidas.length >= 3) lacunas.push({ inicio: mantidas[mantidas.length - 2].segundos, fim: ultimaEntrada });

  const { inicio, fim } = jornada.janelaAlmoco;
  const jaAlmocou =
    dia.intervalos.some((i) => i.tipo === 'almoco') || lacunas.some((l) => l.inicio >= inicio && l.inicio <= fim);
  const restante = Math.max(0, dia.carga - dia.trabalhado);
  return ultimaEntrada + restante + (jaAlmocou ? 0 : jornada.almocoPadrao);
}
