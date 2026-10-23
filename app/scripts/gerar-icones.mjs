// Gera os ícones PNG do app (relógio branco sobre azul) sem dependências: só zlib do Node.
// Uso: npm run icones -w app
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pedaco(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

function png(largura, altura, rgba) {
  const linhas = Buffer.alloc((largura * 4 + 1) * altura);
  for (let y = 0; y < altura; y++) {
    linhas[y * (largura * 4 + 1)] = 0;
    rgba.copy(linhas, y * (largura * 4 + 1) + 1, y * largura * 4, (y + 1) * largura * 4);
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(largura, 0);
  cabecalho.writeUInt32BE(altura, 4);
  cabecalho[8] = 8;
  cabecalho[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pedaco('IHDR', cabecalho),
    pedaco('IDAT', deflateSync(linhas, { level: 9 })),
    pedaco('IEND', Buffer.alloc(0)),
  ]);
}

const AZUL_A = [59, 130, 246];
const AZUL_B = [52, 211, 153];

/** Distância de um ponto a um segmento. */
function distSegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function desenhar(tamanho, { maskable }) {
  const rgba = Buffer.alloc(tamanho * tamanho * 4);
  const amostras = 4;
  const escala = maskable ? 0.72 : 0.86;
  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < amostras; sy++) {
        for (let sx = 0; sx < amostras; sx++) {
          const u = (x + (sx + 0.5) / amostras) / tamanho;
          const v = (y + (sy + 0.5) / amostras) / tamanho;
          // Fundo: quadrado arredondado (ou cheio, no maskable) com degradê azul → verde.
          const raio = maskable ? 0 : 0.22;
          const qx = Math.max(Math.abs(u - 0.5) - (0.5 - raio), 0);
          const qy = Math.max(Math.abs(v - 0.5) - (0.5 - raio), 0);
          const dentroFundo = Math.hypot(qx, qy) <= raio || maskable;
          if (!dentroFundo) continue;
          const t = (u + v) / 2;
          let cor = [AZUL_A[0] + (AZUL_B[0] - AZUL_A[0]) * t, AZUL_A[1] + (AZUL_B[1] - AZUL_A[1]) * t, AZUL_A[2] + (AZUL_B[2] - AZUL_A[2]) * t];
          // Relógio branco: anel + ponteiros + ponto central.
          const cx = (u - 0.5) / escala;
          const cy = (v - 0.5) / escala;
          const d = Math.hypot(cx, cy);
          const anel = d >= 0.3 && d <= 0.37;
          const ponteiroHora = distSegmento(cx, cy, 0, 0, 0, -0.19) <= 0.032;
          const ponteiroMin = distSegmento(cx, cy, 0, 0, 0.17, 0.08) <= 0.032;
          const centro = d <= 0.05;
          if (anel || ponteiroHora || ponteiroMin || centro) cor = [255, 255, 255];
          r += cor[0]; g += cor[1]; b += cor[2]; a += 255;
        }
      }
      const n = amostras * amostras;
      const i = (y * tamanho + x) * 4;
      const alfa = a / n;
      rgba[i] = alfa ? Math.round(r / (a / 255)) : 0;
      rgba[i + 1] = alfa ? Math.round(g / (a / 255)) : 0;
      rgba[i + 2] = alfa ? Math.round(b / (a / 255)) : 0;
      rgba[i + 3] = Math.round(alfa);
    }
  }
  return png(tamanho, tamanho, rgba);
}

const pasta = new URL('../public/icones/', import.meta.url);
mkdirSync(pasta, { recursive: true });
writeFileSync(new URL('icone-192.png', pasta), desenhar(192, { maskable: false }));
writeFileSync(new URL('icone-512.png', pasta), desenhar(512, { maskable: false }));
writeFileSync(new URL('icone-maskable-512.png', pasta), desenhar(512, { maskable: true }));
console.log('Ícones gerados em app/public/icones/');
