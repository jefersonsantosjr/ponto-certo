import type { Saude } from '@ponto-certo/motor';
import { describe, expect, it } from 'vitest';
import { avaliarSaude } from './saude';

const conferencia = { quando: '2026-10-23T15:30:00', tipo: 'completa' as const, totalGmail: 187, totalPlanilha: 187, ok: true, porClassificacao: {} };
const saude = (ultima: string | null, extra: Partial<Saude> = {}): Saude => ({ ultimaSincronizacao: ultima, ultimaConferencia: conferencia, problemas: [], ...extra });
const as = (hora: string) => new Date(`2026-10-23T${hora}`);

describe('avaliarSaude', () => {
  it('verde quando sincronizou há pouco', () => {
    expect(avaliarSaude(saude('2026-10-23T15:41:00'), as('15:42:00'))).toEqual({ nivel: 'ok', texto: '✓ Conferido às 15:41 · 187 e-mails = 187 registros' });
  });

  it('amarela com mais de 5 min no expediente', () => {
    expect(avaliarSaude(saude('2026-10-23T15:30:00'), as('15:36:00')).nivel).toBe('atencao');
  });

  it('vermelha com mais de 20 min no expediente', () => {
    expect(avaliarSaude(saude('2026-10-23T15:00:00'), as('15:21:00'))).toEqual({ nivel: 'problema', texto: 'O robô está sem sincronizar há 21 min.' });
  });

  it('fora do expediente tolera mais tempo', () => {
    expect(avaliarSaude(saude('2026-10-23T22:00:00'), as('22:15:00')).nivel).toBe('ok');
    expect(avaliarSaude(saude('2026-10-23T22:00:00'), as('22:30:00')).nivel).toBe('atencao');
  });

  it('problema informado pelo robô ou conferência que não bateu deixam vermelho', () => {
    expect(avaliarSaude(saude('2026-10-23T15:41:00', { problemas: ['1 e-mail não pôde ser lido.'] }), as('15:42:00'))).toEqual({ nivel: 'problema', texto: '1 e-mail não pôde ser lido.' });
    const naoBateu = { ...conferencia, ok: false, detalhe: '2 e-mails ainda não lidos' };
    expect(avaliarSaude(saude('2026-10-23T15:41:00', { ultimaConferencia: naoBateu }), as('15:42:00')).texto).toBe('2 e-mails ainda não lidos');
  });

  it('sem nenhuma sincronização é problema', () => {
    expect(avaliarSaude(saude(null), as('10:00:00')).nivel).toBe('problema');
  });
});
