// Ajudantes para os testes do app: monta um Estado pequeno, com dados FALSOS.
import { configPadrao, paraSegundos } from '@ponto-certo/motor';
import type { BatidaRegistrada, ConfigCalculo, DataISO, Estado, OrigemBatida } from '@ponto-certo/motor';

let sequencia = 0;

export function batidaRegistrada(data: DataISO, hora: string, origem: OrigemBatida = 'comprovante'): BatidaRegistrada {
  sequencia += 1;
  const completa = hora.length === 5 ? `${hora}:00` : hora;
  return {
    id: `t${sequencia}`,
    data,
    segundos: paraSegundos(completa),
    origem,
    status: 'ativa',
    nsr: origem === 'manual' ? undefined : String(10000 + sequencia),
    hash: origem === 'manual' ? undefined : 'a1'.repeat(32),
    hora: completa,
    cpfConfere: true,
    nomeConfere: true,
    cnpjConfere: true,
    atraso: origem === 'manual' ? 0 : 5,
    recebidoEm: origem === 'manual' ? '' : `${data} ${completa}`,
    idGmail: origem === 'manual' ? undefined : `msg${sequencia}`,
  };
}

export function estadoDeTeste(dias: Record<DataISO, string[]>, config: ConfigCalculo = configPadrao('2026-10-19')): Estado {
  return {
    geradoEm: '2026-10-23T15:42:00',
    hoje: '2026-10-23',
    agora: paraSegundos('15:42:00'),
    usuario: { nome: 'Maria', papel: 'dona' },
    notificacoes: { servidorPronto: false, aparelhos: 0 },
    nomeExibicao: 'Maria',
    identidade: { cpfMascarado: '***.456.789-**', nome: 'MARIA EXEMPLO DA SILVA', cnpj: '11.111.111/0001-00' },
    config,
    batidas: Object.entries(dias).flatMap(([data, horas]) => horas.map((hora) => batidaRegistrada(data, hora))),
    mensagens: [],
    respostas: [],
    ajustes: [],
    alertas: [],
    saude: { ultimaSincronizacao: '2026-10-23T15:41:00', ultimaConferencia: null, problemas: [] },
  };
}

/** Semana de 19 a 23/10/2026, igual ao teste do banco no motor (início do banco −2h05). */
export const SEMANA: Record<DataISO, string[]> = {
  '2026-10-19': ['08:00', '12:00', '13:12', '18:12'],
  '2026-10-20': ['07:56', '07:57', '10:00', '10:50', '12:10', '13:22', '18:21'],
  '2026-10-21': ['07:58', '12:01', '13:13', '18:30'],
  '2026-10-22': ['08:01', '12:30', '13:42', '18:14'],
  '2026-10-23': ['07:59:38', '12:03:12', '13:15:12'],
};

export function estadoDaSemana(): Estado {
  return estadoDeTeste(SEMANA, { ...configPadrao('2026-10-19'), saldoInicial: -7500 });
}
