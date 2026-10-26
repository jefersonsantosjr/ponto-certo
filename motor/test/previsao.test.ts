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
  const regras = CONFIG.regras;
  const semTolerancia = { ...regras, toleranciaLigada: false };

  it('sem tolerância: última entrada + o que falta da carga', () => {
    const config = { ...CONFIG, regras: semTolerancia };
    const previsao = previsaoSaida(diaDeTeste(HOJE, ['07:59:38', '12:03:12', '13:15:12'], { config }), jornada, semTolerancia);
    expect(previsao).toBe(64778);
    expect(formatarHora(previsao ?? 0)).toBe('17:59:38');
    expect(formatarHoraCurta(arredondarParaMinutoSeguinte(previsao ?? 0))).toBe('18:00');
  });

  // Com a tolerância de 5min na entrada (× 08:00) e na saída (× 18:00), a previsão é a primeira saída que não deixa o dia negativo.
  it.each([
    ['entrada 22s antes: a saída das 17:55 já fecha no zero', ['07:59:38', '12:03:12', '13:15:12'], '17:55:00'],
    ['entrada 4min antes (não conta): 17:55', ['07:56', '12:00', '13:12'], '17:55:00'],
    ['entrada 3min atrasada (não desconta): 17:55', ['08:03', '12:00', '13:12'], '17:55:00'],
    ['entrada 10min antes (conta): sai 10min antes, às 17:50', ['07:50', '12:00', '13:12'], '17:50:00'],
    ['almoço 2min mais longo: até 18:05 a saída não paga nada, só a partir de 18:05:01', ['08:00', '12:00', '13:14'], '18:05:01'],
    ['entrada 10min atrasada e almoço longo: fora da janela, conta exato', ['08:10', '12:00', '13:30'], '18:28:00'],
    ['antes do almoço: soma o almoço padrão', ['07:59:38'], '17:55:00'],
    ['uma saída no meio da manhã não conta como almoço', ['08:00', '10:00', '10:50'], '18:50:00'],
  ])('%s', (_titulo, batidas, esperado) => {
    expect(formatarHora(previsaoSaida(diaDeTeste(HOJE, batidas), jornada, regras) ?? 0)).toBe(esperado);
  });

  it('sair na previsão fecha o dia sem ficar devendo (e um segundo antes, não)', () => {
    for (const batidas of [['07:56', '12:00', '13:12'], ['08:03', '12:00', '13:12'], ['08:00', '12:00', '13:14'], ['08:10', '12:00', '13:30']]) {
      const previsao = previsaoSaida(diaDeTeste(HOJE, batidas), jornada, regras) ?? 0;
      const saldoSaindo = (s: number) => diaDeTeste('2026-10-22', [...batidas, formatarHora(s)]).saldo;
      expect(saldoSaindo(previsao)).toBeGreaterThanOrEqual(0);
      expect(saldoSaindo(previsao - 1)).toBeLessThan(0);
    }
  });

  it('sem previsão quando ela está fora ou o dia não tem carga', () => {
    expect(previsaoSaida(diaDeTeste(HOJE, ['08:00', '12:00']), jornada, regras)).toBeNull();
    expect(previsaoSaida(diaDeTeste('2026-10-17', ['09:00']), jornada, regras)).toBeNull();
  });
});
