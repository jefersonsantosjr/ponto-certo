import { describe, expect, it } from 'vitest';
import { configPadrao } from '../src/calculo/jornada';
import { MENOS } from '../src/tempo';
import { descreverRegraTolerancia, descreverToleranciaDoDia } from '../src/textos/tolerancia';
import { CONFIG, diaDeTeste } from './ajuda-dia';

describe('descreverRegraTolerancia', () => {
  it('por batida, com os horários de referência', () => {
    expect(descreverRegraTolerancia(configPadrao('2026-10-19'), '2026-10-26')).toBe('até 5min na entrada (08:00) e na saída (18:00); passou disso, conta tudo; o almoço conta exato');
  });

  it('config antiga (total do dia) e desligada', () => {
    const antiga = { ...CONFIG, jornadas: CONFIG.jornadas.map(({ entrada: _e, saida: _s, ...j }) => j) };
    expect(descreverRegraTolerancia(antiga, '2026-10-26')).toBe('±10min no total do dia');
    expect(descreverRegraTolerancia({ ...CONFIG, regras: { ...CONFIG.regras, toleranciaLigada: false } }, '2026-10-26')).toBe('desligada');
  });
});

describe('descreverToleranciaDoDia', () => {
  it('nomeia cada batida que a tolerância segurou', () => {
    expect(descreverToleranciaDoDia(diaDeTeste('2026-10-19', ['07:56:00', '12:00', '13:12', '18:21']))).toBe('Tolerância da CLT: entrada 07:56:00 (4min antes) não conta');
    expect(descreverToleranciaDoDia(diaDeTeste('2026-10-19', ['08:03:00', '12:00', '13:12', '17:57:50']))).toBe(
      'Tolerância da CLT: entrada 08:03:00 (3min depois) e saída 17:57:50 (2min10s antes) não contam',
    );
  });

  it('sem tolerância no dia, nada; config antiga, o total zerado', () => {
    expect(descreverToleranciaDoDia(diaDeTeste('2026-10-19', ['08:00', '12:00', '13:12', '18:00']))).toBeNull();
    const antiga = { ...CONFIG, jornadas: CONFIG.jornadas.map(({ entrada: _e, saida: _s, ...j }) => j) };
    expect(descreverToleranciaDoDia(diaDeTeste('2026-10-19', ['08:00', '12:00', '13:12', '17:52'], { config: antiga }))).toBe(`${MENOS}8min zerados pela tolerância da CLT`);
  });
});
