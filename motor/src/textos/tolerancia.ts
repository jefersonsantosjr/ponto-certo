import { jornadaVigente } from '../calculo/jornada';
import { formatarDuracao, formatarHora, formatarHoraCurta, formatarSaldo } from '../tempo';
import type { ConfigCalculo, DataISO, MarcacaoTolerada, Regras, ResultadoDia } from '../tipos';

/** A regra de tolerância vigente na data, numa linha (tela de configurações e planilha). */
export function descreverRegraTolerancia(config: ConfigCalculo, data: DataISO): string {
  const { regras } = config;
  if (!regras.toleranciaLigada) return 'desligada';
  const jornada = jornadaVigente(data, config.jornadas);
  if (jornada?.entrada === undefined || jornada.saida === undefined) return `±${formatarDuracao(regras.tolerancia)} no total do dia`;
  return `variação de entrada (${formatarHoraCurta(jornada.entrada)}) e saída (${formatarHoraCurta(jornada.saida)}) somando até ${formatarDuracao(regras.tolerancia)} não conta; passou disso, conta o registrado; o almoço conta exato`;
}

function marcacao(t: MarcacaoTolerada): string {
  const antes = t.marcacao === 'entrada' ? t.diferenca > 0 : t.diferenca < 0;
  return `${t.marcacao === 'entrada' ? 'entrada' : 'saída'} ${formatarHora(t.segundos)} (${formatarDuracao(t.diferenca)} ${antes ? 'antes' : 'depois'})`;
}

/** A conta da tolerância no dia (tela do dia e ocorrências da planilha), para conferir com a folha do RH; null se nada variou. */
export function descreverToleranciaDoDia(dia: ResultadoDia, regras: Pick<Regras, 'tolerancia'>): string | null {
  if (dia.variacoes.length === 0) return dia.toleranciaAplicada ? `${formatarSaldo(dia.ajusteTolerancia)} zerados pela tolerância da CLT` : null;
  const limite = formatarDuracao(regras.tolerancia);
  const total = formatarDuracao(dia.variacoes.reduce((s, v) => s + Math.abs(v.diferenca), 0));
  if (!dia.toleranciaAplicada) return `Sem tolerância da CLT: ${dia.variacoes.map(marcacao).join(' + ')} = ${total} no dia, passou de ${limite}, conta o registrado`;
  return `Tolerância da CLT: ${dia.variacoes.map(marcacao).join(' e ')} não ${dia.variacoes.length > 1 ? 'contam' : 'conta'} (${total} no dia, limite ${limite})`;
}
