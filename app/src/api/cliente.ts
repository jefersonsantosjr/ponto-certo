import type { Ajuste, DataISO, Estado, Requisicao, Resposta, RespostaApi, Sessao } from '@ponto-certo/motor';
import type { SessaoLocal } from './sessao';

export class ErroApi extends Error {
  readonly codigo: string;

  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.codigo = codigo;
  }
}

/** Códigos que significam "essa sessão não vale mais": o app volta para a tela de ativação. */
export const ERROS_DE_SESSAO = new Set(['sessao_invalida', 'sessao_expirada', 'nao_autorizado']);

export type NovoAjuste = Pick<Ajuste, 'data' | 'tipo' | 'segundos' | 'justificativa'>;

export interface ClienteApi {
  estado(): Promise<Estado>;
  sincronizar(): Promise<Estado>;
  responder(resposta: Resposta): Promise<Estado>;
  batidaManual(data: DataISO, hora: string, justificativa: string): Promise<Estado>;
  ajustar(ajuste: NovoAjuste): Promise<Estado>;
  marcarAlertasLidos(ids: string[]): Promise<void>;
  sair(): Promise<void>;
}

/** POST com text/plain (sem pré-voo de CORS); o Apps Script redireciona e devolve JSON. */
export async function chamar<T>(urlRobo: string, req: Requisicao): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(urlRobo, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req),
      redirect: 'follow',
    });
  } catch {
    throw new ErroApi('sem_conexao', 'Sem conexão com o robô. Confira a internet.');
  }
  if (!resposta.ok) throw new ErroApi('http', `O robô respondeu com erro (${resposta.status}).`);
  let corpo: RespostaApi<T>;
  try {
    corpo = (await resposta.json()) as RespostaApi<T>;
  } catch {
    throw new ErroApi('resposta_invalida', 'O robô devolveu uma resposta que não deu pra ler.');
  }
  if (!corpo.ok) throw new ErroApi(corpo.erro, corpo.mensagem);
  return corpo.dados;
}

export function ativar(urlRobo: string, codigo: string, aparelho: string): Promise<Sessao> {
  return chamar<Sessao>(urlRobo, { acao: 'ativar', codigo, aparelho });
}

export function clienteReal(sessao: SessaoLocal): ClienteApi {
  const { urlRobo, token } = sessao;
  return {
    estado: () => chamar<Estado>(urlRobo, { acao: 'estado', token }),
    sincronizar: () => chamar<Estado>(urlRobo, { acao: 'sincronizar', token }),
    responder: (resposta) => chamar<Estado>(urlRobo, { acao: 'responder', token, resposta }),
    batidaManual: (data, hora, justificativa) => chamar<Estado>(urlRobo, { acao: 'batidaManual', token, data, hora, justificativa }),
    ajustar: (ajuste) => chamar<Estado>(urlRobo, { acao: 'ajustar', token, ajuste }),
    marcarAlertasLidos: async (ids) => {
      await chamar<unknown>(urlRobo, { acao: 'marcarAlertasLidos', token, ids });
    },
    sair: async () => {
      await chamar<unknown>(urlRobo, { acao: 'sair', token });
    },
  };
}

/** "Chrome · Android" a partir do userAgent, para o robô saber qual aparelho foi ativado. */
export function descreverAparelho(userAgent: string): string {
  const navegador = /Edg\//.test(userAgent) ? 'Edge' : /Chrome\//.test(userAgent) ? 'Chrome' : /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : 'Navegador';
  const sistema = /Android/.test(userAgent) ? 'Android' : /iPhone|iPad/.test(userAgent) ? 'iOS' : /Windows/.test(userAgent) ? 'Windows' : /Mac OS X/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : 'desconhecido';
  return `${navegador} · ${sistema}`;
}
