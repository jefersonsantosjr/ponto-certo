import { jornadaVigente } from '../calculo/jornada';
import { formatarDuracao, formatarHora, formatarHoraCurta, formatarSaldo } from '../tempo';
import type { ConfigCalculo, DataISO, MarcacaoTolerada, ResultadoDia } from '../tipos';

/** A regra de tolerância vigente na data, numa linha (tela de configurações e planilha). */
export function descreverRegraTolerancia(config: ConfigCalculo, data: DataISO): string {
  const { regras } = config;
  if (!regras.toleranciaLigada) return 'desligada';
  const jornada = jornadaVigente(data, config.jornadas);
  if (jornada?.entrada === undefined || jornada.saida === undefined) return `±${formatarDuracao(regras.tolerancia)} no total do dia`;
  const limite = formatarDuracao(regras.toleranciaMarcacao ?? 5 * 60);
  return `até ${limite} na entrada (${formatarHoraCurta(jornada.entrada)}) e na saída (${formatarHoraCurta(jornada.saida)}); passou disso, conta tudo; o almoço conta exato`;
}

function marcacao(t: MarcacaoTolerada): string {
  const antes = t.marcacao === 'entrada' ? t.diferenca > 0 : t.diferenca < 0;
  return `${t.marcacao === 'entrada' ? 'entrada' : 'saída'} ${formatarHora(t.segundos)} (${formatarDuracao(t.diferenca)} ${antes ? 'antes' : 'depois'})`;
}

/** O que a tolerância fez no dia (tela do dia e ocorrências da planilha), ou null se não fez nada. */
export function descreverToleranciaDoDia(dia: ResultadoDia): string | null {
  if (!dia.toleranciaAplicada) return null;
  if (dia.tolerancias.length === 0) return `${formatarSaldo(dia.ajusteTolerancia)} zerados pela tolerância da CLT`;
  return `Tolerância da CLT: ${dia.tolerancias.map(marcacao).join(' e ')} não ${dia.tolerancias.length > 1 ? 'contam' : 'conta'}`;
}
