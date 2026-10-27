import { Abas } from './componentes/Abas';
import { Carregando } from './componentes/Avisos';
import { FolhaBatida } from './componentes/FolhaBatida';
import { FolhaLancamento } from './componentes/FolhaLancamento';
import type { RetornoGoogle } from './api/google';
import { FolhaResposta } from './componentes/FolhaResposta';
import { ProvedorApp, useApp } from './estado/contexto';
import { useRota } from './estado/rotas';
import { Caderninho } from './telas/Caderninho';
import { Config } from './telas/Config';
import { Dia } from './telas/Dia';
import { Ativar, BoasVindas } from './telas/Entrada';
import { Hoje } from './telas/Hoje';
import { Mes } from './telas/Mes';
import { Pendencias } from './telas/Pendencias';

function FolhaAtual() {
  const { folha } = useApp();
  if (!folha) return null;
  switch (folha.tipo) {
    case 'pendencia':
      return <FolhaResposta key={JSON.stringify(folha.pendencia)} pendencia={folha.pendencia} preferencia={folha.preferencia} />;
    case 'batida':
      return <FolhaBatida batidaId={folha.batidaId} />;
    case 'abono':
    case 'batidaManual':
      return <FolhaLancamento tipo={folha.tipo} data={folha.data} />;
  }
}

function Raiz() {
  const app = useApp();
  const rota = useRota();

  if (rota.nome === 'ativar') return <div class="app"><Ativar rota={rota} /></div>;
  if (!app.sessao) return <div class="app"><BoasVindas /></div>;
  if (!app.estado || !app.calculo) {
    return (
      <div class="app">
        {app.erro ? <div class="tela"><div class="aviso erro">{app.erro}<button type="button" onClick={() => void app.atualizar(true)}>Tentar</button></div></div> : <Carregando />}
      </div>
    );
  }

  const tela = (() => {
    switch (rota.nome) {
      case 'mes':
        return <Mes parametro={rota.parametro} />;
      case 'dia':
        return <Dia parametro={rota.parametro} />;
      case 'pendencias':
        return <Pendencias />;
      case 'caderninho':
        return <Caderninho />;
      case 'config':
        return <Config />;
      default:
        return <Hoje />;
    }
  })();

  return (
    <div class="app">
      {tela}
      <Abas atual={rota.nome} pendencias={app.calculo.pendencias.length} />
      <FolhaAtual />
    </div>
  );
}

export function App({ retornoGoogle = null }: { retornoGoogle?: RetornoGoogle | null }) {
  return (
    <ProvedorApp retornoGoogle={retornoGoogle}>
      <Raiz />
    </ProvedorApp>
  );
}
