import { calcularPeriodo, respostasVigentes } from '@ponto-certo/motor';
import type {
  AjusteGravado, BatidaRegistrada, DataISO, Estado, Pendencia, Resposta, ResultadoDia, ResultadoPeriodo, Segundos,
} from '@ponto-certo/motor';
import { ultimoDiaDoMes, type Relogio } from './datas';

/** Tudo o que as telas precisam, calculado a partir do Estado com o motor. */
export interface Calculo {
  relogio: Relogio;
  respostas: Resposta[];
  /** Do início do banco até o fim do mês atual (dias futuros vêm com status 'futuro'). */
  periodo: ResultadoPeriodo;
  /** Banco até ontem (o dia de hoje só entra quando termina). */
  bancoAtual: Segundos;
  pendencias: Pendencia[];
  dia(data: DataISO): ResultadoDia | undefined;
}

export interface Hipotese {
  respostas?: Resposta[];
  batidas?: BatidaRegistrada[];
  ajustes?: AjusteGravado[];
}

export function vigentes(estado: Estado, extras: Resposta[] = []): Resposta[] {
  const registradas = estado.respostas.map((r) => ({ id: r.id, criadaEm: r.criadaEm, resposta: r.resposta }));
  // Respostas hipotéticas entram como as mais recentes.
  extras.forEach((resposta, i) => registradas.push({ id: `hipotese-${i}`, criadaEm: '9999-12-31T23:59:59', resposta }));
  return respostasVigentes(registradas);
}

export function calcular(estado: Estado, relogio: Relogio, hipotese: Hipotese = {}): Calculo {
  const respostas = vigentes(estado, hipotese.respostas);
  const ate = ultimoDiaDoMes(relogio.hoje);
  const periodo = calcularPeriodo({
    de: estado.config.inicioBanco,
    ate: ate > estado.config.inicioBanco ? ate : estado.config.inicioBanco,
    hoje: relogio.hoje,
    batidas: [...estado.batidas, ...(hipotese.batidas ?? [])],
    respostas,
    ajustes: [...estado.ajustes, ...(hipotese.ajustes ?? [])],
    config: estado.config,
  });
  const porData = new Map(periodo.dias.map((d) => [d.data, d]));
  return {
    relogio,
    respostas,
    periodo,
    bancoAtual: periodo.bancoFim,
    pendencias: periodo.pendencias,
    dia: (data) => porData.get(data),
  };
}
