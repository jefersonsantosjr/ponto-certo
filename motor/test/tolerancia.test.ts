import { describe, expect, it } from 'vitest';
import { configPadrao } from '../src/calculo/jornada';
import { MENOS } from '../src/tempo';
import { descreverRegraTolerancia, descreverToleranciaDoDia } from '../src/textos/tolerancia';
import { CONFIG, diaDeTeste } from './ajuda-dia';

describe('descreverRegraTolerancia', () => {
  it('pela soma do dia, com os horários de referência', () => {
    expect(descreverRegraTolerancia(configPadrao('2026-10-19'), '2026-10-26')).toBe('variação de entrada (08:00) e saída (18:00) somando até 10min não conta; passou disso, conta o registrado; o almoço conta exato');
  });

  it('config antiga (total do dia) e desligada', () => {
    const antiga = { ...CONFIG, jornadas: CONFIG.jornadas.map(({ entrada: _e, saida: _s, ...j }) => j) };
    expect(descreverRegraTolerancia(antiga, '2026-10-26')).toBe('±10min no total do dia');
    expect(descreverRegraTolerancia({ ...CONFIG, regras: { ...CONFIG.regras, toleranciaLigada: false } }, '2026-10-26')).toBe('desligada');
  });
});

describe('descreverToleranciaDoDia', () => {
  const regras = CONFIG.regras;

  it('dentro do limite: diz o que não contou e a soma do dia', () => {
    expect(descreverToleranciaDoDia(diaDeTeste('2026-10-19', ['07:56:00', '12:00', '13:12', '18:00']), regras)).toBe('Tolerância da CLT: entrada 07:56:00 (4min antes) não conta (4min no dia, limite 10min)');
    expect(descreverToleranciaDoDia(diaDeTeste('2026-10-19', ['08:03:00', '12:00', '13:12', '17:57:50']), regras)).toBe(
      'Tolerância da CLT: entrada 08:03:00 (3min depois) e saída 17:57:50 (2min10s antes) não contam (5min10s no dia, limite 10min)',
    );
  });

  it('passou do limite: mostra a conta e avisa que vale o registrado', () => {
    expect(descreverToleranciaDoDia(diaDeTeste('2026-10-19', ['07:56:00', '12:00', '13:12', '18:21']), regras)).toBe(
      'Sem tolerância da CLT: entrada 07:56:00 (4min antes) + saída 18:21:00 (21min depois) = 25min no dia, passou de 10min, conta o registrado',
    );
  });

  it('sem tolerância no dia, nada; config antiga, o total zerado', () => {
    expect(descreverToleranciaDoDia(diaDeTeste('2026-10-19', ['08:00', '12:00', '13:12', '18:00']), regras)).toBeNull();
    const antiga = { ...CONFIG, jornadas: CONFIG.jornadas.map(({ entrada: _e, saida: _s, ...j }) => j) };
    expect(descreverToleranciaDoDia(diaDeTeste('2026-10-19', ['08:00', '12:00', '13:12', '17:52'], { config: antiga }), regras)).toBe(`${MENOS}8min zerados pela tolerância da CLT`);
  });
});
