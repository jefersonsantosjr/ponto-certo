import type { Lacuna, Regras, ResultadoDia, Segundos, VersaoJornada } from '../tipos';
import { lacunasEntrePares } from './intervalos';

/**
 * Horário (em segundos) da primeira saída que fecha o dia sem ficar devendo.
 * Só existe quando ela está "dentro" (a última batida foi uma entrada) e o dia tem carga.
 * Se ainda não houve almoço (nenhum intervalo começando no horário de almoço), soma o almoço padrão.
 * Considera a tolerância do dia: a variação da entrada gasta parte do limite e o que sobra é a janela da saída.
 */
export function previsaoSaida(
  dia: ResultadoDia,
  jornada: Pick<VersaoJornada, 'almocoPadrao' | 'janelaAlmoco' | 'saida'>,
  regras: Pick<Regras, 'toleranciaLigada' | 'tolerancia'>,
): Segundos | null {
  const mantidas = dia.batidas.filter((b) => b.status === 'ativa' && !b.duplicada);
  if (dia.carga === 0 || mantidas.length % 2 === 0) return null;

  const ultimaEntrada = mantidas[mantidas.length - 1].segundos;
  const lacunas: Lacuna[] = lacunasEntrePares(dia.pares);
  if (mantidas.length >= 3) lacunas.push({ inicio: mantidas[mantidas.length - 2].segundos, fim: ultimaEntrada });

  const { inicio, fim } = jornada.janelaAlmoco;
  const jaAlmocou =
    dia.intervalos.some((i) => i.tipo === 'almoco') || lacunas.some((l) => l.inicio >= inicio && l.inicio <= fim);
  const alvo = ultimaEntrada + Math.max(0, dia.carga - dia.trabalhado) + (jaAlmocou ? 0 : jornada.almocoPadrao);

  if (!regras.toleranciaLigada || jornada.saida === undefined) return alvo;
  const entrada = dia.variacoes.find((v) => v.marcacao === 'entrada')?.diferenca ?? 0;
  const folga = regras.tolerancia - Math.abs(entrada);
  if (folga < 0 || alvo < jornada.saida - folga) return alvo;
  // Na janela da saída (ex.: 17:53–18:07) a tolerância vale e o saldo fica parado em (saída − alvo − entrada): se não é
  // negativo, já dá pra sair no começo da janela; se é, só depois dela, quando tudo volta a contar como registrado.
  return jornada.saida - alvo - entrada >= 0 ? Math.max(ultimaEntrada, jornada.saida - folga) : Math.max(alvo, jornada.saida + folga + 1);
}
