import type { Workbook, Worksheet, Row } from 'exceljs';
import type { Relatorio, Tabela } from './relatorio';

type ExcelJSModulo = { Workbook: new () => Workbook };

const VERDE = 'FF15803D';
const VERMELHO = 'FFDC2626';
const FUNDO_CABECALHO = 'FFE8F3EC';
const TEXTO_CABECALHO = 'FF14532D';
const FUNDO_PENDENTE = 'FFFFF8E6';

/** Aceita tanto o módulo com exportações nomeadas quanto o pacote UMD (default). */
export function moduloExcel(importado: unknown): ExcelJSModulo {
  const mod = importado as { Workbook?: unknown; default?: { Workbook?: unknown } };
  if (mod.Workbook) return mod as ExcelJSModulo;
  if (mod.default?.Workbook) return mod.default as ExcelJSModulo;
  throw new Error('Biblioteca do Excel não carregou.');
}

function estilizarCabecalho(linha: Row): void {
  linha.font = { bold: true, color: { argb: TEXTO_CABECALHO } };
  linha.eachCell((celula) => {
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FUNDO_CABECALHO } };
  });
}

function novaAba(pasta: Workbook, nome: string, tabela: Tabela, larguras: number[]): Worksheet {
  const aba = pasta.addWorksheet(nome, { views: [{ state: 'frozen', ySplit: 1 }] });
  aba.addRow(tabela.cabecalho);
  estilizarCabecalho(aba.getRow(1));
  tabela.linhas.forEach((linha) => aba.addRow(linha));
  larguras.forEach((largura, i) => {
    aba.getColumn(i + 1).width = largura;
  });
  return aba;
}

const cor = (segundos: number) => (segundos > 0 ? VERDE : segundos < 0 ? VERMELHO : undefined);

export function montarPasta(ExcelJS: ExcelJSModulo, r: Relatorio): Workbook {
  const pasta = new ExcelJS.Workbook();
  pasta.creator = 'Ponto Certo';
  pasta.created = new Date();

  novaAba(pasta, 'Resumo', { cabecalho: ['Item', 'Valor'], linhas: r.resumo.map(([item, valor]) => [item, valor]) }, [26, 90]);

  const dias = novaAba(pasta, 'Dias', r.dias, [12, 6, 10, 10, 10, 10, 10, 10, 10, 10, 12, 10, 13, 10, 12, 90]);
  r.dias.saldos.forEach((saldo, i) => {
    const linha = dias.getRow(i + 2);
    const tom = cor(saldo);
    if (tom) linha.getCell(13).font = { bold: true, color: { argb: tom } };
    if (r.dias.pendentes[i]) {
      linha.eachCell((celula) => {
        celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FUNDO_PENDENTE } };
      });
    }
  });
  const total = dias.addRow(r.dias.total);
  total.font = { bold: true };
  const tomTotal = cor(r.periodo.resumo.saldo);
  if (tomTotal) total.getCell(13).font = { bold: true, color: { argb: tomTotal } };

  novaAba(pasta, 'Comprovantes', r.comprovantes, [12, 10, 28, 10, 68, 18, 20, 14, 34, 20, 50]);
  novaAba(pasta, 'Justificativas', r.justificativas, [12, 30, 22, 60, 16, 20, 30]);
  return pasta;
}

export async function gerarExcel(ExcelJS: ExcelJSModulo, r: Relatorio): Promise<ArrayBuffer> {
  const buffer = await montarPasta(ExcelJS, r).xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

/** Endereço local (blob:) do arquivo gerado; quem chama revoga quando não precisar mais. */
export function urlDoArquivo(dados: ArrayBuffer, tipo: string): string {
  return URL.createObjectURL(new Blob([dados], { type: tipo }));
}

/** Tenta baixar sem toque. No computador sempre baixa; no celular pode não baixar, por isso a tela também mostra o link para tocar. */
export function baixarSozinho(url: string, nome: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
