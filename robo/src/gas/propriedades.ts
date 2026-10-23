import type { ConfigCalculo, Conferencia, IdentidadeEsperada } from '../../../motor/src/index';
import type { Armazem, Cripto } from '../nucleo/sessoes';

const props = (): GoogleAppsScript.Properties.Properties => PropertiesService.getScriptProperties();

export const armazem: Armazem = {
  ler: (chave) => props().getProperty(chave),
  gravar: (chave, valor) => {
    props().setProperty(chave, valor);
  },
};

export const cripto: Cripto = {
  hash: (texto) =>
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8)
      .map((b) => ((b + 256) % 256).toString(16).padStart(2, '0'))
      .join(''),
  aleatorio: () => (Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''),
};

function lerJson<T>(chave: string): T | null {
  const v = props().getProperty(chave);
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}

export const lerIdentidade = (): IdentidadeEsperada | null => lerJson<IdentidadeEsperada>('IDENTIDADE');
export const gravarIdentidade = (i: IdentidadeEsperada): void => {
  props().setProperty('IDENTIDADE', JSON.stringify(i));
};

export const lerConfig = (): ConfigCalculo | null => lerJson<ConfigCalculo>('CONFIG_CALCULO');
export const gravarConfig = (c: ConfigCalculo): void => {
  props().setProperty('CONFIG_CALCULO', JSON.stringify(c));
};

export const lerUltimaConferencia = (): Conferencia | null => lerJson<Conferencia>('ULTIMA_CONFERENCIA');
export const gravarUltimaConferencia = (c: Conferencia): void => {
  props().setProperty('ULTIMA_CONFERENCIA', JSON.stringify(c));
};

export const lerUltimaSincronizacao = (): string | null => props().getProperty('ULTIMA_SINCRONIZACAO');
export const gravarUltimaSincronizacao = (iso: string): void => {
  props().setProperty('ULTIMA_SINCRONIZACAO', iso);
};

export const lerTexto = (chave: string): string | null => props().getProperty(chave);
export const gravarTexto = (chave: string, valor: string): void => {
  props().setProperty(chave, valor);
};
