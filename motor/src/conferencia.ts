import { formatarHora } from './tempo';
import type { DataISO, Segundos } from './tipos';

export interface ResultadoConferencia {
  ok: boolean;
  totalGmail: number;
  totalPlanilha: number;
  faltandoNaPlanilha: string[];
  ausentesNoGmail: string[];
}

export function conferirIds(idsGmail: Iterable<string>, idsPlanilha: Iterable<string>): ResultadoConferencia {
  const gmail = new Set(idsGmail);
  const planilha = new Set(idsPlanilha);
  const faltandoNaPlanilha = [...gmail].filter((id) => !planilha.has(id)).sort();
  const ausentesNoGmail = [...planilha].filter((id) => !gmail.has(id)).sort();
  return {
    ok: faltandoNaPlanilha.length === 0 && ausentesNoGmail.length === 0,
    totalGmail: gmail.size,
    totalPlanilha: planilha.size,
    faltandoNaPlanilha,
    ausentesNoGmail,
  };
}

export interface RegistroComparavel {
  id: string;
  data: DataISO;
  segundos: Segundos;
  nsr?: string;
  hash?: string;
  cpfConfere?: boolean;
}

export interface Divergencia {
  id: string;
  campo: 'data' | 'hora' | 'nsr' | 'hash' | 'cpf';
  esperado: string;
  gravado: string;
}

export function conferirCampos(relidos: RegistroComparavel[], gravados: RegistroComparavel[]): Divergencia[] {
  const porId = new Map(gravados.map((g) => [g.id, g]));
  const divergencias: Divergencia[] = [];
  for (const r of relidos) {
    const g = porId.get(r.id);
    if (!g) continue;
    const comparar = (campo: Divergencia['campo'], esperado: string, gravado: string): void => {
      if (esperado !== gravado) divergencias.push({ id: r.id, campo, esperado, gravado });
    };
    comparar('data', r.data, g.data);
    comparar('hora', formatarHora(r.segundos), formatarHora(g.segundos));
    comparar('nsr', r.nsr ?? '', g.nsr ?? '');
    comparar('hash', r.hash ?? '', g.hash ?? '');
    comparar('cpf', String(r.cpfConfere ?? ''), String(g.cpfConfere ?? ''));
  }
  return divergencias;
}
