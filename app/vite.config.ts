import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/ponto-certo/',
  plugins: [preact()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1500 },
  server: { port: 5199 },
  preview: { port: 4199 },
});
