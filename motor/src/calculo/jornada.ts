import { nomeFeriado } from '../feriados';
import { diaDaSemana } from '../tempo';
import type { ConfigCalculo, DataISO, Regras, Segundos, VersaoJornada } from '../tipos';

export const MINUTO = 60;
export const HORA = 3600;

const CARGA_DIA_UTIL = 8 * HORA + 48 * MINUTO;

export const REGRAS_PADRAO: Readonly<Regras> = {
  toleranciaLigada: true,
  toleranciaMarcacao: 5 * MINUTO,
  tolerancia: 10 * MINUTO,
  limiteDuplicada: 5 * MINUTO,
  minimoParaDescontarAlmoco: 6 * HORA,
};

export function configPadrao(inicioBanco: DataISO): ConfigCalculo {
  return {
    jornadas: [
      {
        inicio: inicioBanco,
        cargaPorDiaSemana: [0, CARGA_DIA_UTIL, CARGA_DIA_UTIL, CARGA_DIA_UTIL, CARGA_DIA_UTIL, CARGA_DIA_UTIL, 0],
        almocoPadrao: HORA + 12 * MINUTO,
        janelaAlmoco: { inicio: 12 * HORA, fim: 15 * HORA },
        entrada: 8 * HORA,
        saida: 18 * HORA,
      },
    ],
    regras: { ...REGRAS_PADRAO },
    feriados: { incluir: [], excluir: [] },
    inicioBanco,
    saldoInicial: 0,
  };
}

/**
 * Completa uma config salva antes da tolerância por batida: a jornada padrão ganha os horários de
 * referência (08:00–18:00) e as regras, o limite de 5min. Sem nada a mudar, devolve a mesma config.
 */
export function migrarConfig(c: ConfigCalculo): ConfigCalculo {
  const padrao = configPadrao(c.inicioBanco);
  const ref = padrao.jornadas[0];
  const ehPadrao = (j: VersaoJornada): boolean =>
    j.almocoPadrao === ref.almocoPadrao && j.cargaPorDiaSemana.every((carga, i) => carga === ref.cargaPorDiaSemana[i]);
  let mudou = false;
  const jornadas = c.jornadas.map((j) => {
    if (j.entrada !== undefined || j.saida !== undefined || !ehPadrao(j)) return j;
    mudou = true;
    return { ...j, entrada: ref.entrada, saida: ref.saida };
  });
  let regras = c.regras;
  if (regras.toleranciaMarcacao === undefined) {
    mudou = true;
    regras = { ...regras, toleranciaMarcacao: REGRAS_PADRAO.toleranciaMarcacao };
  }
  return mudou ? { ...c, jornadas, regras } : c;
}

export function jornadaVigente(data: DataISO, jornadas: VersaoJornada[]): VersaoJornada | null {
  let escolhida: VersaoJornada | null = null;
  for (const jornada of jornadas) {
    if (jornada.inicio <= data && (!escolhida || jornada.inicio > escolhida.inicio)) escolhida = jornada;
  }
  return escolhida;
}

export interface InfoDia {
  jornada: VersaoJornada | null;
  feriado: string | null;
  diaUtil: boolean;
  carga: Segundos;
}

export function infoDia(data: DataISO, config: ConfigCalculo): InfoDia {
  const jornada = jornadaVigente(data, config.jornadas);
  const feriado = nomeFeriado(data, config.feriados);
  const cargaSemana = jornada ? jornada.cargaPorDiaSemana[diaDaSemana(data)] : 0;
  const diaUtil = cargaSemana > 0 && feriado === null;
  return { jornada, feriado, diaUtil, carga: diaUtil ? cargaSemana : 0 };
}
