import { describe, expect, it } from 'vitest';
import { decodificarBase64Url, lerRetornoGoogle, urlDoGoogle, type PedidoGoogle } from './google';

const jwt = (miolo: object): string => `cabeca.${Buffer.from(JSON.stringify(miolo)).toString('base64url')}.assinatura`;
const pedido: PedidoGoogle = { intencao: 'entrar', estado: 'e1', nonce: 'n1', criadoEm: 1_000_000 };
const volta = (campos: Record<string, string>) => `#${new URLSearchParams(campos).toString()}`;

describe('urlDoGoogle', () => {
  it('pede só o ID token (openid), volta para o app e leva state e nonce', () => {
    const url = new URL(urlDoGoogle('cliente.apps.googleusercontent.com', 'https://exemplo.github.io/ponto-certo/', 'e1', 'n1'));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'cliente.apps.googleusercontent.com', redirect_uri: 'https://exemplo.github.io/ponto-certo/', response_type: 'id_token',
      scope: 'openid', nonce: 'n1', state: 'e1', prompt: 'select_account',
    });
  });
});

describe('lerRetornoGoogle', () => {
  it('endereço normal do app não é volta do Google', () => {
    expect(lerRetornoGoogle('#/hoje', pedido, 1_000_100)).toBeNull();
    expect(lerRetornoGoogle('#/ativar?u=x&c=y', pedido, 1_000_100)).toBeNull();
    expect(lerRetornoGoogle('', null, 0)).toBeNull();
  });

  it('volta certa: entrega o token para o robô', () => {
    const credencial = jwt({ sub: '123', nonce: 'n1' });
    expect(lerRetornoGoogle(volta({ state: 'e1', id_token: credencial, authuser: '0' }), pedido, 1_000_100)).toEqual({ intencao: 'entrar', credencial });
  });

  it('recusa state de outro pedido, pedido vencido, nonce trocado e cancelamento', () => {
    const credencial = jwt({ sub: '123', nonce: 'n1' });
    expect(lerRetornoGoogle(volta({ state: 'outro', id_token: credencial }), pedido, 1_000_100)).toMatchObject({ erro: expect.any(String) });
    expect(lerRetornoGoogle(volta({ state: 'e1', id_token: credencial }), null, 1_000_100)).toMatchObject({ intencao: null, erro: expect.any(String) });
    expect(lerRetornoGoogle(volta({ state: 'e1', id_token: credencial }), pedido, 1_000_000 + 11 * 60_000)).toMatchObject({ erro: expect.any(String) });
    expect(lerRetornoGoogle(volta({ state: 'e1', id_token: jwt({ sub: '123', nonce: 'n2' }) }), pedido, 1_000_100)).toMatchObject({ intencao: 'entrar', erro: expect.any(String) });
    expect(lerRetornoGoogle(volta({ state: 'e1', error: 'access_denied' }), pedido, 1_000_100)).toEqual({ intencao: 'entrar', erro: 'Login com o Google cancelado.' });
  });

  it('decodifica base64url com acento', () => {
    const b = Buffer.from('{"nome":"Conceição"}').toString('base64url');
    expect(decodificarBase64Url(b + '='.repeat((4 - (b.length % 4)) % 4))).toBe('{"nome":"Conceição"}');
  });
});
