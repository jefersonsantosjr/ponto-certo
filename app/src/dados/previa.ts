import { dataCurtaBR, formatarSaldo } from '@ponto-certo/motor';
import type { DataISO, Estado, Segundos } from '@ponto-certo/motor';
import { calcular, type Hipotese } from './calculo';
import type { Relogio } from './datas';

export interface Efeito {
  saldoDiaAntes: Segundos;
  saldoDia: Segundos;
  bancoAntes: Segundos;
  bancoDepois: Segundos;
}

/** O que acontece com o dia e com o banco se a hipótese (resposta, batida ou ajuste) for gravada. */
export function efeitoDaHipotese(estado: Estado, relogio: Relogio, data: DataISO, hipotese: Hipotese): Efeito {
  const antes = calcular(estado, relogio);
  const depois = calcular(estado, relogio, hipotese);
  return {
    saldoDiaAntes: antes.dia(data)?.saldo ?? 0,
    saldoDia: depois.dia(data)?.saldo ?? 0,
    bancoAntes: antes.bancoAtual,
    bancoDepois: depois.bancoAtual,
  };
}

export function textoDoEfeito(data: DataISO, efeito: Efeito, hoje: DataISO): string {
  const dia = `o dia ${dataCurtaBR(data)} fica ${formatarSaldo(efeito.saldoDia)}`;
  if (data >= hoje) return `Com isso, ${dia} (hoje ainda não entra no banco).`;
  return `Com isso, ${dia} e o banco vai pra ${formatarSaldo(efeito.bancoDepois)}.`;
}
