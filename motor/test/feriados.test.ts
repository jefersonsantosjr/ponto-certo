import { describe, expect, it } from 'vitest';
import { feriadosNacionais, nomeFeriado, pascoa } from '../src/feriados';

describe('feriados', () => {
  it('calcula o domingo de Páscoa', () => {
    expect(pascoa(2025)).toBe('2025-04-20');
    expect(pascoa(2026)).toBe('2026-04-05');
    expect(pascoa(2027)).toBe('2027-03-28');
  });

  it('lista os 10 feriados nacionais do ano, incluindo a Sexta-feira Santa', () => {
    const f = feriadosNacionais(2026);
    expect(f.size).toBe(10);
    expect(f.get('2026-04-03')).toBe('Sexta-feira Santa');
    expect(f.get('2026-10-12')).toBe('Nossa Senhora Aparecida');
    expect(f.get('2026-11-20')).toBe('Dia Nacional de Zumbi e da Consciência Negra');
    expect(feriadosNacionais(2027).get('2027-03-26')).toBe('Sexta-feira Santa');
  });

  it('aplica feriados locais e exclusões', () => {
    const cfg = { incluir: [{ data: '2026-07-09', nome: 'Revolução Constitucionalista' }], excluir: ['2026-04-03'] };
    expect(nomeFeriado('2026-07-09', cfg)).toBe('Revolução Constitucionalista');
    expect(nomeFeriado('2026-04-03', cfg)).toBeNull();
    expect(nomeFeriado('2026-10-12', cfg)).toBe('Nossa Senhora Aparecida');
    expect(nomeFeriado('2026-10-13', cfg)).toBeNull();
  });
});
