import { describe, expect, it } from 'vitest';
// O mesmo arquivo que o service worker carrega com importScripts.
import codigo from '../../public/notificacao-payload.js?raw';

interface Aviso { titulo: string; corpo: string; link: string; tag: string }
type Leitor = (bruto: unknown, escopo: string) => Aviso;

function carregarLeitor(): Leitor {
  const falsoSelf: { PontoCertoNotificacao?: { lerPayloadFcm: Leitor } } = {};
  new Function('self', codigo)(falsoSelf);
  if (!falsoSelf.PontoCertoNotificacao) throw new Error('notificacao-payload.js não registrou o leitor');
  return falsoSelf.PontoCertoNotificacao.lerPayloadFcm;
}

const ler = carregarLeitor();
const ESCOPO = 'https://exemplo.github.io/ponto-certo/';

describe('leitura do push (FCM data message)', () => {
  it('usa título, corpo, link e tag mandados pelo robô', () => {
    const bruto = {
      from: '123', fcmMessageId: 'abc',
      data: { titulo: 'Entrada registrada', corpo: '☀️ Bom dia, Maria! Entrada às 07:59:38 registrada.', link: `${ESCOPO}#/hoje`, tag: 'batida' },
    };
    expect(ler(bruto, ESCOPO)).toEqual({
      titulo: 'Entrada registrada', corpo: '☀️ Bom dia, Maria! Entrada às 07:59:38 registrada.', link: `${ESCOPO}#/hoje`, tag: 'batida',
    });
  });

  it('aceita o formato com bloco "notification" do FCM', () => {
    const bruto = { notification: { title: 'Resumo do dia', body: 'Hoje rendeu +32min 🎉' }, fcmOptions: { link: `${ESCOPO}#/pendencias` } };
    expect(ler(bruto, ESCOPO)).toEqual({ titulo: 'Resumo do dia', corpo: 'Hoje rendeu +32min 🎉', link: `${ESCOPO}#/pendencias`, tag: 'ponto-certo' });
  });

  it('nunca abre link fora do app', () => {
    expect(ler({ data: { titulo: 'x', corpo: 'y', link: 'https://site-estranho.example.com/' } }, ESCOPO).link).toBe(`${ESCOPO}#/hoje`);
  });

  it('push vazio ou quebrado ainda vira uma notificação legível', () => {
    expect(ler(null, ESCOPO)).toEqual({ titulo: 'Ponto Certo', corpo: '', link: `${ESCOPO}#/hoje`, tag: 'ponto-certo' });
    expect(ler({ data: { titulo: 42 } }, ESCOPO).titulo).toBe('Ponto Certo');
  });
});
