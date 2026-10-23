import { formatarHoraCurta } from '@ponto-certo/motor';
import type { Saude } from '@ponto-certo/motor';
import { dataHoraLocal } from './datas';

export type NivelSaude = 'ok' | 'atencao' | 'problema';

export interface AvaliacaoSaude {
  nivel: NivelSaude;
  texto: string;
}

const INICIO_EXPEDIENTE = 6 * 3600 + 30 * 60;
const FIM_EXPEDIENTE = 21 * 3600 + 30 * 60;

/**
 * Linha de conferência da tela Hoje (spec §13):
 * amarela se passou de 5 min sem sincronizar no horário de trabalho (fora dele, 20 min);
 * vermelha se passou de 20 min (fora do horário, 45 min), se a conferência falhou ou se o robô informou problema.
 */
export function avaliarSaude(saude: Saude, agora: Date): AvaliacaoSaude {
  if (saude.problemas.length > 0) return { nivel: 'problema', texto: saude.problemas[0] };
  const ultima = saude.ultimaSincronizacao ? dataHoraLocal(saude.ultimaSincronizacao) : null;
  if (!ultima) return { nivel: 'problema', texto: 'O robô ainda não sincronizou.' };

  const minutos = Math.floor((agora.getTime() - ultima.getTime()) / 60000);
  const segundosDoDia = agora.getHours() * 3600 + agora.getMinutes() * 60;
  const expediente = segundosDoDia >= INICIO_EXPEDIENTE && segundosDoDia <= FIM_EXPEDIENTE;
  const [limiteAtencao, limiteProblema] = expediente ? [5, 20] : [20, 45];
  const conf = saude.ultimaConferencia;

  if (conf && !conf.ok) return { nivel: 'problema', texto: conf.detalhe ?? 'A conferência com o Gmail não bateu.' };
  if (minutos > limiteProblema) return { nivel: 'problema', texto: `O robô está sem sincronizar há ${minutos} min.` };

  const hora = formatarHoraCurta(ultima.getHours() * 3600 + ultima.getMinutes() * 60);
  const contagem = conf ? ` · ${conf.totalGmail} e-mails = ${conf.totalPlanilha} registros` : '';
  if (minutos > limiteAtencao) return { nivel: 'atencao', texto: `Última conferência às ${hora}${contagem}` };
  return { nivel: 'ok', texto: `✓ Conferido às ${hora}${contagem}` };
}
