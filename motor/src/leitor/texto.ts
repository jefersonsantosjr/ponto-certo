export const ENTIDADES: Readonly<Record<string, string>> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  copy: '©', reg: '®', ordm: 'º', ordf: 'ª', deg: '°', ndash: '–', mdash: '—', hellip: '…',
  laquo: '«', raquo: '»', middot: '·',
  aacute: 'á', Aacute: 'Á', agrave: 'à', Agrave: 'À', acirc: 'â', Acirc: 'Â', atilde: 'ã', Atilde: 'Ã', auml: 'ä', Auml: 'Ä',
  eacute: 'é', Eacute: 'É', egrave: 'è', Egrave: 'È', ecirc: 'ê', Ecirc: 'Ê', euml: 'ë', Euml: 'Ë',
  iacute: 'í', Iacute: 'Í', igrave: 'ì', Igrave: 'Ì', icirc: 'î', Icirc: 'Î', iuml: 'ï', Iuml: 'Ï',
  oacute: 'ó', Oacute: 'Ó', ograve: 'ò', Ograve: 'Ò', ocirc: 'ô', Ocirc: 'Ô', otilde: 'õ', Otilde: 'Õ', ouml: 'ö', Ouml: 'Ö',
  uacute: 'ú', Uacute: 'Ú', ugrave: 'ù', Ugrave: 'Ù', ucirc: 'û', Ucirc: 'Û', uuml: 'ü', Uuml: 'Ü',
  ccedil: 'ç', Ccedil: 'Ç', ntilde: 'ñ', Ntilde: 'Ñ',
};

export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (inteira, corpo: string) => {
    if (corpo.startsWith('#')) {
      const hexa = corpo[1] === 'x' || corpo[1] === 'X';
      const codigo = hexa ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10);
      return Number.isFinite(codigo) && codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : inteira;
    }
    return ENTIDADES[corpo] ?? inteira;
  });
}

export function normalizarEspacos(texto: string): string {
  return texto
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v   ]+/g, ' ')
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0)
    .join('\n');
}

export function htmlParaTexto(html: string): string {
  const semTags = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|table|section|header|footer)\s*>/gi, '\n')
    .replace(/<(p|div|tr|h[1-6]|li|table)\b[^>]*>/gi, '\n')
    .replace(/<\/t[dh]\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return normalizarEspacos(decodificarEntidades(semTags));
}

const VARIANTES: Readonly<Record<string, string>> = {
  a: 'aáàâãä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôõö', u: 'uúùûü', c: 'cç', n: 'nñ',
};

/** Fonte de regex que casa o rótulo com ou sem acento, em qualquer caixa, com qualquer espaço entre as palavras. Use com flags 'iu'. */
export function rotuloRegex(rotulo: string): string {
  let fonte = '';
  const base = rotulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  for (const ch of base) {
    if (/\s/.test(ch)) {
      if (!fonte.endsWith('\\s+')) fonte += '\\s+';
      continue;
    }
    const variantes = VARIANTES[ch];
    fonte += variantes ? `[${variantes}]` : ch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  }
  return fonte;
}
