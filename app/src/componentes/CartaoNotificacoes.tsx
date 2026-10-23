import { useState } from 'preact/hooks';
import type { ResultadoTeste } from '../api/cliente';
import { useApp } from '../estado/contexto';
import { cartaoDispensado, dispensarCartao } from '../notificacoes/push';
import { DICA_DESBLOQUEIO, situacaoDoCartao } from '../notificacoes/situacao';

/** Convite para ligar as notificações (tela Hoje). Some depois de ativar ou ao tocar em "Agora não". */
export function CartaoNotificacoes() {
  const app = useApp();
  const [dispensado, setDispensado] = useState(() => cartaoDispensado());
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);
  const n = app.notificacoes;

  if (resultado) {
    return (
      <div class="cartao nao-imprimir cartao-notificacao ok">
        <div class="titulo-cartao">🔔 Notificações ligadas!</div>
        <p>{resultado.enviada ? 'Mandei uma de teste agora. A partir daqui eu aviso cada batida, o resumo do dia e as pendências.' : `Ficou tudo cadastrado, mas o teste não saiu: ${resultado.detalhe}`}</p>
        <button type="button" class="botao-secundario" onClick={() => setResultado(null)}>Ok</button>
      </div>
    );
  }

  const situacao = situacaoDoCartao({
    suportado: n.suportado,
    configurado: n.configurado,
    servidorPronto: app.estado?.notificacoes.servidorPronto ?? false,
    permissao: n.permissao,
    ativoNesteAparelho: n.ativoNesteAparelho,
    dispensado,
  });
  if (situacao === 'oculto') return null;

  if (situacao === 'bloqueado') {
    return (
      <div class="cartao nao-imprimir cartao-notificacao">
        <div class="titulo-cartao">🔕 Notificações bloqueadas</div>
        <p>{DICA_DESBLOQUEIO}</p>
      </div>
    );
  }

  const ativar = () => {
    void app.ativarNotificacoes().then((r) => {
      if (r) setResultado(r);
    });
  };

  return (
    <div class="cartao nao-imprimir cartao-notificacao">
      <div class="titulo-cartao">🔔 Ativar notificações</div>
      <p>Aviso cada batida, o resumo do dia e as pendências, direto no celular.</p>
      <div class="grade-dois">
        <button type="button" class="botao-secundario" onClick={() => { dispensarCartao(); setDispensado(true); }}>Agora não</button>
        <button type="button" class="botao-principal" disabled={n.ocupado} onClick={ativar}>{n.ocupado ? 'Ativando…' : 'Ativar'}</button>
      </div>
    </div>
  );
}
