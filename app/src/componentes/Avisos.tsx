import { gerarNotificacao } from '@ponto-certo/motor';
import { useApp } from '../estado/contexto';

function horaDe(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Faixas do topo: sem conexão, erro e alertas do robô ainda não lidos. */
export function Avisos({ comAlertas = false }: { comAlertas?: boolean }) {
  const app = useApp();
  const alertas = comAlertas ? (app.estado?.alertas ?? []).filter((a) => !a.lido) : [];
  return (
    <>
      {app.semConexao && (
        <div class="aviso nao-imprimir">
          Sem conexão. Mostrando os dados de {horaDe(app.recebidoEm) || 'antes'}.
          <button type="button" onClick={() => void app.atualizar(true)}>Tentar</button>
        </div>
      )}
      {app.erro && (
        <div class="aviso erro nao-imprimir">
          {app.erro}
          <button type="button" onClick={app.limparErro}>Fechar</button>
        </div>
      )}
      {alertas.map((a) => (
        <div class="alerta nao-imprimir" key={a.id}>
          {gerarNotificacao({ tipo: 'alerta', alerta: a.alerta }, { nome: app.estado?.nomeExibicao ?? '', agora: app.relogio.agora }).corpo}
          {app.podeEscrever && (
            <button type="button" onClick={() => void app.marcarAlertasLidos([a.id])}>Ok, entendi</button>
          )}
        </div>
      ))}
    </>
  );
}

export function Carregando({ texto = 'Buscando seus comprovantes…' }: { texto?: string }) {
  return (
    <div class="carregando">
      <div>
        <div class="girando" />
        {texto}
      </div>
    </div>
  );
}
