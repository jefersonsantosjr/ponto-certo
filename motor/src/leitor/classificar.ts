import { formatarHora, segundosEntre } from '../tempo';
import type { Alerta, DataISO, Momento, Segundos } from '../tipos';
import { lerComprovante, type CamposComprovante } from './comprovante';

export type Classificacao = 'comprovante' | 'comprovante_incompleto' | 'provisorio' | 'repetido' | 'outro_tipo';

export interface MensagemParaClassificar {
  id: string;
  assunto: string;
  /** Corpo já convertido em texto (htmlParaTexto ou a parte text/plain). */
  texto: string;
  /** Hora local de chegada do e-mail (internalDate do Gmail). */
  recebidoEm: Momento;
  /** Hora local do cabeçalho Date, quando houver. */
  cabecalhoData?: Momento;
}

export interface IdentidadeEsperada {
  cpf: string;
  nome: string;
  cnpj: string;
}

export interface BatidaLida {
  data: DataISO;
  segundos: Segundos;
  hora: string;
  origem: 'comprovante' | 'provisoria';
  status: 'ativa' | 'fora_da_conta';
  nsr?: string;
  hash?: string;
  inpi?: string;
  cpfConfere: boolean;
  nomeConfere: boolean;
  cnpjConfere: boolean;
  nomeNoComprovante?: string;
  atraso: Segundos;
}

export interface ResultadoClassificacao {
  id: string;
  classificacao: Classificacao;
  campos: CamposComprovante;
  chave?: string;
  batida?: BatidaLida;
  alertas: Alerta[];
}

export const LIMITE_ATRASO: Segundos = 600;
const RE_ASSUNTO_COMPROVANTE = /comprovante\s+de\s+marca[cç][aã]o\s+de\s+ponto/iu;

export function chaveComprovante(nsr: string, hash: string): string {
  return `${nsr}|${hash}`;
}

export function normalizarNome(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

interface ConferenciaIdentidade {
  cpfConfere: boolean;
  nomeConfere: boolean;
  cnpjConfere: boolean;
  nomeNoComprovante?: string;
}

function conferirIdentidade(campos: CamposComprovante, esperada: IdentidadeEsperada): ConferenciaIdentidade {
  const cpfConfere = campos.cpfTrabalhador === undefined || campos.cpfTrabalhador === esperada.cpf.replace(/\D/g, '');
  const nomeConfere = campos.nomeTrabalhador === undefined || normalizarNome(campos.nomeTrabalhador) === normalizarNome(esperada.nome);
  const cnpjConfere = campos.cnpjEmpregador === undefined || campos.cnpjEmpregador === esperada.cnpj.replace(/\D/g, '');
  const resultado: ConferenciaIdentidade = { cpfConfere, nomeConfere, cnpjConfere };
  if ((!cpfConfere || !nomeConfere) && campos.nomeTrabalhador) resultado.nomeNoComprovante = campos.nomeTrabalhador;
  return resultado;
}

function alertasIdentidade(id: ConferenciaIdentidade, m: Momento): Alerta[] {
  const alertas: Alerta[] = [];
  if (!id.cpfConfere) alertas.push({ tipo: 'outra_pessoa', data: m.data, segundos: m.segundos, nome: id.nomeNoComprovante });
  else if (!id.nomeConfere) alertas.push({ tipo: 'nome_diferente', data: m.data, segundos: m.segundos, nome: id.nomeNoComprovante ?? '' });
  if (!id.cnpjConfere) alertas.push({ tipo: 'empresa_diferente', data: m.data, segundos: m.segundos });
  return alertas;
}

export function classificarMensagem(
  msg: MensagemParaClassificar,
  esperada: IdentidadeEsperada,
  chavesExistentes: ReadonlySet<string>,
): ResultadoClassificacao {
  const campos = lerComprovante(msg.texto);
  if (!campos.temTitulo && !RE_ASSUNTO_COMPROVANTE.test(msg.assunto)) {
    return { id: msg.id, classificacao: 'outro_tipo', campos, alertas: [{ tipo: 'outro_tipo', assunto: msg.assunto }] };
  }

  const identidade = conferirIdentidade(campos, esperada);
  const status = identidade.cpfConfere ? 'ativa' : 'fora_da_conta';

  if (!campos.registradoEm) {
    const base = msg.cabecalhoData ?? msg.recebidoEm;
    const batida: BatidaLida = {
      data: base.data, segundos: base.segundos, hora: formatarHora(base.segundos),
      origem: 'provisoria', status, ...identidade, atraso: 0,
    };
    return {
      id: msg.id, classificacao: 'provisorio', campos, batida,
      alertas: [{ tipo: 'provisorio', data: base.data, segundos: base.segundos }, ...alertasIdentidade(identidade, base)],
    };
  }

  const { data, segundos, hora } = campos.registradoEm;
  const chave = campos.nsr && campos.hash ? chaveComprovante(campos.nsr, campos.hash) : undefined;
  if (chave && chavesExistentes.has(chave)) {
    return { id: msg.id, classificacao: 'repetido', campos, chave, alertas: [] };
  }

  const faltando: string[] = [];
  if (!campos.nsr) faltando.push('NSR');
  if (!campos.hash) faltando.push('hash');
  if (!campos.cpfTrabalhador) faltando.push('CPF');

  const atraso = Math.max(0, segundosEntre({ data, segundos }, msg.recebidoEm));
  const batida: BatidaLida = {
    data, segundos, hora, origem: 'comprovante', status,
    nsr: campos.nsr, hash: campos.hash, inpi: campos.inpi, ...identidade, atraso,
  };

  const alertas: Alerta[] = alertasIdentidade(identidade, { data, segundos });
  if (faltando.length > 0) alertas.push({ tipo: 'comprovante_incompleto', data, segundos, faltando });
  if (atraso > LIMITE_ATRASO) alertas.push({ tipo: 'atrasado', data, segundos, atraso });

  return {
    id: msg.id,
    classificacao: faltando.length > 0 ? 'comprovante_incompleto' : 'comprovante',
    campos, chave, batida, alertas,
  };
}
