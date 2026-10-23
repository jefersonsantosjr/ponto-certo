import type { DataISO, Estado, Pendencia, Resposta } from '@ponto-certo/motor';
import { createContext } from 'preact';
import type { ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ERROS_DE_SESSAO, ErroApi, ativar as ativarNoRobo, clienteReal, descreverAparelho, type ClienteApi, type NovoAjuste } from '../api/cliente';
import { SESSAO_DE_EXEMPLO, clienteDeExemplo } from '../api/mock';
import { apagarTudo, lerEstadoEmCache, lerSessao, salvarEstadoEmCache, salvarSessao, type SessaoLocal } from '../api/sessao';
import { calcular, type Calculo } from '../dados/calculo';
import { relogioDe, type Relogio } from '../dados/datas';

export const MODO_EXEMPLO = import.meta.env.MODE === 'mock';

export type FolhaAberta =
  | { tipo: 'pendencia'; pendencia: Pendencia; preferencia?: 'sim' | 'nao' }
  | { tipo: 'batida'; batidaId: string }
  | { tipo: 'abono'; data: DataISO }
  | { tipo: 'batidaManual'; data: DataISO };

export interface ContextoApp {
  sessao: SessaoLocal | null;
  estado: Estado | null;
  calculo: Calculo | null;
  relogio: Relogio;
  carregando: boolean;
  /** Mostrando dados salvos porque o robô não respondeu. */
  semConexao: boolean;
  /** Quando os dados em tela foram recebidos do robô (ISO do aparelho). */
  recebidoEm: string | null;
  erro: string | null;
  podeEscrever: boolean;
  folha: FolhaAberta | null;
  abrirFolha(folha: FolhaAberta): void;
  fecharFolha(): void;
  ativar(urlRobo: string, codigo: string): Promise<void>;
  atualizar(sincronizar?: boolean): Promise<void>;
  responder(resposta: Resposta): Promise<void>;
  batidaManual(data: DataISO, hora: string, justificativa: string): Promise<void>;
  ajustar(ajuste: NovoAjuste): Promise<void>;
  marcarAlertasLidos(ids: string[]): Promise<void>;
  sair(): Promise<void>;
  limparErro(): void;
}

const Contexto = createContext<ContextoApp | null>(null);

export function useApp(): ContextoApp {
  const valor = useContext(Contexto);
  if (!valor) throw new Error('useApp fora do ProvedorApp');
  return valor;
}

const INTERVALO_ATUALIZACAO = 60_000;
const INTERVALO_RELOGIO = 15_000;

export function ProvedorApp({ children }: { children: ComponentChildren }) {
  const [sessao, setSessao] = useState<SessaoLocal | null>(() => (MODO_EXEMPLO ? SESSAO_DE_EXEMPLO : lerSessao()));
  const emCache = useMemo(() => (MODO_EXEMPLO ? null : lerEstadoEmCache()), []);
  const [estado, setEstado] = useState<Estado | null>(emCache?.estado ?? null);
  const [recebidoEm, setRecebidoEm] = useState<string | null>(emCache?.salvoEm ?? null);
  const [relogio, setRelogio] = useState<Relogio>(() => relogioDe(new Date()));
  const [carregando, setCarregando] = useState(false);
  const [semConexao, setSemConexao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [folha, setFolha] = useState<FolhaAberta | null>(null);
  const exemplo = useRef<ClienteApi | null>(null);

  const cliente = useMemo<ClienteApi | null>(() => {
    if (!sessao) return null;
    if (MODO_EXEMPLO) return (exemplo.current ??= clienteDeExemplo());
    return clienteReal(sessao);
  }, [sessao]);

  const receber = useCallback((novo: Estado) => {
    setEstado(novo);
    setRecebidoEm(new Date().toISOString());
    setSemConexao(false);
    if (!MODO_EXEMPLO) salvarEstadoEmCache(novo);
  }, []);

  const tratarErro = useCallback((e: unknown) => {
    if (e instanceof ErroApi) {
      if (ERROS_DE_SESSAO.has(e.codigo)) {
        apagarTudo();
        setSessao(null);
        setEstado(null);
        setErro('Seu acesso expirou. Peça um novo link de ativação.');
        return;
      }
      if (e.codigo === 'sem_conexao') {
        setSemConexao(true);
        return;
      }
      setErro(e.message);
      return;
    }
    setErro('Algo deu errado. Tente de novo em instantes.');
  }, []);

  const atualizar = useCallback(async (sincronizar = false) => {
    if (!cliente) return;
    setCarregando(true);
    try {
      receber(await (sincronizar ? cliente.sincronizar() : cliente.estado()));
    } catch (e) {
      tratarErro(e);
    } finally {
      setCarregando(false);
    }
  }, [cliente, receber, tratarErro]);

  // Ao abrir: pede ao robô para sincronizar na hora (spec §3). Depois, atualiza a cada minuto.
  useEffect(() => {
    if (!cliente) return;
    void atualizar(true);
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void atualizar(false);
    }, INTERVALO_ATUALIZACAO);
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void atualizar(true);
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [cliente, atualizar]);

  useEffect(() => {
    const id = setInterval(() => setRelogio(relogioDe(new Date())), INTERVALO_RELOGIO);
    return () => clearInterval(id);
  }, []);

  const calculo = useMemo(() => (estado ? calcular(estado, relogio) : null), [estado, relogio]);

  const escrever = useCallback(
    async (acao: (c: ClienteApi) => Promise<Estado>) => {
      if (!cliente) return;
      setCarregando(true);
      try {
        receber(await acao(cliente));
      } catch (e) {
        tratarErro(e);
        throw e;
      } finally {
        setCarregando(false);
      }
    },
    [cliente, receber, tratarErro],
  );

  const valor: ContextoApp = {
    sessao,
    estado,
    calculo,
    relogio,
    carregando,
    semConexao,
    recebidoEm,
    erro,
    podeEscrever: sessao?.papel === 'dona' && !semConexao,
    folha,
    abrirFolha: setFolha,
    fecharFolha: () => setFolha(null),
    ativar: async (urlRobo, codigo) => {
      setCarregando(true);
      setErro(null);
      try {
        const nova = await ativarNoRobo(urlRobo, codigo, descreverAparelho(navigator.userAgent));
        const local: SessaoLocal = { urlRobo, token: nova.token, nome: nova.nome, papel: nova.papel };
        salvarSessao(local);
        setSessao(local);
      } catch (e) {
        setErro(e instanceof ErroApi ? e.message : 'Não deu pra ativar. Tente de novo.');
        throw e;
      } finally {
        setCarregando(false);
      }
    },
    atualizar,
    responder: (resposta) => escrever((c) => c.responder(resposta)),
    batidaManual: (data, hora, justificativa) => escrever((c) => c.batidaManual(data, hora, justificativa)),
    ajustar: (ajuste) => escrever((c) => c.ajustar(ajuste)),
    marcarAlertasLidos: async (ids) => {
      if (!cliente || !estado) return;
      setEstado({ ...estado, alertas: estado.alertas.map((a) => (ids.includes(a.id) ? { ...a, lido: true } : a)) });
      try {
        await cliente.marcarAlertasLidos(ids);
      } catch (e) {
        tratarErro(e);
      }
    },
    sair: async () => {
      try {
        await cliente?.sair();
      } catch {
        // Mesmo sem resposta do robô, a sessão sai deste aparelho.
      }
      apagarTudo();
      setSessao(MODO_EXEMPLO ? SESSAO_DE_EXEMPLO : null);
      setEstado(null);
    },
    limparErro: () => setErro(null),
  };

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
