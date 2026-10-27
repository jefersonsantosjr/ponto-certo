import { describe, expect, it } from 'vitest';
import { lerDeclaracoes, subValido } from '../src/google';

const decodificar = (b: string): string => Buffer.from(b, 'base64url').toString('utf8');
const jwt = (miolo: object): string => `cabeca.${Buffer.from(JSON.stringify(miolo)).toString('base64url')}.assinatura`;
const CLIENTE = '123-abc.apps.googleusercontent.com';
const AGORA = 1_800_000_000;
const bom = { aud: CLIENTE, iss: 'https://accounts.google.com', exp: AGORA + 600, sub: '1098765432', nonce: 'n1' };

describe('lerDeclaracoes', () => {
  it('lê o miolo do JWT (com acento, sem "=" de preenchimento)', () => {
    expect(lerDeclaracoes(jwt({ ...bom, nome: 'Conceição' }), decodificar)).toMatchObject({ sub: '1098765432', nonce: 'n1', nome: 'Conceição' });
  });

  it('qualquer coisa que não seja um JWT vira null', () => {
    for (const lixo of ['', 'abc', 'a.b', 'a.b.c.d', 'a.!!!.c', `a.${Buffer.from('não é json').toString('base64url')}.c`, `a.${Buffer.from('7').toString('base64url')}.c`]) {
      expect(lerDeclaracoes(lixo, decodificar)).toBeNull();
    }
    expect(lerDeclaracoes(jwt({ grande: 'x'.repeat(5000) }), decodificar)).toBeNull();
  });
});

describe('subValido', () => {
  it('aceita só token do nosso app, emitido pelo Google e dentro da validade', () => {
    expect(subValido(bom, CLIENTE, AGORA)).toBe('1098765432');
    expect(subValido({ ...bom, iss: 'accounts.google.com' }, CLIENTE, AGORA)).toBe('1098765432');
    expect(subValido({ ...bom, exp: String(AGORA + 600) }, CLIENTE, AGORA)).toBe('1098765432');
  });

  it('recusa outro app, outro emissor, vencido, sem sub ou sem cliente configurado', () => {
    expect(subValido({ ...bom, aud: 'outro.apps.googleusercontent.com' }, CLIENTE, AGORA)).toBeNull();
    expect(subValido({ ...bom, iss: 'https://malandro.com' }, CLIENTE, AGORA)).toBeNull();
    expect(subValido({ ...bom, exp: AGORA }, CLIENTE, AGORA)).toBeNull();
    expect(subValido({ ...bom, exp: 'amanhã' }, CLIENTE, AGORA)).toBeNull();
    expect(subValido({ ...bom, sub: '' }, CLIENTE, AGORA)).toBeNull();
    expect(subValido({ ...bom, sub: 42 }, CLIENTE, AGORA)).toBeNull();
    expect(subValido(bom, '', AGORA)).toBeNull();
    expect(subValido(null, CLIENTE, AGORA)).toBeNull();
  });
});
