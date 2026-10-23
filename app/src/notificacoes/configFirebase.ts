import type { FirebaseOptions } from 'firebase/app';

// Dados PÚBLICOS do app web no projeto Firebase dela (por natureza vão no código do site).
// Console do Firebase → ⚙️ Configurações do projeto → Seus apps → app web "Ponto Certo" → firebaseConfig.
// Enquanto for null, o app mostra "notificações ainda não configuradas" e nada quebra.
export const FIREBASE_CONFIG: FirebaseOptions | null = null;

// Chave pública VAPID: ⚙️ Configurações do projeto → Cloud Messaging → Certificados push da Web.
export const VAPID_KEY: string | null = null;
