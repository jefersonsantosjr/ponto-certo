import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { htmlParaTexto, type BatidaRegistrada } from '../../motor/src/index';
import { FALSO } from '../../motor/test/fixtures/dados-falsos';
import { aprenderIdentidade, sincronizar, type MensagemLida, type PortaGmail } from '../src/nucleo/sincronizar';

const MODELO = htmlParaTexto(readFileSync(new URL('../../motor/test/fixtures/comprovante-modelo.html', import.meta.url), 'utf8'));
const ASSUNTO = 'Comprovante de marcação de ponto IDFace';

/** Comprovante falso com hora, NSR e hash próprios. */
function comprovante(id: string, data: string, hora: string, nsr: string, extra: Partial<MensagemLida> = {}): MensagemLida {
  const [d, m, a] = [data.slice(8, 10), data.slice(5, 7), data.slice(0, 4)];
  const hash = nsr.padStart(64, 'a');
  const texto = MODELO.replace('23/10/2026 07:59:38', `${d}/${m}/${a} ${hora}`).replace(`NSR: ${FALSO.nsr}`, `NSR: ${nsr}`).replace(FALSO.hash, hash);
  const [hh, mm, ss] = hora.split(':').map(Number);
  const segundos = hh * 3600 + mm * 60 + ss;
  return {
    id, assunto: ASSUNTO, remetente: 'RHiD <rhid.naoresponda@controlid.com.br>', texto,
    recebidoEm: { data, segundos: segundos + 20 }, recebidoEmTexto: `${data} ${hora}`, ...extra,
  };
}

function gmailFalso(mensagens: MensagemLida[], quebradas: string[] = []): PortaGmail & { consultas: string[] } {
  const consultas: string[] = [];
  return {
    consultas,
    listarIds: (consulta) => {
      consultas.push(consulta);
      return mensagens.map((m) => m.id);
    },
    ler: (id) => {
      if (quebradas.includes(id)) throw new Error('Gmail fora do ar');
      const m = mensagens.find((x) => x.id === id);
      if (!m) throw new Error('não existe');
      return m;
    },
  };
}

const VAZIO = { mensagens: [], batidas: [] as BatidaRegistrada[] };
const opcoes = (modo: 'incremental' | 'completa' = 'completa') => ({ modo, agoraTexto: '2026-10-23T18:00:00', identidade: null });

describe('aprenderIdentidade', () => {
  it('pega o CPF, nome e CNPJ mais frequentes', () => {
    expect(aprenderIdentidade([MODELO, MODELO])).toEqual({ cpf: FALSO.cpf, nome: FALSO.nome, cnpj: FALSO.cnpj });
    expect(aprenderIdentidade(['nada aqui'])).toBeNull();
  });
});

describe('sincronizar', () => {
  it('importa comprovantes novos, aprende a identidade e confere 1 a 1 com o Gmail', () => {
    const gmail = gmailFalso([comprovante('m1', '2026-10-22', '08:00:10', '1'), comprovante('m2', '2026-10-22', '12:00:05', '2')]);
    const r = sincronizar(gmail, VAZIO, opcoes());
    expect(r.identidadeAprendida).toEqual({ cpf: FALSO.cpf, nome: FALSO.nome, cnpj: FALSO.cnpj });
    expect(r.novasMensagens.map((m) => [m.idGmail, m.classificacao, m.batidaId])).toEqual([['m1', 'comprovante', 'm1'], ['m2', 'comprovante', 'm2']]);
    expect(r.novasBatidas.map((b) => [b.id, b.data, b.hora, b.segundos, b.status])).toEqual([
      ['m1', '2026-10-22', '08:00:10', 28810, 'ativa'],
      ['m2', '2026-10-22', '12:00:05', 43205, 'ativa'],
    ]);
    expect(r.conferencia).toMatchObject({ ok: true, totalGmail: 2, totalPlanilha: 2, porClassificacao: { comprovante: 2 } });
    expect(gmail.consultas).toEqual(['from:rhid.naoresponda@controlid.com.br']);
  });

  it('a incremental procura só os e-mails recentes e ignora os já registrados', () => {
    const m1 = comprovante('m1', '2026-10-22', '08:00:10', '1');
    const primeira = sincronizar(gmailFalso([m1]), VAZIO, opcoes());
    const gmail = gmailFalso([m1, comprovante('m2', '2026-10-22', '12:00:05', '2')]);
    const r = sincronizar(gmail, { mensagens: primeira.novasMensagens, batidas: primeira.novasBatidas }, { ...opcoes('incremental'), identidade: primeira.identidadeAprendida ?? null });
    expect(gmail.consultas).toEqual(['from:rhid.naoresponda@controlid.com.br newer_than:2d']);
    expect(r.novasMensagens.map((m) => m.idGmail)).toEqual(['m2']);
    expect(r.conferencia).toBeNull();
  });

  it('o mesmo comprovante em dois e-mails conta uma vez só', () => {
    const r = sincronizar(gmailFalso([comprovante('m1', '2026-10-22', '08:00:10', '7'), comprovante('m2', '2026-10-22', '08:00:10', '7', { recebidoEmTexto: '2026-10-22 08:05:00' })]), VAZIO, opcoes());
    expect(r.novasBatidas).toHaveLength(1);
    expect(r.novasMensagens.map((m) => [m.idGmail, m.classificacao, m.batidaId])).toEqual([['m1', 'comprovante', 'm1'], ['m2', 'repetido', 'm1']]);
    expect(r.conferencia).toMatchObject({ ok: true, totalGmail: 2, totalPlanilha: 2, porClassificacao: { comprovante: 1, repetido: 1 } });
  });

  it('e-mail que não é comprovante fica registrado como "outro tipo" e gera alerta', () => {
    const outro: MensagemLida = { ...comprovante('m9', '2026-10-22', '09:00:00', '9'), assunto: 'Senha redefinida', texto: 'Sua senha do RHiD foi redefinida.' };
    const r = sincronizar(gmailFalso([outro]), VAZIO, opcoes());
    expect(r.novasMensagens[0].classificacao).toBe('outro_tipo');
    expect(r.novasBatidas).toEqual([]);
    expect(r.alertas).toEqual([{ origem: 'm9', alerta: { tipo: 'outro_tipo', assunto: 'Senha redefinida' } }]);
  });

  it('erro ao ler um e-mail não perde nada: fica de fora e a conferência acusa', () => {
    const r = sincronizar(gmailFalso([comprovante('m1', '2026-10-22', '08:00:10', '1'), comprovante('m2', '2026-10-22', '12:00:05', '2')], ['m2']), VAZIO, opcoes());
    expect(r.falhas.map((f) => f.id)).toEqual(['m2']);
    expect(r.conferencia).toMatchObject({ ok: false, detalhe: '1 e-mail(s) ainda não lido(s)' });
  });

  it('comprovante a até 30 min de uma batida manual do mesmo dia substitui a manual', () => {
    const manual: BatidaRegistrada = {
      id: 'man-1', data: '2026-10-22', segundos: 64800, origem: 'manual', status: 'ativa', hora: '18:00:00',
      cpfConfere: true, nomeConfere: true, cnpjConfere: true, atraso: 0, recebidoEm: '', justificativa: 'Esqueci de bater',
    };
    const r = sincronizar(gmailFalso([comprovante('m5', '2026-10-22', '18:02:30', '5')]), { mensagens: [], batidas: [manual] }, opcoes());
    expect(r.batidasAlteradas).toEqual([{ ...manual, status: 'substituida' }]);
  });
});
