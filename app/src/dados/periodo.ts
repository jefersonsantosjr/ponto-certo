import { somarDias } from '@ponto-certo/motor';
import type { DataISO } from '@ponto-certo/motor';
import { anoDe, inicioDaSemana, primeiroDiaDoMes, ultimoDiaDoMes } from './datas';

export type Atalho = 'dia' | 'semana' | 'mes' | 'ano' | 'periodo';

export interface Intervalo {
  de: DataISO;
  ate: DataISO;
}

export function intervaloDoAtalho(atalho: Exclude<Atalho, 'periodo'>, hoje: DataISO): Intervalo {
  switch (atalho) {
    case 'dia':
      return { de: hoje, ate: hoje };
    case 'semana': {
      const de = inicioDaSemana(hoje);
      return { de, ate: somarDias(de, 6) };
    }
    case 'mes':
      return { de: primeiroDiaDoMes(hoje), ate: ultimoDiaDoMes(hoje) };
    case 'ano':
      return { de: `${anoDe(hoje)}-01-01`, ate: `${anoDe(hoje)}-12-31` };
  }
}

/** Recorta o intervalo para o que pode ser calculado: do início do banco até hoje. */
export function recortar(intervalo: Intervalo, inicioBanco: DataISO, hoje: DataISO): Intervalo | null {
  const de = intervalo.de > inicioBanco ? intervalo.de : inicioBanco;
  const ate = intervalo.ate < hoje ? intervalo.ate : hoje;
  return de <= ate ? { de, ate } : null;
}
