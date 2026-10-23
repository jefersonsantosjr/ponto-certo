// Envio de push pelo Firebase Cloud Messaging (API HTTP v1), autenticado com a conta de serviço do projeto Firebase dela.
// A credencial fica só nas Propriedades do Script (FCM_CONTA_SERVICO); os aparelhos, em DISPOSITIVOS.
import type { PayloadNotificacao } from '../../../motor/src/index';

interface ContaServico {
  project_id: string;
  client_email: string;
  private_key: string;
}

interface Aparelho {
  nome: string;
  papel: string;
  aparelho: string;
  criado: string;
}

const props = (): GoogleAppsScript.Properties.Properties => PropertiesService.getScriptProperties();

function lerConta(): ContaServico | null {
  try {
    const c = JSON.parse(props().getProperty('FCM_CONTA_SERVICO') ?? 'null') as ContaServico | null;
    return c && c.project_id && c.client_email && c.private_key ? c : null;
  } catch {
    return null;
  }
}

function lerAparelhos(): Record<string, Aparelho> {
  try {
    return JSON.parse(props().getProperty('DISPOSITIVOS') ?? '{}') as Record<string, Aparelho>;
  } catch {
    return {};
  }
}

function gravarAparelhos(a: Record<string, Aparelho>): void {
  props().setProperty('DISPOSITIVOS', JSON.stringify(a));
}

export function servidorPronto(): boolean {
  return lerConta() !== null;
}

export function quantidadeAparelhos(): number {
  return Object.keys(lerAparelhos()).length;
}

export function registrarAparelho(fcmToken: string, dados: Omit<Aparelho, 'criado'>, criado: string): void {
  const a = lerAparelhos();
  a[fcmToken] = { ...dados, criado };
  gravarAparelhos(a);
}

const b64url = (texto: string): string => Utilities.base64EncodeWebSafe(texto, Utilities.Charset.UTF_8).replace(/=+$/, '');

function tokenDeAcesso(conta: ContaServico): string {
  const cache = CacheService.getScriptCache();
  const guardado = cache.get('FCM_ACESSO');
  if (guardado) return guardado;
  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = b64url(JSON.stringify({
    iss: conta.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: agora,
    exp: agora + 3600,
  }));
  const assinatura = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(`${cabecalho}.${corpo}`, conta.private_key)).replace(/=+$/, '');
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${cabecalho}.${corpo}.${assinatura}` },
    muteHttpExceptions: true,
  });
  const resposta = JSON.parse(r.getContentText()) as { access_token?: string; error_description?: string; error?: string };
  if (!resposta.access_token) throw new Error(`Firebase recusou a credencial: ${resposta.error_description ?? resposta.error ?? r.getResponseCode()}`);
  cache.put('FCM_ACESSO', resposta.access_token, 50 * 60);
  return resposta.access_token;
}

/** Envia para um aparelho. Devolve se foi aceito e, se o token não vale mais, já remove o aparelho. */
export function enviarPara(fcmToken: string, payload: PayloadNotificacao): { enviada: boolean; detalhe: string } {
  const conta = lerConta();
  if (!conta) return { enviada: false, detalhe: 'O robô ainda não tem a chave do Firebase.' };
  const r = UrlFetchApp.fetch(`https://fcm.googleapis.com/v1/projects/${conta.project_id}/messages:send`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: `Bearer ${tokenDeAcesso(conta)}` },
    payload: JSON.stringify({
      message: {
        token: fcmToken,
        webpush: {
          headers: { Urgency: 'high', TTL: '86400' },
          data: { titulo: payload.titulo, corpo: payload.corpo, link: payload.link, tag: payload.tag },
        },
      },
    }),
    muteHttpExceptions: true,
  });
  const codigo = r.getResponseCode();
  if (codigo === 200) return { enviada: true, detalhe: 'ok' };
  const texto = r.getContentText();
  if (codigo === 404 || /UNREGISTERED|registration token is not a valid/i.test(texto)) {
    const a = lerAparelhos();
    delete a[fcmToken];
    gravarAparelhos(a);
    return { enviada: false, detalhe: 'Este aparelho não está mais registrado; ative as notificações de novo.' };
  }
  return { enviada: false, detalhe: `FCM respondeu ${codigo}: ${texto.slice(0, 200)}` };
}

/** Envia para todos os aparelhos cadastrados; devolve quantos receberam. */
export function enviarParaTodos(payload: PayloadNotificacao): number {
  let enviadas = 0;
  for (const fcmToken of Object.keys(lerAparelhos())) {
    try {
      if (enviarPara(fcmToken, payload).enviada) enviadas += 1;
    } catch (erro) {
      console.warn(`Falha ao notificar um aparelho: ${String(erro)}`);
    }
  }
  return enviadas;
}

/** Salva a conta de serviço colada pelo menu e testa se o Google aceita. */
export function salvarConta(textoJson: string): string {
  let conta: ContaServico;
  try {
    conta = JSON.parse(textoJson) as ContaServico;
  } catch {
    return '❌ Isso não parece o conteúdo do arquivo .json. Abra o arquivo, copie TUDO e cole de novo.';
  }
  if (!conta.project_id || !conta.client_email || !conta.private_key) {
    return '❌ Faltam campos (project_id, client_email, private_key). Confira se é o arquivo da "Conta de serviço".';
  }
  props().setProperty('FCM_CONTA_SERVICO', JSON.stringify({ project_id: conta.project_id, client_email: conta.client_email, private_key: conta.private_key }));
  CacheService.getScriptCache().remove('FCM_ACESSO');
  try {
    tokenDeAcesso(conta);
    return `✅ Chave salva e aceita pelo Google (projeto ${conta.project_id}). Agora é ativar as notificações no app.`;
  } catch (erro) {
    return `⚠️ Chave salva, mas o Google recusou: ${String(erro)}`;
  }
}
