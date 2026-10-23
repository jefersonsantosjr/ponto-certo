import { describe, expect, it } from 'vitest';
import { marcaDaSessao, precisaRegistrar } from './push';
import { situacaoDoAparelho, situacaoDoCartao, type EntradaSituacao } from './situacao';

const base: EntradaSituacao = {
  suportado: true, configurado: true, servidorPronto: true, permissao: 'default', ativoNesteAparelho: false, dispensado: false,
};

describe('situacaoDoCartao (tela Hoje)', () => {
  it('convida a ativar quando tudo está pronto e ainda não foi ativado', () => {
    expect(situacaoDoCartao(base)).toBe('ativar');
    expect(situacaoDoCartao({ ...base, permissao: 'granted' })).toBe('ativar');
  });

  it('mostra como desbloquear quando o navegador bloqueou', () => {
    expect(situacaoDoCartao({ ...base, permissao: 'denied' })).toBe('bloqueado');
  });

  it.each([
    ['já ativo neste aparelho', { ativoNesteAparelho: true }],
    ['dispensado ("agora não")', { dispensado: true }],
    ['navegador sem suporte', { suportado: false }],
    ['app sem dados do Firebase', { configurado: false }],
    ['robô ainda sem a chave', { servidorPronto: false }],
  ] as const)('some quando %s', (_, mudanca) => {
    expect(situacaoDoCartao({ ...base, ...mudanca })).toBe('oculto');
  });
});

describe('situacaoDoAparelho (Configurações)', () => {
  it('reflete a situação deste celular', () => {
    expect(situacaoDoAparelho({ ...base, permissao: 'granted', ativoNesteAparelho: true })).toBe('ativas');
    expect(situacaoDoAparelho({ ...base, permissao: 'granted', ativoNesteAparelho: false })).toBe('desligadas');
    expect(situacaoDoAparelho({ ...base, permissao: 'denied' })).toBe('bloqueadas');
    expect(situacaoDoAparelho({ ...base, suportado: false })).toBe('sem_suporte');
    expect(situacaoDoAparelho({ ...base, configurado: false, suportado: false })).toBe('nao_configuradas');
  });
});

describe('precisaRegistrar', () => {
  const sessao = 'abcdef0123456789-resto-do-token';
  const registro = { fcmToken: 'fcm-1', sessao: marcaDaSessao(sessao), registradoEm: '2026-10-23T12:00:00Z' };

  it('registra na primeira vez, quando o token do FCM muda ou quando entra outra sessão', () => {
    expect(precisaRegistrar(null, 'fcm-1', sessao)).toBe(true);
    expect(precisaRegistrar(registro, 'fcm-2', sessao)).toBe(true);
    expect(precisaRegistrar(registro, 'fcm-1', 'outra-sessao-qualquer-0000')).toBe(true);
  });

  it('não registra de novo se nada mudou', () => {
    expect(precisaRegistrar(registro, 'fcm-1', sessao)).toBe(false);
  });
});
