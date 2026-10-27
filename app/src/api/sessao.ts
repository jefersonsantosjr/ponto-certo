import type { Estado, Papel } from '@ponto-certo/motor';

export interface SessaoLocal {
  urlRobo: string;
  token: string;
  nome: string;
  papel: Papel;
}

export interface EstadoEmCache {
  estado: Estado;
  /** Quando foi salvo (ISO do aparelho). */
  salvoEm: string;
}

const CHAVE_SESSAO = 'pontoCerto.sessao';
const CHAVE_ESTADO = 'pontoCerto.estado';

function ler<T>(chave: string): T | null {
  try {
    const texto = localStorage.getItem(chave);
    return texto ? (JSON.parse(texto) as T) : null;
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: unknown): void {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento (aba anônima, cota cheia): o app segue funcionando sem cache.
  }
}

export const lerSessao = (): SessaoLocal | null => ler<SessaoLocal>(CHAVE_SESSAO);
export const salvarSessao = (sessao: SessaoLocal): void => gravar(CHAVE_SESSAO, sessao);
export const lerEstadoEmCache = (): EstadoEmCache | null => ler<EstadoEmCache>(CHAVE_ESTADO);
export const salvarEstadoEmCache = (estado: Estado): void => gravar(CHAVE_ESTADO, { estado, salvoEm: new Date().toISOString() });

export type ProtecaoDados = 'protegido' | 'sem_protecao' | 'indisponivel';

/**
 * Pede ao navegador para não apagar os dados do app sozinho (quando falta espaço, o Chrome apaga os sites "comuns").
 * O Chrome concede sem perguntar quando o app está instalado ou tem notificação ligada: vale pedir de novo depois de ligar as notificações.
 */
export async function protegerDados(storage: Pick<StorageManager, 'persist' | 'persisted'> | undefined = globalThis.navigator?.storage): Promise<ProtecaoDados> {
  if (!storage?.persist || !storage.persisted) return 'indisponivel';
  try {
    return (await storage.persisted()) || (await storage.persist()) ? 'protegido' : 'sem_protecao';
  } catch {
    return 'indisponivel';
  }
}

export function apagarTudo(): void {
  gravar(CHAVE_SESSAO, null);
  gravar(CHAVE_ESTADO, null);
}
