import preact from '@preact/preset-vite';
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

// Endereço do robô para o "Entrar com o Google" (quem perdeu o acesso não tem mais o do link de ativação).
// No GitHub vem da variável URL_ROBO do repositório; no computador, da implantação local do robô.
const implantacao = new URL('../robo/.implantacao.json', import.meta.url);
process.env.VITE_URL_ROBO ??= existsSync(implantacao) ? String((JSON.parse(readFileSync(implantacao, 'utf8')) as { url?: string }).url ?? '') : '';

export default defineConfig({
  base: '/ponto-certo/',
  plugins: [preact()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
  server: { port: 5199 },
  preview: { port: 4199 },
});
