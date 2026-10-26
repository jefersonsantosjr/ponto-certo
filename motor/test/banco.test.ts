import { describe, expect, it } from 'vitest';
import { calcularPeriodo, type EntradaPeriodo } from '../src/calculo/banco';
import { configPadrao } from '../src/calculo/jornada';
import type { Ajuste, Batida, VersaoJornada } from '../src/tipos';
import { batida } from './ajuda';

const HOJE = '2026-10-23';
const CONFIG = { ...configPadrao('2026-10-19'), saldoInicial: -7500 };

const DIAS: Record<string, string[]> = {
  '2026-10-19': ['08:00', '12:00', '13:12', '18:12'],                            // +12min
  '2026-10-20': ['07:56', '07:57', '10:00', '10:50', '12:10', '13:22', '18:21'], // −29min (entrada 4min antes não conta; abono pendente)
  '2026-10-21': ['07:58', '12:01', '13:13', '18:30'],                            // +30min (entrada 2min antes não conta)
  '2026-10-22': ['08:01', '12:30', '13:42', '18:14'],                            // +14min (atraso de 1min não conta)
  '2026-10-23': ['07:59:38', '12:03:12', '13:15:12'],                            // hoje, em andamento
};
const BATIDAS: Batida[] = Object.entries(DIAS).flatMap(([data, horas]) => horas.map((hora) => batida(data, hora)));

function periodo(extra: Partial<EntradaPeriodo> = {}) {
  return calcularPeriodo({ de: '2026-10-19', ate: '2026-10-25', hoje: HOJE, batidas: BATIDAS, respostas: [], ajustes: [], config: CONFIG, ...extra });
}

describe('calcularPeriodo', () => {
  it('soma os dias fechados, ignora o dia em andamento e acumula o banco', () => {
    const r = periodo();
    expect(r.dias.map((d) => d.saldo)).toEqual([720, -1740, 1800, 840, expect.any(Number), 0, 0]);
    expect(r.dias[4].status).toBe('em_andamento');
    expect(r.resumo).toMatchObject({ saldo: 1620, diasTrabalhados: 4, feriados: 0, pendencias: 1, ajustesBanco: 0 });
    expect(r.bancoInicio).toBe(-7500);
    expect(r.bancoFim).toBe(-5880);
    expect(r.bancoPorDia['2026-10-20']).toBe(-8520);
    expect(r.bancoPorDia['2026-10-22']).toBe(-5880);
    expect(r.pendencias).toEqual([{ tipo: 'abono_intervalo', data: '2026-10-20', inicio: 36000, fim: 39000 }]);
  });

  it('um recorte no meio herda o banco dos dias anteriores', () => {
    const r = periodo({ de: '2026-10-21', ate: '2026-10-22' });
    expect(r.bancoInicio).toBe(-8520);
    expect(r.resumo.saldo).toBe(2640);
    expect(r.bancoFim).toBe(-5880);
  });

  it('ajuste de banco entra na data dele; ajuste futuro ainda não', () => {
    const pago: Ajuste = { id: 'a1', data: '2026-10-21', tipo: 'ajuste_banco', segundos: -18000, justificativa: 'RH pagou 5h', ativo: true };
    const futuro: Ajuste = { id: 'a2', data: '2026-10-30', tipo: 'ajuste_banco', segundos: 3600, justificativa: 'x', ativo: true };
    const inativo: Ajuste = { ...pago, id: 'a3', ativo: false };
    const r = periodo({ ate: '2026-10-31', ajustes: [pago, futuro, inativo] });
    expect(r.bancoFim).toBe(-5880 - 18000);
    expect(r.resumo.ajustesBanco).toBe(-18000);
  });

  it('período começando antes do início do banco só traz dias a partir do início', () => {
    const r = periodo({ de: '2026-10-01' });
    expect(r.dias[0].data).toBe('2026-10-19');
    expect(r.bancoInicio).toBe(-7500);
  });

  it('mudança de jornada vale só a partir da data dela', () => {
    const oito: VersaoJornada = { ...CONFIG.jornadas[0], inicio: '2026-10-21', cargaPorDiaSemana: [0, 28800, 28800, 28800, 28800, 28800, 0] };
    const r = periodo({ config: { ...CONFIG, jornadas: [CONFIG.jornadas[0], oito] } });
    expect(r.dias.map((d) => d.saldo).slice(0, 4)).toEqual([720, -1740, 4680, 3720]);
  });
});
