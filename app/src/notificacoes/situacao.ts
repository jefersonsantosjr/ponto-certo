import type { Permissao } from './push';

export interface EntradaSituacao {
  /** O navegador aceita notificações push. */
  suportado: boolean;
  /** O app tem os dados do Firebase (FIREBASE_CONFIG e VAPID_KEY). */
  configurado: boolean;
  /** O robô tem a chave do Firebase e consegue mandar. */
  servidorPronto: boolean;
  permissao: Permissao;
  /** Este aparelho já está cadastrado no robô com a sessão atual. */
  ativoNesteAparelho: boolean;
  /** A pessoa tocou em "Agora não" há pouco. */
  dispensado: boolean;
}

export type SituacaoCartao = 'oculto' | 'ativar' | 'bloqueado';

/** Cartão da tela Hoje: só aparece quando dá pra ativar de verdade (ou quando o navegador bloqueou). */
export function situacaoDoCartao(e: EntradaSituacao): SituacaoCartao {
  if (!e.suportado || !e.configurado || !e.servidorPronto || e.ativoNesteAparelho || e.dispensado) return 'oculto';
  return e.permissao === 'denied' ? 'bloqueado' : 'ativar';
}

export type SituacaoAparelho = 'ativas' | 'bloqueadas' | 'desligadas' | 'sem_suporte' | 'nao_configuradas';

/** Situação das notificações neste aparelho (tela de Configurações). */
export function situacaoDoAparelho(e: Omit<EntradaSituacao, 'servidorPronto' | 'dispensado'>): SituacaoAparelho {
  if (!e.configurado) return 'nao_configuradas';
  if (!e.suportado) return 'sem_suporte';
  if (e.permissao === 'denied') return 'bloqueadas';
  if (e.permissao === 'granted' && e.ativoNesteAparelho) return 'ativas';
  return 'desligadas';
}

export const TEXTO_APARELHO: Record<SituacaoAparelho, string> = {
  ativas: 'ativas neste celular ✓',
  bloqueadas: 'bloqueadas no navegador',
  desligadas: 'desligadas neste celular',
  sem_suporte: 'este navegador não aceita',
  nao_configuradas: 'ainda não configuradas',
};

export const DICA_DESBLOQUEIO = 'No Chrome: toque em ⋮ → Configurações do site (ou no cadeado ao lado do endereço) → Notificações → Permitir. Depois volte aqui.';
