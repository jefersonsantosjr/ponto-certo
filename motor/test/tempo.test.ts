import { describe, expect, it } from 'vitest';
import {
  MENOS, arredondarParaMinutoSeguinte, dataBR, dataCurtaBR, dataValida, diaDaSemana, diasEntre,
  formatarDuracao, formatarHora, formatarHoraCurta, formatarHorasPlanilha, formatarSaldo,
  formatarSaldoPlanilha, listarDatas, paraSegundos, segundosEntre, somarDias,
} from '../src/tempo';

describe('horários', () => {
  it('converte HH:MM:SS em segundos e volta', () => {
    expect(paraSegundos('07:59:38')).toBe(28778);
    expect(paraSegundos('8:00')).toBe(28800);
    expect(formatarHora(28778)).toBe('07:59:38');
    expect(formatarHoraCurta(28778)).toBe('07:59');
  });

  it('recusa horário inválido', () => {
    expect(() => paraSegundos('24:00')).toThrow('Horário inválido');
    expect(() => paraSegundos('07:60')).toThrow('Horário inválido');
    expect(() => paraSegundos('7h')).toThrow('Horário inválido');
  });

  it('arredonda para o minuto seguinte só quando há segundos', () => {
    expect(arredondarParaMinutoSeguinte(64778)).toBe(64800);
    expect(arredondarParaMinutoSeguinte(64740)).toBe(64740);
  });
});

describe('durações e saldos', () => {
  it.each([
    [0, '0min'], [45, '45s'], [780, '13min'], [785, '13min05s'], [3605, '1h00min05s'],
    [5220, '1h27'], [5232, '1h27min12s'], [31680, '8h48'], [477480, '132h38'], [-785, '13min05s'],
  ])('formatarDuracao(%i) = %s', (segundos, texto) => {
    expect(formatarDuracao(segundos)).toBe(texto);
  });

  it('formata saldo com sinal', () => {
    expect(formatarSaldo(785)).toBe('+13min05s');
    expect(formatarSaldo(-5232)).toBe(`${MENOS}1h27min12s`);
    expect(formatarSaldo(0)).toBe('0min');
  });

  it('formata para planilha', () => {
    expect(formatarSaldoPlanilha(725)).toBe('+0:12:05');
    expect(formatarSaldoPlanilha(-31680)).toBe(`${MENOS}8:48:00`);
    expect(formatarSaldoPlanilha(0)).toBe('0:00:00');
    expect(formatarHorasPlanilha(477480)).toBe('132:38:00');
  });
});

describe('datas', () => {
  it('dia da semana (0 = domingo)', () => {
    expect(diaDaSemana('2026-10-23')).toBe(5);
    expect(diaDaSemana('2026-10-25')).toBe(0);
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('diferença e lista de datas', () => {
    expect(diasEntre('2026-10-19', '2026-10-23')).toBe(4);
    expect(listarDatas('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(listarDatas('2026-10-02', '2026-10-01')).toEqual([]);
  });

  it('valida datas', () => {
    expect(dataValida('2026-02-29')).toBe(false);
    expect(dataValida('2028-02-29')).toBe(true);
    expect(dataValida('2026-13-01')).toBe(false);
    expect(dataValida('23/10/2026')).toBe(false);
  });

  it('segundos entre dois momentos, atravessando a meia-noite', () => {
    expect(segundosEntre({ data: '2026-10-23', segundos: 28778 }, { data: '2026-10-23', segundos: 39578 })).toBe(10800);
    expect(segundosEntre({ data: '2026-10-22', segundos: 86000 }, { data: '2026-10-23', segundos: 400 })).toBe(800);
  });

  it('formatos brasileiros', () => {
    expect(dataBR('2026-10-23')).toBe('23/10/2026');
    expect(dataCurtaBR('2026-10-23')).toBe('23/10');
  });
});
