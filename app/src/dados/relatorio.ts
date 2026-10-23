import {
  calcularPeriodo, chaveResposta, dataBR, formatarDuracao, formatarHora, formatarHorasPlanilha, formatarSaldo,
  formatarSaldoPlanilha, NOMES_DIAS, diaDaSemana,
} from '@ponto-certo/motor';
import type { BatidaRegistrada, DataISO, Estado, ResultadoDia, ResultadoPeriodo } from '@ponto-certo/motor';
import { vigentes } from './calculo';
import { dataHoraLocal, type Relogio } from './datas';
import { CLASSIFICACOES_DIA, decisaoResposta, tipoResposta } from './rotulos';

export type Celula = string | number;

export interface Tabela {
  cabecalho: string[];
  linhas: Celula[][];
}

export interface Relatorio {
  nomeArquivo: string;
  de: DataISO;
  ate: DataISO;
  periodo: ResultadoPeriodo;
  resumo: Array<[string, Celula]>;
  dias: Tabela & { saldos: number[]; pendentes: boolean[]; total: Celula[] };
  comprovantes: Tabela;
  justificativas: Tabela;
}

export const ABAS = ['Resumo', 'Dias', 'Comprovantes', 'Justificativas'] as const;

const ORIGENS: Record<BatidaRegistrada['origem'], string> = { comprovante: 'comprovante', provisoria: 'provisória (horário do e-mail)', manual: 'manual (sem comprovante)' };

function dataHoraBR(texto: string): string {
  const d = dataHoraLocal(texto);
  if (!d) return texto;
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`;
}

function ocorrencias(dia: ResultadoDia, estado: Estado): string {
  const itens: string[] = [];
  const respostasDoDia = vigentes(estado).filter((r) => r.data === dia.data);
  if (dia.feriado) itens.push(`Feriado: ${dia.feriado}`);
  if (dia.classificacao) {
    const r = respostasDoDia.find((x) => x.tipo === 'dia_sem_batida');
    itens.push(`${CLASSIFICACOES_DIA[dia.classificacao]}${r ? `: ${r.justificativa}` : ' (PENDENTE)'}`);
  }
  for (const i of dia.intervalos.filter((x) => x.tipo === 'saida')) {
    const r = respostasDoDia.find((x) => x.tipo === 'abono_intervalo' && x.inicio === i.inicio && x.fim === i.fim);
    const faixa = `${formatarHora(i.inicio)}–${formatarHora(i.fim)}`;
    itens.push(r ? `Saída ${faixa} ${i.abonado ? 'abonada' : 'não abonada'}: ${r.justificativa}` : `Saída ${faixa} PENDENTE`);
  }
  for (const p of dia.pendencias) {
    if (p.tipo === 'batida_faltando') itens.push('Batida faltando (PENDENTE)');
    if (p.tipo === 'so_duas_batidas') itens.push('Só entrada e saída (PENDENTE)');
    if (p.tipo === 'almoco_ambiguo') itens.push('Almoço não identificado (PENDENTE)');
  }
  if (dia.almocoDescontado > 0) itens.push(`Almoço de ${formatarDuracao(dia.almocoDescontado)} descontado (só 2 batidas)`);
  for (const b of dia.batidas) {
    const registrada = estado.batidas.find((x) => x.id === b.id);
    if (b.duplicada) itens.push(`Batida ${formatarHora(b.segundos)} duplicada (ignorada)`);
    else if (b.status === 'fora_da_conta') itens.push(`Comprovante ${formatarHora(b.segundos)} de outra pessoa (fora da conta)`);
    else if (b.status === 'substituida') itens.push(`Batida manual ${formatarHora(b.segundos)} substituída pelo comprovante`);
    else if (b.origem === 'manual') itens.push(`Batida ${formatarHora(b.segundos)} manual (sem comprovante)${registrada?.justificativa ? `: ${registrada.justificativa}` : ''}`);
    else if (b.origem === 'provisoria') itens.push(`Batida ${formatarHora(b.segundos)} provisória (horário do e-mail)`);
  }
  for (const a of estado.ajustes.filter((x) => x.ativo && x.data === dia.data)) {
    itens.push(`${a.tipo === 'abono_horas' ? 'Abono de' : 'Ajuste do banco'} ${formatarSaldo(a.segundos)}: ${a.justificativa}`);
  }
  if (dia.toleranciaAplicada) itens.push(`${formatarSaldo(dia.saldoBruto)} zerados pela tolerância da CLT`);
  return itens.join(' · ');
}

function situacao(b: BatidaRegistrada, dia: ResultadoDia | undefined): string {
  if (b.status === 'fora_da_conta') return 'fora da conta (CPF de outra pessoa)';
  if (b.status === 'substituida') return 'substituída pelo comprovante';
  if (dia?.batidas.find((x) => x.id === b.id)?.duplicada) return 'duplicada (ignorada)';
  const avisos = [!b.nomeConfere && 'nome diferente', !b.cnpjConfere && 'CNPJ diferente'].filter(Boolean);
  return avisos.length ? `válida (${avisos.join(', ')})` : 'válida';
}

/** Monta o conteúdo das 4 abas do Excel (spec §10.1) para o período [de, ate], já recortado. */
export function montarRelatorio(estado: Estado, relogio: Relogio, de: DataISO, ate: DataISO): Relatorio {
  const respostas = vigentes(estado);
  const periodo = calcularPeriodo({ de, ate, hoje: relogio.hoje, batidas: estado.batidas, respostas, ajustes: estado.ajustes, config: estado.config });
  const porData = new Map(periodo.dias.map((d) => [d.data, d]));

  const dias = {
    cabecalho: ['Data', 'Dia', 'Entrada', 'Saída', 'Entrada', 'Saída', 'Entrada', 'Saída', 'Entrada', 'Saída', 'Trabalhado', 'Carga', 'Saldo do dia', 'Saldo (s)', 'Banco', 'Ocorrências e justificativas'],
    linhas: [] as Celula[][],
    saldos: [] as number[],
    pendentes: [] as boolean[],
    total: [] as Celula[],
  };
  for (const dia of periodo.dias) {
    const mantidas = dia.batidas.filter((b) => b.status === 'ativa' && !b.duplicada).map((b) => formatarHora(b.segundos));
    const horas = Array.from({ length: 8 }, (_, i) => mantidas[i] ?? '');
    if (mantidas.length > 8) horas[7] = `${horas[7]} (+${mantidas.length - 8})`;
    const banco = periodo.bancoPorDia[dia.data];
    const emAndamento = dia.status === 'em_andamento';
    dias.linhas.push([
      dataBR(dia.data), NOMES_DIAS[diaDaSemana(dia.data)], ...horas,
      formatarHorasPlanilha(dia.trabalhado), formatarHorasPlanilha(dia.carga),
      emAndamento ? 'em andamento' : formatarSaldoPlanilha(dia.saldo), emAndamento ? '' : dia.saldo,
      banco === undefined ? '' : formatarSaldoPlanilha(banco), ocorrencias(dia, estado),
    ]);
    dias.saldos.push(emAndamento ? 0 : dia.saldo);
    dias.pendentes.push(dia.pendencias.length > 0);
  }
  dias.total = [
    'Total', '', '', '', '', '', '', '', '', '',
    formatarHorasPlanilha(periodo.resumo.trabalhado), formatarHorasPlanilha(periodo.resumo.carga),
    formatarSaldoPlanilha(periodo.resumo.saldo), periodo.resumo.saldo, formatarSaldoPlanilha(periodo.bancoFim),
    periodo.resumo.pendencias === 1 ? '1 pendência' : `${periodo.resumo.pendencias} pendências`,
  ];

  const comprovantes: Tabela = {
    cabecalho: ['Data', 'Hora', 'Origem', 'NSR', 'Hash (SHA-256)', 'Registro no INPI', 'E-mail recebido em', 'Atraso do e-mail', 'Situação', 'ID do e-mail', 'Justificativa'],
    linhas: estado.batidas
      .filter((b) => b.data >= de && b.data <= ate)
      .sort((a, b) => a.data.localeCompare(b.data) || a.segundos - b.segundos)
      .map((b) => [
        dataBR(b.data), b.hora || formatarHora(b.segundos), ORIGENS[b.origem], b.nsr ?? '', b.hash ?? '', b.inpi ?? '',
        b.recebidoEm ? dataHoraBR(b.recebidoEm) : '', b.atraso > 0 ? formatarDuracao(b.atraso) : '',
        situacao(b, porData.get(b.data)), b.idGmail ?? '', b.justificativa ?? '',
      ]),
  };

  const ultimas = new Map<string, string>();
  for (const r of estado.respostas) {
    const chave = chaveResposta(r.resposta);
    const atual = estado.respostas.find((x) => x.id === ultimas.get(chave));
    if (!atual || r.criadaEm >= atual.criadaEm) ultimas.set(chave, r.id);
  }
  const vigentesIds = new Set(ultimas.values());
  const justificativas: Tabela = {
    cabecalho: ['Data', 'Tipo', 'Decisão', 'Justificativa', 'Quem', 'Quando', 'Situação'],
    linhas: [
      ...estado.respostas
        .filter((r) => r.resposta.data >= de && r.resposta.data <= ate)
        .sort((a, b) => a.resposta.data.localeCompare(b.resposta.data) || a.criadaEm.localeCompare(b.criadaEm))
        .map((r) => [
          dataBR(r.resposta.data), tipoResposta(r.resposta), decisaoResposta(r.resposta), r.resposta.justificativa,
          r.autor, dataHoraBR(r.criadaEm), vigentesIds.has(r.id) ? 'vigente' : 'substituída por outra resposta',
        ]),
      ...estado.ajustes
        .filter((a) => a.data >= de && a.data <= ate)
        .sort((a, b) => a.data.localeCompare(b.data))
        .map((a) => [
          dataBR(a.data), a.tipo === 'abono_horas' ? 'Abono de horas' : 'Ajuste do banco', formatarSaldo(a.segundos),
          a.justificativa, a.autor, dataHoraBR(a.criadoEm), a.ativo ? 'vigente' : 'cancelado',
        ]),
    ],
  };

  const conf = estado.saude.ultimaConferencia;
  const resumo: Array<[string, Celula]> = [
    ['Período', `${dataBR(de)} a ${dataBR(ate)}`],
    ['Gerado em', `${dataBR(relogio.hoje)} ${formatarHora(relogio.agora)}`],
    ...(estado.identidade
      ? ([['Nome', estado.identidade.nome], ['CPF', estado.identidade.cpfMascarado], ['Empresa (CNPJ)', estado.identidade.cnpj]] as Array<[string, Celula]>)
      : []),
    ['Saldo do período', formatarSaldoPlanilha(periodo.resumo.saldo)],
    ['Banco no início', formatarSaldoPlanilha(periodo.bancoInicio)],
    ['Banco no fim', formatarSaldoPlanilha(periodo.bancoFim)],
    ['Trabalhado', formatarHorasPlanilha(periodo.resumo.trabalhado)],
    ['Previsto (carga)', formatarHorasPlanilha(periodo.resumo.carga)],
    ['Abonado', formatarHorasPlanilha(periodo.resumo.abonado)],
    ['Ajustes do banco', formatarSaldoPlanilha(periodo.resumo.ajustesBanco)],
    ['Dias trabalhados', periodo.resumo.diasTrabalhados],
    ['Feriados', periodo.resumo.feriados],
    ['Pendências', periodo.resumo.pendencias],
    ['Conferência com o Gmail', conf ? `${conf.totalGmail} e-mails = ${conf.totalPlanilha} registros (${dataHoraBR(conf.quando)})${conf.ok ? '' : ' — NÃO BATEU'}` : 'não disponível'],
    ['Observação', 'Horários com segundos, como nos comprovantes. Tolerância da CLT (±10 min por dia) aplicada. Batidas manuais não têm comprovante.'],
  ];

  return { nomeArquivo: `ponto_${de}_a_${ate}.xlsx`, de, ate, periodo, resumo, dias, comprovantes, justificativas };
}
