// Publica o robô: build → clasp push → cria/atualiza a implantação do app da web.
// Na primeira vez guarda o ID/URL da implantação em robo/.implantacao.json (fora do git) e refaz o build com a URL.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const arquivo = fileURLToPath(new URL('./.implantacao.json', import.meta.url));
const rodar = (cmd, args) => execFileSync(cmd, args, { cwd: raiz, encoding: 'utf8', shell: process.platform === 'win32' });

function enviar() {
  console.log(rodar('node', ['robo/build.mjs']).trim());
  console.log(rodar('npx', ['clasp', 'push', '--force']).trim().split('\n').slice(-2).join('\n'));
}

enviar();
let implantacao = existsSync(arquivo) ? JSON.parse(readFileSync(arquivo, 'utf8')) : null;
if (!implantacao) {
  const saida = rodar('npx', ['clasp', 'create-deployment', '--description', 'PontoCerto']);
  const id = /(AKfyc[\w-]+)/.exec(saida)?.[1];
  if (!id) throw new Error(`Não achei o ID da implantação na saída do clasp:\n${saida}`);
  implantacao = { deploymentId: id, url: `https://script.google.com/macros/s/${id}/exec` };
  writeFileSync(arquivo, JSON.stringify(implantacao, null, 2));
  console.log('Implantação criada. Refazendo o build com a URL do robô…');
  enviar();
}
console.log(rodar('npx', ['clasp', 'update-deployment', implantacao.deploymentId, '--description', `PontoCerto-${new Date().toISOString()}`]).trim().split('\n').slice(-1)[0]);
console.log(`Robô publicado em ${implantacao.url}`);
