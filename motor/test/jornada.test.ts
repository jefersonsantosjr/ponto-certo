import { describe, expect, it } from 'vitest';
import { configPadrao, infoDia } from '../src/calculo/jornada';
import type { VersaoJornada } from '../src/tipos';

const cfg = configPadrao('2026-09-01');

describe('jornada', () => {
  it('tem os valores padrão combinados', () => {
    expect(cfg.jornadas[0]).toMatchObject({
      inicio: '2026-09-01', almocoPadrao: 4320, janelaAlmoco: { inicio: 43200, fim: 54000 },
      cargaPorDiaSemana: [0, 31680, 31680, 31680, 31680, 31680, 0],
    });
    expect(cfg.regras).toEqual({ toleranciaLigada: true, tolerancia: 600, limiteDuplicada: 300, minimoParaDescontarAlmoco: 21600 });
    expect(cfg.saldoInicial).toBe(0);
    expect(cfg.inicioBanco).toBe('2026-09-01');
  });

  it('segunda a sexta têm 8h48; sábado e domingo, zero', () => {
    expect(infoDia('2026-10-23', cfg)).toMatchObject({ diaUtil: true, carga: 31680, feriado: null });
    expect(infoDia('2026-10-24', cfg)).toMatchObject({ diaUtil: false, carga: 0 });
  });

  it('feriado zera a carga', () => {
    expect(infoDia('2026-10-12', cfg)).toMatchObject({ diaUtil: false, carga: 0, feriado: 'Nossa Senhora Aparecida' });
  });

  it('usa a versão de jornada vigente em cada data', () => {
    const nova: VersaoJornada = { ...cfg.jornadas[0], inicio: '2026-11-01', cargaPorDiaSemana: [0, 28800, 28800, 28800, 28800, 28800, 0] };
    const c = { ...cfg, jornadas: [nova, cfg.jornadas[0]] };
    expect(infoDia('2026-10-30', c).carga).toBe(31680);
    expect(infoDia('2026-11-03', c).carga).toBe(28800);
  });

  it('antes da primeira versão não há jornada', () => {
    expect(infoDia('2026-08-31', cfg)).toMatchObject({ jornada: null, carga: 0, diaUtil: false });
  });
});
