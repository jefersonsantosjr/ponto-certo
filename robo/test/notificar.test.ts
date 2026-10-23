import { describe, expect, it } from 'vitest';
import { configPadrao, paraSegundos, type BatidaRegistrada, type Pendencia } from '../../motor/src/index';
import { avisoDeCarinho, avisosDeBatidas, avisosDePendencias, avisosDoDia, horaDoCarinho, pendenciasAbertas, tagDoEvento, type DadosAviso } from '../src/nucleo/notificar';

const HOJE = '2026-10-23';
const CONFIG = configPadrao('2026-10-22');

function bat(data: string, hora: string, extra: Partial<BatidaRegistrada> = {}): BatidaRegistrada {
  const segundos = paraSegundos(hora);
  return {
    id: `${data}-${hora}`, data, segundos, origem: 'comprovante', status: 'ativa', hora, nsr: hora.replace(/:/g, ''), hash: `h${data}${hora}`,
    cpfConfere: true, nomeConfere: true, cnpjConfere: true, atraso: 1, recebidoEm: `${data} ${hora}`, ...extra,
  };
}

const ONTEM = ['07:59:07', '13:50:38', '15:03:02', '18:15:41'].map((h) => bat('2026-10-22', h)); // +16min10s
function dados(hojeHoras: string[], agora: string, extra: Partial<DadosAviso> = {}): DadosAviso {
  return { batidas: [...ONTEM, ...hojeHoras.map((h) => bat(HOJE, h))], respostas: [], ajustes: [], config: CONFIG, hoje: HOJE, agora: paraSegundos(agora), ...extra };
}

describe('avisosDeBatidas', () => {
  it('cada batida, ao chegar na hora dela, vira o aviso certo (entrada, almoço, volta com previsão, resumo)', () => {
    const horas = ['07:59:38', '12:03:12', '13:15:12', '18:00:00'];
    const eventos = horas.map((hora, i) => {
      const d = dados(horas.slice(0, i + 1), hora);
      const nova = d.batidas.find((b) => b.data === HOJE && b.hora === hora);
      return avisosDeBatidas(nova ? [nova] : [], d).map((a) => a.evento);
    });
    expect(eventos).toEqual([
      [{ tipo: 'entrada', segundos: paraSegundos('07:59:38') }],
      [{ tipo: 'saida_intermediaria', segundos: paraSegundos('12:03:12'), almoco: true }],
      [{ tipo: 'volta', segundos: paraSegundos('13:15:12'), previsao: paraSegundos('17:59:38') }],
      [{ tipo: 'resumo_saida', saldoDia: 0, bancoAntes: 970, bancoDepois: 970 }],
    ]);
  });

  it('a volta traz a previsão de saída quando ela ainda está dentro', () => {
    const d = dados(['07:59:38', '12:03:12', '13:15:12'], '13:15:30');
    const volta = d.batidas.find((b) => b.data === HOJE && b.hora === '13:15:12');
    expect(avisosDeBatidas(volta ? [volta] : [], d)).toEqual([
      { chave: `batida|${HOJE}-13:15:12`, evento: { tipo: 'volta', segundos: paraSegundos('13:15:12'), previsao: paraSegundos('17:59:38') } },
    ]);
  });

  it('não avisa batidas antigas, atrasadas (viram alerta) ou de outro dia', () => {
    const d = dados(['07:59:38'], '11:00:00');
    const entrada = d.batidas.find((b) => b.data === HOJE);
    expect(avisosDeBatidas(entrada ? [entrada] : [], d)).toEqual([]);
    const atrasada = { ...bat(HOJE, '10:30:00'), atraso: 1200 };
    expect(avisosDeBatidas([atrasada], { ...d, batidas: [...d.batidas, atrasada] })).toEqual([]);
    expect(avisosDeBatidas([ONTEM[0]], d)).toEqual([]);
  });
});

describe('avisosDoDia', () => {
  it('lembra a entrada às 08:30 se nada chegou num dia útil', () => {
    expect(avisosDoDia(dados([], '08:31:00'), [])).toEqual([{ chave: `lembrete_entrada|${HOJE}`, evento: { tipo: 'lembrete_entrada' } }]);
    expect(avisosDoDia(dados([], '08:29:00'), [])).toEqual([]);
    expect(avisosDoDia(dados(['07:59:38'], '08:31:00'), [])).toEqual([]);
  });

  it('às 20:00 avisa número ímpar de batidas', () => {
    expect(avisosDoDia(dados(['07:59:38', '12:03:12', '13:15:12'], '20:00:30'), [])).toEqual([
      { chave: `dia_incompleto|${HOJE}`, evento: { tipo: 'dia_incompleto', quantidade: 3 } },
    ]);
  });

  it('ao meio-dia lembra pendências de mais de um dia', () => {
    const antiga: Pendencia = { tipo: 'dia_sem_batida', data: '2026-10-20' };
    const deOntem: Pendencia = { tipo: 'dia_sem_batida', data: '2026-10-22' };
    expect(avisosDoDia(dados(['07:59:38'], '12:00:30'), [antiga, deOntem])).toEqual([
      { chave: `pendencias_antigas|${HOJE}`, evento: { tipo: 'pendencias_antigas', quantidade: 1 } },
    ]);
  });
});

describe('recado de carinho', () => {
  it('horário-surpresa entre 10:00 e 17:00, estável para a mesma data e diferente entre dias', () => {
    const horas = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'].map(horaDoCarinho);
    for (const s of horas) {
      expect(s).toBeGreaterThanOrEqual(paraSegundos('10:00'));
      expect(s).toBeLessThan(paraSegundos('17:00'));
      expect(s % 60).toBe(0);
    }
    expect(horaDoCarinho('2026-10-23')).toBe(horas[0]);
    expect(new Set(horas).size).toBeGreaterThan(1);
  });

  it('manda uma vez por dia, a partir do horário-surpresa e até as 22h', () => {
    const hora = horaDoCarinho(HOJE);
    expect(avisoDeCarinho({ hoje: HOJE, agora: hora - 60 }, 'João')).toEqual([]);
    expect(avisoDeCarinho({ hoje: HOJE, agora: hora }, 'João')).toEqual([{ chave: `carinho|${HOJE}`, evento: { tipo: 'carinho', de: 'João' } }]);
    expect(avisoDeCarinho({ hoje: HOJE, agora: paraSegundos('22:00') }, 'João')).toEqual([]);
    expect(avisoDeCarinho({ hoje: HOJE, agora: hora }, '  ')).toEqual([]);
  });
});

describe('pendências e tags', () => {
  it('pendenciasAbertas usa o banco inteiro e avisosDePendencias limita a 3 por rodada', () => {
    const d = dados(['07:59:38'], '12:00:00', { batidas: ONTEM.slice(0, 3), config: configPadrao('2026-10-20') });
    const abertas = pendenciasAbertas(d);
    expect(abertas.map((p) => p.tipo)).toEqual(['dia_sem_batida', 'dia_sem_batida', 'batida_faltando']);
    const muitas: Pendencia[] = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'].map((data) => ({ tipo: 'dia_sem_batida', data }));
    expect(avisosDePendencias(muitas)).toHaveLength(3);
  });

  it('agrupa por tipo', () => {
    expect(tagDoEvento({ tipo: 'entrada', segundos: 1 })).toBe('batida');
    expect(tagDoEvento({ tipo: 'resumo_saida', saldoDia: 0, bancoAntes: 0, bancoDepois: 0 })).toBe('resumo');
    expect(tagDoEvento({ tipo: 'lembrete_entrada' })).toBe('lembrete');
  });
});
