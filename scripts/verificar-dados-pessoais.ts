import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { procurarDadosPessoais } from './dados-pessoais';

const listar = (args: string[]): string[] =>
  execFileSync('git', args, { encoding: 'utf8' }).split('\n').map((s) => s.trim()).filter(Boolean);

const arquivos = process.argv.includes('--staged')
  ? listar(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
  : listar(['ls-files', '--cached', '--others', '--exclude-standard']);

const BINARIOS = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|pdf|zip|xlsx)$/i;
const achados = arquivos
  .filter((arquivo) => !BINARIOS.test(arquivo) && existsSync(arquivo))
  .flatMap((arquivo) => procurarDadosPessoais(arquivo, readFileSync(arquivo, 'utf8')));

if (achados.length > 0) {
  console.error('Dados pessoais encontrados. Commit bloqueado:');
  for (const a of achados) console.error(`  ${a.arquivo}:${a.linha}  ${a.tipo}  ${a.valor}`);
  process.exit(1);
}
console.log(`OK: nenhum dado pessoal em ${arquivos.length} arquivo(s).`);
