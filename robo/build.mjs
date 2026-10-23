// Empacota o robô para o Apps Script: um único Codigo.js + funções globais que o Google chama pelo nome.
import { build } from 'esbuild';
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const aqui = (caminho) => fileURLToPath(new URL(caminho, import.meta.url));
const implantacao = existsSync(aqui('./.implantacao.json')) ? JSON.parse(readFileSync(aqui('./.implantacao.json'), 'utf8')) : {};

mkdirSync(aqui('./dist'), { recursive: true });
await build({
  entryPoints: [aqui('./src/principal.ts')],
  outfile: aqui('./dist/Codigo.js'),
  bundle: true,
  format: 'iife',
  globalName: 'PontoCerto',
  target: 'es2019',
  charset: 'utf8',
  legalComments: 'none',
  define: {
    __URL_ROBO__: JSON.stringify(implantacao.url ?? ''),
    __URL_APP__: JSON.stringify('https://jefersonsantosjr.github.io/ponto-certo/'),
  },
});

const globais = ['doGet', 'doPost', 'onOpen', 'configurar', 'tick', 'vigia', 'checkupDiario', 'menuLinkDona', 'menuLinkLeitura', 'menuSincronizar', 'menuInicioBanco'];
appendFileSync(aqui('./dist/Codigo.js'), '\n' + globais.map((n) => `function ${n}(e) { return PontoCerto.${n}(e); }`).join('\n') + '\n');
copyFileSync(aqui('./appsscript.json'), aqui('./dist/appsscript.json'));
console.log(`robo/dist pronto${implantacao.url ? ' (com URL da implantação)' : ' (sem URL da implantação ainda)'}`);
