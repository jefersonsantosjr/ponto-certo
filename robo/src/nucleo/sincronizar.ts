import {
  chaveComprovante, classificarMensagem, conferirIds, lerComprovante, manuaisSubstituidas,
  type IdentidadeEsperada, type MensagemParaClassificar,
} from '../../../motor/src/index';
import type {
  Alerta, BatidaRegistrada, ClassificacaoMensagem, Conferencia, MensagemRegistrada,
} from '../../../motor/src/index';
export type { Alerta };

export const REMETENTE = 'rhid.naoresponda@controlid.com.br';
export const CONSULTA_REMETENTE = `from:${REMETENTE}`;

export interface MensagemLida extends MensagemParaClassificar {
  remetente: string;
  /** 'AAAA-MM-DD HH:MM:SS' local. */
  recebidoEmTexto: string;
}

export interface PortaGmail {
  listarIds(consulta: string): string[];
  ler(id: string): MensagemLida;
}

export interface Registros {
  mensagens: MensagemRegistrada[];
  batidas: BatidaRegistrada[];
}

export type ModoSincronizacao = 'incremental' | 'completa';

export interface ResultadoSincronizacao {
  novasMensagens: MensagemRegistrada[];
  novasBatidas: BatidaRegistrada[];
  /** Batidas já gravadas que mudaram de status (ex.: manual substituída pelo comprovante). */
  batidasAlteradas: BatidaRegistrada[];
  /** Cada alerta vem com a mensagem de origem (para não repetir o mesmo aviso). */
  alertas: Array<{ origem: string; alerta: Alerta }>;
  /** Mensagens que deram erro ao ler; ficam para a próxima rodada. */
  falhas: Array<{ id: string; erro: string }>;
  /** Só na sincronização completa. */
  conferencia: Conferencia | null;
  /** Preenchida quando a identidade ainda não existia e foi aprendida dos comprovantes. */
  identidadeAprendida?: IdentidadeEsperada;
}

/** Identidade mais frequente nos comprovantes (a dona da caixa de e-mail). */
export function aprenderIdentidade(textos: string[]): IdentidadeEsperada | null {
  const conta = (valores: Array<string | undefined>): string | undefined => {
    const contagem = new Map<string, number>();
    for (const v of valores) if (v) contagem.set(v, (contagem.get(v) ?? 0) + 1);
    let melhor: string | undefined;
    for (const [valor, n] of contagem) if (melhor === undefined || n > (contagem.get(melhor) ?? 0)) melhor = valor;
    return melhor;
  };
  const campos = textos.map((t) => lerComprovante(t));
  const cpf = conta(campos.map((c) => c.cpfTrabalhador));
  if (!cpf) return null;
  const doCpf = campos.filter((c) => c.cpfTrabalhador === cpf);
  return {
    cpf,
    nome: conta(doCpf.map((c) => c.nomeTrabalhador)) ?? '',
    cnpj: conta(doCpf.map((c) => c.cnpjEmpregador)) ?? '',
  };
}

export function sincronizar(
  gmail: PortaGmail,
  registros: Registros,
  opcoes: { modo: ModoSincronizacao; agoraTexto: string; identidade: IdentidadeEsperada | null },
): ResultadoSincronizacao {
  const consulta = opcoes.modo === 'completa' ? CONSULTA_REMETENTE : `${CONSULTA_REMETENTE} newer_than:2d`;
  const idsGmail = gmail.listarIds(consulta);
  const conhecidos = new Set(registros.mensagens.map((m) => m.idGmail));

  const falhas: ResultadoSincronizacao['falhas'] = [];
  const lidas: MensagemLida[] = [];
  for (const id of idsGmail) {
    if (conhecidos.has(id)) continue;
    try {
      lidas.push(gmail.ler(id));
    } catch (erro) {
      falhas.push({ id, erro: String(erro) });
    }
  }
  lidas.sort((a, b) => (a.recebidoEmTexto < b.recebidoEmTexto ? -1 : a.recebidoEmTexto > b.recebidoEmTexto ? 1 : 0));

  let identidade = opcoes.identidade;
  let identidadeAprendida: IdentidadeEsperada | undefined;
  if (!identidade) {
    const aprendida = aprenderIdentidade(lidas.map((l) => l.texto));
    if (aprendida) identidade = identidadeAprendida = aprendida;
  }
  // Sem identidade conhecida (nenhum comprovante com CPF ainda), cada mensagem é comparada com ela mesma.
  const esperadaPara = (l: MensagemLida): IdentidadeEsperada => {
    if (identidade) return identidade;
    const c = lerComprovante(l.texto);
    return { cpf: c.cpfTrabalhador ?? '', nome: c.nomeTrabalhador ?? '', cnpj: c.cnpjEmpregador ?? '' };
  };

  const batidaPorChave = new Map<string, string>();
  for (const b of registros.batidas) if (b.nsr && b.hash) batidaPorChave.set(chaveComprovante(b.nsr, b.hash), b.id);

  const novasMensagens: MensagemRegistrada[] = [];
  const novasBatidas: BatidaRegistrada[] = [];
  const alertas: ResultadoSincronizacao['alertas'] = [];
  for (const l of lidas) {
    const r = classificarMensagem(l, esperadaPara(l), new Set(batidaPorChave.keys()));
    const mensagem: MensagemRegistrada = {
      idGmail: l.id, recebidoEm: l.recebidoEmTexto, assunto: l.assunto, remetente: l.remetente, classificacao: r.classificacao,
    };
    if (r.classificacao === 'repetido' && r.chave) mensagem.batidaId = batidaPorChave.get(r.chave);
    if (r.batida) {
      const b = r.batida;
      novasBatidas.push({
        id: l.id, data: b.data, segundos: b.segundos, origem: b.origem, status: b.status, nsr: b.nsr, hash: b.hash,
        hora: b.hora, inpi: b.inpi, cpfConfere: b.cpfConfere, nomeConfere: b.nomeConfere, cnpjConfere: b.cnpjConfere,
        nomeNoComprovante: b.nomeNoComprovante, atraso: b.atraso, recebidoEm: l.recebidoEmTexto, idGmail: l.id,
      });
      mensagem.batidaId = l.id;
      if (r.chave) batidaPorChave.set(r.chave, l.id);
    }
    novasMensagens.push(mensagem);
    for (const alerta of r.alertas) alertas.push({ origem: l.id, alerta });
  }

  const todas = [...registros.batidas, ...novasBatidas];
  const substituidas = new Set(manuaisSubstituidas(todas));
  const batidasAlteradas = registros.batidas
    .filter((b) => substituidas.has(b.id))
    .map((b) => ({ ...b, status: 'substituida' as const }));
  for (const b of novasBatidas) if (substituidas.has(b.id)) b.status = 'substituida';

  let conferencia: Conferencia | null = null;
  if (opcoes.modo === 'completa') {
    const mensagens = [...registros.mensagens, ...novasMensagens];
    const c = conferirIds(idsGmail, mensagens.map((m) => m.idGmail));
    const porClassificacao: Partial<Record<ClassificacaoMensagem, number>> = {};
    for (const m of mensagens) porClassificacao[m.classificacao] = (porClassificacao[m.classificacao] ?? 0) + 1;
    const partes: string[] = [];
    if (c.faltandoNaPlanilha.length) partes.push(`${c.faltandoNaPlanilha.length} e-mail(s) ainda não lido(s)`);
    if (c.ausentesNoGmail.length) partes.push(`${c.ausentesNoGmail.length} registro(s) que não estão mais no Gmail`);
    conferencia = {
      quando: opcoes.agoraTexto, tipo: 'completa', totalGmail: c.totalGmail, totalPlanilha: c.totalPlanilha, ok: c.ok,
      porClassificacao, detalhe: partes.length ? partes.join('; ') : undefined,
    };
    const batidaPorId = new Map(todas.map((b) => [b.id, b]));
    for (const id of c.ausentesNoGmail) {
      const b = batidaPorId.get(id);
      if (b) alertas.push({ origem: id, alerta: { tipo: 'ausente_no_gmail', data: b.data, segundos: b.segundos } });
    }
  }

  return { novasMensagens, novasBatidas, batidasAlteradas, alertas, falhas, conferencia, identidadeAprendida };
}
