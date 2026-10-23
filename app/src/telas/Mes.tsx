import { diaDaSemana, formatarDuracao, formatarSaldo, listarDatas } from '@ponto-certo/motor';
import type { ResultadoDia } from '@ponto-certo/motor';
import { Avisos } from '../componentes/Avisos';
import { IconeAvancar, IconeVoltar } from '../componentes/Icones';
import { mesAno, primeiroDiaDoMes, somarMeses, ultimoDiaDoMes } from '../dados/datas';
import { classeDoSaldo, rotuloCurto } from '../dados/formatos';
import { useApp } from '../estado/contexto';
import { navegar } from '../estado/rotas';

function classeDaCelula(dia: ResultadoDia | undefined, data: string, hoje: string, inicio: string): string {
  if (data < inicio || !dia) return 'cel antes';
  if (data === hoje) return 'cel hoje';
  if (dia.status === 'futuro') return dia.diaUtil ? 'cel futuro' : 'cel fds';
  if (dia.pendencias.length > 0) return `cel pendente ${classeDoSaldo(dia.saldo)}`;
  if (dia.feriado || (dia.classificacao && dia.classificacao !== 'folga_banco')) return 'cel feriado';
  if (dia.status === 'fim_de_semana') return 'cel fds';
  return `cel ${dia.saldo > 0 ? 'pos' : dia.saldo < 0 ? 'neg' : 'zero'}`;
}

function textoDaCelula(dia: ResultadoDia | undefined, data: string, hoje: string): string {
  if (!dia || dia.status === 'futuro') return '';
  if (data === hoje) return 'hoje';
  if (dia.feriado && dia.pares.length === 0) return 'feriado';
  if (dia.classificacao === 'ferias') return 'férias';
  if (dia.classificacao === 'abonado') return 'abono';
  if (dia.status === 'fim_de_semana') return '';
  return rotuloCurto(dia.saldo);
}

export function Mes({ parametro }: { parametro: string | null }) {
  const app = useApp();
  const { estado, calculo } = app;
  if (!estado || !calculo) return null;
  const hoje = calculo.relogio.hoje;
  const inicioBanco = estado.config.inicioBanco;
  const mes = parametro && /^\d{4}-\d{2}$/.test(parametro) ? `${parametro}-01` : primeiroDiaDoMes(hoje);
  const fim = ultimoDiaDoMes(mes);
  const datas = listarDatas(mes, fim);
  const fechados = datas.map((d) => calculo.dia(d)).filter((d): d is ResultadoDia => !!d && d.status !== 'futuro' && d.status !== 'em_andamento');
  const saldo = fechados.reduce((s, d) => s + d.saldo, 0);
  const trabalhado = fechados.reduce((s, d) => s + d.trabalhado, 0);
  const previsto = fechados.reduce((s, d) => s + d.carga, 0);
  const ultimoFechado = fechados[fechados.length - 1];
  const banco = ultimoFechado ? calculo.periodo.bancoPorDia[ultimoFechado.data] : undefined;
  const podeVoltar = mes > primeiroDiaDoMes(inicioBanco);
  const podeAvancar = mes < primeiroDiaDoMes(hoje);
  const irPara = (delta: number) => navegar(`#/mes/${somarMeses(mes, delta).slice(0, 7)}`);
  const vazias = diaDaSemana(mes);

  return (
    <div class="tela">
      <Avisos />
      <div class="barra-topo">
        <button type="button" class="botao-icone" disabled={!podeVoltar} onClick={() => irPara(-1)} aria-label="Mês anterior"><IconeVoltar /></button>
        <h1>{mesAno(mes)}</h1>
        <button type="button" class="botao-icone" disabled={!podeAvancar} onClick={() => irPara(1)} aria-label="Próximo mês"><IconeAvancar /></button>
      </div>

      <div class="cartao">
        <div class="resumo-mes"><span class="rotulo">Saldo do mês</span><b class={classeDoSaldo(saldo)}>{formatarSaldo(saldo)}</b></div>
        <div class="mini">
          <div><small>Trabalhado</small><b>{formatarDuracao(trabalhado)}</b></div>
          <div><small>Previsto</small><b>{formatarDuracao(previsto)}</b></div>
          <div><small>Banco</small><b class={banco !== undefined ? classeDoSaldo(banco) : ''}>{banco !== undefined ? formatarSaldo(banco) : '—'}</b></div>
        </div>
      </div>

      <div class="cartao">
        <div class="semana-cab"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
        <div class="cal">
          {Array.from({ length: vazias }, (_, i) => <span class="cel vazia" key={`v${i}`} />)}
          {datas.map((data) => {
            const dia = calculo.dia(data);
            const classe = classeDaCelula(dia, data, hoje, inicioBanco);
            const clicavel = data >= inicioBanco && data <= hoje;
            return clicavel ? (
              <a class={classe} key={data} href={`#/dia/${data}`}><b>{Number(data.slice(8))}</b><em>{textoDaCelula(dia, data, hoje)}</em></a>
            ) : (
              <span class={classe} key={data}><b>{Number(data.slice(8))}</b></span>
            );
          })}
        </div>
        <div class="legenda">
          <span><i style={{ background: '#22C55E' }} />sobrou</span>
          <span><i style={{ background: '#F87171' }} />faltou</span>
          <span><i style={{ background: '#F5B53F' }} />pendente</span>
          <span><i style={{ background: '#818CF8' }} />feriado / abono</span>
        </div>
      </div>
      <div class="dica">Toque num dia pra ver as batidas e a conta</div>
    </div>
  );
}
