import { useEffect, useState } from 'preact/hooks';

export type NomeRota = 'hoje' | 'mes' | 'dia' | 'pendencias' | 'caderninho' | 'config' | 'ativar';

export interface Rota {
  nome: NomeRota;
  /** Segundo pedaço do caminho: a data em #/dia/AAAA-MM-DD, o mês em #/mes/AAAA-MM. */
  parametro: string | null;
  consulta: URLSearchParams;
}

const NOMES: NomeRota[] = ['hoje', 'mes', 'dia', 'pendencias', 'caderninho', 'config', 'ativar'];

export function lerRota(hash: string): Rota {
  const semCerquilha = hash.replace(/^#\/?/, '');
  const [caminho, consulta = ''] = semCerquilha.split('?');
  const [primeiro, segundo] = caminho.split('/');
  const nome = (NOMES as string[]).includes(primeiro) ? (primeiro as NomeRota) : 'hoje';
  return { nome, parametro: segundo ?? null, consulta: new URLSearchParams(consulta) };
}

export function navegar(caminho: string): void {
  window.location.hash = caminho;
}

export function useRota(): Rota {
  const [rota, setRota] = useState(() => lerRota(window.location.hash));
  useEffect(() => {
    const aoMudar = () => {
      setRota(lerRota(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', aoMudar);
    return () => window.removeEventListener('hashchange', aoMudar);
  }, []);
  return rota;
}
