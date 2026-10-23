import type { DataISO, Intervalo, Lacuna, Pendencia, Resposta, Segundos } from '../tipos';

export interface EntradaIntervalos {
  data: DataISO;
  lacunas: Lacuna[];
  janelaAlmoco: Lacuna;
  almocoPadrao: Segundos;
  respostas: Resposta[];
  emAndamento: boolean;
}

export function lacunasEntrePares(pares: Array<[Segundos, Segundos]>): Lacuna[] {
  return pares.slice(1).map((par, i) => ({ inicio: pares[i][1], fim: par[0] }));
}

const mesmaLacuna = (a: Lacuna, b: Lacuna): boolean => a.inicio === b.inicio && a.fim === b.fim;

function identificarAlmoco(e: EntradaIntervalos): { almoco: Lacuna | null; incerto: boolean } {
  if (e.lacunas.length === 0) return { almoco: null, incerto: false };

  const escolhido = e.respostas.find((r) => r.tipo === 'almoco_escolhido');
  if (escolhido?.tipo === 'almoco_escolhido') {
    const lacuna = e.lacunas.find((l) => l.inicio === escolhido.inicio && l.fim === escolhido.fim);
    if (lacuna) return { almoco: lacuna, incerto: false };
  }

  const naJanela = e.lacunas.filter((l) => l.inicio >= e.janelaAlmoco.inicio && l.inicio <= e.janelaAlmoco.fim);
  const candidatas = naJanela.length > 0 ? naJanela : e.lacunas;
  const distancia = (l: Lacuna): number => Math.abs(l.fim - l.inicio - e.almocoPadrao);
  const ordenadas = [...candidatas].sort((a, b) => distancia(a) - distancia(b) || a.inicio - b.inicio);
  const melhor = ordenadas[0];
  const empate = ordenadas.length > 1 && distancia(ordenadas[1]) === distancia(melhor);
  return { almoco: melhor, incerto: naJanela.length === 0 || empate };
}

export function classificarIntervalos(e: EntradaIntervalos): { intervalos: Intervalo[]; pendencias: Pendencia[] } {
  const { almoco, incerto } = identificarAlmoco(e);
  const pendencias: Pendencia[] = [];

  const intervalos = e.lacunas.map((lacuna): Intervalo => {
    const duracao = lacuna.fim - lacuna.inicio;
    if (almoco && mesmaLacuna(lacuna, almoco)) {
      return { ...lacuna, duracao, tipo: 'almoco', abonado: false, almocoIncerto: incerto };
    }
    const resposta = e.respostas.find((r) => r.tipo === 'abono_intervalo' && r.inicio === lacuna.inicio && r.fim === lacuna.fim);
    const abonado = resposta?.tipo === 'abono_intervalo' && resposta.abonado;
    if (!resposta && !(e.emAndamento && incerto)) {
      pendencias.push({ tipo: 'abono_intervalo', data: e.data, inicio: lacuna.inicio, fim: lacuna.fim });
    }
    return { ...lacuna, duracao, tipo: 'saida', abonado, almocoIncerto: false };
  });

  if (incerto && !e.emAndamento) {
    pendencias.unshift({ tipo: 'almoco_ambiguo', data: e.data, opcoes: e.lacunas.map(({ inicio, fim }) => ({ inicio, fim })) });
  }
  return { intervalos, pendencias };
}
