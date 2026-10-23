// Parte do navegador e do Firebase: permissão, token do FCM e registro local deste aparelho.
// O Firebase só é carregado quando precisa (import dinâmico), pra não pesar a abertura do app.
import type { FirebaseApp } from 'firebase/app';
import { FIREBASE_CONFIG, VAPID_KEY } from './configFirebase';

const MODO_EXEMPLO = import.meta.env.MODE === 'mock';
const CHAVE_REGISTRO = 'pontoCerto.notificacoes';
const CHAVE_DISPENSA = 'pontoCerto.notificacoes.dispensadoAte';
const ESPERA_SERVICE_WORKER_MS = 10_000;

export type Permissao = NotificationPermission | 'indisponivel';

/** O que este aparelho já mandou para o robô (pra não registrar de novo à toa). */
export interface RegistroLocal {
  fcmToken: string;
  /** Pedaço do token da sessão: se outra pessoa entrar neste aparelho, registra de novo. */
  sessao: string;
  registradoEm: string;
}

export class ErroNotificacao extends Error {
  readonly codigo: string;

  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
  }
}

export function navegadorSuporta(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** No modo de demonstração não precisa de Firebase (a notificação é local). */
export function configurado(): boolean {
  return MODO_EXEMPLO || (FIREBASE_CONFIG !== null && Boolean(VAPID_KEY));
}

export function permissaoAtual(): Permissao {
  return navegadorSuporta() ? Notification.permission : 'indisponivel';
}

export async function suportado(): Promise<boolean> {
  if (MODO_EXEMPLO) return typeof window !== 'undefined' && 'Notification' in window;
  if (!navegadorSuporta()) return false;
  try {
    const { isSupported } = await import('firebase/messaging');
    return await isSupported();
  } catch {
    return false;
  }
}

/** Chame direto no clique, ANTES de qualquer await: o Chrome só mostra o pedido com o gesto da pessoa. */
export function pedirPermissao(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return Promise.resolve('denied');
  return Notification.requestPermission();
}

let appFirebase: FirebaseApp | null = null;

async function firebase(): Promise<FirebaseApp> {
  if (!FIREBASE_CONFIG) throw new ErroNotificacao('nao_configurado', 'As notificações ainda não foram configuradas.');
  if (appFirebase) return appFirebase;
  const { getApps, initializeApp } = await import('firebase/app');
  appFirebase = getApps()[0] ?? initializeApp(FIREBASE_CONFIG);
  return appFirebase;
}

function serviceWorkerPronto(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, falhar) =>
      setTimeout(() => falhar(new ErroNotificacao('sem_service_worker', 'O app ainda está se instalando. Feche, abra de novo e tente outra vez.')), ESPERA_SERVICE_WORKER_MS),
    ),
  ]);
}

/** Token do FCM deste aparelho (o "endereço" para onde o robô manda as notificações). */
export async function obterTokenFcm(): Promise<string> {
  if (MODO_EXEMPLO) return 'token-de-demonstracao';
  if (!VAPID_KEY) throw new ErroNotificacao('nao_configurado', 'As notificações ainda não foram configuradas.');
  const [{ getMessaging, getToken }, app, registro] = await Promise.all([import('firebase/messaging'), firebase(), serviceWorkerPronto()]);
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registro });
  if (!token) throw new ErroNotificacao('sem_token', 'O Firebase não devolveu o endereço deste celular. Tente de novo.');
  return token;
}

/** Ao sair: invalida o token, para este aparelho parar de receber (o robô descarta tokens inválidos). */
export async function apagarTokenFcm(): Promise<void> {
  if (MODO_EXEMPLO || !configurado() || permissaoAtual() !== 'granted') return;
  try {
    const [{ deleteToken, getMessaging }, app] = await Promise.all([import('firebase/messaging'), firebase()]);
    await deleteToken(getMessaging(app));
  } catch {
    // Sem internet ou sem token: segue saindo do mesmo jeito.
  }
}

export const marcaDaSessao = (tokenSessao: string): string => tokenSessao.slice(0, 16);

export function precisaRegistrar(registro: RegistroLocal | null, fcmToken: string, tokenSessao: string): boolean {
  return !registro || registro.fcmToken !== fcmToken || registro.sessao !== marcaDaSessao(tokenSessao);
}

export function lerRegistroLocal(): RegistroLocal | null {
  try {
    const texto = localStorage.getItem(CHAVE_REGISTRO);
    return texto ? (JSON.parse(texto) as RegistroLocal) : null;
  } catch {
    return null;
  }
}

export function salvarRegistroLocal(registro: RegistroLocal): void {
  try {
    localStorage.setItem(CHAVE_REGISTRO, JSON.stringify(registro));
  } catch {
    // Sem armazenamento: na próxima abertura registra de novo, sem problema.
  }
}

export function apagarRegistroLocal(): void {
  try {
    localStorage.removeItem(CHAVE_REGISTRO);
  } catch {
    // nada a fazer
  }
}

/** "Agora não" no cartão da tela Hoje: some por alguns dias. */
export function dispensarCartao(dias = 7, agora = new Date()): void {
  try {
    localStorage.setItem(CHAVE_DISPENSA, new Date(agora.getTime() + dias * 86_400_000).toISOString());
  } catch {
    // sem armazenamento: o cartão volta na próxima abertura
  }
}

export function cartaoDispensado(agora = new Date()): boolean {
  try {
    const ate = localStorage.getItem(CHAVE_DISPENSA);
    return ate !== null && new Date(ate).getTime() > agora.getTime();
  } catch {
    return false;
  }
}

/** Notificação local (modo de demonstração): mostra o visual sem robô nem Firebase. */
export async function mostrarNotificacaoLocal(titulo: string, corpo: string): Promise<void> {
  const icone = `${import.meta.env.BASE_URL}icones/icone-192.png`;
  try {
    const registro = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registro) {
      await registro.showNotification(titulo, { body: corpo, icon: icone, tag: 'teste' });
      return;
    }
    new Notification(titulo, { body: corpo, icon: icone });
  } catch {
    // Alguns navegadores (Android) só aceitam notificação pelo service worker.
  }
}
