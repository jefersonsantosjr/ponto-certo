import { MENOS } from '@ponto-certo/motor';
import type { Segundos } from '@ponto-certo/motor';

const dois = (n: number) => String(n).padStart(2, '0');

/** Rótulo curto em minutos para barras e calendário: +12, −25, +1h20, 0. */
export function rotuloCurto(segundos: Segundos): string {
  if (segundos === 0) return '0';
  const sinal = segundos > 0 ? '+' : MENOS;
  const minutos = Math.round(Math.abs(segundos) / 60);
  if (minutos === 0) return `${sinal}${Math.abs(segundos)}s`;
  return minutos >= 60 ? `${sinal}${Math.floor(minutos / 60)}h${dois(minutos % 60)}` : `${sinal}${minutos}`;
}

/** Divide um saldo para exibição grande: principal ("−1h27", "+25min") e resto menor ("12s"). */
export function partesDoSaldo(segundos: Segundos): { principal: string; resto: string } {
  if (segundos === 0) return { principal: '0min', resto: '' };
  const sinal = segundos > 0 ? '+' : MENOS;
  const abs = Math.abs(segundos);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const resto = s > 0 ? `${dois(s)}s` : '';
  if (h > 0) return { principal: `${sinal}${h}h${dois(m)}`, resto };
  if (m > 0) return { principal: `${sinal}${m}min`, resto };
  return { principal: `${sinal}${s}s`, resto: '' };
}

export function classeDoSaldo(segundos: Segundos): 'pos' | 'neg' | '' {
  return segundos > 0 ? 'pos' : segundos < 0 ? 'neg' : '';
}

/** 'AAAA-MM-DDTHH:MM:SS' → 'dd/mm às HH:MM'. */
export function quandoCurto(texto: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(texto);
  return m ? `${m[3]}/${m[2]} às ${m[4]}:${m[5]}` : texto;
}
