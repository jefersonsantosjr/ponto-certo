import { arredondarParaMinutoSeguinte, formatarDuracao, formatarHoraCurta, formatarSaldo } from '@ponto-certo/motor';
import { Avisos } from '../componentes/Avisos';
import { BarrasSemana } from '../componentes/Barras';
import { CartaoPendencia } from '../componentes/CartaoPendencia';
import { classeDoSaldo, partesDoSaldo } from '../dados/formatos';
import { resumoHoje } from '../dados/hoje';
import { avaliarSaude } from '../dados/saude';
import { useApp } from '../estado/contexto';

export function Hoje() {
  const app = useApp();
  const { estado, calculo } = app;
  if (!estado || !calculo) return null;
  const r = resumoHoje(estado, calculo);
  const saude = avaliarSaude(estado.saude, new Date());
  const banco = partesDoSaldo(r.banco);
  const inicial = (r.nome.trim()[0] ?? '•').toUpperCase();
  const previsao = r.previsao !== null ? formatarHoraCurta(arredondarParaMinutoSeguinte(r.previsao)) : null;

  return (
    <div class="tela">
      <Avisos comAlertas />
      <div class="topo">
        <div>
          <div class="ola">{r.saudacao}, {r.nome} 👋</div>
          <div class="data-hoje">{r.dataExtenso}</div>
        </div>
        <a class="avatar" href="#/config" aria-label="Configurações" style={{ textDecoration: 'none' }}>{inicial}</a>
      </div>

      <div class="cartao cartao-hero">
        <div class="rotulo">Banco de horas</div>
        <div class={`numero-grande ${classeDoSaldo(r.banco)}`}>
          {banco.principal}
          {banco.resto && <small>{banco.resto}</small>}
        </div>
        <div class="sub">
          {r.banco < 0 ? <>Faltam <b>{formatarDuracao(r.banco)}</b> pra zerar</> : r.banco > 0 ? <>Sobrando <b>{formatarDuracao(r.banco)}</b> 🎉</> : <>Banco zerado ✓</>}
        </div>
        {r.saldoMes !== 0 && (
          <div class={`chip ${r.saldoMes > 0 ? 'pos' : 'neg'}`}>
            {r.saldoMes > 0 ? '▲' : '▼'} {formatarSaldo(r.saldoMes)} {r.saldoMes > 0 && r.banco < 0 ? 'pagos ' : ''}em {r.mesNome}{r.saldoMes > 0 && r.banco < 0 ? ' 💪' : ''}
          </div>
        )}
      </div>

      <a class="cartao" href={`#/dia/${calculo.relogio.hoje}`} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
        <div class="linha-titulo">
          <span class="titulo-cartao">Hoje</span>
          {r.dentro && previsao ? <span class="discreto">saída prevista <b>{previsao}</b></span> : r.carga === 0 ? <span class="discreto">dia sem carga</span> : null}
        </div>
        <div class="horas"><b>{formatarDuracao(r.trabalhadoAoVivo)}</b>{r.carga > 0 ? ` de ${formatarDuracao(r.carga)}` : ' trabalhadas'}</div>
        {r.carga > 0 && <div class="progresso"><div style={{ width: `${Math.round(r.progresso * 100)}%` }} /></div>}
        {r.batidas.length === 0 ? (
          <div class="vazio" style={{ marginTop: '10px' }}>Nenhuma batida hoje ainda.</div>
        ) : (
          <div class="batidas-hoje">
            {r.batidas.map((b) => (
              <span class="batida-hoje" key={b.id}>{b.hora}<small>{b.rotulo}</small></span>
            ))}
            {r.dentro && previsao && <span class="batida-hoje prevista">{previsao}<small>saída</small></span>}
          </div>
        )}
      </a>

      <div class="cartao">
        <div class="linha-titulo">
          <span class="titulo-cartao">Esta semana</span>
          <span class={`discreto ${classeDoSaldo(r.saldoSemana)}`} style={{ fontWeight: 800 }}>{formatarSaldo(r.saldoSemana)}</span>
        </div>
        <BarrasSemana dias={r.semana} />
      </div>

      {r.pendencias.length > 0 && (
        <>
          <CartaoPendencia pendencia={r.pendencias[0]} />
          {r.pendencias.length > 1 && <a class="mais-pendencias" href="#/pendencias">Ver todas as {r.pendencias.length} pendências ›</a>}
        </>
      )}

      <div class={`saude ${saude.nivel}`}>{saude.texto}</div>
    </div>
  );
}
