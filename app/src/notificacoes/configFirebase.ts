import type { FirebaseOptions } from 'firebase/app';

// Dados PÚBLICOS do app web no projeto Firebase dela (por natureza vão no código do site).
// Console do Firebase → ⚙️ Configurações do projeto → Seus apps → app web "Ponto Certo" → firebaseConfig.
// Obtidos pela API de gerenciamento do Firebase (não digitados), em 23/10/2026.
export const FIREBASE_CONFIG: FirebaseOptions | null = {
  apiKey: 'AIzaSyDAA9O7oED6UbnZc3jaa7EB_MxfE0mypGc',
  authDomain: 'ponto-certo2.firebaseapp.com',
  projectId: 'ponto-certo2',
  storageBucket: 'ponto-certo2.firebasestorage.app',
  messagingSenderId: '691341513058',
  appId: '1:691341513058:web:e741e63ba68f611068dc3b',
};

// Chave pública VAPID: ⚙️ Configurações do projeto → Cloud Messaging → Certificados push da Web.
// Conferida como ponto válido da curva P-256 (uma letra errada a tornaria inválida).
export const VAPID_KEY: string | null =
  'BFvxY8qYhpuXZlxhu8fHBBZ6B4i_04Lbmio9aTkUL7uMRUwSO8KcUohulzdsus84BnfrV7FkfyMpzOtew4gst9Y';
