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

  // A previsão é a primeira saída que não deixa o dia negativo. A entrada gasta parte dos 10min; o que sobra é a janela da saída.
  it.each([
    ['entrada 22s antes: sobram 9min38s de janela', ['07:59:38', '12:03:12', '13:15:12'], '17:50:22'],
    ['entrada 4min antes: sobram 6min', ['07:56', '12:00', '13:12'], '17:54:00'],
    ['entrada 3min atrasada: sobram 7min', ['08:03', '12:00', '13:12'], '17:53:00'],
    ['entrada 6min atrasada: sobram 4min', ['08:06', '12:00', '13:12'], '17:56:00'],
    ['entrada 10min antes: gastou o limite, sair antes das 18:00 conta o registrado', ['07:50', '12:00', '13:12'], '17:50:00'],
    ['entrada 12min atrasada: sem tolerância no dia', ['08:12', '12:00', '13:12'], '18:12:00'],
    ['almoço 2min mais longo: até 18:10 o saldo fica negativo, só a partir de 18:10:01', ['08:00', '12:00', '13:14'], '18:10:01'],
    ['entrada 10min atrasada e almoço longo: fora da janela, conta exato', ['08:10', '12:00', '13:30'], '18:28:00'],
    ['antes do almoço: soma o almoço padrão', ['07:59:38'], '17:50:22'],
    ['uma saída no meio da manhã não conta como almoço', ['08:00', '10:00', '10:50'], '18:50:00'],
  ])('%s', (_titulo, batidas, esperado) => {
    expect(formatarHora(previsaoSaida(diaDeTeste(HOJE, batidas), jornada, regras) ?? 0)).toBe(esperado);
  });

  it('a previsão é mesmo a primeira saída que não deixa o dia negativo', () => {
    const entradas = ['07:45', '07:50', '07:52', '07:55', '07:57', '08:00', '08:03', '08:05', '08:06', '08:10', '08:11', '08:20'];
    const voltas = ['13:05', '13:12', '13:15'];
    for (const entrada of entradas) {
      for (const volta of voltas) {
        const batidas = [entrada, '12:00', volta];
        const previsao = previsaoSaida(diaDeTeste(HOJE, batidas), jornada, regras) ?? 0;
        const saldoSaindo = (s: number) => diaDeTeste('2026-10-22', [...batidas, formatarHora(s)]).saldo;
        expect(saldoSaindo(previsao), `${entrada} ${volta}`).toBeGreaterThanOrEqual(0);
        expect(saldoSaindo(previsao - 1), `${entrada} ${volta}`).toBeLessThan(0);
        for (let s = previsao - 30; s > h('17:00'); s -= 30) expect(saldoSaindo(s), `${entrada} ${volta} saindo ${formatarHora(s)}`).toBeLessThan(0);
      }
    }
  });

  it('sem previsão quando ela está fora ou o dia não tem carga', () => {
    expect(previsaoSaida(diaDeTeste(HOJE, ['08:00', '12:00']), jornada, regras)).toBeNull();
    expect(previsaoSaida(diaDeTeste('2026-10-17', ['09:00']), jornada, regras)).toBeNull();
  });
});
