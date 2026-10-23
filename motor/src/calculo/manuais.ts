import type { Batida, Segundos } from '../tipos';

export const JANELA_SUBSTITUICAO: Segundos = 30 * 60;

/** IDs das batidas manuais ativas que têm um comprovante (ou provisória) ativo no mesmo dia a até `janela` segundos (spec §4.6). */
export function manuaisSubstituidas(batidas: Batida[], janela: Segundos = JANELA_SUBSTITUICAO): string[] {
  const provas = batidas.filter((b) => b.status === 'ativa' && b.origem !== 'manual');
  return batidas
    .filter((m) => m.status === 'ativa' && m.origem === 'manual')
    .filter((m) => provas.some((p) => p.data === m.data && Math.abs(p.segundos - m.segundos) <= janela))
    .map((m) => m.id);
}
