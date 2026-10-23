import { describe, expect, it } from 'vitest';
import { calcularDia } from '../src/calculo/dia';
import { classificarNovaBatida } from '../src/calculo/eventos';
import { MENOS } from '../src/tempo';
import {
  MODELOS_CARINHO, MODELOS_ENTRADA, MODELOS_SAIDA, MODELOS_SAIDA_ALMOCO, MODELOS_VOLTA, MODELOS_VOLTA_COM_PREVISAO,
  RESUMO, gerarNotificacao, saudacao,
} from '../src/textos/notificacoes';
import { batida, h } from './ajuda';
import { CONFIG, HOJE } from './ajuda-dia';

const ctx = (agora: string) => ({ nome: 'Maria', agora: h(agora), sortear: () => 0 });

describe('saudacao', () => {
  it('muda ao meio-dia e às 18h', () => {
    expect(saudacao(h('11:59:59'))).toBe('Bom dia');
    expect(saudacao(h('12:00'))).toBe('Boa tarde');
    expect(saudacao(h('17:59:59'))).toBe('Boa tarde');
    expect(saudacao(h('18:00'))).toBe('Boa noite');
  });
});

describe('modelos', () => {
  it('toda mensagem de batida e todo cenário de resumo têm pelo menos 3 frases', () => {
    const listas = [MODELOS_ENTRADA, MODELOS_SAIDA_ALMOCO, MODELOS_SAIDA, MODELOS_VOLTA, MODELOS_VOLTA_COM_PREVISAO, ...Object.values(RESUMO)];
    for (const lista of listas) expect(lista.length).toBeGreaterThanOrEqual(3);
  });
});

describe('gerarNotificacao: batidas', () => {
  it('entrada com saudação, nome e horário com segundos', () => {
    expect(gerarNotificacao({ tipo: 'entrada', segundos: h('07:59:38') }, ctx('07:59:40'))).toEqual({
      titulo: 'Entrada registrada', corpo: '☀️ Bom dia, Maria! Entrada às 07:59:38 registrada.', destino: '#/hoje',
    });
  });

  it('volta com previsão arredondada para o minuto seguinte', () => {
    const n = gerarNotificacao({ tipo: 'volta', segundos: h('13:15:12'), previsao: 64778 }, ctx('13:15:20'));
    expect(n.corpo).toBe('⏰ De volta! Pra fechar o dia no zero, sua saída é às 18:00.');
  });

  it('saída pro almoço e saída comum usam modelos diferentes', () => {
    expect(gerarNotificacao({ tipo: 'saida_intermediaria', segundos: h('12:03:12'), almoco: true }, ctx('12:03:20')).corpo)
      .toBe('🍽️ Bom almoço, Maria! Saída às 12:03:12 registrada.');
    expect(gerarNotificacao({ tipo: 'saida_intermediaria', segundos: h('10:00'), almoco: false }, ctx('10:00:10')).corpo)
      .toBe('Saída às 10:00:00 registrada. Até já! 👋');
  });
});

describe('gerarNotificacao: resumo da saída', () => {
  const resumo = (saldoDia: number, bancoAntes: number) =>
    gerarNotificacao({ tipo: 'resumo_saida', saldoDia, bancoAntes, bancoDepois: bancoAntes + saldoDia }, ctx('18:30')).corpo;

  it('banco negativo e dia positivo: motivação com o que falta', () => {
    expect(resumo(780, -6000)).toBe('Boa noite, Maria! Isso aí, hoje pagamos +13min. Falta só 1h27 pra zerar 💪');
  });

  it('acabou de zerar', () => {
    expect(resumo(600, -300)).toBe('ZERAMOS, Maria! 🥳 Banco no azul: +5min.');
  });

  it('banco negativo e dia negativo', () => {
    expect(resumo(-1500, -5000)).toBe(`Boa noite, Maria. Hoje ficou ${MENOS}25min, mas amanhã a gente recupera 😉 Faltam 1h48min20s.`);
  });

  it('banco positivo e dia positivo', () => {
    expect(resumo(1920, 13080)).toBe('Hoje rendeu +32min 🎉 Banco: +4h10.');
  });

  it('banco positivo e dia negativo', () => {
    expect(resumo(-900, 15000)).toBe('Hoje usamos 15min do banco. Ainda sobram 3h55 😌');
  });

  it('banco virou negativo', () => {
    expect(resumo(-900, 300)).toBe(`Hoje ficou ${MENOS}15min e o banco foi pra ${MENOS}10min. Amanhã a gente recupera 😉`);
  });
});

describe('gerarNotificacao: pendências e alertas', () => {
  it('pendência de abono abre a tela de pendências', () => {
    expect(gerarNotificacao({ tipo: 'nova_pendencia', pendencia: { tipo: 'abono_intervalo', data: '2026-10-20', inicio: h('10:00'), fim: h('10:50') } }, ctx('14:00'))).toEqual({
      titulo: 'Pendência', corpo: '🤔 Você saiu das 10:00 às 10:50 em 20/10. Foi abonado? Toca pra responder.', destino: '#/pendencias',
    });
  });

  it('alerta de outra pessoa abre o dia do comprovante', () => {
    const n = gerarNotificacao({ tipo: 'alerta', alerta: { tipo: 'outra_pessoa', data: '2026-10-23', segundos: h('07:59:38'), nome: 'FULANA DE TAL' } }, ctx('08:00'));
    expect(n.corpo).toBe('⚠️ O comprovante de 23/10 às 07:59:38 está no nome de FULANA DE TAL. Provavelmente o RH lançou errado.');
    expect(n.destino).toBe('#/dia/2026-10-23');
  });

  it('pendências antigas no singular e no plural', () => {
    expect(gerarNotificacao({ tipo: 'pendencias_antigas', quantidade: 1 }, ctx('12:00')).corpo).toBe('Ainda tem 1 resposta esperando por você 🙏');
    expect(gerarNotificacao({ tipo: 'pendencias_antigas', quantidade: 3 }, ctx('12:00')).corpo).toBe('Ainda tem 3 respostas esperando por você 🙏');
  });
});

describe('gerarNotificacao: recado de carinho', () => {
  it('tem várias versões, todas com quem manda e o título de recado especial', () => {
    expect(MODELOS_CARINHO.length).toBeGreaterThanOrEqual(5);
    MODELOS_CARINHO.forEach((_, i) => {
      const n = gerarNotificacao({ tipo: 'carinho', de: 'João' }, { nome: 'Maria', agora: h('14:00'), sortear: () => i });
      expect(n.titulo).toBe('💌 Recado especial');
      expect(n.corpo).toContain('João');
      expect(n.destino).toBe('#/hoje');
    });
  });

  it('chama ela de "amor" e vem do "seu marido"', () => {
    expect(gerarNotificacao({ tipo: 'carinho', de: 'seu marido' }, ctx('10:30')).corpo).toBe('💌 Recado do seu marido: "Eu te amo muito, amor!" ❤️');
    for (const modelo of MODELOS_CARINHO) expect(modelo({ s: 'Bom dia', nome: 'Maria', de: 'seu marido' })).not.toContain('Maria');
  });
});

describe('classificarNovaBatida', () => {
  const janela = CONFIG.jornadas[0].janelaAlmoco;
  const b = ['07:59:38', '12:03:12', '13:15:12', '18:00:00'].map((hora) => batida(HOJE, hora));
  const dia = calcularDia({ data: HOJE, hoje: HOJE, batidas: b, respostas: [], ajustes: [], config: CONFIG });

  it('entrada, saída pro almoço, volta e saída final', () => {
    expect(b.map((x) => classificarNovaBatida(dia, x.id, janela))).toEqual([
      { tipo: 'entrada' }, { tipo: 'saida_intermediaria', almoco: true }, { tipo: 'volta' }, { tipo: 'saida_final' },
    ]);
  });

  it('saída antes do horário de almoço não é almoço; duplicada não gera evento', () => {
    const saida = batida(HOJE, '10:00');
    const dup = batida(HOJE, '10:02');
    const d = calcularDia({ data: HOJE, hoje: HOJE, batidas: [batida(HOJE, '08:00'), saida, dup], respostas: [], ajustes: [], config: CONFIG });
    expect(classificarNovaBatida(d, saida.id, janela)).toEqual({ tipo: 'saida_intermediaria', almoco: false });
    expect(classificarNovaBatida(d, dup.id, janela)).toBeNull();
  });
});
