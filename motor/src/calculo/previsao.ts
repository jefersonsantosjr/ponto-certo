import type { Lacuna, Regras, ResultadoDia, Segundos, VersaoJornada } from '../tipos';
import { lacunasEntrePares } from './intervalos';

/**
 * Horário (em segundos) da primeira saída que fecha o dia sem ficar devendo.
 * Só existe quando ela está "dentro" (a última batida foi uma entrada) e o dia tem carga.
 * Se ainda não houve almoço (nenhum intervalo começando no horário de almoço), soma o almoço padrão.
 * Considera a tolerância por batida: a da entrada (que não entra no saldo) e a janela da saída.
 */
export function previsaoSaida(
  dia: ResultadoDia,
  jornada: Pick<VersaoJornada, 'almocoPadrao' | 'janelaAlmoco' | 'saida'>,
  regras: Pick<Regras, 'toleranciaLigada' | 'toleranciaMarcacao'>,
): Segundos | null {
  const mantidas = dia.batidas.filter((b) => b.status === 'ativa' && !b.duplicada);
  if (dia.carga === 0 || mantidas.length % 2 === 0) return null;

  const ultimaEntrada = mantidas[mantidas.length - 1].segundos;
  const lacunas: Lacuna[] = lacunasEntrePares(dia.pares);
  if (mantidas.length >= 3) lacunas.push({ inicio: mantidas[mantidas.length - 2].segundos, fim: ultimaEntrada });

  const { inicio, fim } = jornada.janelaAlmoco;
  const jaAlmocou =
    dia.intervalos.some((i) => i.tipo === 'almoco') || lacunas.some((l) => l.inicio >= inicio && l.inicio <= fim);
  // O que a tolerância segurou na entrada não vale no saldo: chegou antes, precisa fazer de novo; atrasou, sobra.
  const toleranciaEntrada = dia.tolerancias.find((t) => t.marcacao === 'entrada')?.diferenca ?? 0;
  const restante = Math.max(0, dia.carga - dia.trabalhado + toleranciaEntrada);
  const alvo = ultimaEntrada + restante + (jaAlmocou ? 0 : jornada.almocoPadrao);

  if (!regras.toleranciaLigada || jornada.saida === undefined) return alvo;
  const limite = regras.toleranciaMarcacao ?? 5 * 60;
  if (Math.abs(alvo - jornada.saida) > limite) return alvo;
  // Na janela da saída (ex.: 17:55–18:05) o saldo fica parado em (saída − alvo): se não é negativo, já dá pra sair
  // no começo da janela; se é, só a partir do primeiro segundo depois dela, quando a diferença volta a contar.
  return alvo <= jornada.saida ? Math.max(ultimaEntrada, jornada.saida - limite) : jornada.saida + limite + 1;
}
