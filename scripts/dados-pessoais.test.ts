import { describe, expect, it } from 'vitest';
import { cpfValido, digitosVerificadores, procurarDadosPessoais } from './dados-pessoais';

// Monta um CPF válido em tempo de execução, para que o próprio arquivo de teste não contenha um.
const BASE = '987654321';
const CPF_VALIDO = BASE + digitosVerificadores(BASE);

describe('cpfValido', () => {
  it('calcula os dígitos verificadores', () => {
    expect(digitosVerificadores(BASE)).toBe('00');
  });

  it('aceita CPF com dígitos corretos e recusa os demais', () => {
    expect(cpfValido(CPF_VALIDO)).toBe(true);
    expect(cpfValido('12345678900')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });
});

describe('procurarDadosPessoais', () => {
  it('acha CPF válido com e sem pontuação, informando a linha', () => {
    const formatado = `${CPF_VALIDO.slice(0, 3)}.${CPF_VALIDO.slice(3, 6)}.${CPF_VALIDO.slice(6, 9)}-${CPF_VALIDO.slice(9)}`;
    const achados = procurarDadosPessoais('x.ts', `a: ${formatado}\nb: ${CPF_VALIDO}`);
    expect(achados.map((a) => [a.linha, a.tipo])).toEqual([[1, 'cpf'], [2, 'cpf']]);
  });

  it('ignora o CPF falso das fixtures, CNPJ e números curtos', () => {
    expect(procurarDadosPessoais('x.ts', 'cpf 12345678900 cnpj 11111111000100 nsr 85747')).toEqual([]);
  });

  it('acha e-mail fora da lista permitida', () => {
    // Montado em tempo de execução para que o próprio arquivo não contenha um e-mail (o hook bloquearia o commit).
    const email = ['fulana', 'gmail.com'].join('@');
    expect(procurarDadosPessoais('x.ts', `contato: ${email}`)).toEqual([
      { arquivo: 'x.ts', linha: 1, tipo: 'email', valor: email },
    ]);
  });

  it('permite o remetente do RHiD, domínios de exemplo e o noreply do GitHub', () => {
    const texto = 'rhid.naoresponda@controlid.com.br usuaria@example.com a@example.org 1+a@users.noreply.github.com noreply@anthropic.com';
    expect(procurarDadosPessoais('x.ts', texto)).toEqual([]);
  });
});
