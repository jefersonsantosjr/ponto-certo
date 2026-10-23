import type { Resposta } from '../tipos';

export interface RespostaRegistrada {
  id: string;
  /** Data e hora ISO da gravação (todas no mesmo formato, então a ordem de texto é a ordem do tempo). */
  criadaEm: string;
  resposta: Resposta;
}

export const MINIMO_JUSTIFICATIVA = 3;

export function chaveResposta(r: Resposta): string {
  switch (r.tipo) {
    case 'abono_intervalo':
      return `${r.tipo}|${r.data}|${r.inicio}-${r.fim}`;
    case 'batida_conta':
      return `${r.tipo}|${r.data}|${r.batidaId}`;
    default:
      return `${r.tipo}|${r.data}`;
  }
}

export function respostasVigentes(registradas: RespostaRegistrada[]): Resposta[] {
  const ultimas = new Map<string, RespostaRegistrada>();
  for (const registro of registradas) {
    const chave = chaveResposta(registro.resposta);
    const atual = ultimas.get(chave);
    if (!atual || registro.criadaEm >= atual.criadaEm) ultimas.set(chave, registro);
  }
  return [...ultimas.values()].map((r) => r.resposta);
}

export function justificativaValida(texto: string): boolean {
  return texto.trim().length >= MINIMO_JUSTIFICATIVA;
}
