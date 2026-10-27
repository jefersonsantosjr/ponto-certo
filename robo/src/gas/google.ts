// "Entrar com o Google" do lado do robô: triagem local do ID token e confirmação com o próprio Google.
// O Apps Script não confere assinatura RSA, então quem garante o token é o endpoint tokeninfo do Google.
import { GOOGLE_CLIENT_ID, lerDeclaracoes, subValido, type DeclaracoesGoogle } from '../../../motor/src/index';

const decodificar = (base64url: string): string => Utilities.newBlob(Utilities.base64DecodeWebSafe(base64url)).getDataAsString('UTF-8');
const agoraSegundos = (): number => Math.floor(Date.now() / 1000);

/** Só lê o token (sem rede): o `sub` se ele diz ser do nosso app, do Google e ainda vale. */
export function lerSub(credencial: string): string | null {
  return subValido(lerDeclaracoes(credencial, decodificar), GOOGLE_CLIENT_ID, agoraSegundos());
}

/** O Google confere assinatura e validade; devolve o `sub` só se as declarações conferidas também batem. */
export function confirmar(credencial: string): string | null {
  const r = UrlFetchApp.fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credencial)}`, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  try {
    return subValido(JSON.parse(r.getContentText()) as DeclaracoesGoogle, GOOGLE_CLIENT_ID, agoraSegundos());
  } catch {
    return null;
  }
}
