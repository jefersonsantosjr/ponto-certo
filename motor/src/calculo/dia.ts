import type {
  Ajuste, Batida, BatidaNoDia, ClassificacaoDia, ConfigCalculo, DataISO, MarcacaoTolerada, OrigemBatida,
  Pendencia, Resposta, ResultadoDia, Segundos, StatusDia,
} from '../tipos';
import { classificarIntervalos, lacunasEntrePares } from './intervalos';
import { infoDia } from './jornada';

export interface EntradaDia {
  data: DataISO;
  hoje: DataISO;
  /** Batidas desta data, em qualquer status. */
  batidas: Batida[];
  /** Respostas vigentes desta data (veja respostasVigentes). */
  respostas: Resposta[];
  /** Ajustes desta data. */
  ajustes: Ajuste[];
  config: ConfigCalculo;
}

const PRIORIDADE: Record<OrigemBatida, number> = { comprovante: 0, provisoria: 1, manual: 2 };
const ordenar = (a: Batida, b: Batida): number => a.segundos - b.segundos || PRIORIDADE[a.origem] - PRIORIDADE[b.origem];

export function calcularDia(e: EntradaDia): ResultadoDia {
  const info = infoDia(e.data, e.config);
  const { regras } = e.config;

  if (e.data > e.hoje) {
    return {
      data: e.data, diaUtil: info.diaUtil, feriado: info.feriado, batidas: [], pares: [], intervalos: [],
      trabalhado: 0, carga: info.carga, saldoBruto: 0, saldo: 0, toleranciaAplicada: false, ajusteTolerancia: 0, tolerancias: [],
      almocoDescontado: 0, abonado: 0, pendencias: [], status: 'futuro',
    };
  }

  const emAndamento = e.data === e.hoje;
  const fechado = !emAndamento;
  const almocoPadrao = info.jornada?.almocoPadrao ?? 0;
  const janelaAlmoco = info.jornada?.janelaAlmoco ?? { inicio: 0, fim: 0 };
  const resposta = <T extends Resposta['tipo']>(tipo: T) =>
    e.respostas.find((r): r is Extract<Resposta, { tipo: T }> => r.tipo === tipo);

  // 1–2: batidas ativas em ordem; duplicadas ficam de fora (o comprovante vale mais que a manual).
  const forcadas = new Set(e.respostas.flatMap((r) => (r.tipo === 'batida_conta' ? [r.batidaId] : [])));
  const mantidas: Batida[] = [];
  const duplicadas = new Set<string>();
  for (const b of e.batidas.filter((x) => x.status === 'ativa').sort(ordenar)) {
    const anterior = mantidas[mantidas.length - 1];
    if (anterior && b.segundos - anterior.segundos <= regras.limiteDuplicada && !forcadas.has(b.id)) {
      if (anterior.origem === 'manual' && b.origem !== 'manual') {
        duplicadas.add(anterior.id);
        mantidas[mantidas.length - 1] = b;
      } else {
        duplicadas.add(b.id);
      }
      continue;
    }
    mantidas.push(b);
  }
  const batidas: BatidaNoDia[] = [...e.batidas].sort(ordenar).map((b) => ({ ...b, duplicada: duplicadas.has(b.id) }));

  // 3: pares.
  const pares: Array<[Segundos, Segundos]> = [];
  for (let i = 0; i + 1 < mantidas.length; i += 2) pares.push([mantidas[i].segundos, mantidas[i + 1].segundos]);
  const pendencias: Pendencia[] = [];
  if (mantidas.length % 2 === 1 && fechado && !resposta('batida_faltando')) {
    pendencias.push({ tipo: 'batida_faltando', data: e.data });
  }

  // 4: intervalos (almoço × saídas).
  const classificados = classificarIntervalos({
    data: e.data, lacunas: lacunasEntrePares(pares), janelaAlmoco, almocoPadrao, respostas: e.respostas, emAndamento,
  });
  pendencias.push(...classificados.pendencias);

  // 5: só duas batidas num dia longo.
  let almocoDescontado = 0;
  if (mantidas.length === 2 && pares[0][1] - pares[0][0] > regras.minimoParaDescontarAlmoco) {
    const r = resposta('so_duas_batidas');
    if (r ? r.almocou : true) almocoDescontado = almocoPadrao;
    if (!r && fechado) pendencias.push({ tipo: 'so_duas_batidas', data: e.data });
  }

  // 6: trabalhado.
  const somaPares = pares.reduce((s, [a, b]) => s + (b - a), 0);
  const abonoIntervalos = classificados.intervalos.reduce((s, i) => s + (i.tipo === 'saida' && i.abonado ? i.duracao : 0), 0);
  const abonoManual = e.ajustes.reduce((s, a) => s + (a.ativo && a.tipo === 'abono_horas' ? a.segundos : 0), 0);
  const trabalhado = somaPares + abonoIntervalos + abonoManual - almocoDescontado;

  // 7 e 10: carga e dia útil sem batida.
  let carga = info.carga;
  let classificacao: ClassificacaoDia | undefined;
  if (mantidas.length === 0 && info.diaUtil) {
    const r = resposta('dia_sem_batida');
    classificacao = r ? r.classificacao : 'folga_banco';
    if (classificacao !== 'folga_banco') carga = 0;
    if (!r && fechado) pendencias.push({ tipo: 'dia_sem_batida', data: e.data });
  }

  // 8–9: saldo e tolerância da CLT (art. 58 §1º; Súmula 366 do TST: passou da tolerância, conta tudo).
  const saldoBruto = trabalhado - carga;
  let ajusteTolerancia = 0;
  let toleranciaAplicada = false;
  const tolerancias: MarcacaoTolerada[] = [];
  const jornada = info.jornada;
  if (regras.toleranciaLigada && jornada?.entrada !== undefined && jornada.saida !== undefined) {
    // Por batida: entrada × horário de entrada e última saída × horário de saída. O almoço conta exato.
    const limite = regras.toleranciaMarcacao ?? 5 * 60;
    const neutralizar = (marcacao: MarcacaoTolerada['marcacao'], segundos: Segundos, diferenca: Segundos): void => {
      if (diferenca !== 0 && Math.abs(diferenca) <= limite) {
        ajusteTolerancia += diferenca;
        toleranciaAplicada = true;
        tolerancias.push({ marcacao, segundos, diferenca });
      }
    };
    if (carga > 0 && mantidas.length > 0) {
      const entrada = mantidas[0].segundos;
      const saida = mantidas[mantidas.length - 1].segundos;
      neutralizar('entrada', entrada, jornada.entrada - entrada); // + = chegou antes
      if (mantidas.length % 2 === 0) neutralizar('saida', saida, saida - jornada.saida); // + = saiu depois
    }
  } else if (regras.toleranciaLigada && saldoBruto !== 0 && Math.abs(saldoBruto) <= regras.tolerancia) {
    // Configs antigas, sem horário de referência: tolerância no total do dia.
    ajusteTolerancia = saldoBruto;
    toleranciaAplicada = true;
  }
  const saldo = saldoBruto - ajusteTolerancia;

  let status: StatusDia = 'normal';
  if (emAndamento) status = 'em_andamento';
  else if (mantidas.length === 0) status = info.diaUtil ? 'sem_batida' : info.feriado ? 'feriado' : 'fim_de_semana';

  return {
    data: e.data, diaUtil: info.diaUtil, feriado: info.feriado, batidas, pares, intervalos: classificados.intervalos,
    trabalhado, carga, saldoBruto, saldo, toleranciaAplicada, ajusteTolerancia, tolerancias, almocoDescontado,
    abonado: abonoIntervalos + abonoManual, classificacao, pendencias, status,
  };
}
