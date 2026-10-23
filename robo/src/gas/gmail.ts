import { htmlParaTexto, lerComprovante, normalizarEspacos } from '../../../motor/src/index';
import type { MensagemLida, PortaGmail } from '../nucleo/sincronizar';
import { momentoLocal, textoLocal } from './tempoLocal';

type Parte = GoogleAppsScript.Gmail.Schema.MessagePart;

function cabecalho(parte: Parte | undefined, nome: string): string {
  return (parte?.headers ?? []).find((h) => (h.name ?? '').toLowerCase() === nome)?.value ?? '';
}

function decodificar(parte: Parte): string {
  const dados = parte.body?.data as unknown;
  if (!dados) return '';
  const bytes = typeof dados === 'string' ? Utilities.base64DecodeWebSafe(dados) : (dados as GoogleAppsScript.Byte[]);
  const charset = /charset="?([\w-]+)"?/i.exec(cabecalho(parte, 'content-type'))?.[1] ?? 'UTF-8';
  try {
    return Utilities.newBlob(bytes).getDataAsString(charset);
  } catch {
    return Utilities.newBlob(bytes).getDataAsString('UTF-8');
  }
}

function coletar(parte: Parte | undefined, saida: { html: string[]; texto: string[] }): void {
  if (!parte) return;
  const mime = (parte.mimeType ?? '').toLowerCase();
  if (mime === 'text/html') saida.html.push(decodificar(parte));
  else if (mime === 'text/plain') saida.texto.push(decodificar(parte));
  for (const p of parte.parts ?? []) coletar(p, saida);
}

/** Usa a primeira versão do corpo (HTML antes de texto puro) em que o leitor encontra a data/hora. */
export function melhorTexto(htmls: string[], textos: string[]): string {
  const candidatos = [...htmls.map(htmlParaTexto), ...textos.map(normalizarEspacos)].filter((c) => c.length > 0);
  return candidatos.find((c) => lerComprovante(c).registradoEm) ?? candidatos[0] ?? '';
}

export const gmailReal: PortaGmail = {
  listarIds(consulta: string): string[] {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const r = Gmail!.Users!.Messages!.list('me', { q: consulta, includeSpamTrash: true, maxResults: 500, pageToken });
      for (const m of r.messages ?? []) if (m.id) ids.push(m.id);
      pageToken = r.nextPageToken ?? undefined;
    } while (pageToken);
    return ids;
  },

  ler(id: string): MensagemLida {
    const m = Gmail!.Users!.Messages!.get('me', id, { format: 'full' });
    const recebido = new Date(Number(m.internalDate));
    const dataCabecalho = cabecalho(m.payload, 'date');
    const cab = dataCabecalho ? new Date(dataCabecalho) : null;
    const partes = { html: [] as string[], texto: [] as string[] };
    coletar(m.payload, partes);
    return {
      id,
      assunto: cabecalho(m.payload, 'subject'),
      remetente: cabecalho(m.payload, 'from'),
      texto: melhorTexto(partes.html, partes.texto),
      recebidoEm: momentoLocal(recebido),
      recebidoEmTexto: textoLocal(recebido),
      cabecalhoData: cab && !isNaN(cab.getTime()) ? momentoLocal(cab) : undefined,
    };
  },
};
