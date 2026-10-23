import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { htmlParaTexto, lerComprovante } from '../motor/src/index';
import { FALSO } from '../motor/test/fixtures/dados-falsos';
import { anonimizarHtml, regexTolerante } from './anonimizar';

const modelo = readFileSync(new URL('../motor/test/fixtures/comprovante-modelo.html', import.meta.url), 'utf8');

/** Monta um comprovante "real" de mentira: troca os falsos por outros valores e acrescenta e-mail e pixel de rastreio. */
function htmlReal(): string {
  return modelo
    .replace(FALSO.cpf, '987.654.321-99')
    .replace(FALSO.nome, 'JO&Atilde;O REAL DE TESTE')
    .replace(FALSO.cnpj, '22333444000155')
    .replace(FALSO.empresa, 'EMPRESA REAL S.A.')
    .replace(FALSO.hash, 'f'.repeat(64))
    .replace('</body>', '<img src="https://rastreio.example.org/p.gif?u=abc"><p>Enviado para joao.real@example.org</p></body>');
}

describe('anonimizarHtml', () => {
  it('troca os dados reais pelos falsos e o comprovante continua legível', () => {
    const { html } = anonimizarHtml(htmlReal());
    for (const real of ['98765432199', '987.654.321-99', 'JO&Atilde;O', 'JOÃO REAL', '22333444000155', 'EMPRESA REAL', 'f'.repeat(64), 'joao.real@example.org', 'rastreio.example.org']) {
      expect(html).not.toContain(real);
    }
    expect(lerComprovante(htmlParaTexto(html))).toMatchObject({
      cpfTrabalhador: FALSO.cpf, nomeTrabalhador: FALSO.nome, cnpjEmpregador: FALSO.cnpj,
      nomeEmpregador: FALSO.empresa, hash: FALSO.hash, nsr: FALSO.nsr,
    });
    expect(html).toContain('usuaria@example.com');
  });

  it('mantém o remetente do RHiD', () => {
    const { html } = anonimizarHtml(modelo.replace('</body>', '<p>rhid.naoresponda@controlid.com.br</p></body>'));
    expect(html).toContain('rhid.naoresponda@controlid.com.br');
  });
});

describe('regexTolerante', () => {
  it('casa o valor mesmo quando ele vem com entidades HTML', () => {
    const re = regexTolerante('JOÃO DA SILVA');
    expect('JO&Atilde;O DA&nbsp;SILVA'.replace(re, 'X')).toBe('X');
    expect('JO&#195;O DA SILVA'.replace(re, 'X')).toBe('X');
    expect('João da Silva'.replace(re, 'X')).toBe('X');
  });
});
