import { criarData, dataValida } from '../tempo';
import type { DataISO, Segundos } from '../tipos';
import { rotuloRegex } from './texto';

export interface RegistroLido {
  data: DataISO;
  /** HH:MM:SS (segundos = 00 quando o comprovante não traz). */
  hora: string;
  segundos: Segundos;
}

export interface CamposComprovante {
  temTitulo: boolean;
  nsr?: string;
  registradoEm?: RegistroLido;
  nomeEmpregador?: string;
  cnpjEmpregador?: string;
  nomeTrabalhador?: string;
  cpfTrabalhador?: string;
  inpi?: string;
  hash?: string;
}

const re = (rotulo: string, resto = ''): RegExp => new RegExp(rotuloRegex(rotulo) + resto, 'iu');

const RE_TITULO = re('Comprovante de Registro de Ponto do Trabalhador');
const RE_NSR = re('NSR', '\\s*:?\\s*(\\d+)');
const RE_ROTULO_DATA = re('Data e Horário do Registro');
const RE_DATA_HORA = re('Data e Horário do Registro', '\\s*:?\\s*(\\d{2})\\/(\\d{2})\\/(\\d{4})\\s+(\\d{2}):(\\d{2})(?::(\\d{2}))?');
const RE_BLOCO_EMPREGADOR = re('Dados do Empregador');
const RE_BLOCO_TRABALHADOR = re('Dados do Trabalhador');
const RE_LOCAL = re('Local de Prestação de Serviço');
const RE_NOME = re('Nome', '[ \\t]*:[ \\t]*([^\\n]+)');
const RE_CPF = re('CPF', '[ \\t]*:\\s*([\\d.\\- ]{11,20})');
const RE_CPF_CNPJ = re('CPF/CNPJ', '[ \\t]*:\\s*([\\d.\\/\\- ]{11,25})');
const RE_INPI = re('Registro no INPI', '\\s*:\\s*([A-Za-z0-9]+)');
const RE_HASH = re('Hash', '\\s*:\\s*([0-9a-fA-F]{64})(?![0-9a-fA-F])');

const soDigitos = (texto: string): string => texto.replace(/\D/g, '');
const limparNome = (texto: string): string => texto.replace(/\s+/g, ' ').trim();

/** Trecho do texto depois de `inicio` e antes do primeiro dos `fins` que aparecer. */
function trecho(texto: string, inicio: RegExp, fins: RegExp[]): string | undefined {
  const mi = inicio.exec(texto);
  if (!mi) return undefined;
  const resto = texto.slice(mi.index + mi[0].length);
  let corte = resto.length;
  for (const fim of fins) {
    const mf = fim.exec(resto);
    if (mf && mf.index < corte) corte = mf.index;
  }
  return resto.slice(0, corte);
}

export function lerComprovante(texto: string): CamposComprovante {
  const campos: CamposComprovante = { temTitulo: RE_TITULO.test(texto) };

  const nsr = RE_NSR.exec(texto);
  if (nsr) campos.nsr = nsr[1];

  const dh = RE_DATA_HORA.exec(texto);
  if (dh) {
    const [, dia, mes, ano, hh, mm, ss = '00'] = dh;
    const data = criarData(Number(ano), Number(mes), Number(dia));
    const h = Number(hh);
    const m = Number(mm);
    const s = Number(ss);
    if (dataValida(data) && h <= 23 && m <= 59 && s <= 59) {
      campos.registradoEm = { data, hora: `${hh}:${mm}:${ss}`, segundos: h * 3600 + m * 60 + s };
    }
  }

  const empregador = trecho(texto, RE_BLOCO_EMPREGADOR, [RE_LOCAL, RE_BLOCO_TRABALHADOR, RE_ROTULO_DATA]);
  if (empregador) {
    const nome = RE_NOME.exec(empregador);
    if (nome) campos.nomeEmpregador = limparNome(nome[1]);
    const documento = RE_CPF_CNPJ.exec(empregador);
    if (documento) {
      const digitos = soDigitos(documento[1]);
      if (digitos.length === 14 || digitos.length === 11) campos.cnpjEmpregador = digitos;
    }
  }

  const trabalhador = trecho(texto, RE_BLOCO_TRABALHADOR, [RE_ROTULO_DATA, RE_BLOCO_EMPREGADOR]);
  if (trabalhador) {
    const nome = RE_NOME.exec(trabalhador);
    if (nome) campos.nomeTrabalhador = limparNome(nome[1]);
    const cpf = RE_CPF.exec(trabalhador);
    if (cpf) {
      const digitos = soDigitos(cpf[1]);
      if (digitos.length === 11) campos.cpfTrabalhador = digitos;
    }
  }

  const inpi = RE_INPI.exec(texto);
  if (inpi) campos.inpi = inpi[1];

  const hash = RE_HASH.exec(texto);
  if (hash) campos.hash = hash[1].toLowerCase();

  return campos;
}
