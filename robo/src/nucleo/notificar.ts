import {
  calcularPeriodo, classificarNovaBatida, jornadaVigente, previsaoSaida, respostasVigentes, somarDias,
} from '../../../motor/src/index';
import type {
  Ajuste, AlertaGravado, BatidaRegistrada, ConfigCalculo, DataISO, EventoNotificacao, Pendencia, RespostaGravada, Segundos,
} from '../../../motor/src/index';

/** Só avisa batidas de até 2h atrás (a importação de dias antigos não vira notificação). */
export const JANELA_AVISO_BATIDA: Segundos = 2 * 3600;
export const HORA_LEMBRETE_ENTRADA: Segundos = 8 * 3600 + 30 * 60;
export const FIM_LEMBRETE_ENTRADA: Segundos = 12 * 3600;
export const HORA_DIA_INCOMPLETO: Segundos = 20 * 3600;
export const HORA_PENDENCIAS_ANTIGAS: Segundos = 12 * 3600;
/** No máximo tantas pendências avisadas uma a uma por rodada; o resto entra no lembrete diário. */
export const MAX_PENDENCIAS_POR_RODADA = 3;

export interface DadosAviso {
  batidas: BatidaRegistrada[];
  respostas: RespostaGravada[];
  ajustes: Ajuste[];
  config: ConfigCalculo;
  hoje: DataISO;
  agora: Segundos;
}

export interface Aviso {
  /** Identifica o aviso para nunca mandar o mesmo duas vezes. */
  chave: string;
  evento: EventoNotificacao;
}

const chavePendencia = (p: Pendencia): string =>
  p.tipo === 'abono_intervalo' ? `${p.tipo}|${p.data}|${p.inicio}-${p.fim}` : `${p.tipo}|${p.data}`;

function periodoAteHoje(d: DadosAviso) {
  return calcularPeriodo({
    de: d.hoje, ate: d.hoje, hoje: d.hoje, batidas: d.batidas,
    respostas: respostasVigentes(d.respostas), ajustes: d.ajustes, config: d.config,
  });
}

/** Avisos das batidas que acabaram de chegar: só as de hoje, recentes e sem atraso (as atrasadas viram alerta). */
export function avisosDeBatidas(novas: BatidaRegistrada[], d: DadosAviso): Aviso[] {
  const jornada = jornadaVigente(d.hoje, d.config.jornadas);
  if (!jornada || d.hoje < d.config.inicioBanco) return [];
  const recentes = novas
    .filter((b) => b.data === d.hoje && b.origem !== 'manual' && b.status === 'ativa' && b.atraso <= 600)
    .filter((b) => d.agora - b.segundos <= JANELA_AVISO_BATIDA)
    .sort((a, b) => a.segundos - b.segundos);
  if (recentes.length === 0) return [];

  const periodo = periodoAteHoje(d);
  const dia = periodo.dias[0];
  if (!dia) return [];
  const bancoAntes = periodo.bancoInicio;
  const avisos: Aviso[] = [];
  for (const b of recentes) {
    const tipo = classificarNovaBatida(dia, b.id, jornada.janelaAlmoco);
    if (!tipo) continue;
    let evento: EventoNotificacao;
    if (tipo.tipo === 'entrada') evento = { tipo: 'entrada', segundos: b.segundos };
    else if (tipo.tipo === 'saida_intermediaria') evento = { tipo: 'saida_intermediaria', segundos: b.segundos, almoco: tipo.almoco };
    else if (tipo.tipo === 'volta') evento = { tipo: 'volta', segundos: b.segundos, previsao: previsaoSaida(dia, jornada) };
    else evento = { tipo: 'resumo_saida', saldoDia: dia.saldo, bancoAntes, bancoDepois: bancoAntes + dia.saldo };
    avisos.push({ chave: `batida|${b.id}`, evento });
  }
  return avisos;
}

/** Pendências abertas de todo o banco (para avisar as novas e lembrar as antigas). */
export function pendenciasAbertas(d: DadosAviso): Pendencia[] {
  if (d.hoje < d.config.inicioBanco) return [];
  return calcularPeriodo({
    de: d.config.inicioBanco, ate: d.hoje, hoje: d.hoje, batidas: d.batidas,
    respostas: respostasVigentes(d.respostas), ajustes: d.ajustes, config: d.config,
  }).pendencias;
}

export function avisosDePendencias(pendencias: Pendencia[]): Aviso[] {
  return pendencias.slice(0, MAX_PENDENCIAS_POR_RODADA).map((p) => ({ chave: `pendencia|${chavePendencia(p)}`, evento: { tipo: 'nova_pendencia', pendencia: p } }));
}

export function avisosDeAlertas(alertas: AlertaGravado[]): Aviso[] {
  return alertas.map((a) => ({ chave: `alerta|${a.id}`, evento: { tipo: 'alerta', alerta: a.alerta } }));
}

/** Lembretes com hora marcada (um de cada por dia): entrada que não chegou, dia com batida faltando, pendências antigas. */
export function avisosDoDia(d: DadosAviso, pendencias: Pendencia[]): Aviso[] {
  if (d.hoje < d.config.inicioBanco) return [];
  const dia = periodoAteHoje(d).dias[0];
  if (!dia) return [];
  const mantidas = dia.batidas.filter((b) => b.status === 'ativa' && !b.duplicada).length;
  const avisos: Aviso[] = [];
  if (dia.diaUtil && mantidas === 0 && d.agora >= HORA_LEMBRETE_ENTRADA && d.agora < FIM_LEMBRETE_ENTRADA) {
    avisos.push({ chave: `lembrete_entrada|${d.hoje}`, evento: { tipo: 'lembrete_entrada' } });
  }
  if (mantidas % 2 === 1 && d.agora >= HORA_DIA_INCOMPLETO) {
    avisos.push({ chave: `dia_incompleto|${d.hoje}`, evento: { tipo: 'dia_incompleto', quantidade: mantidas } });
  }
  const antigas = pendencias.filter((p) => p.data < somarDias(d.hoje, -1)).length;
  if (antigas > 0 && d.agora >= HORA_PENDENCIAS_ANTIGAS) {
    avisos.push({ chave: `pendencias_antigas|${d.hoje}`, evento: { tipo: 'pendencias_antigas', quantidade: antigas } });
  }
  return avisos;
}

export const INICIO_CARINHO: Segundos = 10 * 3600;
export const FIM_CARINHO: Segundos = 17 * 3600;
const FIM_DO_DIA_CARINHO: Segundos = 22 * 3600;

/** Horário-surpresa do recado de carinho: muda todo dia, mas é sempre o mesmo para a mesma data (entre 10:00 e 17:00). */
export function horaDoCarinho(data: DataISO): Segundos {
  // FNV-1a de 32 bits: uma letra diferente na data muda o resultado inteiro (um hash fraco repetia o mesmo minuto em dias seguidos).
  let h = 2166136261;
  for (const ch of data) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  const minutosNaJanela = (FIM_CARINHO - INICIO_CARINHO) / 60;
  return INICIO_CARINHO + ((h >>> 0) % minutosNaJanela) * 60;
}

/** Um recado por dia, a partir do horário-surpresa (até 22h). Sem remetente configurado, não manda. */
export function avisoDeCarinho(d: Pick<DadosAviso, 'hoje' | 'agora'>, de: string): Aviso[] {
  if (!de.trim()) return [];
  if (d.agora < horaDoCarinho(d.hoje) || d.agora >= FIM_DO_DIA_CARINHO) return [];
  return [{ chave: `carinho|${d.hoje}`, evento: { tipo: 'carinho', de: de.trim() } }];
}

/**
 * Recados extras com hora marcada (pedidos avulsos, ex.: "manda um às 17h hoje").
 * `agendados` são 'AAAA-MM-DDTHH:MM:SS' locais; sai cada um uma vez, no dia dele, a partir da hora marcada.
 */
export function avisosDeRecadosExtras(agendados: string[], agoraIso: string, de: string): Aviso[] {
  if (!de.trim()) return [];
  const hoje = agoraIso.slice(0, 10);
  return agendados
    .filter((iso) => iso.slice(0, 10) === hoje && iso <= agoraIso)
    .map((iso) => ({ chave: `carinho_extra|${iso}`, evento: { tipo: 'carinho' as const, de: de.trim() } }));
}

/** Tag da notificação no celular (agrupa as do mesmo tipo). */
export function tagDoEvento(e: EventoNotificacao): string {
  switch (e.tipo) {
    case 'entrada':
    case 'saida_intermediaria':
    case 'volta':
      return 'batida';
    case 'resumo_saida':
      return 'resumo';
    case 'nova_pendencia':
    case 'pendencias_antigas':
      return 'pendencia';
    case 'alerta':
      return 'alerta';
    case 'carinho':
      return 'carinho';
    default:
      return 'lembrete';
  }
}
