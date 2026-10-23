import { dataValida, formatarHora, justificativaValida, paraSegundos } from '../../../motor/src/index';
import type { Ajuste, Estado, Papel, Requisicao, Resposta, RespostaApi, Sessao } from '../../../motor/src/index';

/** O que a API precisa do resto do robô (no Apps Script: planilha, propriedades, Gmail). */
export interface DependenciasApi {
  ativar(codigo: string, aparelho: string): Sessao | null;
  validarToken(token: string): { nome: string; papel: Papel } | null;
  encerrar(token: string): void;
  estado(usuario: { nome: string; papel: Papel }): Estado;
  sincronizar(): void;
  gravarResposta(resposta: Resposta, autor: string): void;
  gravarBatidaManual(dados: { data: string; segundos: number; hora: string; justificativa: string }, autor: string): void;
  gravarAjuste(ajuste: Pick<Ajuste, 'data' | 'tipo' | 'segundos' | 'justificativa'>, autor: string): void;
  marcarAlertasLidos(ids: string[]): void;
  registrarDispositivo(fcmToken: string, aparelho: string, usuario: { nome: string; papel: Papel }): void;
  testarNotificacao(fcmToken: string, usuario: { nome: string; papel: Papel }): { enviada: boolean; detalhe: string };
}

const erro = (codigo: string, mensagem: string): RespostaApi<never> => ({ ok: false, erro: codigo, mensagem });

export function tratarRequisicao(corpo: string, d: DependenciasApi): RespostaApi<unknown> {
  let req: Requisicao;
  try {
    req = JSON.parse(corpo) as Requisicao;
  } catch {
    return erro('requisicao_invalida', 'Não entendi o pedido.');
  }
  if (!req || typeof req !== 'object' || typeof (req as { acao?: unknown }).acao !== 'string') {
    return erro('requisicao_invalida', 'Não entendi o pedido.');
  }

  if (req.acao === 'ativar') {
    const sessao = d.ativar(String(req.codigo ?? ''), String(req.aparelho ?? ''));
    return sessao ? { ok: true, dados: sessao } : erro('codigo_invalido', 'Este link de ativação não vale mais. Peça um novo.');
  }

  const usuario = d.validarToken(String((req as { token?: unknown }).token ?? ''));
  if (!usuario) return erro('sessao_invalida', 'Sua sessão expirou. Abra um novo link de ativação.');

  const exigirDona = (): RespostaApi<never> | null =>
    usuario.papel === 'dona' ? null : erro('sem_permissao', 'Este acesso é só de leitura.');

  switch (req.acao) {
    case 'estado':
      return { ok: true, dados: d.estado(usuario) };
    case 'sincronizar':
      d.sincronizar();
      return { ok: true, dados: d.estado(usuario) };
    case 'responder': {
      const bloqueio = exigirDona();
      if (bloqueio) return bloqueio;
      if (!req.resposta || !justificativaValida(String(req.resposta.justificativa ?? ''))) {
        return erro('justificativa_obrigatoria', 'Escreva uma justificativa (pelo menos 3 letras).');
      }
      d.gravarResposta(req.resposta, usuario.nome);
      return { ok: true, dados: d.estado(usuario) };
    }
    case 'batidaManual': {
      const bloqueio = exigirDona();
      if (bloqueio) return bloqueio;
      if (!justificativaValida(String(req.justificativa ?? ''))) {
        return erro('justificativa_obrigatoria', 'Escreva uma justificativa (pelo menos 3 letras).');
      }
      if (!dataValida(String(req.data ?? ''))) return erro('data_invalida', 'Data inválida.');
      let segundos: number;
      try {
        segundos = paraSegundos(String(req.hora ?? ''));
      } catch {
        return erro('hora_invalida', 'Horário inválido. Use HH:MM ou HH:MM:SS.');
      }
      d.gravarBatidaManual({ data: req.data, segundos, hora: formatarHora(segundos), justificativa: req.justificativa.trim() }, usuario.nome);
      return { ok: true, dados: d.estado(usuario) };
    }
    case 'ajustar': {
      const bloqueio = exigirDona();
      if (bloqueio) return bloqueio;
      const a = req.ajuste;
      if (!a || !justificativaValida(String(a.justificativa ?? ''))) {
        return erro('justificativa_obrigatoria', 'Escreva uma justificativa (pelo menos 3 letras).');
      }
      if (!dataValida(String(a.data ?? '')) || !Number.isInteger(a.segundos) || (a.tipo !== 'abono_horas' && a.tipo !== 'ajuste_banco')) {
        return erro('ajuste_invalido', 'Ajuste inválido.');
      }
      d.gravarAjuste({ data: a.data, tipo: a.tipo, segundos: a.segundos, justificativa: a.justificativa.trim() }, usuario.nome);
      return { ok: true, dados: d.estado(usuario) };
    }
    case 'marcarAlertasLidos':
      d.marcarAlertasLidos(Array.isArray(req.ids) ? req.ids.map(String) : []);
      return { ok: true, dados: d.estado(usuario) };
    case 'registrarDispositivo': {
      const fcmToken = String(req.fcmToken ?? '');
      if (fcmToken.length < 20 || fcmToken.length > 4096) return erro('token_invalido', 'Não consegui registrar este aparelho.');
      d.registrarDispositivo(fcmToken, String(req.aparelho ?? '').slice(0, 120), usuario);
      return { ok: true, dados: d.estado(usuario) };
    }
    case 'testarNotificacao': {
      const fcmToken = String(req.fcmToken ?? '');
      if (!fcmToken) return erro('token_invalido', 'Este aparelho ainda não ativou as notificações.');
      return { ok: true, dados: d.testarNotificacao(fcmToken, usuario) };
    }
    case 'sair':
      d.encerrar(req.token);
      return { ok: true, dados: null };
    default:
      return erro('acao_desconhecida', 'Ação desconhecida.');
  }
}
