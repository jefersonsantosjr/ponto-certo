import { useState } from 'preact/hooks';
import { useApp } from '../estado/contexto';
import { DICA_DESBLOQUEIO, TEXTO_APARELHO, situacaoDoAparelho } from '../notificacoes/situacao';

/** Seção "Notificações" das Configurações: situação neste celular, no robô e botões de ativar/testar. */
export function SecaoNotificacoes() {
  const app = useApp();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const n = app.notificacoes;
  const robo = app.estado?.notificacoes ?? { servidorPronto: false, aparelhos: 0 };
  const situacao = situacaoDoAparelho({ suportado: n.suportado, configurado: n.configurado, permissao: n.permissao, ativoNesteAparelho: n.ativoNesteAparelho });

  const ativar = () => {
    setMensagem(null);
    void app.ativarNotificacoes().then((r) => {
      if (r) setMensagem(r.enviada ? 'Pronto! Mandei uma notificação de teste 🔔' : `Cadastrado, mas o teste não saiu: ${r.detalhe}`);
    });
  };
  const testar = () => {
    setMensagem(null);
    void app.testarNotificacao().then((r) => {
      if (r) setMensagem(r.enviada ? 'Teste enviado. Deve chegar em alguns segundos 🔔' : `O teste não saiu: ${r.detalhe}`);
    });
  };

  return (
    <>
      <div class="secao">Notificações</div>
      <div class="cartao lista">
        <div class="item"><span>Neste celular</span><b class={situacao === 'ativas' ? 'pos' : situacao === 'bloqueadas' ? 'neg' : ''}>{TEXTO_APARELHO[situacao]}</b></div>
        <div class="item"><span>Robô</span><b class={robo.servidorPronto ? 'pos' : 'ambar'}>{robo.servidorPronto ? 'pronto pra mandar ✓' : 'ainda sem a chave do Firebase'}</b></div>
        <div class="item"><span>Aparelhos cadastrados</span><b>{robo.aparelhos}</b></div>
      </div>
      {situacao === 'bloqueadas' && <p class="dica" style={{ margin: '-4px 8px 12px' }}>{DICA_DESBLOQUEIO}</p>}
      {(situacao === 'desligadas' || situacao === 'ativas') && (
        <div class="campos">
          {situacao === 'desligadas' ? (
            <button type="button" class="botao-secundario" disabled={n.ocupado} onClick={ativar}>{n.ocupado ? 'Ativando…' : '🔔 Ativar notificações neste celular'}</button>
          ) : (
            <button type="button" class="botao-secundario" disabled={n.ocupado || !robo.servidorPronto} onClick={testar}>{n.ocupado ? 'Enviando…' : 'Enviar notificação de teste'}</button>
          )}
          {mensagem && <p class="dica">{mensagem}</p>}
          {!robo.servidorPronto && <p class="dica">O robô ainda não tem a chave do Firebase: o celular fica cadastrado e começa a receber assim que ela for configurada.</p>}
        </div>
      )}
    </>
  );
}
