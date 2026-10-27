// Contrato entre o robô (Apps Script) e o app (PWA). Só tipos: os dois lados importam daqui.
// O robô guarda e entrega os dados brutos; o app calcula com o mesmo motor (calcularPeriodo etc.).
import type { Ajuste, Alerta, Batida, ConfigCalculo, DataISO, Resposta, Segundos } from './tipos';

export type Papel = 'dona' | 'leitura';

export type ClassificacaoMensagem = 'comprovante' | 'comprovante_incompleto' | 'provisorio' | 'repetido' | 'outro_tipo';

/** Batida como o robô guarda: a Batida do motor + o que serve de prova e de auditoria. */
export interface BatidaRegistrada extends Batida {
  /** HH:MM:SS como veio no comprovante (ou digitado, se manual). */
  hora: string;
  inpi?: string;
  cpfConfere: boolean;
  nomeConfere: boolean;
  cnpjConfere: boolean;
  nomeNoComprovante?: string;
  /** Atraso do e-mail em segundos (0 para manual). */
  atraso: Segundos;
  /** Quando o e-mail chegou (hora local, 'AAAA-MM-DD HH:MM:SS'); vazio para manual. */
  recebidoEm: string;
  /** ID da mensagem no Gmail (comprovante/provisória). */
  idGmail?: string;
  /** Para batidas manuais: por que foi lançada. */
  justificativa?: string;
}

export interface MensagemRegistrada {
  idGmail: string;
  recebidoEm: string;
  assunto: string;
  remetente: string;
  classificacao: ClassificacaoMensagem;
  /** Batida gerada (ou a original, quando 'repetido'). */
  batidaId?: string;
}

export interface RespostaGravada {
  id: string;
  /** 'AAAA-MM-DDTHH:MM:SS' local. */
  criadaEm: string;
  autor: string;
  resposta: Resposta;
}

export interface AjusteGravado extends Ajuste {
  criadoEm: string;
  autor: string;
}

export interface AlertaGravado {
  id: string;
  quando: string;
  alerta: Alerta;
  lido: boolean;
}

export interface Conferencia {
  quando: string;
  tipo: 'incremental' | 'completa';
  totalGmail: number;
  totalPlanilha: number;
  ok: boolean;
  porClassificacao: Partial<Record<ClassificacaoMensagem, number>>;
  /** Texto curto quando não está ok (ex.: "2 e-mails ainda não lidos"). */
  detalhe?: string;
}

export interface Saude {
  /** Última sincronização bem-sucedida ('AAAA-MM-DDTHH:MM:SS' local) ou null. */
  ultimaSincronizacao: string | null;
  ultimaConferencia: Conferencia | null;
  /** Problemas atuais, em texto para a usuária (vazio = tudo certo). */
  problemas: string[];
}

/** Situação das notificações no robô. */
export interface SituacaoNotificacoes {
  /** O robô tem a credencial do Firebase e consegue enviar. */
  servidorPronto: boolean;
  /** Quantos aparelhos estão cadastrados para receber. */
  aparelhos: number;
}

/**
 * Conteúdo de cada push (FCM "data message", só texto). O service worker do app monta a notificação:
 * título, corpo, ícone do app e, ao tocar, abre `link`.
 */
export interface PayloadNotificacao {
  titulo: string;
  corpo: string;
  /** URL completa do app com a rota (ex.: https://…/ponto-certo/#/pendencias). */
  link: string;
  /** Agrupa notificações do mesmo tipo (ex.: 'batida', 'resumo', 'pendencia', 'alerta', 'teste'). */
  tag: string;
}

export interface Estado {
  geradoEm: string;
  hoje: DataISO;
  /** Hora local do robô, em segundos desde a meia-noite. */
  agora: Segundos;
  /** `contaGoogle`: já tem conta Google vinculada (se o celular perder o acesso, volta com "Entrar com o Google"). */
  usuario: { nome: string; papel: Papel; contaGoogle?: boolean };
  /** Nome usado nas saudações (ex.: "Larissa"). */
  nomeExibicao: string;
  identidade: { cpfMascarado: string; nome: string; cnpj: string } | null;
  config: ConfigCalculo;
  batidas: BatidaRegistrada[];
  mensagens: MensagemRegistrada[];
  respostas: RespostaGravada[];
  ajustes: AjusteGravado[];
  alertas: AlertaGravado[];
  saude: Saude;
  notificacoes: SituacaoNotificacoes;
}

export interface Sessao {
  token: string;
  nome: string;
  papel: Papel;
}

export type Requisicao =
  | { acao: 'ativar'; codigo: string; aparelho: string }
  | { acao: 'entrarComGoogle'; credencial: string; aparelho: string }
  | { acao: 'vincularGoogle'; token: string; credencial: string }
  | { acao: 'estado'; token: string }
  | { acao: 'sincronizar'; token: string }
  | { acao: 'responder'; token: string; resposta: Resposta }
  | { acao: 'batidaManual'; token: string; data: DataISO; hora: string; justificativa: string }
  | { acao: 'ajustar'; token: string; ajuste: Pick<Ajuste, 'data' | 'tipo' | 'segundos' | 'justificativa'> }
  | { acao: 'marcarAlertasLidos'; token: string; ids: string[] }
  | { acao: 'registrarDispositivo'; token: string; fcmToken: string; aparelho: string }
  | { acao: 'testarNotificacao'; token: string; fcmToken: string }
  | { acao: 'sair'; token: string };

/**
 * Envelope de toda resposta do robô. 'ativar' e 'entrarComGoogle' devolvem Sessao; 'estado', 'sincronizar', 'responder', 'batidaManual',
 * 'ajustar', 'registrarDispositivo' e 'vincularGoogle' devolvem Estado; 'testarNotificacao' devolve { enviada: boolean; detalhe: string }.
 */
export type RespostaApi<T> = { ok: true; dados: T } | { ok: false; erro: string; mensagem: string };
