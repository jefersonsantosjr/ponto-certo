import { describe, expect, it } from 'vitest';
import { conferirCampos, conferirIds, type RegistroComparavel } from '../src/conferencia';

describe('conferirIds', () => {
  it('ok quando os conjuntos são iguais', () => {
    expect(conferirIds(['a', 'b'], ['b', 'a'])).toEqual({ ok: true, totalGmail: 2, totalPlanilha: 2, faltandoNaPlanilha: [], ausentesNoGmail: [] });
  });

  it('aponta e-mails que faltam na planilha e registros que sumiram do Gmail', () => {
    expect(conferirIds(['a', 'b', 'c'], ['a', 'b', 'x'])).toEqual({
      ok: false, totalGmail: 3, totalPlanilha: 3, faltandoNaPlanilha: ['c'], ausentesNoGmail: ['x'],
    });
  });
});

describe('conferirCampos', () => {
  const base: RegistroComparavel = { id: 'm1', data: '2026-10-23', segundos: 28778, nsr: '12345', hash: 'abc', cpfConfere: true };

  it('sem divergência quando tudo bate', () => {
    expect(conferirCampos([base], [{ ...base }])).toEqual([]);
  });

  it('aponta cada campo diferente com o valor do e-mail e o da planilha', () => {
    const gravado = { ...base, segundos: 28740, nsr: '99999' };
    expect(conferirCampos([base], [gravado])).toEqual([
      { id: 'm1', campo: 'hora', esperado: '07:59:38', gravado: '07:59:00' },
      { id: 'm1', campo: 'nsr', esperado: '12345', gravado: '99999' },
    ]);
  });

  it('ignora registros que não estão na planilha (isso é papel do conferirIds)', () => {
    expect(conferirCampos([base], [])).toEqual([]);
  });
});
