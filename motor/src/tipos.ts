/** Segundos desde a meia-noite (hora local de Brasília) ou uma duração em segundos. */
export type Segundos = number;

/** Data no formato AAAA-MM-DD, sem fuso horário. */
export type DataISO = string;

/** Um instante: data + segundos desde a meia-noite. */
export interface Momento {
  data: DataISO;
  segundos: Segundos;
}

export type OrigemBatida = 'comprovante' | 'provisoria' | 'manual';
export type StatusBatida = 'ativa' | 'substituida' | 'fora_da_conta';

export interface Batida {
  id: string;
  data: DataISO;
  segundos: Segundos;
  origem: OrigemBatida;
  status: StatusBatida;
  nsr?: string;
  hash?: string;
}

export interface BatidaNoDia extends Batida {
  duplicada: boolean;
}

export interface Lacuna {
  inicio: Segundos;
  fim: Segundos;
}

export interface Intervalo extends Lacuna {
  duracao: Segundos;
  tipo: 'almoco' | 'saida';
  abonado: boolean;
  almocoIncerto: boolean;
}

export interface VersaoJornada {
  /** Data a partir da qual esta versão vale. */
  inicio: DataISO;
  /** Carga por dia da semana; índice 0 = domingo. */
  cargaPorDiaSemana: [Segundos, Segundos, Segundos, Segundos, Segundos, Segundos, Segundos];
  almocoPadrao: Segundos;
  janelaAlmoco: Lacuna;
}

export interface Regras {
  toleranciaLigada: boolean;
  tolerancia: Segundos;
  limiteDuplicada: Segundos;
  minimoParaDescontarAlmoco: Segundos;
}

export interface FeriadoLocal {
  data: DataISO;
  nome: string;
}

export interface FeriadosConfig {
  incluir: FeriadoLocal[];
  excluir: DataISO[];
}

export interface ConfigCalculo {
  jornadas: VersaoJornada[];
  regras: Regras;
  feriados: FeriadosConfig;
  inicioBanco: DataISO;
  saldoInicial: Segundos;
}

export type ClassificacaoDia = 'folga_banco' | 'abonado' | 'ferias' | 'feriado';

export type Resposta =
  | { tipo: 'abono_intervalo'; data: DataISO; inicio: Segundos; fim: Segundos; abonado: boolean; justificativa: string }
  | { tipo: 'dia_sem_batida'; data: DataISO; classificacao: ClassificacaoDia; justificativa: string }
  | { tipo: 'so_duas_batidas'; data: DataISO; almocou: boolean; justificativa: string }
  | { tipo: 'almoco_escolhido'; data: DataISO; inicio: Segundos; fim: Segundos; justificativa: string }
  | { tipo: 'batida_conta'; data: DataISO; batidaId: string; justificativa: string }
  | { tipo: 'batida_faltando'; data: DataISO; justificativa: string };

export interface Ajuste {
  id: string;
  data: DataISO;
  tipo: 'abono_horas' | 'ajuste_banco';
  segundos: Segundos;
  justificativa: string;
  ativo: boolean;
}

export type Pendencia =
  | { tipo: 'abono_intervalo'; data: DataISO; inicio: Segundos; fim: Segundos }
  | { tipo: 'dia_sem_batida'; data: DataISO }
  | { tipo: 'batida_faltando'; data: DataISO }
  | { tipo: 'so_duas_batidas'; data: DataISO }
  | { tipo: 'almoco_ambiguo'; data: DataISO; opcoes: Lacuna[] };

export type StatusDia = 'normal' | 'sem_batida' | 'fim_de_semana' | 'feriado' | 'em_andamento' | 'futuro';

export interface ResultadoDia {
  data: DataISO;
  diaUtil: boolean;
  feriado: string | null;
  batidas: BatidaNoDia[];
  pares: Array<[Segundos, Segundos]>;
  intervalos: Intervalo[];
  trabalhado: Segundos;
  carga: Segundos;
  saldoBruto: Segundos;
  saldo: Segundos;
  toleranciaAplicada: boolean;
  almocoDescontado: Segundos;
  abonado: Segundos;
  classificacao?: ClassificacaoDia;
  pendencias: Pendencia[];
  status: StatusDia;
}

export type Alerta =
  | { tipo: 'outra_pessoa'; data: DataISO; segundos: Segundos; nome?: string }
  | { tipo: 'nome_diferente'; data: DataISO; segundos: Segundos; nome: string }
  | { tipo: 'empresa_diferente'; data: DataISO; segundos: Segundos }
  | { tipo: 'comprovante_incompleto'; data: DataISO; segundos: Segundos; faltando: string[] }
  | { tipo: 'provisorio'; data: DataISO; segundos: Segundos }
  | { tipo: 'atrasado'; data: DataISO; segundos: Segundos; atraso: Segundos }
  | { tipo: 'outro_tipo'; assunto: string }
  | { tipo: 'remetente_desconhecido'; remetente: string; assunto: string }
  | { tipo: 'ausente_no_gmail'; data: DataISO; segundos: Segundos }
  | { tipo: 'campo_divergente'; data: DataISO; segundos: Segundos; campo: string };
