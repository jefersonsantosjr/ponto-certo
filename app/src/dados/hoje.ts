import { classificarNovaBatida, jornadaVigente, previsaoSaida, saudacao, somarDias } from '@ponto-certo/motor';
import type { DataISO, Estado, Pendencia, ResultadoDia, Segundos, StatusDia } from '@ponto-certo/motor';
import type { Calculo } from './calculo';
import { DIAS_CURTOS, MESES, dataPorExtenso, inicioDaSemana, mesDe, primeiroDiaDoMes } from './datas';

export interface BatidaDeHoje {
  id: string;
  hora: string;
  rotulo: string;
}

export interface DiaDaSemana {
  data: DataISO;
  rotulo: string;
  saldo: Segundos | null;
  status: StatusDia | 'sem_dados';
  hoje: boolean;
}

export interface ResumoHoje {
  saudacao: string;
  nome: string;
  dataExtenso: string;
  banco: Segundos;
  mesNome: string;
  saldoMes: Segundos;
  dia: ResultadoDia | undefined;
  trabalhadoAoVivo: Segundos;
  carga: Segundos;
  progresso: number;
  dentro: boolean;
  previsao: Segundos | null;
  batidas: BatidaDeHoje[];
  semana: DiaDaSemana[];
  saldoSemana: Segundos;
  pendencias: Pendencia[];
}

const ROTULOS = { entrada: 'entrada', volta: 'volta', saida_final: 'saída' } as const;

export function resumoHoje(estado: Estado, calculo: Calculo): ResumoHoje {
  const { hoje, agora } = calculo.relogio;
  const dia = calculo.dia(hoje);
  const jornada = jornadaVigente(hoje, estado.config.jornadas) ?? estado.config.jornadas[0];
  const mantidas = (dia?.batidas ?? []).filter((b) => b.status === 'ativa' && !b.duplicada);
  const dentro = mantidas.length % 2 === 1;
  const ultima = mantidas[mantidas.length - 1];
  const aoVivo = dentro && ultima && agora > ultima.segundos ? agora - ultima.segundos : 0;
  const trabalhadoAoVivo = (dia?.trabalhado ?? 0) + aoVivo;
  const carga = dia?.carga ?? 0;

  const batidas: BatidaDeHoje[] = dia
    ? mantidas.map((b) => {
        const tipo = classificarNovaBatida(dia, b.id, jornada.janelaAlmoco);
        const rotulo = !tipo ? '' : tipo.tipo === 'saida_intermediaria' ? (tipo.almoco ? 'almoço' : 'saída') : ROTULOS[tipo.tipo];
        const registrada = estado.batidas.find((x) => x.id === b.id);
        return { id: b.id, hora: registrada?.hora ?? '', rotulo };
      })
    : [];

  const inicio = inicioDaSemana(hoje);
  const semana: DiaDaSemana[] = [0, 1, 2, 3, 4].map((i) => {
    const data = somarDias(inicio, i);
    const d = calculo.dia(data);
    const fechado = d && d.status !== 'em_andamento' && d.status !== 'futuro';
    return {
      data,
      rotulo: data === hoje ? 'hoje' : DIAS_CURTOS[(i + 1) % 7],
      saldo: fechado ? d.saldo : null,
      status: d ? d.status : 'sem_dados',
      hoje: data === hoje,
    };
  });

  const inicioMes = primeiroDiaDoMes(hoje);
  const saldoMes = calculo.periodo.dias
    .filter((d) => d.data >= inicioMes && d.data < hoje && d.status !== 'futuro')
    .reduce((s, d) => s + d.saldo, 0);

  return {
    saudacao: saudacao(agora),
    nome: estado.nomeExibicao,
    dataExtenso: dataPorExtenso(hoje),
    banco: calculo.bancoAtual,
    mesNome: MESES[mesDe(hoje) - 1],
    saldoMes,
    dia,
    trabalhadoAoVivo,
    carga,
    progresso: carga > 0 ? Math.min(1, trabalhadoAoVivo / carga) : 0,
    dentro,
    previsao: dia ? previsaoSaida(dia, jornada, estado.config.regras) : null,
    batidas,
    semana,
    saldoSemana: semana.reduce((s, d) => s + (d.saldo ?? 0), 0),
    pendencias: calculo.pendencias,
  };
}
