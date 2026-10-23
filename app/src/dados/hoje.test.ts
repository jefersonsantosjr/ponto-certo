import { paraSegundos } from '@ponto-certo/motor';
import { describe, expect, it } from 'vitest';
import { estadoDaSemana } from './ajuda-teste';
import { calcular } from './calculo';
import { resumoHoje } from './hoje';
import { efeitoDaHipotese, textoDoEfeito } from './previa';

const relogio = { hoje: '2026-10-23', agora: paraSegundos('15:42:00') };

describe('resumoHoje', () => {
  const estado = estadoDaSemana();
  const r = resumoHoje(estado, calcular(estado, relogio));

  it('banco até ontem, sem o dia em andamento', () => {
    expect(r.banco).toBe(-5580);
    expect(r.saldoMes).toBe(1920);
    expect(r.mesNome).toBe('outubro');
  });

  it('trabalhado ao vivo soma o tempo desde a última entrada', () => {
    expect(r.dentro).toBe(true);
    expect(r.trabalhadoAoVivo).toBe(14614 + (paraSegundos('15:42:00') - paraSegundos('13:15:12')));
    expect(r.carga).toBe(31680);
    expect(r.previsao).toBe(64778);
  });

  it('rotula as batidas de hoje', () => {
    expect(r.batidas.map((b) => [b.hora, b.rotulo])).toEqual([['07:59:38', 'entrada'], ['12:03:12', 'almoço'], ['13:15:12', 'volta']]);
  });

  it('monta a semana de segunda a sexta, com hoje em andamento', () => {
    expect(r.semana.map((d) => [d.rotulo, d.saldo])).toEqual([['seg', 720], ['ter', -1500], ['qua', 1920], ['qui', 780], ['hoje', null]]);
    expect(r.saldoSemana).toBe(1920);
    expect(r.saudacao).toBe('Boa tarde');
    expect(r.dataExtenso).toBe('Sexta, 23 de outubro');
  });

  it('traz a pendência de abono do dia 20', () => {
    expect(r.pendencias).toEqual([{ tipo: 'abono_intervalo', data: '2026-10-20', inicio: 36000, fim: 39000 }]);
  });
});

describe('prévia de uma resposta', () => {
  it('abono da saída do dia 20 vira +25min e o banco sobe 50min', () => {
    const estado = estadoDaSemana();
    const efeito = efeitoDaHipotese(estado, relogio, '2026-10-20', {
      respostas: [{ tipo: 'abono_intervalo', data: '2026-10-20', inicio: 36000, fim: 39000, abonado: true, justificativa: 'Dentista' }],
    });
    expect(efeito).toEqual({ saldoDiaAntes: -1500, saldoDia: 1500, bancoAntes: -5580, bancoDepois: -2580 });
    expect(textoDoEfeito('2026-10-20', efeito, '2026-10-23')).toBe('Com isso, o dia 20/10 fica +25min e o banco vai pra −43min.');
  });
});
