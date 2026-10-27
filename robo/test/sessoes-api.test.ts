import { createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Estado, Papel, Resposta } from '../../motor/src/index';
import { tratarRequisicao, type DependenciasApi } from '../src/nucleo/api';
import { ativar, encerrar, gerarCodigo, resumoSessoes, validarToken, VALIDADE_CODIGO_MS, type Armazem, type Cripto } from '../src/nucleo/sessoes';

function armazemMemoria(): Armazem {
  const dados = new Map<string, string>();
  return { ler: (k) => dados.get(k) ?? null, gravar: (k, v) => void dados.set(k, v) };
}
const cripto: Cripto = {
  hash: (t) => createHash('sha256').update(t).digest('hex'),
  aleatorio: () => randomBytes(32).toString('hex'),
};

describe('sessões', () => {
  it('o código vale uma vez só e vira um token válido', () => {
    const arm = armazemMemoria();
    const codigo = gerarCodigo(arm, cripto, 'dona', 'Maria', 1000);
    const sessao = ativar(arm, cripto, codigo, 'Android', 2000);
    expect(sessao).toMatchObject({ nome: 'Maria', papel: 'dona' });
    expect(ativar(arm, cripto, codigo, 'Android', 3000)).toBeNull();
    expect(validarToken(arm, cripto, sessao?.token ?? '', 4000)).toEqual({ nome: 'Maria', papel: 'dona' });
  });

  it('código vencido não ativa; token encerrado não vale', () => {
    const arm = armazemMemoria();
    const codigo = gerarCodigo(arm, cripto, 'leitura', 'João', 0);
    expect(ativar(arm, cripto, codigo, 'x', VALIDADE_CODIGO_MS + 1)).toBeNull();
    const outro = gerarCodigo(arm, cripto, 'leitura', 'João', 0);
    const sessao = ativar(arm, cripto, outro, 'x', 10);
    encerrar(arm, cripto, sessao?.token ?? '');
    expect(validarToken(arm, cripto, sessao?.token ?? '', 20)).toBeNull();
  });

  it('o armazém guarda só o hash, nunca o token', () => {
    const arm = armazemMemoria();
    const sessao = ativar(arm, cripto, gerarCodigo(arm, cripto, 'dona', 'Maria', 0), 'x', 1);
    expect(arm.ler('SESSOES')).not.toContain(sessao?.token ?? '???');
  });

  it('o resumo das sessões não traz token nem nome', () => {
    const arm = armazemMemoria();
    const sessao = ativar(arm, cripto, gerarCodigo(arm, cripto, 'dona', 'Maria', 0), 'Chrome · Android', 5);
    const resumo = resumoSessoes(arm);
    expect(resumo).toEqual([{ papel: 'dona', aparelho: 'Chrome · Android', criada: 5, usadaEm: 5 }]);
    expect(JSON.stringify(resumo)).not.toContain(sessao?.token ?? '???');
    expect(JSON.stringify(resumo)).not.toContain('Maria');
  });
});

describe('API', () => {
  const estadoFalso = { ok: 'estado' } as unknown as Estado;
  const registrados: string[] = [];
  function deps(papel: Papel | null): DependenciasApi & { gravadas: Resposta[] } {
    const gravadas: Resposta[] = [];
    return {
      gravadas,
      ativar: (codigo) => (codigo === 'bom' ? { token: 't', nome: 'Maria', papel: 'dona' } : null),
      validarToken: (token) => (papel && token === 't' ? { nome: 'Maria', papel } : null),
      encerrar: () => undefined,
      estado: () => estadoFalso,
      sincronizar: () => undefined,
      gravarResposta: (r) => void gravadas.push(r),
      gravarBatidaManual: () => undefined,
      gravarAjuste: () => undefined,
      marcarAlertasLidos: () => undefined,
      registrarDispositivo: (fcmToken) => void registrados.push(fcmToken),
      testarNotificacao: (fcmToken) => ({ enviada: fcmToken === 'x'.repeat(30), detalhe: 'ok' }),
    };
  }
  const resposta: Resposta = { tipo: 'abono_intervalo', data: '2026-10-20', inicio: 36000, fim: 39000, abonado: true, justificativa: 'Dentista' };

  it('ativar com código bom devolve a sessão; ruim devolve erro', () => {
    expect(tratarRequisicao(JSON.stringify({ acao: 'ativar', codigo: 'bom', aparelho: 'x' }), deps(null))).toEqual({ ok: true, dados: { token: 't', nome: 'Maria', papel: 'dona' } });
    expect(tratarRequisicao(JSON.stringify({ acao: 'ativar', codigo: 'ruim', aparelho: 'x' }), deps(null))).toMatchObject({ ok: false, erro: 'codigo_invalido' });
  });

  it('sem sessão válida, nada passa', () => {
    expect(tratarRequisicao(JSON.stringify({ acao: 'estado', token: 'x' }), deps('dona'))).toMatchObject({ ok: false, erro: 'sessao_invalida' });
    expect(tratarRequisicao('isso não é json', deps('dona'))).toMatchObject({ ok: false, erro: 'requisicao_invalida' });
  });

  it('a dona responde com justificativa; sem justificativa é recusado', () => {
    const d = deps('dona');
    expect(tratarRequisicao(JSON.stringify({ acao: 'responder', token: 't', resposta }), d)).toEqual({ ok: true, dados: estadoFalso });
    expect(d.gravadas).toEqual([resposta]);
    const semJustificativa = { ...resposta, justificativa: ' a ' };
    expect(tratarRequisicao(JSON.stringify({ acao: 'responder', token: 't', resposta: semJustificativa }), d)).toMatchObject({ ok: false, erro: 'justificativa_obrigatoria' });
  });

  it('acesso só de leitura não grava nada', () => {
    const d = deps('leitura');
    expect(tratarRequisicao(JSON.stringify({ acao: 'responder', token: 't', resposta }), d)).toMatchObject({ ok: false, erro: 'sem_permissao' });
    expect(tratarRequisicao(JSON.stringify({ acao: 'estado', token: 't' }), d)).toEqual({ ok: true, dados: estadoFalso });
  });

  it('batida manual exige horário válido', () => {
    const corpo = { acao: 'batidaManual', token: 't', data: '2026-10-22', hora: '25:00', justificativa: 'Esqueci de bater' };
    expect(tratarRequisicao(JSON.stringify(corpo), deps('dona'))).toMatchObject({ ok: false, erro: 'hora_invalida' });
  });

  it('registra o aparelho para notificações e testa o envio', () => {
    const fcmToken = 'x'.repeat(30);
    expect(tratarRequisicao(JSON.stringify({ acao: 'registrarDispositivo', token: 't', fcmToken, aparelho: 'Android' }), deps('leitura'))).toEqual({ ok: true, dados: estadoFalso });
    expect(registrados).toContain(fcmToken);
    expect(tratarRequisicao(JSON.stringify({ acao: 'registrarDispositivo', token: 't', fcmToken: 'curto', aparelho: 'x' }), deps('dona'))).toMatchObject({ ok: false, erro: 'token_invalido' });
    expect(tratarRequisicao(JSON.stringify({ acao: 'testarNotificacao', token: 't', fcmToken }), deps('dona'))).toEqual({ ok: true, dados: { enviada: true, detalhe: 'ok' } });
  });
});
