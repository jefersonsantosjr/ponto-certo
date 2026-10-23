// Cliente de demonstração: guarda tudo em memória, sem robô (npm run dev:mock).
import { formatarHora, gerarNotificacao, paraSegundos } from '@ponto-certo/motor';
import type { Estado } from '@ponto-certo/motor';
import { relogioDe } from '../dados/datas';
import { mostrarNotificacaoLocal } from '../notificacoes/push';
import type { ClienteApi } from './cliente';
import { estadoDeExemplo } from './exemplo';
import type { SessaoLocal } from './sessao';

export const SESSAO_DE_EXEMPLO: SessaoLocal = { urlRobo: 'mock', token: 'mock', nome: 'Maria', papel: 'dona' };

const espera = () => new Promise((ok) => setTimeout(ok, 350));

export function clienteDeExemplo(): ClienteApi {
  let estado: Estado = { ...estadoDeExemplo(relogioDe(new Date())), notificacoes: { servidorPronto: true, aparelhos: 0 } };
  let contador = 0;
  const agoraTexto = () => {
    const r = relogioDe(new Date());
    return `${r.hoje}T${formatarHora(r.agora)}`;
  };
  const atualizar = (mudanca: (e: Estado) => Estado): Estado => {
    estado = mudanca(structuredClone(estado));
    estado.saude.ultimaSincronizacao = agoraTexto();
    return structuredClone(estado);
  };

  return {
    estado: async () => {
      await espera();
      return atualizar((e) => e);
    },
    sincronizar: async () => {
      await espera();
      return atualizar((e) => e);
    },
    responder: async (resposta) => {
      await espera();
      contador += 1;
      return atualizar((e) => ({ ...e, respostas: [...e.respostas, { id: `nova-${contador}`, criadaEm: agoraTexto(), autor: 'Maria', resposta }] }));
    },
    batidaManual: async (data, hora, justificativa) => {
      await espera();
      contador += 1;
      const completa = hora.length === 5 ? `${hora}:00` : hora;
      return atualizar((e) => ({
        ...e,
        batidas: [...e.batidas, {
          id: `manual-${contador}`, data, segundos: paraSegundos(completa), origem: 'manual', status: 'ativa', hora: completa,
          cpfConfere: true, nomeConfere: true, cnpjConfere: true, atraso: 0, recebidoEm: '', justificativa,
        }],
      }));
    },
    ajustar: async (ajuste) => {
      await espera();
      contador += 1;
      return atualizar((e) => ({ ...e, ajustes: [...e.ajustes, { ...ajuste, id: `ajuste-${contador}`, ativo: true, criadoEm: agoraTexto(), autor: 'Maria' }] }));
    },
    marcarAlertasLidos: async (ids) => {
      await espera();
      atualizar((e) => ({ ...e, alertas: e.alertas.map((a) => (ids.includes(a.id) ? { ...a, lido: true } : a)) }));
    },
    registrarDispositivo: async () => {
      await espera();
      return atualizar((e) => ({ ...e, notificacoes: { servidorPronto: true, aparelhos: e.notificacoes.aparelhos + 1 } }));
    },
    testarNotificacao: async () => {
      await espera();
      const r = relogioDe(new Date());
      const n = gerarNotificacao({ tipo: 'entrada', segundos: r.agora }, { nome: 'Maria', agora: r.agora });
      await mostrarNotificacaoLocal(n.titulo, n.corpo);
      return { enviada: true, detalhe: 'Demonstração: notificação local, sem robô.' };
    },
    sair: async () => {
      await espera();
    },
  };
}
