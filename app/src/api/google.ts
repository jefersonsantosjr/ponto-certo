// "Entrar com o Google" no app: vai para a tela de login do Google e, na volta, entrega o ID token ao robô.
// Fluxo por redirecionamento (sem script do Google na página): funciona igual no Chrome e no app instalado na tela inicial.
import { GOOGLE_CLIENT_ID, lerDeclaracoes } from '@ponto-certo/motor';

export type IntencaoGoogle = 'entrar' | 'vincular';

/** Guardado antes de sair para o Google: o `estado` barra volta forjada e o `nonce` barra token de outro pedido. */
export interface PedidoGoogle {
  intencao: IntencaoGoogle;
  estado: string;
  nonce: string;
  criadoEm: number;
}

export type RetornoGoogle = { intencao: IntencaoGoogle; credencial: string } | { intencao: IntencaoGoogle | null; erro: string };

const CHAVE_PEDIDO = 'pontoCerto.google';
const VALIDADE_PEDIDO_MS = 10 * 60 * 1000;

/** Endereço do robô embutido no app publicado: quem perdeu o acesso não tem mais o do link de ativação. */
export const URL_ROBO_PUBLICADO: string = import.meta.env.VITE_URL_ROBO ?? '';

export const googleConfigurado = (): boolean => import.meta.env.MODE !== 'mock' && Boolean(GOOGLE_CLIENT_ID && URL_ROBO_PUBLICADO);

export function urlDoGoogle(clientId: string, voltarPara: string, estado: string, nonce: string): string {
  const consulta = new URLSearchParams({
    client_id: clientId, redirect_uri: voltarPara, response_type: 'id_token', scope: 'openid', nonce, state: estado, prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${consulta.toString()}`;
}

export function decodificarBase64Url(base64url: string): string {
  const binario = atob(base64url.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
}

/** Lê a volta do Google no endereço (#state=…&id_token=… ou #state=…&error=…). null = não é volta do Google. */
export function lerRetornoGoogle(hash: string, pedido: PedidoGoogle | null, agoraMs: number): RetornoGoogle | null {
  const consulta = new URLSearchParams(hash.replace(/^#/, ''));
  const estado = consulta.get('state');
  if (!estado || (!consulta.has('id_token') && !consulta.has('error'))) return null;
  if (!pedido || pedido.estado !== estado || agoraMs - pedido.criadoEm > VALIDADE_PEDIDO_MS) {
    return { intencao: pedido?.intencao ?? null, erro: 'O login com o Google não foi concluído a tempo. Tente de novo.' };
  }
  const { intencao } = pedido;
  const erroGoogle = consulta.get('error');
  if (erroGoogle) return { intencao, erro: erroGoogle === 'access_denied' ? 'Login com o Google cancelado.' : 'O Google não completou o login. Tente de novo.' };
  const credencial = consulta.get('id_token') ?? '';
  if (lerDeclaracoes(credencial, decodificarBase64Url)?.nonce !== pedido.nonce) return { intencao, erro: 'O Google não confirmou o login. Tente de novo.' };
  return { intencao, credencial };
}

function aleatorio(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Sai do app para o login do Google; ele volta para o endereço do app com o token. */
export function irParaGoogle(intencao: IntencaoGoogle): void {
  const pedido: PedidoGoogle = { intencao, estado: aleatorio(), nonce: aleatorio(), criadoEm: Date.now() };
  try {
    localStorage.setItem(CHAVE_PEDIDO, JSON.stringify(pedido));
  } catch {
    // Sem armazenamento: na volta o app avisa que o login não foi concluído.
  }
  window.location.assign(urlDoGoogle(GOOGLE_CLIENT_ID, `${window.location.origin}${import.meta.env.BASE_URL}`, pedido.estado, pedido.nonce));
}

/** Uma vez, ao abrir: se é a volta do Google, tira o token do endereço (não fica no histórico) e devolve o resultado. */
export function capturarRetornoGoogle(): RetornoGoogle | null {
  let pedido: PedidoGoogle | null = null;
  try {
    pedido = JSON.parse(localStorage.getItem(CHAVE_PEDIDO) ?? 'null') as PedidoGoogle | null;
  } catch {
    pedido = null;
  }
  const retorno = lerRetornoGoogle(window.location.hash, pedido, Date.now());
  if (!retorno) return null;
  try {
    localStorage.removeItem(CHAVE_PEDIDO);
  } catch {
    // tanto faz: o pedido vence sozinho
  }
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#/${retorno.intencao === 'vincular' ? 'config' : 'hoje'}`);
  return retorno;
}
