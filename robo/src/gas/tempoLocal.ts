import { segundosEntre, type Momento } from '../../../motor/src/index';

const FUSO = 'America/Sao_Paulo';

/** 'AAAA-MM-DD HH:MM:SS' no horário de Brasília. */
export function textoLocal(data: Date): string {
  return Utilities.formatDate(data, FUSO, 'yyyy-MM-dd HH:mm:ss');
}

export function momentoDeTexto(texto: string): Momento {
  return {
    data: texto.slice(0, 10),
    segundos: Number(texto.slice(11, 13)) * 3600 + Number(texto.slice(14, 16)) * 60 + Number(texto.slice(17, 19)),
  };
}

export function momentoLocal(data: Date): Momento {
  return momentoDeTexto(textoLocal(data));
}

export interface Agora {
  /** 'AAAA-MM-DDTHH:MM:SS' local (ordena como texto). */
  iso: string;
  momento: Momento;
}

export function agoraLocal(): Agora {
  const texto = textoLocal(new Date());
  return { iso: texto.replace(' ', 'T'), momento: momentoDeTexto(texto) };
}

/** Segundos passados desde um 'AAAA-MM-DDTHH:MM:SS' local. */
export function segundosDesde(iso: string, agora: Agora): number {
  return segundosEntre(momentoDeTexto(iso.replace('T', ' ')), agora.momento);
}
