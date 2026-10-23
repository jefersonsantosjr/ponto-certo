import { readFileSync, writeFileSync } from 'node:fs';
import { simpleParser } from 'mailparser';
import { anonimizarHtml } from './anonimizar';

const [entrada, saida] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error('Uso: npx tsx scripts/anonimizar-eml.ts <original.eml> <saida.html>');
  process.exit(1);
}

const email = await simpleParser(readFileSync(entrada));
const html = typeof email.html === 'string' ? email.html : (email.textAsHtml ?? '');
if (!html) {
  console.error('O e-mail não tem corpo HTML.');
  process.exit(1);
}

const resultado = anonimizarHtml(html);
writeFileSync(saida, resultado.html, 'utf8');
console.log(`OK: ${resultado.substituicoes} substituição(ões). Campos lidos: ${resultado.camposEncontrados.join(', ')}`);
console.log(`Partes MIME: html=${typeof email.html === 'string'} text=${Boolean(email.text)} | Date: ${email.date?.toISOString() ?? '-'}`);
