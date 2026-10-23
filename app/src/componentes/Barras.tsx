import type { ResultadoDia } from '@ponto-certo/motor';
import { rotuloCurto } from '../dados/formatos';
import type { DiaDaSemana } from '../dados/hoje';
import { navegar } from '../estado/rotas';

const ALTURA = 22;
const minutos = rotuloCurto;

/** Barras grandes da semana (tela Hoje). */
export function BarrasSemana({ dias }: { dias: DiaDaSemana[] }) {
  const maior = Math.max(600, ...dias.map((d) => Math.abs(d.saldo ?? 0)));
  return (
    <div class="barras">
      {dias.map((d) => {
        const altura = d.saldo ? Math.max(4, Math.round((Math.abs(d.saldo) / maior) * ALTURA)) : 0;
        return (
          <button type="button" key={d.data} class="barra-col" onClick={() => navegar(`#/dia/${d.data}`)} aria-label={`Ver ${d.rotulo}`}>
            <em class={d.saldo && d.saldo > 0 ? 'pos' : ''}>{d.saldo && d.saldo > 0 ? minutos(d.saldo) : d.saldo === 0 ? '0' : d.hoje ? '…' : ''}</em>
            <div class="barra-cima">
              {d.saldo !== null && d.saldo > 0 && <i style={{ height: `${altura}px` }} />}
              {d.saldo === 0 && <i class="zero" style={{ height: '2px', width: '14px' }} />}
              {d.hoje && d.saldo === null && <i class="hoje" style={{ height: '14px' }} />}
            </div>
            <div class="barra-baixo">{d.saldo !== null && d.saldo < 0 && <i style={{ height: `${altura}px` }} />}</div>
            <span>{d.rotulo}{d.saldo !== null && d.saldo < 0 && <b class="neg"> {minutos(d.saldo)}</b>}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Barras finas, uma por dia útil do período (Caderninho). */
export function BarrasPeriodo({ dias }: { dias: ResultadoDia[] }) {
  // Só dias fechados: o dia em andamento tem saldo parcial e distorceria a escala.
  const visiveis = dias
    .filter((d) => d.diaUtil || d.feriado || d.pares.length > 0)
    .filter((d) => d.status !== 'futuro' && d.status !== 'em_andamento');
  const maior = Math.max(600, ...visiveis.map((d) => Math.abs(d.saldo)));
  return (
    <div class="barras-finas" aria-hidden="true">
      {visiveis.map((d) => {
        const altura = Math.max(2, Math.round((Math.abs(d.saldo) / maior) * ALTURA));
        return (
          <div class="barra-fina" key={d.data}>
            <div class="c">
              {d.feriado && d.pares.length === 0 ? <i class="feriado" /> : d.saldo > 0 ? <i style={{ height: `${altura}px` }} /> : d.saldo === 0 ? <i class="zero" /> : null}
            </div>
            <div class="b">{d.saldo < 0 && <i class={d.pendencias.length ? 'pendente' : ''} style={{ height: `${altura}px` }} />}</div>
          </div>
        );
      })}
    </div>
  );
}
