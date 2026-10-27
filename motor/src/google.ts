// "Entrar com o Google": o app pede ao Google um ID token (um JWT) e o robô confere antes de abrir uma sessão.

/**
 * ID PÚBLICO do cliente OAuth (Google Cloud → Google Auth Platform → Clientes → "Aplicativo da Web").
 * Por natureza vai no código do site, como a configuração do Firebase. Vazio = recurso desligado.
 */
export const GOOGLE_CLIENT_ID = '';

const EMISSORES = new Set(['accounts.google.com', 'https://accounts.google.com']);

/** O que interessa do miolo do ID token (tudo `unknown`: vem de fora). */
export interface DeclaracoesGoogle {
  aud?: unknown;
  iss?: unknown;
  exp?: unknown;
  sub?: unknown;
  nonce?: unknown;
}

/**
 * Lê o miolo do JWT SEM conferir a assinatura: serve para a triagem barata e para o nonce.
 * Quem garante que o token é legítimo é o próprio Google (o robô pergunta a ele).
 * @param decodificarBase64Url recebe base64url com o "=" de preenchimento e devolve o texto UTF-8
 */
export function lerDeclaracoes(credencial: string, decodificarBase64Url: (base64url: string) => string): DeclaracoesGoogle | null {
  const partes = credencial.split('.');
  if (partes.length !== 3 || credencial.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(partes[1])) return null;
  try {
    const miolo = partes[1] + '='.repeat((4 - (partes[1].length % 4)) % 4);
    const declaracoes = JSON.parse(decodificarBase64Url(miolo)) as unknown;
    return declaracoes && typeof declaracoes === 'object' ? (declaracoes as DeclaracoesGoogle) : null;
  } catch {
    return null;
  }
}

/** O `sub` (identificador fixo da conta Google) se o token é do nosso app, emitido pelo Google e ainda vale. */
export function subValido(declaracoes: DeclaracoesGoogle | null, clientId: string, agoraSegundos: number): string | null {
  if (!declaracoes || !clientId || declaracoes.aud !== clientId) return null;
  if (!EMISSORES.has(String(declaracoes.iss)) || !(Number(declaracoes.exp) > agoraSegundos)) return null;
  const sub = declaracoes.sub;
  return typeof sub === 'string' && sub.length > 0 && sub.length <= 255 ? sub : null;
}
