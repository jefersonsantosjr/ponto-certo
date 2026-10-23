import type { Lacuna, ResultadoDia, Segundos } from '../tipos';

/** A partir deste horário, uma batida de saída fecha o dia e gera o resumo (spec §8). */
export const INICIO_SAIDA_FINAL: Segundos = 16 * 3600;

export type TipoNovaBatida =
  | { tipo: 'entrada' }
  | { tipo: 'saida_intermediaria'; almoco: boolean }
  | { tipo: 'volta' }
  | { tipo: 'saida_final' };

export function classificarNovaBatida(dia: ResultadoDia, batidaId: string, janelaAlmoco: Lacuna): TipoNovaBatida | null {
  const mantidas = dia.batidas.filter((b) => b.status === 'ativa' && !b.duplicada);
  const posicao = mantidas.findIndex((b) => b.id === batidaId);
  if (posicao < 0) return null;
  if (posicao === 0) return { tipo: 'entrada' };
  if (posicao % 2 === 0) return { tipo: 'volta' };
  const { segundos } = mantidas[posicao];
  if (segundos >= INICIO_SAIDA_FINAL) return { tipo: 'saida_final' };
  return { tipo: 'saida_intermediaria', almoco: segundos >= janelaAlmoco.inicio && segundos <= janelaAlmoco.fim };
}
