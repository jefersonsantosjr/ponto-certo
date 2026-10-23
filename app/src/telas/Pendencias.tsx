import { chaveResposta, dataCurtaBR, diaDaSemana, formatarSaldo } from '@ponto-certo/motor';
import { useState } from 'preact/hooks';
import { Avisos } from '../componentes/Avisos';
import { CartaoPendencia } from '../componentes/CartaoPendencia';
import { IconeBusca } from '../componentes/Icones';
import { DIAS_CURTOS } from '../dados/datas';
import { quandoCurto } from '../dados/formatos';
import { decisaoResposta, tipoResposta, tomDecisao } from '../dados/rotulos';
import { useApp } from '../estado/contexto';

interface ItemHistorico {
  id: string;
  data: string;
  titulo: string;
  decisao: string;
  tom: string;
  justificativa: string;
  rodape: string;
  substituida: boolean;
  quando: string;
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Pendencias() {
  const app = useApp();
  const [busca, setBusca] = useState('');
  const { estado, calculo } = app;
  if (!estado || !calculo) return null;

  const ultimaPorChave = new Map<string, string>();
  for (const r of [...estado.respostas].sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))) ultimaPorChave.set(chaveResposta(r.resposta), r.id);
  const vigentes = new Set(ultimaPorChave.values());

  const itens: ItemHistorico[] = [
    ...estado.respostas.map((r) => ({
      id: r.id,
      data: r.resposta.data,
      titulo: `${DIAS_CURTOS[diaDaSemana(r.resposta.data)]}, ${dataCurtaBR(r.resposta.data)} · ${tipoResposta(r.resposta).toLowerCase()}`,
      decisao: decisaoResposta(r.resposta),
      tom: tomDecisao(r.resposta),
      justificativa: r.resposta.justificativa,
      rodape: `${r.autor} · ${quandoCurto(r.criadaEm)}${vigentes.has(r.id) ? '' : ' · alterada depois'}`,
      substituida: !vigentes.has(r.id),
      quando: r.criadaEm,
    })),
    ...estado.ajustes.map((a) => ({
      id: a.id,
      data: a.data,
      titulo: `${DIAS_CURTOS[diaDaSemana(a.data)]}, ${dataCurtaBR(a.data)} · ${a.tipo === 'abono_horas' ? 'abono de horas' : 'ajuste do banco'}`,
      decisao: formatarSaldo(a.segundos),
      tom: a.segundos >= 0 ? 'sim' : 'nao',
      justificativa: a.justificativa,
      rodape: `${a.autor} · ${quandoCurto(a.criadoEm)}${a.ativo ? '' : ' · cancelado'}`,
      substituida: !a.ativo,
      quando: a.criadoEm,
    })),
    ...estado.batidas.filter((b) => b.origem === 'manual').map((b) => ({
      id: b.id,
      data: b.data,
      titulo: `${DIAS_CURTOS[diaDaSemana(b.data)]}, ${dataCurtaBR(b.data)} · batida informada`,
      decisao: `Manual ${b.hora.slice(0, 5)}`,
      tom: 'neutro',
      justificativa: b.justificativa ?? '',
      rodape: b.status === 'substituida' ? 'substituída pelo comprovante' : 'sem comprovante',
      substituida: b.status !== 'ativa',
      quando: `${b.data}T${b.hora}`,
    })),
  ].sort((a, b) => b.quando.localeCompare(a.quando));

  const termo = semAcento(busca.trim());
  const filtrados = termo ? itens.filter((i) => semAcento(`${i.titulo} ${i.decisao} ${i.justificativa}`).includes(termo)) : itens;

  return (
    <div class="tela">
      <Avisos comAlertas />
      <div class="titulo-tela">
        <h1>Pendências</h1>
        <p>O que precisa da sua resposta</p>
      </div>

      <div class="secao">Para responder · {calculo.pendencias.length}</div>
      {calculo.pendencias.length === 0 && <div class="cartao vazio">Tudo respondido ✓</div>}
      {calculo.pendencias.map((p) => <CartaoPendencia key={`${p.tipo}-${p.data}-${'inicio' in p ? p.inicio : ''}`} pendencia={p} />)}

      <div class="secao">Já respondidas</div>
      <label class="busca">
        <IconeBusca tamanho={18} />
        <input type="search" placeholder="Buscar nas justificativas…" value={busca} onInput={(e) => setBusca((e.target as HTMLInputElement).value)} />
      </label>
      <div class="cartao" style={{ padding: '10px 14px' }}>
        {filtrados.length === 0 && <div class="vazio">{itens.length === 0 ? 'Nenhuma resposta ainda.' : 'Nada encontrado.'}</div>}
        {filtrados.map((i) => (
          <a class={`historico-item${i.substituida ? ' substituida' : ''}`} key={i.id} href={`#/dia/${i.data}`} style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
            <div class="historico-topo"><b>{i.titulo}</b><span class={`etiqueta ${i.tom}`}>{i.decisao}</span></div>
            {i.justificativa && <div class="justificativa">"{i.justificativa}"</div>}
            <div class="discreto" style={{ marginTop: '4px' }}>{i.rodape}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
