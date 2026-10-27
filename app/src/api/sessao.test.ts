import { describe, expect, it } from 'vitest';
import { protegerDados } from './sessao';

const storage = (jaProtegido: boolean, concede: boolean) => {
  const pedidos: string[] = [];
  return {
    pedidos,
    persisted: async () => (pedidos.push('persisted'), jaProtegido),
    persist: async () => (pedidos.push('persist'), concede),
  };
};

describe('protegerDados', () => {
  it('já protegido: não pede de novo', async () => {
    const s = storage(true, false);
    expect(await protegerDados(s)).toBe('protegido');
    expect(s.pedidos).toEqual(['persisted']);
  });

  it('pede a proteção e diz se o navegador concedeu', async () => {
    expect(await protegerDados(storage(false, true))).toBe('protegido');
    expect(await protegerDados(storage(false, false))).toBe('sem_protecao');
  });

  it('navegador sem a função ou que falha: indisponível, sem quebrar o app', async () => {
    expect(await protegerDados(undefined)).toBe('indisponivel');
    expect(await protegerDados({ persisted: async () => Promise.reject(new Error('x')), persist: async () => true })).toBe('indisponivel');
  });
});
