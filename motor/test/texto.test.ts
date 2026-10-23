import { describe, expect, it } from 'vitest';
import { decodificarEntidades, htmlParaTexto, normalizarEspacos, rotuloRegex } from '../src/leitor/texto';

describe('decodificarEntidades', () => {
  it('decodifica entidades nomeadas e numéricas', () => {
    expect(decodificarEntidades('Hor&aacute;rio &amp; Servi&#231;o &#xE3;')).toBe('Horário & Serviço ã');
    expect(decodificarEntidades('a&nbsp;b')).toBe('a b');
  });

  it('mantém entidade desconhecida', () => {
    expect(decodificarEntidades('a &foo; b')).toBe('a &foo; b');
  });
});

describe('normalizarEspacos', () => {
  it('junta espaços, remove linhas vazias e espaços nas pontas', () => {
    expect(normalizarEspacos('  a  b \r\n\r\n\t c  ')).toBe('a b\nc');
  });
});

describe('htmlParaTexto', () => {
  it('converte HTML em linhas de texto, ignorando head, style e comentários', () => {
    const html =
      '<html><head><title>T</title><style>p{color:red}</style></head><body>' +
      '<h2>Dados do Trabalhador</h2><p>Nome: MARIA<br>CPF: 123</p>' +
      '<table><tr><td>Hash:</td><td>abc</td></tr></table><!-- x --></body></html>';
    expect(htmlParaTexto(html)).toBe('Dados do Trabalhador\nNome: MARIA\nCPF: 123\nHash: abc');
  });
});

describe('rotuloRegex', () => {
  it('é tolerante a acento, caixa e espaços (inclusive quebra de linha)', () => {
    const re = new RegExp(rotuloRegex('Data e Horário do Registro'), 'iu');
    expect(re.test('DATA E HORARIO DO REGISTRO')).toBe(true);
    expect(re.test('Data  e\nHorário do Registro')).toBe(true);
    expect(re.test('Data do Registro')).toBe(false);
  });

  it('escapa caracteres especiais', () => {
    expect(new RegExp(rotuloRegex('CPF/CNPJ'), 'iu').test('cpf/cnpj')).toBe(true);
  });
});
