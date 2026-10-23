import {
  arredondarParaMinutoSeguinte, dataCurtaBR, formatarDuracao, formatarHora, formatarHoraCurta, formatarSaldo,
} from '../tempo';
import type { Alerta, DataISO, Pendencia, Segundos } from '../tipos';

export interface ContextoTexto {
  nome: string;
  /** Hora local atual em segundos (define a saudação). */
  agora: Segundos;
  /** Sorteio injetável; recebe a quantidade de opções. Os testes usam () => 0. */
  sortear?: (quantidade: number) => number;
}

export interface Notificacao {
  titulo: string;
  corpo: string;
  /** Rota do app aberta ao tocar. */
  destino: string;
}

export type EventoNotificacao =
  | { tipo: 'entrada'; segundos: Segundos }
  | { tipo: 'saida_intermediaria'; segundos: Segundos; almoco: boolean }
  | { tipo: 'volta'; segundos: Segundos; previsao: Segundos | null }
  | { tipo: 'resumo_saida'; saldoDia: Segundos; bancoAntes: Segundos; bancoDepois: Segundos }
  | { tipo: 'nova_pendencia'; pendencia: Pendencia }
  | { tipo: 'lembrete_entrada' }
  | { tipo: 'dia_incompleto'; quantidade: number }
  | { tipo: 'alerta'; alerta: Alerta }
  | { tipo: 'pendencias_antigas'; quantidade: number }
  /** Recado diário de carinho de quem configurou o app (ex.: o marido). */
  | { tipo: 'carinho'; de: string };

interface DadosBatida { s: string; nome: string; hora: string; previsao: string }
interface DadosResumo { s: string; nome: string; dia: string; diaAbs: string; falta: string; banco: string; bancoAbs: string }
type Modelo<T> = (dados: T) => string;

export const MODELOS_ENTRADA: Modelo<DadosBatida>[] = [
  ({ s, nome, hora }) => `☀️ ${s}, ${nome}! Entrada às ${hora} registrada.`,
  ({ nome, hora }) => `Entrada às ${hora} anotada ✓ Bom trabalho, ${nome}!`,
  ({ s, hora }) => `${s}! Bati aqui: entrada às ${hora} ✓`,
];

export const MODELOS_SAIDA_ALMOCO: Modelo<DadosBatida>[] = [
  ({ nome, hora }) => `🍽️ Bom almoço, ${nome}! Saída às ${hora} registrada.`,
  ({ hora }) => `Saída pro almoço às ${hora} ✓ Aproveita! 🍽️`,
  ({ hora }) => `Hora de recarregar 🍽️ Saída às ${hora} anotada.`,
];

export const MODELOS_SAIDA: Modelo<DadosBatida>[] = [
  ({ hora }) => `Saída às ${hora} registrada. Até já! 👋`,
  ({ hora }) => `Anotei sua saída às ${hora} ✓`,
  ({ hora }) => `Saída às ${hora} ✓ Quando voltar, eu registro.`,
];

export const MODELOS_VOLTA_COM_PREVISAO: Modelo<DadosBatida>[] = [
  ({ previsao }) => `⏰ De volta! Pra fechar o dia no zero, sua saída é às ${previsao}.`,
  ({ hora, previsao }) => `Volta às ${hora} ✓ Saída prevista pro zero: ${previsao} ⏰`,
  ({ previsao }) => `Que bom que voltou! Hoje dá pra sair às ${previsao} no zero 😉`,
];

export const MODELOS_VOLTA: Modelo<DadosBatida>[] = [
  ({ hora }) => `De volta às ${hora} ✓`,
  ({ hora }) => `Volta registrada às ${hora} ✓`,
  ({ hora }) => `Anotei sua volta às ${hora} 👍`,
];

interface DadosCarinho { s: string; nome: string; de: string }

export const MODELOS_CARINHO: Modelo<DadosCarinho>[] = [
  ({ nome, de }) => `💌 Recado do ${de}: "Eu te amo muito, ${nome}!" ❤️`,
  ({ de }) => `💌 O ${de} pediu pra eu te lembrar: ele te ama muito! ❤️`,
  ({ nome, de }) => `❤️ Só passando pra avisar: o ${de} te ama demais, ${nome}!`,
  ({ de }) => `🥰 Pausa pro carinho: o ${de} mandou dizer que te ama muito!`,
  ({ nome, de }) => `💌 ${nome}, lembrete importante do dia: o ${de} te ama muito! 🥰`,
  ({ de }) => `❤️ Mensagem do ${de}: "Você é o amor da minha vida."`,
  ({ s, nome, de }) => `${s}, ${nome}! O ${de} te ama muito, hoje e todo dia ❤️`,
];

export type CenarioResumo =
  | 'zerou' | 'virouNegativo' | 'pagando' | 'devendoNegativo' | 'devendoZero' | 'positivo' | 'usandoBanco' | 'positivoZero';

export const RESUMO: Record<CenarioResumo, Modelo<DadosResumo>[]> = {
  zerou: [
    ({ nome, banco }) => `ZERAMOS, ${nome}! 🥳 Banco no azul: ${banco}.`,
    ({ banco }) => `Banco zerado! 🥳 Agora estamos com ${banco}.`,
    ({ nome, banco }) => `Conseguimos, ${nome}! Saímos do vermelho 🎉 Banco: ${banco}.`,
  ],
  pagando: [
    ({ s, nome, dia, falta }) => `${s}, ${nome}! Isso aí, hoje pagamos ${dia}. Falta só ${falta} pra zerar 💪`,
    ({ dia, falta }) => `Mais um passo! Hoje foram ${dia}. Faltam ${falta} pra zerar o banco 💪`,
    ({ s, nome, diaAbs, falta }) => `${s}, ${nome}! Pagamos ${diaAbs} hoje 👏 Agora faltam ${falta}.`,
  ],
  devendoNegativo: [
    ({ s, nome, dia, falta }) => `${s}, ${nome}. Hoje ficou ${dia}, mas amanhã a gente recupera 😉 Faltam ${falta}.`,
    ({ dia, falta }) => `Hoje ficou ${dia}. Tudo bem, amanhã a gente compensa 😉 Faltam ${falta} pra zerar.`,
    ({ nome, dia, falta }) => `${nome}, hoje foi ${dia}. Bora recuperar amanhã 💪 Faltam ${falta}.`,
  ],
  devendoZero: [
    ({ falta }) => `Dia fechado no zero ✓ Faltam ${falta} pra zerar o banco.`,
    ({ s, nome, falta }) => `${s}, ${nome}! Dia certinho ✓ Ainda faltam ${falta} pra zerar.`,
    ({ falta }) => `Fechamos o dia no zero ✓ Faltam ${falta}.`,
  ],
  positivo: [
    ({ dia, banco }) => `Hoje rendeu ${dia} 🎉 Banco: ${banco}.`,
    ({ s, nome, dia, banco }) => `${s}, ${nome}! Mais ${dia} pro banco 🎉 Total: ${banco}.`,
    ({ dia, banco }) => `Dia produtivo: ${dia} 🙌 Banco em ${banco}.`,
  ],
  usandoBanco: [
    ({ diaAbs, bancoAbs }) => `Hoje usamos ${diaAbs} do banco. Ainda sobram ${bancoAbs} 😌`,
    ({ s, nome, diaAbs, bancoAbs }) => `${s}, ${nome}. Hoje saíram ${diaAbs} do banco, que segue com ${bancoAbs} 😌`,
    ({ diaAbs, banco }) => `Usamos ${diaAbs} do banco hoje. Saldo: ${banco} 👍`,
  ],
  virouNegativo: [
    ({ dia, banco }) => `Hoje ficou ${dia} e o banco foi pra ${banco}. Amanhã a gente recupera 😉`,
    ({ s, nome, dia, banco }) => `${s}, ${nome}. Hoje foi ${dia} e o banco ficou em ${banco}. Bora compensar 💪`,
    ({ dia, banco }) => `Dia de ${dia}. O banco ficou em ${banco}, mas dá pra recuperar 😉`,
  ],
  positivoZero: [
    ({ banco }) => `Dia fechado no zero ✓ Banco: ${banco}.`,
    ({ s, nome, banco }) => `${s}, ${nome}! Dia certinho ✓ Banco segue em ${banco}.`,
    ({ banco }) => `Fechamos o dia no zero ✓ Banco em ${banco}.`,
  ],
};

export function saudacao(agora: Segundos): string {
  if (agora < 12 * 3600) return 'Bom dia';
  if (agora < 18 * 3600) return 'Boa tarde';
  return 'Boa noite';
}

export function cenarioResumo(saldoDia: Segundos, bancoAntes: Segundos, bancoDepois: Segundos): CenarioResumo {
  if (bancoAntes < 0 && bancoDepois >= 0) return 'zerou';
  if (bancoAntes >= 0 && bancoDepois < 0) return 'virouNegativo';
  if (bancoAntes < 0) return saldoDia > 0 ? 'pagando' : saldoDia < 0 ? 'devendoNegativo' : 'devendoZero';
  return saldoDia > 0 ? 'positivo' : saldoDia < 0 ? 'usandoBanco' : 'positivoZero';
}

function escolher<T>(opcoes: T[], ctx: ContextoTexto): T {
  const sortear = ctx.sortear ?? ((n: number) => Math.floor(Math.random() * n));
  return opcoes[sortear(opcoes.length) % opcoes.length];
}

const quando = (data: DataISO, segundos: Segundos): string => `${dataCurtaBR(data)} às ${formatarHora(segundos)}`;

function textoPendencia(p: Pendencia): string {
  const d = dataCurtaBR(p.data);
  switch (p.tipo) {
    case 'abono_intervalo':
      return `🤔 Você saiu das ${formatarHoraCurta(p.inicio)} às ${formatarHoraCurta(p.fim)} em ${d}. Foi abonado? Toca pra responder.`;
    case 'dia_sem_batida':
      return `📅 ${d} ficou sem nenhuma batida. Foi folga, atestado, férias ou feriado?`;
    case 'batida_faltando':
      return `⚠️ ${d} ficou com uma batida faltando. Toca pra completar.`;
    case 'so_duas_batidas':
      return `🍽️ Em ${d} só teve entrada e saída. Você almoçou sem bater o ponto?`;
    case 'almoco_ambiguo':
      return `🤔 Em ${d} não deu pra saber qual saída foi o almoço. Me ajuda?`;
  }
}

function textoAlerta(a: Alerta): string {
  switch (a.tipo) {
    case 'outra_pessoa':
      return `⚠️ O comprovante de ${quando(a.data, a.segundos)} está no nome de ${a.nome ?? 'outra pessoa'}. Provavelmente o RH lançou errado.`;
    case 'nome_diferente':
      return `⚠️ O comprovante de ${quando(a.data, a.segundos)} está com o seu CPF, mas com o nome "${a.nome}". A batida foi contada; vale avisar o RH.`;
    case 'empresa_diferente':
      return `⚠️ O comprovante de ${quando(a.data, a.segundos)} veio com o CNPJ de outra empresa. A batida foi contada; vale conferir com o RH.`;
    case 'comprovante_incompleto':
      return `⚠️ O comprovante de ${quando(a.data, a.segundos)} veio sem ${a.faltando.join(' e ')}. A batida foi contada e o aviso ficou guardado.`;
    case 'provisorio':
      return `⚠️ Chegou um comprovante num formato novo. Anotei a batida pelo horário do e-mail (${quando(a.data, a.segundos)}) e avisei o desenvolvedor.`;
    case 'atrasado':
      return `📬 Chegou o comprovante de ${quando(a.data, a.segundos)}, com ${formatarDuracao(a.atraso)} de atraso. Já reorganizei o dia ✓`;
    case 'outro_tipo':
      return `📩 Chegou um e-mail do RHiD que não é comprovante: "${a.assunto}". Dá uma olhada no app.`;
    case 'remetente_desconhecido':
      return `⚠️ Chegou um comprovante de um remetente desconhecido (${a.remetente}). Confere no app.`;
    case 'ausente_no_gmail':
      return `⚠️ O e-mail do comprovante de ${quando(a.data, a.segundos)} não está mais no Gmail. A cópia continua guardada.`;
    case 'campo_divergente':
      return `⚠️ A planilha está diferente do e-mail no comprovante de ${quando(a.data, a.segundos)} (campo: ${a.campo}). Alguém mexeu na planilha?`;
  }
}

export function gerarNotificacao(evento: EventoNotificacao, ctx: ContextoTexto): Notificacao {
  const s = saudacao(ctx.agora);
  const nome = ctx.nome;
  switch (evento.tipo) {
    case 'entrada':
      return { titulo: 'Entrada registrada', corpo: escolher(MODELOS_ENTRADA, ctx)({ s, nome, hora: formatarHora(evento.segundos), previsao: '' }), destino: '#/hoje' };
    case 'saida_intermediaria': {
      const modelos = evento.almoco ? MODELOS_SAIDA_ALMOCO : MODELOS_SAIDA;
      return { titulo: 'Saída registrada', corpo: escolher(modelos, ctx)({ s, nome, hora: formatarHora(evento.segundos), previsao: '' }), destino: '#/hoje' };
    }
    case 'volta': {
      const previsao = evento.previsao === null ? null : formatarHoraCurta(arredondarParaMinutoSeguinte(evento.previsao));
      const modelos = previsao ? MODELOS_VOLTA_COM_PREVISAO : MODELOS_VOLTA;
      return { titulo: 'Volta registrada', corpo: escolher(modelos, ctx)({ s, nome, hora: formatarHora(evento.segundos), previsao: previsao ?? '' }), destino: '#/hoje' };
    }
    case 'resumo_saida': {
      const cenario = cenarioResumo(evento.saldoDia, evento.bancoAntes, evento.bancoDepois);
      const corpo = escolher(RESUMO[cenario], ctx)({
        s, nome,
        dia: formatarSaldo(evento.saldoDia),
        diaAbs: formatarDuracao(evento.saldoDia),
        falta: formatarDuracao(evento.bancoDepois),
        banco: formatarSaldo(evento.bancoDepois),
        bancoAbs: formatarDuracao(evento.bancoDepois),
      });
      return { titulo: 'Resumo do dia', corpo, destino: '#/hoje' };
    }
    case 'nova_pendencia':
      return { titulo: 'Pendência', corpo: textoPendencia(evento.pendencia), destino: '#/pendencias' };
    case 'lembrete_entrada':
      return { titulo: 'Lembrete', corpo: `${s}! Ainda não chegou o comprovante de entrada de hoje. Você já bateu? Eu aviso quando chegar 😉`, destino: '#/hoje' };
    case 'dia_incompleto':
      return { titulo: 'Batida faltando?', corpo: `⚠️ Hoje ficaram ${evento.quantidade} batidas. Falta alguma?`, destino: '#/hoje' };
    case 'alerta':
      return { titulo: 'Atenção', corpo: textoAlerta(evento.alerta), destino: 'data' in evento.alerta ? `#/dia/${evento.alerta.data}` : '#/hoje' };
    case 'carinho':
      return { titulo: '💌 Recado especial', corpo: escolher(MODELOS_CARINHO, ctx)({ s, nome, de: evento.de }), destino: '#/hoje' };
    case 'pendencias_antigas':
      return {
        titulo: 'Pendências',
        corpo: evento.quantidade === 1 ? 'Ainda tem 1 resposta esperando por você 🙏' : `Ainda tem ${evento.quantidade} respostas esperando por você 🙏`,
        destino: '#/pendencias',
      };
  }
}
