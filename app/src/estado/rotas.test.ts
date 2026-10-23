import { describe, expect, it } from 'vitest';
import { descreverAparelho } from '../api/cliente';
import { lerRota } from './rotas';

describe('lerRota', () => {
  it('lê nome, parâmetro e consulta do hash', () => {
    expect(lerRota('#/dia/2026-10-20')).toMatchObject({ nome: 'dia', parametro: '2026-10-20' });
    expect(lerRota('#/mes')).toMatchObject({ nome: 'mes', parametro: null });
    expect(lerRota('')).toMatchObject({ nome: 'hoje' });
    expect(lerRota('#/qualquer-coisa')).toMatchObject({ nome: 'hoje' });
  });

  it('decodifica o link de ativação', () => {
    const url = 'https://script.google.com/macros/s/ABC/exec';
    const rota = lerRota(`#/ativar?u=${encodeURIComponent(url)}&c=XYZ123`);
    expect(rota.nome).toBe('ativar');
    expect(rota.consulta.get('u')).toBe(url);
    expect(rota.consulta.get('c')).toBe('XYZ123');
  });
});

describe('descreverAparelho', () => {
  it('resume navegador e sistema', () => {
    expect(descreverAparelho('Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36')).toBe('Chrome · Android');
    expect(descreverAparelho('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0')).toBe('Edge · Windows');
  });
});
