import { listarDatas } from '../tempo';
import type { Ajuste, Batida, ConfigCalculo, DataISO, Pendencia, Resposta, ResultadoDia, Segundos } from '../tipos';
import { calcularDia } from './dia';

export interface EntradaPeriodo {
  de: DataISO;
  ate: DataISO;
  hoje: DataISO;
  batidas: Batida[];
  /** Respostas vigentes (veja respostasVigentes). */
  respostas: Resposta[];
  ajustes: Ajuste[];
  config: ConfigCalculo;
}

export interface ResumoPeriodo {
  saldo: Segundos;
  trabalhado: Segundos;
  carga: Segundos;
  abonado: Segundos;
  ajustesBanco: Segundos;
  diasTrabalhados: number;
  feriados: number;
  pendencias: number;
}

export interface ResultadoPeriodo {
  dias: ResultadoDia[];
  /** Banco ao fim de cada dia do período até hoje (hoje: sem o saldo do dia em andamento). */
  bancoPorDia: Record<DataISO, Segundos>;
  bancoInicio: Segundos;
  bancoFim: Segundos;
  resumo: ResumoPeriodo;
  pendencias: Pendencia[];
}

function agruparPorData<T extends { data: DataISO }>(itens: T[]): Map<DataISO, T[]> {
  const mapa = new Map<DataISO, T[]>();
  for (const item of itens) {
    const lista = mapa.get(item.data);
    if (lista) lista.push(item);
    else mapa.set(item.data, [item]);
  }
  return mapa;
}

const entraNoBanco = (dia: ResultadoDia): boolean => dia.status !== 'em_andamento' && dia.status !== 'futuro';

export function calcularPeriodo(e: EntradaPeriodo): ResultadoPeriodo {
  const batidas = agruparPorData(e.batidas);
  const respostas = agruparPorData(e.respostas);
  const ajustes = agruparPorData(e.ajustes.filter((a) => a.ativo));
  const inicio = e.config.inicioBanco;
  const primeiroDia = e.de > inicio ? e.de : inicio;

  let banco = e.config.saldoInicial;
  let bancoInicio = banco;
  const dias: ResultadoDia[] = [];
  const bancoPorDia: Record<DataISO, Segundos> = {};
  const pendencias: Pendencia[] = [];
  const resumo: ResumoPeriodo = { saldo: 0, trabalhado: 0, carga: 0, abonado: 0, ajustesBanco: 0, diasTrabalhados: 0, feriados: 0, pendencias: 0 };

  for (const data of listarDatas(inicio, e.ate)) {
    if (data === primeiroDia) bancoInicio = banco;
    const ajustesDoDia = ajustes.get(data) ?? [];
    const dia = calcularDia({ data, hoje: e.hoje, batidas: batidas.get(data) ?? [], respostas: respostas.get(data) ?? [], ajustes: ajustesDoDia, config: e.config });
    const ajusteBanco = data <= e.hoje ? ajustesDoDia.reduce((s, a) => s + (a.tipo === 'ajuste_banco' ? a.segundos : 0), 0) : 0;
    if (entraNoBanco(dia)) banco += dia.saldo;
    banco += ajusteBanco;
    if (data < primeiroDia) continue;

    dias.push(dia);
    pendencias.push(...dia.pendencias);
    if (data <= e.hoje) bancoPorDia[data] = banco;
    resumo.ajustesBanco += ajusteBanco;
    if (entraNoBanco(dia)) {
      resumo.saldo += dia.saldo;
      resumo.trabalhado += dia.trabalhado;
      resumo.carga += dia.carga;
      resumo.abonado += dia.abonado;
      if (dia.pares.length > 0) resumo.diasTrabalhados += 1;
      if (dia.feriado) resumo.feriados += 1;
    }
  }
  resumo.pendencias = pendencias.length;
  return { dias, bancoPorDia, bancoInicio, bancoFim: banco, resumo, pendencias };
}
