import { calcularPeriodo, dataBR, formatarDuracao, formatarSaldo } from '@ponto-certo/motor';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Avisos } from '../componentes/Avisos';
import { BarrasPeriodo } from '../componentes/Barras';
import { IconeBaixar, IconeImpressora } from '../componentes/Icones';
import { vigentes } from '../dados/calculo';
import { baixarSozinho, gerarExcel, moduloExcel, urlDoArquivo } from '../dados/excel';
import { classeDoSaldo, partesDoSaldo } from '../dados/formatos';
import { intervaloDoAtalho, recortar, type Atalho, type Intervalo } from '../dados/periodo';
import { montarRelatorio } from '../dados/relatorio';
import { useApp } from '../estado/contexto';

const ATALHOS: Array<[Atalho, string]> = [['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['ano', 'Ano'], ['periodo', 'Período']];
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const detalheDoErro = (e: unknown): string => (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).slice(0, 160);

export function Caderninho() {
  const app = useApp();
  const { estado, calculo } = app;
  const hoje = calculo?.relogio.hoje ?? '';
  const [atalho, setAtalho] = useState<Atalho>('mes');
  const [intervalo, setIntervalo] = useState<Intervalo>(() => intervaloDoAtalho('mes', hoje));
  const [gerando, setGerando] = useState(false);
  const [falha, setFalha] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<{ nome: string; url: string } | null>(null);

  const recorte = estado ? recortar(intervalo, estado.config.inicioBanco, hoje) : null;
  const periodo = useMemo(() => {
    if (!estado || !recorte) return null;
    return calcularPeriodo({ ...recorte, hoje, batidas: estado.batidas, respostas: vigentes(estado), ajustes: estado.ajustes, config: estado.config });
  }, [estado, recorte?.de, recorte?.ate, hoje]);
  const relatorioImpressao = useMemo(() => (estado && calculo && recorte ? montarRelatorio(estado, calculo.relogio, recorte.de, recorte.ate) : null), [estado, calculo, recorte?.de, recorte?.ate]);
  // O arquivo gerado vale para o período em que foi gerado: trocou o período ou saiu da tela, ele some (e libera a memória).
  useEffect(() => () => {
    if (arquivo) URL.revokeObjectURL(arquivo.url);
  }, [arquivo]);
  useEffect(() => {
    setArquivo(null);
  }, [recorte?.de, recorte?.ate]);

  if (!estado || !calculo) return null;

  const escolher = (novo: Atalho) => {
    setAtalho(novo);
    if (novo !== 'periodo') setIntervalo(intervaloDoAtalho(novo, hoje));
  };
  const mudarData = (campo: 'de' | 'ate', valor: string) => {
    if (!valor) return;
    setAtalho('periodo');
    setIntervalo((atual) => ({ ...atual, [campo]: valor }));
  };

  const exportar = async () => {
    if (!recorte) return;
    setGerando(true);
    setFalha(null);
    setArquivo(null);
    let etapa = 'carregar o gerador';
    try {
      const ExcelJS = moduloExcel(await import('exceljs'));
      etapa = 'montar o relatório';
      const relatorio = montarRelatorio(estado, calculo.relogio, recorte.de, recorte.ate);
      etapa = 'gerar o arquivo';
      const url = urlDoArquivo(await gerarExcel(ExcelJS, relatorio), MIME_XLSX);
      setArquivo({ nome: relatorio.nomeArquivo, url });
      try {
        baixarSozinho(url, relatorio.nomeArquivo);
      } catch {
        // Não baixou sozinho: o botão "Baixar" que aparece na tela resolve com um toque.
      }
    } catch (e) {
      setFalha(`Não deu pra gerar o Excel (${etapa} · ${detalheDoErro(e)}). Tente de novo; se repetir, manda um print desta mensagem.`);
    } finally {
      setGerando(false);
    }
  };

  const saldo = periodo ? partesDoSaldo(periodo.resumo.saldo) : null;

  return (
    <div class="tela">
      <Avisos />
      <div class="titulo-tela nao-imprimir">
        <h1>Caderninho 📒</h1>
        <p>Resumo e exportação de qualquer período</p>
      </div>
      <div class="so-impressao"><h2 style={{ margin: 0 }}>Ponto Certo · {recorte ? `${dataBR(recorte.de)} a ${dataBR(recorte.ate)}` : ''}</h2></div>

      <div class="atalhos-periodo nao-imprimir">
        {ATALHOS.map(([chave, rotulo]) => (
          <button type="button" key={chave} class={atalho === chave ? 'marcado' : ''} onClick={() => escolher(chave)}>{rotulo}</button>
        ))}
      </div>
      <div class="intervalo nao-imprimir">
        <label><small>De</small><input type="date" value={intervalo.de} onChange={(e) => mudarData('de', (e.target as HTMLInputElement).value)} /></label>
        <span>→</span>
        <label><small>Até</small><input type="date" value={intervalo.ate} onChange={(e) => mudarData('ate', (e.target as HTMLInputElement).value)} /></label>
      </div>

      {!recorte || !periodo || !saldo ? (
        <div class="cartao vazio">Esse período é antes do início do banco ({dataBR(estado.config.inicioBanco)}) ou ainda não começou.</div>
      ) : (
        <>
          {(recorte.de !== intervalo.de || recorte.ate !== intervalo.ate) && (
            <div class="discreto nao-imprimir" style={{ margin: '-4px 4px 10px' }}>Calculado de {dataBR(recorte.de)} a {dataBR(recorte.ate)} (do início do banco até hoje).</div>
          )}
          <div class="cartao cartao-hero">
            <div class="rotulo">Saldo do período</div>
            <div class={`numero-grande ${classeDoSaldo(periodo.resumo.saldo)}`} style={{ fontSize: '40px' }}>
              {saldo.principal}{saldo.resto && <small>{saldo.resto}</small>}
            </div>
            <div class="sub">
              Banco: <b class={classeDoSaldo(periodo.bancoInicio)}>{formatarSaldo(periodo.bancoInicio)}</b> → <b class={classeDoSaldo(periodo.bancoFim)}>{formatarSaldo(periodo.bancoFim)}</b>
              {periodo.bancoFim > periodo.bancoInicio && periodo.bancoInicio < 0 ? ' · pagou ' + formatarDuracao(periodo.bancoFim - periodo.bancoInicio) + ' 💪' : ''}
            </div>
            <BarrasPeriodo dias={periodo.dias} />
          </div>
          <div class="grade-tres">
            <div><small>Trabalhado</small><b>{formatarDuracao(periodo.resumo.trabalhado)}</b></div>
            <div><small>Previsto</small><b>{formatarDuracao(periodo.resumo.carga)}</b></div>
            <div><small>Dias trabalhados</small><b>{periodo.resumo.diasTrabalhados}</b></div>
            <div><small>Abonado</small><b>{formatarDuracao(periodo.resumo.abonado)}</b></div>
            <div><small>Feriados</small><b>{periodo.resumo.feriados}</b></div>
            <div><small>Pendências</small><b class={periodo.resumo.pendencias ? 'ambar' : ''}>{periodo.resumo.pendencias}</b></div>
          </div>
          {arquivo ? (
            <>
              <a class="exportar excel nao-imprimir" href={arquivo.url} download={arquivo.nome}><IconeBaixar />Baixar o Excel</a>
              <div class="discreto nao-imprimir" style={{ textAlign: 'center', margin: '-2px 8px 10px' }}>
                Pronto ✓ {arquivo.nome}. Não apareceu o download? Toque no botão verde. O arquivo fica na pasta Downloads e abre no Planilhas Google ou no Excel.
              </div>
            </>
          ) : (
            <button type="button" class="exportar excel nao-imprimir" disabled={gerando} onClick={exportar}>
              <IconeBaixar />{gerando ? 'Gerando o Excel…' : 'Exportar Excel (.xlsx)'}
            </button>
          )}
          <button type="button" class="exportar pdf nao-imprimir" onClick={() => window.print()}>
            <IconeImpressora />Gerar PDF pra imprimir
          </button>
          {falha && <div class="aviso erro">{falha}</div>}
          <div class="discreto nao-imprimir" style={{ textAlign: 'center' }}>O arquivo traz todas as batidas com NSR e hash, as justificativas e a conferência com o Gmail.</div>
          {relatorioImpressao && (
            <table class="tabela-impressao so-impressao">
              <thead><tr>{relatorioImpressao.dias.cabecalho.filter((_, i) => i !== 13).map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
              <tbody>
                {relatorioImpressao.dias.linhas.map((linha, i) => <tr key={i}>{linha.filter((_, j) => j !== 13).map((c, j) => <td key={j}>{c}</td>)}</tr>)}
                <tr>{relatorioImpressao.dias.total.filter((_, j) => j !== 13).map((c, j) => <td key={j}><b>{c}</b></td>)}</tr>
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
