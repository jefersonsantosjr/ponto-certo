import { describe, expect, it } from 'vitest';
import { partesDoSaldo, quandoCurto, rotuloCurto } from './formatos';

describe('formatos de tela', () => {
  it('rótulo curto em minutos', () => {
    expect([720, -1500, 4800, 0, 25, -5232].map(rotuloCurto)).toEqual(['+12', '−25', '+1h20', '0', '+25s', '−1h27']);
  });

  it('saldo grande dividido em principal e segundos', () => {
    expect(partesDoSaldo(-5232)).toEqual({ principal: '−1h27', resto: '12s' });
    expect(partesDoSaldo(1505)).toEqual({ principal: '+25min', resto: '05s' });
    expect(partesDoSaldo(-5580)).toEqual({ principal: '−1h33', resto: '' });
    expect(partesDoSaldo(0)).toEqual({ principal: '0min', resto: '' });
  });

  it('data e hora curtas', () => {
    expect(quandoCurto('2026-10-23T15:41:07')).toBe('23/10 às 15:41');
  });
});
