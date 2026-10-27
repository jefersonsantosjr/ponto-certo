import { dataBR, formatarDuracao, formatarHoraCurta, formatarSaldo, jornadaVigente } from '@ponto-certo/motor';
import { Avisos } from '../componentes/Avisos';
import { IconeVoltar } from '../componentes/Icones';
import { SecaoNotificacoes } from '../componentes/SecaoNotificacoes';
import { quandoCurto } from '../dados/formatos';
import { avaliarSaude } from '../dados/saude';
import { MODO_EXEMPLO, useApp } from '../estado/contexto';
import { navegar } from '../estado/rotas';

const NOMES_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function Config() {
  const app = useApp();
  const { estado, calculo } = app;
  if (!estado || !calculo) return null;
  const jornada = jornadaVigente(calculo.relogio.hoje, estado.config.jornadas) ?? estado.config.jornadas[0];
  const diasComCarga = jornada.cargaPorDiaSemana.map((c, i) => (c > 0 ? NOMES_DIAS[i] : null)).filter(Boolean);
  const cargas = [...new Set(jornada.cargaPorDiaSemana.filter((c) => c > 0))];
  const { regras, feriados } = estado.config;
  const porBatida = jornada.entrada !== undefined && jornada.saida !== undefined;
  const tolerancia = !regras.toleranciaLigada
    ? 'desligada'
    : porBatida
      ? `até ${formatarDuracao(regras.toleranciaMarcacao ?? 300)} na entrada e na saída`
      : `±${formatarDuracao(regras.tolerancia)} no total do dia`;
  const saude = avaliarSaude(estado.saude, new Date());
  const conf = estado.saude.ultimaConferencia;

  const sair = () => {
    if (window.confirm('Sair deste aparelho? Pra entrar de novo vai precisar de um novo link de ativação.')) {
      void app.sair().then(() => navegar('#/hoje'));
    }
  };

  return (
    <div class="tela">
      <Avisos />
      <div class="barra-topo">
        <a class="botao-icone" href="#/hoje" aria-label="Voltar"><IconeVoltar /></a>
        <h1>Configurações</h1>
        <span class="espaco-icone" />
      </div>

      <div class="secao">Jornada</div>
      <div class="cartao lista">
        <div class="item"><span>Dias</span><b>{diasComCarga.length === 5 && diasComCarga[0] === 'Seg' ? 'Segunda a sexta' : diasComCarga.join(', ')}</b></div>
        <div class="item"><span>Carga diária</span><b>{cargas.map(formatarDuracao).join(' / ')}</b></div>
        {jornada.entrada !== undefined && jornada.saida !== undefined && (
          <div class="item"><span>Horário</span><b>{formatarHoraCurta(jornada.entrada)} às {formatarHoraCurta(jornada.saida)}</b></div>
        )}
        <div class="item"><span>Almoço</span><b>{formatarDuracao(jornada.almocoPadrao)} · sai entre {formatarHoraCurta(jornada.janelaAlmoco.inicio)} e {formatarHoraCurta(jornada.janelaAlmoco.fim)}</b></div>
        <div class="item"><span>Vale desde</span><b>{dataBR(jornada.inicio)}</b></div>
      </div>

      <div class="secao">Regras do cálculo</div>
      <div class="cartao lista">
        <div class="item"><span>Tolerância da CLT</span><b>{tolerancia}</b></div>
        {regras.toleranciaLigada && porBatida && <div class="item"><span>Passou da tolerância</span><b>conta tudo · almoço conta exato</b></div>}
        <div class="item"><span>Batida duplicada</span><b>até {formatarDuracao(regras.limiteDuplicada)} depois</b></div>
        <div class="item"><span>Início do banco</span><b>{dataBR(estado.config.inicioBanco)} · saldo {formatarSaldo(estado.config.saldoInicial)}</b></div>
        <div class="item"><span>Feriados</span><b>nacionais{feriados.incluir.length ? ` + ${feriados.incluir.length} locais` : ''}{feriados.excluir.length ? ` − ${feriados.excluir.length}` : ''}</b></div>
      </div>

      {estado.identidade && (
        <>
          <div class="secao">Identidade conferida nos comprovantes</div>
          <div class="cartao lista">
            <div class="item"><span>Nome</span><b>{estado.identidade.nome}</b></div>
            <div class="item"><span>CPF</span><b>{estado.identidade.cpfMascarado}</b></div>
            <div class="item"><span>Empresa (CNPJ)</span><b>{estado.identidade.cnpj}</b></div>
          </div>
        </>
      )}

      <div class="secao">Acesso</div>
      <div class="cartao lista">
        <div class="item"><span>{estado.usuario.nome}</span><b>{estado.usuario.papel === 'dona' ? 'dona' : 'só leitura'}</b></div>
        {app.protecaoDados && app.protecaoDados !== 'indisponivel' && (
          <div class="item">
            <span>Dados neste celular</span>
            <b class={app.protecaoDados === 'protegido' ? 'pos' : 'ambar'}>{app.protecaoDados === 'protegido' ? 'protegidos ✓' : 'sem proteção · instale na tela inicial'}</b>
          </div>
        )}
        {app.google.disponivel && (
          <div class="item"><span>Conta Google</span><b class={estado.usuario.contaGoogle ? 'pos' : 'ambar'}>{estado.usuario.contaGoogle ? 'ligada ✓' : 'não ligada'}</b></div>
        )}
        {MODO_EXEMPLO && <div class="item"><span>Modo</span><b>demonstração (dados falsos)</b></div>}
      </div>
      {app.google.disponivel && !estado.usuario.contaGoogle && (
        <div class="campos">
          <button type="button" class="botao-secundario" disabled={app.carregando} onClick={app.vincularGoogle}>Ligar minha conta Google</button>
          <p class="dica">Se este celular perder o acesso, é só tocar em "Entrar com o Google" que você volta, sem precisar de link.</p>
        </div>
      )}

      <SecaoNotificacoes />

      <div class="secao">Saúde do robô</div>
      <div class="cartao lista">
        <div class="item"><span>Situação</span><b class={saude.nivel === 'problema' ? 'neg' : saude.nivel === 'atencao' ? 'ambar' : 'pos'}>{saude.nivel === 'ok' ? 'tudo certo ✓' : saude.texto}</b></div>
        <div class="item"><span>Última sincronização</span><b>{estado.saude.ultimaSincronizacao ? quandoCurto(estado.saude.ultimaSincronizacao) : '—'}</b></div>
        <div class="item"><span>Última conferência</span><b>{conf ? `${quandoCurto(conf.quando)} · ${conf.totalGmail} = ${conf.totalPlanilha} ${conf.ok ? '✓' : '✗'}` : '—'}</b></div>
        {estado.saude.problemas.map((p) => <div class="item" key={p}><span>Problema</span><b class="neg">{p}</b></div>)}
      </div>

      <div class="campos">
        <button type="button" class="botao-secundario" disabled={app.carregando} onClick={() => void app.atualizar(true)}>
          {app.carregando ? 'Sincronizando…' : '↻ Sincronizar agora'}
        </button>
        <button type="button" class="botao-secundario" style={{ color: 'var(--neg-forte)' }} onClick={sair}>Sair deste aparelho</button>
      </div>
    </div>
  );
}
