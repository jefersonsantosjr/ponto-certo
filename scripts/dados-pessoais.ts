export interface Achado {
  arquivo: string;
  linha: number;
  tipo: 'cpf' | 'email';
  valor: string;
}

const EMAILS_PERMITIDOS = new Set(['rhid.naoresponda@controlid.com.br', 'noreply@anthropic.com']);
const DOMINIOS_PERMITIDOS = /@(example\.(com|org|net)|users\.noreply\.github\.com)$/i;
const RE_CPF = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g;
const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function digitosVerificadores(base9: string): string {
  const dv = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(base9, 10);
  const d2 = dv(base9 + d1, 11);
  return `${d1}${d2}`;
}

export function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  return digitos.slice(9) === digitosVerificadores(digitos.slice(0, 9));
}

export function procurarDadosPessoais(arquivo: string, conteudo: string): Achado[] {
  const achados: Achado[] = [];
  conteudo.split(/\r?\n/).forEach((texto, indice) => {
    for (const m of texto.matchAll(RE_CPF)) {
      if (cpfValido(m[0].replace(/\D/g, ''))) achados.push({ arquivo, linha: indice + 1, tipo: 'cpf', valor: m[0] });
    }
    for (const m of texto.matchAll(RE_EMAIL)) {
      const email = m[0].toLowerCase();
      if (!EMAILS_PERMITIDOS.has(email) && !DOMINIOS_PERMITIDOS.test(email)) {
        achados.push({ arquivo, linha: indice + 1, tipo: 'email', valor: m[0] });
      }
    }
  });
  return achados;
}
