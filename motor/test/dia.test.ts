import { describe, expect, it } from 'vitest';
import type { Resposta } from '../src/tipos';
import { batida, h } from './ajuda';
import { CONFIG, diaDeTeste } from './ajuda-dia';

const SEM_TOLERANCIA = { ...CONFIG, regras: { ...CONFIG.regras, toleranciaLigada: false } };

describe('calcularDia: base', () => {
  it('dia normal fecha no zero e identifica o almoço', () => {
    const d = diaDeTeste('2026-10-19', ['08:00', '12:00', '13:12', '18:00']);
    expect(d).toMatchObject({ trabalhado: 31680, carga: 31680, saldo: 0, status: 'normal', diaUtil: true, pendencias: [] });
    expect(d.intervalos).toMatchObject([{ tipo: 'almoco', inicio: h('12:00'), fim: h('13:12') }]);
  });

  it('os segundos entram na conta', () => {
    const d = diaDeTeste('2026-10-19', ['07:59:38', '12:03:12', '13:15:12', '18:00:00'], { config: SEM_TOLERANCIA });
    expect(d.trabalhado).toBe(31702);
    expect(d.saldo).toBe(22);
  });

  it.each([
    ['17:50:00', -600, 0, true],
    ['17:49:59', -601, -601, false],
    ['18:10:00', 600, 0, true],
    ['18:10:01', 601, 601, false],
  ])('tolerância: saída %s → bruto %i, saldo %i', (saida, bruto, saldo, aplicada) => {
    const d = diaDeTeste('2026-10-19', ['08:00', '12:00', '13:12', saida]);
    expect(d.saldoBruto).toBe(bruto);
    expect(d.saldo).toBe(saldo);
    expect(d.toleranciaAplicada).toBe(aplicada);
  });

  it('batida até 5min00s depois é duplicada; 5min01s não', () => {
    const dup = diaDeTeste('2026-10-19', ['08:00:00', '08:05:00', '12:00', '13:12', '18:00']);
    expect(dup.batidas.map((b) => b.duplicada)).toEqual([false, true, false, false, false]);
    expect(dup.saldo).toBe(0);
    const naoDup = diaDeTeste('2026-10-19', ['08:00:00', '08:05:01', '12:00', '13:12', '18:00']);
    expect(naoDup.batidas.every((b) => !b.duplicada)).toBe(true);
    expect(naoDup.pendencias).toContainEqual({ tipo: 'batida_faltando', data: '2026-10-19' });
  });

  it('comprovante vale mais que batida manual próxima', () => {
    const data = '2026-10-19';
    const manual = batida(data, '08:00:00', 'manual');
    const comprovante = batida(data, '08:02:10');
    const d = diaDeTeste(data, [], { batidas: [manual, comprovante, batida(data, '12:00'), batida(data, '13:12'), batida(data, '18:00')] });
    expect(d.batidas.find((b) => b.id === manual.id)?.duplicada).toBe(true);
    expect(d.batidas.find((b) => b.id === comprovante.id)?.duplicada).toBe(false);
    expect(d.trabalhado).toBe(31550); // 08:02:10→12:00 (14270) + 13:12→18:00 (17280)
    expect(d.saldoBruto).toBe(-130);
    expect(d.saldo).toBe(0); // dentro da tolerância
  });

  it('a resposta "essa batida conta" desfaz a duplicada', () => {
    const data = '2026-10-19';
    const segunda = batida(data, '08:03:00');
    const respostas: Resposta[] = [{ tipo: 'batida_conta', data, batidaId: segunda.id, justificativa: 'Saí e voltei' }];
    const d = diaDeTeste(data, [], { respostas, batidas: [batida(data, '08:00'), segunda, batida(data, '12:00'), batida(data, '13:12')] });
    expect(d.batidas.every((b) => !b.duplicada)).toBe(true);
    expect(d.pares).toHaveLength(2);
  });

  it('número ímpar: conta só os pares completos e pede a batida que falta', () => {
    const d = diaDeTeste('2026-10-21', ['08:00', '12:00', '13:12']);
    expect(d.trabalhado).toBe(14400);
    expect(d.saldo).toBe(14400 - 31680);
    expect(d.pendencias).toEqual([{ tipo: 'batida_faltando', data: '2026-10-21' }]);
  });

  it('batidas fora da conta aparecem, mas não entram no cálculo', () => {
    const data = '2026-10-19';
    const fora = batida(data, '10:00', 'comprovante', 'fora_da_conta');
    const d = diaDeTeste(data, [], { batidas: [batida(data, '08:00'), fora, batida(data, '12:00'), batida(data, '13:12'), batida(data, '18:00')] });
    expect(d.batidas).toHaveLength(5);
    expect(d.saldo).toBe(0);
  });

  it('fim de semana trabalhado é todo positivo', () => {
    expect(diaDeTeste('2026-10-17', ['09:00', '13:00'])).toMatchObject({ diaUtil: false, carga: 0, saldo: 14400, status: 'normal' });
  });

  it('feriado sem batida não deve nada', () => {
    expect(diaDeTeste('2026-10-12', [])).toMatchObject({ status: 'feriado', feriado: 'Nossa Senhora Aparecida', saldo: 0, pendencias: [] });
  });

  it('dia útil sem batida desconta a carga e pergunta o que foi', () => {
    expect(diaDeTeste('2026-10-21', [])).toMatchObject({
      status: 'sem_batida', saldo: -31680, classificacao: 'folga_banco',
      pendencias: [{ tipo: 'dia_sem_batida', data: '2026-10-21' }],
    });
  });

  it.each([['abonado'], ['ferias'], ['feriado']] as const)('dia sem batida respondido como %s não desconta', (classificacao) => {
    const respostas: Resposta[] = [{ tipo: 'dia_sem_batida', data: '2026-10-21', classificacao, justificativa: 'Atestado' }];
    expect(diaDeTeste('2026-10-21', [], { respostas })).toMatchObject({ carga: 0, saldo: 0, classificacao, pendencias: [] });
  });

  it('dia futuro não é calculado', () => {
    expect(diaDeTeste('2026-10-26', [])).toMatchObject({ status: 'futuro', carga: 31680, saldo: 0, pendencias: [] });
  });

  it('abono manual de horas soma no trabalhado', () => {
    const ajustes = [{ id: 'a1', data: '2026-10-19', tipo: 'abono_horas' as const, segundos: 7200, justificativa: 'Consulta', ativo: true }];
    expect(diaDeTeste('2026-10-19', ['08:00', '12:00', '13:12', '16:00'], { ajustes })).toMatchObject({ trabalhado: 31680, abonado: 7200, saldo: 0 });
  });
});

describe('calcularDia: intervalos e almoço', () => {
  const EXEMPLO = ['07:56', '07:57', '10:00', '10:50', '12:10', '13:22', '18:21'];

  it('exemplo 6.7 da spec, sem resposta: −25min e pendência de abono', () => {
    const d = diaDeTeste('2026-10-20', EXEMPLO);
    expect(d.trabalhado).toBe(30180);
    expect(d.saldo).toBe(-1500);
    expect(d.intervalos.map((i) => [i.tipo, i.inicio, i.fim])).toEqual([['saida', h('10:00'), h('10:50')], ['almoco', h('12:10'), h('13:22')]]);
    expect(d.pendencias).toEqual([{ tipo: 'abono_intervalo', data: '2026-10-20', inicio: h('10:00'), fim: h('10:50') }]);
  });

  it('exemplo 6.7 com abono: +25min', () => {
    const respostas: Resposta[] = [{ tipo: 'abono_intervalo', data: '2026-10-20', inicio: h('10:00'), fim: h('10:50'), abonado: true, justificativa: 'Dentista' }];
    expect(diaDeTeste('2026-10-20', EXEMPLO, { respostas })).toMatchObject({ trabalhado: 33180, saldo: 1500, abonado: 3000, pendencias: [] });
  });

  it('só 2 batidas num dia longo: desconta 1h12 e pergunta', () => {
    expect(diaDeTeste('2026-10-19', ['08:00', '18:00'])).toMatchObject({
      almocoDescontado: 4320, trabalhado: 31680, saldo: 0,
      pendencias: [{ tipo: 'so_duas_batidas', data: '2026-10-19' }],
    });
  });

  it('só 2 batidas respondido "não almocei": não desconta', () => {
    const respostas: Resposta[] = [{ tipo: 'so_duas_batidas', data: '2026-10-19', almocou: false, justificativa: 'Sem almoço' }];
    expect(diaDeTeste('2026-10-19', ['08:00', '18:00'], { respostas })).toMatchObject({ almocoDescontado: 0, saldo: 4320, pendencias: [] });
  });

  it('2 batidas num dia curto não descontam almoço', () => {
    expect(diaDeTeste('2026-10-19', ['08:00', '12:00'])).toMatchObject({ almocoDescontado: 0, saldo: 14400 - 31680, pendencias: [] });
  });
});
