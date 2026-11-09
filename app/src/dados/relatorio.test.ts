import { paraSegundos } from '@ponto-certo/motor';
import { describe, expect, it } from 'vitest';
import { estadoDaSemana } from './ajuda-teste';
import { gerarExcel, moduloExcel } from './excel';
import { intervaloDoAtalho, recortar } from './periodo';
import { ABAS, montarImpressao, montarRelatorio } from './relatorio';

const relogio = { hoje: '2026-10-23', agora: paraSegundos('15:42:00') };

describe('montarRelatorio', () => {
  const estado = estadoDaSemana();
  const r = montarRelatorio(estado, relogio, '2026-10-19', '2026-10-22');

  it('uma linha por dia, com as batidas válidas em ordem e a duplicada nas ocorrências', () => {
    expect(r.dias.linhas).toHaveLength(4);
    const terca = r.dias.linhas[1];
    expect(terca.slice(0, 8)).toEqual(['20/10/2026', 'ter', '07:56:00', '10:00:00', '10:50:00', '12:10:00', '13:22:00', '18:21:00']);
    expect(terca[12]).toBe('−0:25:00');
    expect(terca[13]).toBe(-1500);
    expect(String(terca[15])).toContain('Saída 10:00:00–10:50:00 PENDENTE');
    expect(String(terca[15])).toContain('Batida 07:57:00 duplicada (ignorada)');
    expect(String(terca[15])).toContain('Sem tolerância da CLT: entrada 07:56:00 (4min antes) + saída 18:21:00 (21min depois) = 25min no dia, passou de 10min, conta o registrado');
    expect(r.dias.pendentes).toEqual([false, true, false, false]);
  });

  it('o total bate com o cálculo do período', () => {
    expect(r.periodo.resumo.saldo).toBe(1920);
    expect(r.dias.total[12]).toBe('+0:32:00');
    expect(r.dias.total[13]).toBe(1920);
    expect(r.dias.total[14]).toBe('−1:33:00');
    expect(r.resumo).toContainEqual(['Banco no início', '−2:05:00']);
    expect(r.resumo).toContainEqual(['Observação', expect.stringContaining('Tolerância da CLT: variação de entrada (08:00) e saída (18:00) somando até 10min não conta; passou disso, conta o registrado; o almoço conta exato.')]);
  });

  it('lista todos os comprovantes do período com NSR e situação', () => {
    expect(r.comprovantes.linhas).toHaveLength(19);
    const duplicada = r.comprovantes.linhas.find((l) => l[1] === '07:57:00');
    expect(duplicada?.[8]).toBe('duplicada (ignorada)');
    expect(r.nomeArquivo).toBe('ponto_2026-10-19_a_2026-10-22.xlsx');
  });
});

describe('montarImpressao (PDF)', () => {
  const r = montarRelatorio(estadoDaSemana(), relogio, '2026-10-19', '2026-10-22');
  const impressao = montarImpressao(r);

  it('a tabela dos dias fica sem o texto das ocorrências e sem o saldo em segundos', () => {
    expect(impressao.cabecalho).toEqual(['Data', 'Dia', 'Entrada', 'Saída', 'Entrada', 'Saída', 'Entrada', 'Saída', 'Entrada', 'Saída', 'Trabalhado', 'Carga', 'Saldo do dia', 'Banco']);
    expect(impressao.linhas[1].slice(0, 2)).toEqual(['20/10/2026', 'ter']);
    expect(impressao.linhas[1].slice(12)).toEqual(['−0:25:00', r.dias.linhas[1][14]]);
    expect(impressao.total.slice(12)).toEqual(['+0:32:00', '−1:33:00']);
  });

  it('as informações do dia vão para a lista do final, com a data e o dia da semana', () => {
    const terca = impressao.informacoes.find((i) => i.data === '20/10/2026');
    expect(terca?.dia).toBe('ter');
    expect(terca?.texto).toContain('Saída 10:00:00–10:50:00 PENDENTE');
    expect(terca?.texto).toContain('Sem tolerância da CLT');
  });

  it('dia sem nenhuma informação não entra na lista', () => {
    const semTextoNaSegunda = { ...r, dias: { ...r.dias, linhas: r.dias.linhas.map((l, i) => (i === 0 ? [...l.slice(0, 15), ''] : l)) } };
    expect(montarImpressao(semTextoNaSegunda).informacoes.map((i) => i.data)).not.toContain('19/10/2026');
  });

  it('o Excel continua com a coluna de ocorrências', () => {
    expect(r.dias.cabecalho[15]).toBe('Ocorrências e justificativas');
  });
});

describe('gerarExcel', () => {
  it('gera um .xlsx com as 4 abas', async () => {
    const ExcelJS = moduloExcel(await import('exceljs'));
    const r = montarRelatorio(estadoDaSemana(), relogio, '2026-10-19', '2026-10-22');
    const dados = await gerarExcel(ExcelJS, r);
    const lida = new ExcelJS.Workbook();
    await lida.xlsx.load(dados);
    expect(lida.worksheets.map((w) => w.name)).toEqual([...ABAS]);
    const dias = lida.getWorksheet('Dias');
    expect(dias?.getRow(6).getCell(14).value).toBe(1920);
    // O ExcelJS de verdade leva ~2s; com a máquina ocupada passava dos 5s padrão e falhava sem bug.
  }, 30_000);
});

describe('períodos do Caderninho', () => {
  it('atalhos e recorte pelo início do banco e por hoje', () => {
    expect(intervaloDoAtalho('semana', '2026-10-23')).toEqual({ de: '2026-10-19', ate: '2026-10-25' });
    expect(intervaloDoAtalho('mes', '2026-10-23')).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(recortar({ de: '2026-10-01', ate: '2026-10-31' }, '2026-10-19', '2026-10-23')).toEqual({ de: '2026-10-19', ate: '2026-10-23' });
    expect(recortar({ de: '2026-09-01', ate: '2026-09-30' }, '2026-10-19', '2026-10-23')).toBeNull();
  });
});
