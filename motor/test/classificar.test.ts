import { describe, expect, it } from 'vitest';
import { classificarMensagem, normalizarNome, type MensagemParaClassificar } from '../src/leitor/classificar';
import { htmlParaTexto } from '../src/leitor/texto';
import { lerFixture } from './ajuda';
import { FALSO } from './fixtures/dados-falsos';

const ESPERADA = { cpf: FALSO.cpf, nome: 'Maria Exemplo da Silva', cnpj: FALSO.cnpj };
const texto = htmlParaTexto(lerFixture('comprovante-modelo.html'));
const NENHUMA = new Set<string>();

function msg(sobrescrever: Partial<MensagemParaClassificar> = {}): MensagemParaClassificar {
  return {
    id: 'm1',
    assunto: 'Comprovante de marcação de ponto IDFace',
    texto,
    recebidoEm: { data: '2026-10-23', segundos: 28790 },
    ...sobrescrever,
  };
}

describe('classificarMensagem', () => {
  it('classifica comprovante completo e confere a identidade', () => {
    const r = classificarMensagem(msg(), ESPERADA, NENHUMA);
    expect(r.classificacao).toBe('comprovante');
    expect(r.chave).toBe(`${FALSO.nsr}|${FALSO.hash}`);
    expect(r.batida).toMatchObject({
      data: '2026-10-23', segundos: 28778, hora: '07:59:38', origem: 'comprovante', status: 'ativa',
      nsr: FALSO.nsr, hash: FALSO.hash, cpfConfere: true, nomeConfere: true, cnpjConfere: true, atraso: 12,
    });
    expect(r.alertas).toEqual([]);
  });

  it('CPF de outra pessoa fica fora da conta e gera alerta', () => {
    const r = classificarMensagem(msg(), { ...ESPERADA, cpf: '98765432199' }, NENHUMA);
    expect(r.batida?.status).toBe('fora_da_conta');
    expect(r.alertas).toEqual([{ tipo: 'outra_pessoa', data: '2026-10-23', segundos: 28778, nome: FALSO.nome }]);
  });

  it('CPF dela com nome diferente: conta e avisa', () => {
    const r = classificarMensagem(msg(), { ...ESPERADA, nome: 'Joana Teste' }, NENHUMA);
    expect(r.batida?.status).toBe('ativa');
    expect(r.alertas).toEqual([{ tipo: 'nome_diferente', data: '2026-10-23', segundos: 28778, nome: FALSO.nome }]);
  });

  it('CNPJ diferente: conta e avisa', () => {
    const r = classificarMensagem(msg(), { ...ESPERADA, cnpj: '22222222000100' }, NENHUMA);
    expect(r.batida?.status).toBe('ativa');
    expect(r.alertas).toEqual([{ tipo: 'empresa_diferente', data: '2026-10-23', segundos: 28778 }]);
  });

  it('comprovante sem hash é incompleto, mas conta', () => {
    const r = classificarMensagem(msg({ texto: texto.replace(/Hash:.*$/m, '') }), ESPERADA, NENHUMA);
    expect(r.classificacao).toBe('comprovante_incompleto');
    expect(r.batida?.status).toBe('ativa');
    expect(r.alertas).toEqual([{ tipo: 'comprovante_incompleto', data: '2026-10-23', segundos: 28778, faltando: ['hash'] }]);
  });

  it('mesmo NSR e hash de um comprovante já registrado é repetido e não vira batida', () => {
    const r = classificarMensagem(msg({ id: 'm2' }), ESPERADA, new Set([`${FALSO.nsr}|${FALSO.hash}`]));
    expect(r.classificacao).toBe('repetido');
    expect(r.batida).toBeUndefined();
    expect(r.alertas).toEqual([]);
  });

  it('corpo ilegível com assunto de comprovante vira batida provisória pelo cabeçalho Date', () => {
    const r = classificarMensagem(
      msg({ texto: 'conteúdo num formato novo', cabecalhoData: { data: '2026-10-23', segundos: 28781 } }),
      ESPERADA,
      NENHUMA,
    );
    expect(r.classificacao).toBe('provisorio');
    expect(r.batida).toMatchObject({ data: '2026-10-23', segundos: 28781, origem: 'provisoria', status: 'ativa' });
    expect(r.alertas).toEqual([{ tipo: 'provisorio', data: '2026-10-23', segundos: 28781 }]);
  });

  it('sem cabeçalho Date, a provisória usa a hora de chegada', () => {
    expect(classificarMensagem(msg({ texto: '???' }), ESPERADA, NENHUMA).batida?.segundos).toBe(28790);
  });

  it('e-mail do RHiD que não é comprovante é "outro tipo" e gera alerta', () => {
    const r = classificarMensagem(msg({ assunto: 'Ajuste de ponto aprovado', texto: 'Seu ajuste foi aprovado.' }), ESPERADA, NENHUMA);
    expect(r.classificacao).toBe('outro_tipo');
    expect(r.alertas).toEqual([{ tipo: 'outro_tipo', assunto: 'Ajuste de ponto aprovado' }]);
  });

  it('marca atraso acima de 10 minutos', () => {
    const r = classificarMensagem(msg({ recebidoEm: { data: '2026-10-23', segundos: 28778 + 10800 } }), ESPERADA, NENHUMA);
    expect(r.batida?.atraso).toBe(10800);
    expect(r.alertas).toEqual([{ tipo: 'atrasado', data: '2026-10-23', segundos: 28778, atraso: 10800 }]);
  });

  it('atraso de exatamente 10 minutos não gera alerta', () => {
    const r = classificarMensagem(msg({ recebidoEm: { data: '2026-10-23', segundos: 28778 + 600 } }), ESPERADA, NENHUMA);
    expect(r.alertas).toEqual([]);
  });
});

describe('normalizarNome', () => {
  it('remove acentos, espaços extras e ignora caixa', () => {
    expect(normalizarNome('  José  da   Conceição ')).toBe('JOSE DA CONCEICAO');
  });
});
