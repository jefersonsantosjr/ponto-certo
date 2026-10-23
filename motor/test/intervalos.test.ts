import { describe, expect, it } from 'vitest';
import { classificarIntervalos, lacunasEntrePares, type EntradaIntervalos } from '../src/calculo/intervalos';
import type { Resposta } from '../src/tipos';
import { h } from './ajuda';

const base: Omit<EntradaIntervalos, 'lacunas'> = {
  data: '2026-10-20',
  janelaAlmoco: { inicio: h('12:00'), fim: h('15:00') },
  almocoPadrao: h('01:12'),
  respostas: [],
  emAndamento: false,
};
const SAIDA = { inicio: h('10:00'), fim: h('10:50') };
const ALMOCO = { inicio: h('12:10'), fim: h('13:22') };

describe('lacunasEntrePares', () => {
  it('pega o espaço entre o fim de um par e o início do próximo', () => {
    expect(lacunasEntrePares([[1, 2], [5, 9], [10, 20]])).toEqual([{ inicio: 2, fim: 5 }, { inicio: 9, fim: 10 }]);
    expect(lacunasEntrePares([[1, 2]])).toEqual([]);
  });
});

describe('classificarIntervalos', () => {
  it('o intervalo que começa no horário de almoço é o almoço; o outro vira pergunta de abono', () => {
    const r = classificarIntervalos({ ...base, lacunas: [SAIDA, ALMOCO] });
    expect(r.intervalos.map((i) => [i.tipo, i.abonado, i.almocoIncerto, i.duracao])).toEqual([
      ['saida', false, false, 3000],
      ['almoco', false, false, 4320],
    ]);
    expect(r.pendencias).toEqual([{ tipo: 'abono_intervalo', data: '2026-10-20', ...SAIDA }]);
  });

  it('resposta de abono resolve a pendência e marca como abonado', () => {
    const respostas: Resposta[] = [{ tipo: 'abono_intervalo', data: '2026-10-20', ...SAIDA, abonado: true, justificativa: 'Dentista' }];
    const r = classificarIntervalos({ ...base, respostas, lacunas: [SAIDA, ALMOCO] });
    expect(r.intervalos[0]).toMatchObject({ tipo: 'saida', abonado: true });
    expect(r.pendencias).toEqual([]);
  });

  it('com dois intervalos no horário de almoço, almoço é o de duração mais perto de 1h12', () => {
    const r = classificarIntervalos({ ...base, lacunas: [{ inicio: h('12:00'), fim: h('12:20') }, { inicio: h('13:00'), fim: h('14:10') }] });
    expect(r.intervalos.map((i) => i.tipo)).toEqual(['saida', 'almoco']);
  });

  it('empate deixa o almoço incerto e pergunta qual foi', () => {
    const lacunas = [{ inicio: h('12:00'), fim: h('12:30') }, { inicio: h('13:00'), fim: h('13:30') }];
    const r = classificarIntervalos({ ...base, lacunas });
    expect(r.intervalos.map((i) => [i.tipo, i.almocoIncerto])).toEqual([['almoco', true], ['saida', false]]);
    expect(r.pendencias[0]).toEqual({ tipo: 'almoco_ambiguo', data: '2026-10-20', opcoes: lacunas });
    expect(r.pendencias[1]).toMatchObject({ tipo: 'abono_intervalo', inicio: h('13:00') });
  });

  it('nenhum intervalo no horário de almoço: provisório é o mais perto de 1h12 e pergunta', () => {
    const lacunas = [{ inicio: h('10:00'), fim: h('11:12') }];
    const r = classificarIntervalos({ ...base, lacunas });
    expect(r.intervalos[0]).toMatchObject({ tipo: 'almoco', almocoIncerto: true });
    expect(r.pendencias).toEqual([{ tipo: 'almoco_ambiguo', data: '2026-10-20', opcoes: lacunas }]);
  });

  it('a resposta "qual foi o almoço" resolve a dúvida', () => {
    const lacunas = [{ inicio: h('12:00'), fim: h('12:30') }, { inicio: h('13:00'), fim: h('13:30') }];
    const respostas: Resposta[] = [{ tipo: 'almoco_escolhido', data: '2026-10-20', ...lacunas[1], justificativa: 'Almocei às 13h' }];
    const r = classificarIntervalos({ ...base, respostas, lacunas });
    expect(r.intervalos.map((i) => i.tipo)).toEqual(['saida', 'almoco']);
    expect(r.pendencias).toEqual([{ tipo: 'abono_intervalo', data: '2026-10-20', ...lacunas[0] }]);
  });

  it('no dia em andamento com almoço incerto, ainda não pergunta nada', () => {
    expect(classificarIntervalos({ ...base, emAndamento: true, lacunas: [SAIDA] }).pendencias).toEqual([]);
  });

  it('sem lacunas, nada a classificar', () => {
    expect(classificarIntervalos({ ...base, lacunas: [] })).toEqual({ intervalos: [], pendencias: [] });
  });
});
