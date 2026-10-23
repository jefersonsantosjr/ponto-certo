import { render } from 'preact';
import { App } from './App';
import './estilos.css';

const raiz = document.getElementById('app');
if (raiz) render(<App />, raiz);

// Service worker só na versão publicada (no modo de demonstração não, pra não guardar dados falsos em cache).
if (import.meta.env.PROD && import.meta.env.MODE !== 'mock' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Sem service worker o app funciona normalmente, só não abre offline.
    });
  });
}
