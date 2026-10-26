import { dataValida, descreverToleranciaDoDia, formatarDuracao, formatarHora, formatarHoraCurta, formatarSaldo, jornadaVigente } from '@ponto-certo/motor';
import type { BatidaNoDia, Pendencia, ResultadoDia } from '@ponto-certo/motor';
import { classificarNovaBatida } from '@ponto-certo/motor';
import { Avisos } from '../componentes/Avisos';
import { CartaoPendencia } from '../componentes/CartaoPendencia';
import { IconeVoltar } from '../componentes/Icones';
import { dataPorExtenso } from '../dados/datas';
import { classeDoSaldo, partesDoSaldo } from '../dados/formatos';
import { efeitoDaHipotese } from '../dados/previa';
import { useApp } from '../estado/contexto';
import { navegar } from '../estado/rotas';

const STATUS: Partial<Record<ResultadoDia['status'], string>> = {
  em_andamento: 'Dia em andamento: entra no banco quando terminar.',
  sem_batida: 'Dia útil sem nenhuma batida.',
  fim_de_semana: 'Fim de semana.',
  feriado: 'Feriado.',
};

function rotuloBatida(b: BatidaNoDia, dia: ResultadoDia, janela: { inicio: number; fim: number }): string {
  if (b.duplicada) return 'Duplicada, ignorada';
  if (b.status === 'fora_da_conta') return 'Outra pessoa, fora da conta';
  if (b.status === 'substituida') return 'Substituída pelo comprovante';
  const tipo = classificarNovaBatida(dia, b.id, janela);
  const nome = !tipo ? '' : tipo.tipo === 'entrada' ? 'Entrada' : tipo.tipo === 'volta' ? 'Volta' : tipo.tipo === 'saida_final' ? 'Saída' : tipo.almoco ? 'Saída almoço' : 'Saída';
  return b.origem === 'manual' ? `${nome} · manual` : b.origem === 'provisoria' ? `${nome} · provisória` : nome;
}

export function Dia({ parametro }: { parametro: string | null }) {
  const app = useApp();
  const { estado, calculo } = app;
  if (!estado || !calculo) return null;
  const data = parametro && dataValida(parametro) ? parametro : calculo.relogio.hoje;
  const dia = calculo.dia(data);
  const voltar = () => (window.history.length > 1 ? window.history.back() : navegar(`#/mes/${data.slice(0, 7)}`));

  if (!dia) {
    return (
      <div class="tela">
        <div class="barra-topo">
          <button type="button" class="botao-icone" onClick={voltar} aria-label="Voltar"><IconeVoltar /></button>
          <h1>{dataPorExtenso(data)}</h1>
          <span class="espaco-icone" />
        </div>
        <div class="cartao vazio">Esse dia é antes do início do banco de horas.</div>
      </div>
    );
  }

  const jornada = jornadaVigente(data, estado.config.jornadas) ?? estado.config.jornadas[0];
  const saldo = partesDoSaldo(dia.saldo);
  const tolerancia = descreverToleranciaDoDia(dia);
  const abonoPendente = dia.pendencias.find((p): p is Extract<Pendencia, { tipo: 'abono_intervalo' }> => p.tipo === 'abono_intervalo');
  const efeitoAbono = abonoPendente
    ? efeitoDaHipotese(estado, calculo.relogio, data, { respostas: [{ ...abonoPendente, abonado: true, justificativa: 'prévia' }] })
    : null;
  const outrasPendencias = dia.pendencias.filter((p) => p.tipo !== 'abono_intervalo');
  const registradas = new Map(estado.batidas.map((b) => [b.id, b]));
  const podeLancar = app.podeEscrever && data <= calculo.relogio.hoje;

  return (
    <div class="tela">
      <Avisos />
      <div class="barra-topo">
        <button type="button" class="botao-icone" onClick={voltar} aria-label="Voltar"><IconeVoltar /></button>
        <h1>{dataPorExtenso(data)}</h1>
        <span class="espaco-icone" />
      </div>

      <div class="cartao cartao-hero">
        <div class="rotulo">Saldo do dia</div>
        <div class={`numero-grande ${classeDoSaldo(dia.saldo)}`} style={{ fontSize: '40px' }}>
          {dia.status === 'futuro' ? '—' : saldo.principal}
          {dia.status !== 'futuro' && saldo.resto && <small>{saldo.resto}</small>}
        </div>
        <div class="conta">
          {formatarDuracao(dia.trabalhado)} trabalhadas − {formatarDuracao(dia.carga)} de carga
          {dia.abonado > 0 && ` (inclui ${formatarDuracao(dia.abonado)} abonadas)`}
        </div>
        {STATUS[dia.status] && <div class="discreto" style={{ marginTop: '4px' }}>{STATUS[dia.status]}</div>}
        {dia.feriado && <div class="chip neutro">{dia.feriado}</div>}
        {tolerancia && <div class="chip neutro">{tolerancia}</div>}
        {efeitoAbono && abonoPendente && (
          <div class="chip ambar">Se a saída das {formatarHoraCurta(abonoPendente.inicio)} for abonada: {formatarSaldo(efeitoAbono.saldoDia)}</div>
        )}
      </div>

      {outrasPendencias.map((p) => <CartaoPendencia key={`${p.tipo}`} pendencia={p} />)}

      {dia.intervalos.length > 0 && (
        <div class="cartao">
          <div class="titulo-cartao" style={{ marginBottom: '4px' }}>Intervalos</div>
          {dia.intervalos.map((i) => {
            const pendente = dia.pendencias.find((p) => p.tipo === 'abono_intervalo' && p.inicio === i.inicio && p.fim === i.fim);
            const faixa = `${formatarHora(i.inicio)}–${formatarHora(i.fim)}`;
            if (i.tipo === 'almoco') {
              return (
                <div class="lista-linha" key={faixa}>
                  <span>🍽️ Almoço {faixa}</span>
                  <b>{formatarDuracao(i.duracao)}{i.almocoIncerto ? ' ?' : ' ✓'}</b>
                </div>
              );
            }
            return (
              <button
                type="button"
                class={`lista-linha${pendente ? ' pendente clicavel' : ''}`}
                key={faixa}
                disabled={!pendente || !app.podeEscrever}
                onClick={() => pendente && app.abrirFolha({ tipo: 'pendencia', pendencia: pendente })}
              >
                <span>🚶 Saída {faixa}</span>
                <b>{formatarDuracao(i.duracao)} · {pendente ? 'responder ›' : i.abonado ? 'abonada' : 'não abonada'}</b>
              </button>
            );
          })}
        </div>
      )}

      <div class="cartao">
        <div class="titulo-cartao" style={{ marginBottom: '4px' }}>
          Batidas<span class="contagem">{dia.batidas.length === 1 ? '1 registro' : `${dia.batidas.length} registros`}</span>
        </div>
        {dia.batidas.length === 0 && <div class="vazio">Nenhuma batida nesse dia.</div>}
        {dia.batidas.map((b) => {
          const r = registradas.get(b.id);
          const classe = b.duplicada ? ' duplicada' : b.origem === 'manual' ? ' manual' : b.status === 'fora_da_conta' ? ' fora' : '';
          const selo = b.origem === 'manual' ? 'sem comprovante' : b.nsr ? `NSR ${b.nsr}${b.duplicada || b.status !== 'ativa' ? '' : ' ✓'}` : 'provisória';
          return (
            <button type="button" class={`lista-linha clicavel batida-linha${classe}`} key={b.id} onClick={() => app.abrirFolha({ tipo: 'batida', batidaId: b.id })}>
              <span class="hora">{r?.hora ?? formatarHora(b.segundos)}</span>
              <span>{rotuloBatida(b, dia, jornada.janelaAlmoco)}</span>
              <small>{selo}</small>
              <span class="seta">›</span>
            </button>
          );
        })}
      </div>

      {podeLancar && (
        <div class="acoes-dia">
          <button type="button" class="botao-secundario" onClick={() => app.abrirFolha({ tipo: 'abono', data })}>+ Lançar abono</button>
          <button type="button" class="botao-secundario" onClick={() => app.abrirFolha({ tipo: 'batidaManual', data })}>+ Batida que faltou</button>
        </div>
      )}
    </div>
  );
}
