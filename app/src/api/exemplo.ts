// Estado de EXEMPLO para o modo de demonstração (npm run dev:mock). Tudo aqui é falso.
import { configPadrao, diaDaSemana, formatarHora, nomeFeriado, somarDias } from '@ponto-certo/motor';
import type { BatidaRegistrada, DataISO, Estado, MensagemRegistrada, RespostaGravada, AlertaGravado } from '@ponto-certo/motor';
import type { Relogio } from '../dados/datas';

function sementeDe(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) h = Math.imul(h ^ texto.charCodeAt(i), 16777619);
  return h >>> 0;
}

function aleatorio(semente: number): () => number {
  let a = semente;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let sequencia = 0;
function registrar(data: DataISO, segundos: number, extra: Partial<BatidaRegistrada> = {}): BatidaRegistrada {
  sequencia += 1;
  const id = `exemplo-${data}-${sequencia}`;
  return {
    id, data, segundos, origem: 'comprovante', status: 'ativa',
    nsr: String(80000 + sequencia), hash: (sequencia.toString(16).padStart(8, '0') + 'c0ffee12').repeat(4),
    inpi: 'BR5120210029364', hora: formatarHora(segundos),
    cpfConfere: true, nomeConfere: true, cnpjConfere: true, atraso: 4,
    recebidoEm: `${data} ${formatarHora(segundos + 4)}`, idGmail: id,
    ...extra,
  };
}

export function estadoDeExemplo(relogio: Relogio): Estado {
  sequencia = 0;
  const { hoje, agora } = relogio;
  const inicio = somarDias(hoje, -40);
  const config = { ...configPadrao(inicio), saldoInicial: -7500 };
  const batidas: BatidaRegistrada[] = [];
  const respostas: RespostaGravada[] = [];
  const alertas: AlertaGravado[] = [];
  const h = (horas: number, minutos: number, segundos = 0) => horas * 3600 + minutos * 60 + segundos;
  let diaUtil = 0;

  for (let data = inicio; data < hoje; data = somarDias(data, 1)) {
    const semana = diaDaSemana(data);
    if (semana === 0 || semana === 6 || nomeFeriado(data, config.feriados)) continue;
    diaUtil += 1;
    const r = aleatorio(sementeDe(data));
    const varia = (max: number) => Math.floor(r() * max);
    if (diaUtil === 12) {
      respostas.push({ id: `r-${data}`, criadaEm: `${data}T20:10:00`, autor: 'Maria', resposta: { tipo: 'dia_sem_batida', data, classificacao: 'folga_banco', justificativa: 'Folga combinada com a supervisora.' } });
      continue;
    }
    const entrada = h(7, 52) + varia(14 * 60);
    const saidaAlmoco = h(12, 0) + varia(40 * 60);
    const volta = saidaAlmoco + h(1, 12) + varia(6 * 60) - 180;
    const saida = h(17, 50) + varia(45 * 60);
    batidas.push(registrar(data, entrada));
    if (diaUtil === 7) batidas.push(registrar(data, entrada + 41));
    if (diaUtil === 5 || diaUtil === 25) {
      batidas.push(registrar(data, h(10, 0, 12)), registrar(data, h(10, 50, 3)));
      if (diaUtil === 5) {
        respostas.push({ id: `r-${data}`, criadaEm: `${data}T19:00:00`, autor: 'Maria', resposta: { tipo: 'abono_intervalo', data, inicio: h(10, 0, 12), fim: h(10, 50, 3), abonado: true, justificativa: 'Exame de sangue. Atestado entregue.' } });
      }
    }
    batidas.push(registrar(data, saidaAlmoco), registrar(data, volta), registrar(data, saida));
    if (diaUtil === 18) {
      const atrasada = batidas[batidas.length - 1];
      atrasada.atraso = 10800;
      atrasada.recebidoEm = `${data} ${formatarHora(saida + 10800)}`;
      alertas.push({ id: `a-${data}`, quando: `${data}T21:00:00`, alerta: { tipo: 'atrasado', data, segundos: saida, atraso: 10800 }, lido: false });
    }
  }

  const deHoje = [h(7, 59, 38), h(12, 3, 12), h(13, 15, 12)];
  for (const s of deHoje) if (agora >= s) batidas.push(registrar(hoje, s));

  const mensagens: MensagemRegistrada[] = batidas.map((b) => ({
    idGmail: b.idGmail ?? b.id, recebidoEm: b.recebidoEm, assunto: 'Comprovante de marcação de ponto IDFace',
    remetente: 'rhid.naoresponda@controlid.com.br', classificacao: 'comprovante', batidaId: b.id,
  }));
  const agoraTexto = `${hoje}T${formatarHora(Math.max(0, agora - 40))}`;

  return {
    geradoEm: `${hoje}T${formatarHora(agora)}`,
    hoje,
    agora,
    usuario: { nome: 'Maria', papel: 'dona' },
    notificacoes: { servidorPronto: false, aparelhos: 0 },
    nomeExibicao: 'Maria',
    identidade: { cpfMascarado: '***.456.789-**', nome: 'MARIA EXEMPLO DA SILVA', cnpj: '11.111.111/0001-00' },
    config,
    batidas,
    mensagens,
    respostas,
    ajustes: [],
    alertas,
    saude: {
      ultimaSincronizacao: agoraTexto,
      ultimaConferencia: { quando: agoraTexto, tipo: 'completa', totalGmail: mensagens.length, totalPlanilha: mensagens.length, ok: true, porClassificacao: { comprovante: mensagens.length } },
      problemas: [],
    },
  };
}
