import { describe, expect, it } from 'vitest';
import { previsaoSaida } from '../src/calculo/previsao';
import { arredondarParaMinutoSeguinte, formatarHora, formatarHoraCurta } from '../src/tempo';
import { h } from './ajuda';
import { CONFIG, HOJE, diaDeTeste } from './ajuda-dia';

const jornada = CONFIG.jornadas[0];

describe('dia em andamento', () => {
  it('não abre pendência de batida faltando nem de dia sem batida antes do dia acabar', () => {
    const d = diaDeTeste(HOJE, ['07:59:38', '12:03:12', '13:15:12']);
    expect(d.status).toBe('em_andamento');
    expect(d.pendencias).toEqual([]);
    expect(d.trabalhado).toBe(14614);
    expect(diaDeTeste(HOJE, []).pendencias).toEqual([]);
  });
});

describe('previsaoSaida', () => {
  it('depois do almoço: última entrada + o que falta da carga', () => {
    const previsao = previsaoSaida(diaDeTeste(HOJE, ['07:59:38', '12:03:12', '13:15:12']), jornada);
    expect(previsao).toBe(64778);
    expect(formatarHora(previsao ?? 0)).toBe('17:59:38');
    expect(formatarHoraCurta(arredondarParaMinutoSeguinte(previsao ?? 0))).toBe('18:00');
  });

  it('antes do almoço: soma o almoço padrão', () => {
    expect(previsaoSaida(diaDeTeste(HOJE, ['07:59:38']), jornada)).toBe(64778);
  });

  it('uma saída no meio da manhã não conta como almoço', () => {
    expect(previsaoSaida(diaDeTeste(HOJE, ['08:00', '10:00', '10:50']), jornada)).toBe(h('18:50'));
  });

  it('sem previsão quando ela está fora ou o dia não tem carga', () => {
    expect(previsaoSaida(diaDeTeste(HOJE, ['08:00', '12:00']), jornada)).toBeNull();
    expect(previsaoSaida(diaDeTeste('2026-10-17', ['09:00']), jornada)).toBeNull();
  });
});
