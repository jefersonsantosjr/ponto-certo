import { describe, expect, it } from 'vitest';
import { lerComprovante } from '../src/leitor/comprovante';
import { htmlParaTexto } from '../src/leitor/texto';
import { lerFixture } from './ajuda';
import { FALSO } from './fixtures/dados-falsos';

const texto = htmlParaTexto(lerFixture('comprovante-modelo.html'));

describe('lerComprovante', () => {
  it('lê todos os campos do comprovante-modelo', () => {
    expect(lerComprovante(texto)).toEqual({
      temTitulo: true,
      nsr: FALSO.nsr,
      registradoEm: { data: '2026-10-23', hora: '07:59:38', segundos: 28778 },
      nomeEmpregador: FALSO.empresa,
      cnpjEmpregador: FALSO.cnpj,
      nomeTrabalhador: FALSO.nome,
      cpfTrabalhador: FALSO.cpf,
      inpi: FALSO.inpi,
      hash: FALSO.hash,
    });
  });

  it('aceita rótulos sem acento, em maiúsculas e com espaços extras', () => {
    const variado = texto
      .replace('Data e Horário do Registro:', 'DATA  E HORARIO DO REGISTRO :')
      .replace('Dados do Trabalhador', 'DADOS DO TRABALHADOR');
    const campos = lerComprovante(variado);
    expect(campos.registradoEm?.segundos).toBe(28778);
    expect(campos.cpfTrabalhador).toBe(FALSO.cpf);
  });

  it('aceita horário sem segundos (conta como :00)', () => {
    expect(lerComprovante(texto.replace('07:59:38', '07:59')).registradoEm).toEqual({
      data: '2026-10-23', hora: '07:59:00', segundos: 28740,
    });
  });

  it('aceita layout em células de tabela, CPF com pontuação e hash em maiúsculas', () => {
    const html =
      '<table><tr><td>Comprovante de Registro de Ponto do Trabalhador</td></tr>' +
      '<tr><td>NSR:</td><td>777</td></tr>' +
      '<tr><td><b>Dados do Trabalhador</b></td></tr>' +
      '<tr><td>Nome:</td><td>MARIA EXEMPLO DA SILVA</td></tr>' +
      '<tr><td>CPF:</td><td>123.456.789-00</td></tr>' +
      '<tr><td>Data e Hor&aacute;rio do Registro:</td><td>01/11/2026 18:02:05</td></tr>' +
      `<tr><td>Hash:</td><td>${FALSO.hash.toUpperCase()}</td></tr></table>`;
    const campos = lerComprovante(htmlParaTexto(html));
    expect(campos.nsr).toBe('777');
    expect(campos.cpfTrabalhador).toBe(FALSO.cpf);
    expect(campos.registradoEm?.hora).toBe('18:02:05');
    expect(campos.hash).toBe(FALSO.hash);
  });

  it('não inventa campos ausentes', () => {
    const campos = lerComprovante(texto.replace(/Hash:.*$/m, '').replace('NSR: 12345', ''));
    expect(campos.hash).toBeUndefined();
    expect(campos.nsr).toBeUndefined();
    expect(campos.registradoEm).toBeDefined();
  });

  it('recusa data impossível', () => {
    expect(lerComprovante(texto.replace('23/10/2026', '31/02/2026')).registradoEm).toBeUndefined();
  });

  it('identifica texto que não é comprovante', () => {
    expect(lerComprovante('Sua senha foi redefinida.').temTitulo).toBe(false);
  });
});
