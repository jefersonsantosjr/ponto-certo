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

export function apagarTudo(): void {
  gravar(CHAVE_SESSAO, null);
  gravar(CHAVE_ESTADO, null);
}
