import { paraSegundos } from '@ponto-certo/motor';
import { describe, expect, it } from 'vitest';
import { estadoDaSemana } from './ajuda-teste';
import { gerarExcel, moduloExcel } from './excel';
import { intervaloDoAtalho, recortar } from './periodo';
import { ABAS, montarRelatorio } from './relatorio';

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
    expect(r.dias.pendentes).toEqual([false, true, false, false]);
  });

  it('o total bate com o cálculo do período', () => {
    expect(r.periodo.resumo.saldo).toBe(1920);
    expect(r.dias.total[12]).toBe('+0:32:00');
    expect(r.dias.total[13]).toBe(1920);
    expect(r.dias.total[14]).toBe('−1:33:00');
    expect(r.resumo).toContainEqual(['Banco no início', '−2:05:00']);
  });

  it('lista todos os comprovantes do período com NSR e situação', () => {
    expect(r.comprovantes.linhas).toHaveLength(19);
    const duplicada = r.comprovantes.linhas.find((l) => l[1] === '07:57:00');
    expect(duplicada?.[8]).toBe('duplicada (ignorada)');
    expect(r.nomeArquivo).toBe('ponto_2026-10-19_a_2026-10-22.xlsx');
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
