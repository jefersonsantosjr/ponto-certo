import { dataCurtaBR, formatarHoraCurta } from '@ponto-certo/motor';
import type { ClassificacaoDia, Pendencia, Resposta } from '@ponto-certo/motor';

export const CLASSIFICACOES_DIA: Record<ClassificacaoDia, string> = {
  folga_banco: 'Folga do banco',
  abonado: 'Atestado / abonado',
  ferias: 'Férias',
  feriado: 'Feriado',
};

export const ATALHOS_JUSTIFICATIVA = ['Consulta médica', 'Atestado', 'Declaração', 'Banco / cartório', 'Assunto pessoal'];

const faixa = (inicio: number, fim: number): string => `${formatarHoraCurta(inicio)}–${formatarHoraCurta(fim)}`;

/** Título curto da pendência (ex.: "Ter, 20/10 · saída 10:00–10:50"). */
export function tituloPendencia(p: Pendencia, diaCurto: string): string {
  const base = `${diaCurto}, ${dataCurtaBR(p.data)}`;
  switch (p.tipo) {
    case 'abono_intervalo':
      return `${base} · saída ${faixa(p.inicio, p.fim)}`;
    case 'dia_sem_batida':
      return `${base} · dia sem batida`;
    case 'batida_faltando':
      return `${base} · batida faltando`;
    case 'so_duas_batidas':
      return `${base} · só entrada e saída`;
    case 'almoco_ambiguo':
      return `${base} · qual foi o almoço?`;
  }
}

/** A pergunta que a folha de resposta faz. */
export function perguntaPendencia(p: Pendencia): string {
  switch (p.tipo) {
    case 'abono_intervalo':
      return `Você saiu das ${formatarHoraCurta(p.inicio)} às ${formatarHoraCurta(p.fim)}. Essas horas foram abonadas?`;
    case 'dia_sem_batida':
      return 'Esse dia ficou sem nenhuma batida. O que foi?';
    case 'batida_faltando':
      return 'Ficou faltando uma batida nesse dia. Qual foi o horário?';
    case 'so_duas_batidas':
      return 'Só teve entrada e saída. Você almoçou sem bater o ponto?';
    case 'almoco_ambiguo':
      return 'Qual dessas saídas foi o almoço?';
  }
}

export function tipoResposta(r: Resposta): string {
  switch (r.tipo) {
    case 'abono_intervalo':
      return `Saída ${faixa(r.inicio, r.fim)}`;
    case 'dia_sem_batida':
      return 'Dia sem batida';
    case 'so_duas_batidas':
      return 'Só entrada e saída';
    case 'almoco_escolhido':
      return 'Qual foi o almoço';
    case 'batida_conta':
      return 'Batida marcada como duplicada';
    case 'batida_faltando':
      return 'Batida faltando';
  }
}

export function decisaoResposta(r: Resposta): string {
  switch (r.tipo) {
    case 'abono_intervalo':
      return r.abonado ? 'Abonado' : 'Não abonado';
    case 'dia_sem_batida':
      return CLASSIFICACOES_DIA[r.classificacao];
    case 'so_duas_batidas':
      return r.almocou ? 'Almoçou sem bater' : 'Não almoçou';
    case 'almoco_escolhido':
      return `Almoço ${faixa(r.inicio, r.fim)}`;
    case 'batida_conta':
      return 'Conta como batida';
    case 'batida_faltando':
      return 'Não sei o horário';
  }
}

/** Tom da etiqueta de decisão no histórico. */
export function tomDecisao(r: Resposta): 'sim' | 'nao' | 'neutro' | 'folga' {
  if (r.tipo === 'abono_intervalo') return r.abonado ? 'sim' : 'nao';
  if (r.tipo === 'dia_sem_batida') return r.classificacao === 'folga_banco' ? 'folga' : 'sim';
  return 'neutro';
}
