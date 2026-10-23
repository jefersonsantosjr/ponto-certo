import { describe, expect, it } from 'vitest';
import { manuaisSubstituidas } from '../src/calculo/manuais';
import { chaveResposta, justificativaValida, respostasVigentes, type RespostaRegistrada } from '../src/calculo/respostas';
import { batida, h } from './ajuda';

const abono = (abonado: boolean, inicio = h('10:00'), fim = h('10:50')) =>
  ({ tipo: 'abono_intervalo', data: '2026-10-20', inicio, fim, abonado, justificativa: 'x' }) as const;

describe('respostas', () => {
  it('a chave identifica o que está sendo respondido', () => {
    expect(chaveResposta(abono(true))).toBe(`abono_intervalo|2026-10-20|${h('10:00')}-${h('10:50')}`);
    expect(chaveResposta({ tipo: 'dia_sem_batida', data: '2026-10-21', classificacao: 'ferias', justificativa: 'x' })).toBe('dia_sem_batida|2026-10-21');
    expect(chaveResposta({ tipo: 'batida_conta', data: '2026-10-21', batidaId: 'b9', justificativa: 'x' })).toBe('batida_conta|2026-10-21|b9');
  });

  it('vale a versão mais recente de cada resposta; respostas diferentes convivem', () => {
    const lista: RespostaRegistrada[] = [
      { id: 'r1', criadaEm: '2026-10-21T09:00:00', resposta: abono(true) },
      { id: 'r2', criadaEm: '2026-10-22T10:00:00', resposta: abono(false) },
      { id: 'r3', criadaEm: '2026-10-21T09:30:00', resposta: abono(true, h('15:00'), h('15:30')) },
    ];
    const vigentes = respostasVigentes(lista);
    expect(vigentes).toHaveLength(2);
    expect(vigentes).toContainEqual(abono(false));
    expect(vigentes).toContainEqual(abono(true, h('15:00'), h('15:30')));
  });

  it('justificativa precisa de pelo menos 3 caracteres de verdade', () => {
    expect(justificativaValida('  ab ')).toBe(false);
    expect(justificativaValida('abc')).toBe(true);
  });
});

describe('manuaisSubstituidas', () => {
  it('manual a até 30 min de um comprovante do mesmo dia é substituída', () => {
    const manual = batida('2026-10-20', '18:00', 'manual');
    expect(manuaisSubstituidas([manual, batida('2026-10-20', '18:25')])).toEqual([manual.id]);
    expect(manuaisSubstituidas([manual, batida('2026-10-20', '18:30:00')])).toEqual([manual.id]);
  });

  it('não substitui com comprovante longe, em outro dia, ou manual já inativa', () => {
    const manual = batida('2026-10-20', '18:00', 'manual');
    expect(manuaisSubstituidas([manual, batida('2026-10-20', '18:30:01')])).toEqual([]);
    expect(manuaisSubstituidas([manual, batida('2026-10-21', '18:00')])).toEqual([]);
    expect(manuaisSubstituidas([batida('2026-10-20', '18:00', 'manual', 'substituida'), batida('2026-10-20', '18:01')])).toEqual([]);
  });
});
