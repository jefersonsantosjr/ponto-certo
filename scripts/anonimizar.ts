import { ENTIDADES, htmlParaTexto, lerComprovante } from '../motor/src/index';
import { FALSO } from '../motor/test/fixtures/dados-falsos';

const REMETENTE_RHID = 'rhid.naoresponda@controlid.com.br';
const REVERSO = new Map(Object.entries(ENTIDADES).map(([nome, caractere]) => [caractere, nome]));

const formatarCpf = (d: string): string => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
const formatarCnpj = (d: string): string => `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;

/** Regex que casa o valor com ou sem entidades HTML no lugar dos acentos e dos espaços. */
export function regexTolerante(valor: string): RegExp {
  let fonte = '';
  for (const ch of valor) {
    if (/\s/.test(ch)) {
      fonte += '(?:\\s|&nbsp;|&#160;)+';
      continue;
    }
    const escapado = ch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    if (/[\x20-\x7e]/.test(ch)) {
      fonte += escapado;
      continue;
    }
    const codigo = ch.codePointAt(0) ?? 0;
    const alternativas = [escapado, `&#${codigo};`, `&#x${codigo.toString(16)};`];
    const nome = REVERSO.get(ch);
    if (nome) alternativas.push(`&${nome};`);
    fonte += `(?:${alternativas.join('|')})`;
  }
  return new RegExp(fonte, 'giu');
}

export interface ResultadoAnonimizacao {
  html: string;
  substituicoes: number;
  camposEncontrados: string[];
}

export function anonimizarHtml(html: string): ResultadoAnonimizacao {
  const campos = lerComprovante(htmlParaTexto(html));
  const trocas: Array<[string, string]> = [];
  if (campos.cpfTrabalhador) {
    trocas.push([formatarCpf(campos.cpfTrabalhador), formatarCpf(FALSO.cpf)], [campos.cpfTrabalhador, FALSO.cpf]);
  }
  if (campos.nomeTrabalhador) trocas.push([campos.nomeTrabalhador, FALSO.nome]);
  if (campos.cnpjEmpregador?.length === 14) {
    trocas.push([formatarCnpj(campos.cnpjEmpregador), formatarCnpj(FALSO.cnpj)], [campos.cnpjEmpregador, FALSO.cnpj]);
  }
  if (campos.nomeEmpregador) trocas.push([campos.nomeEmpregador, FALSO.empresa]);
  if (campos.hash) trocas.push([campos.hash, FALSO.hash]);
  // Valores que já são os falsos (arquivo já anonimizado) não precisam de troca nem de verificação.
  const efetivas = trocas.filter(([real, falso]) => real.toLowerCase() !== falso.toLowerCase());

  let saida = html;
  let substituicoes = 0;
  for (const [real, falso] of efetivas) {
    saida = saida.replace(regexTolerante(real), () => {
      substituicoes += 1;
      return falso;
    });
  }
  saida = saida
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/\shref\s*=\s*("[^"]*"|'[^']*')/gi, ' href="#"')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (email) =>
      email.toLowerCase() === REMETENTE_RHID ? email : 'usuaria@example.com',
    );

  const reais = efetivas.map(([real]) => real.toLowerCase());
  const texto = htmlParaTexto(saida).toLowerCase();
  const sobrou = reais.filter((real) => texto.includes(real) || saida.toLowerCase().includes(real));
  if (sobrou.length > 0) {
    throw new Error(`Anonimização incompleta: ${sobrou.length} dado(s) real(is) ainda aparecem. Revise o arquivo à mão.`);
  }
  return { html: saida, substituicoes, camposEncontrados: Object.keys(campos).filter((k) => k !== 'temTitulo') };
}
