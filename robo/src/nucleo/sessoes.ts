import type { Papel, Sessao } from '../../../motor/src/index';

/** Guarda chave/valor (no Apps Script: Propriedades do Script). */
export interface Armazem {
  ler(chave: string): string | null;
  gravar(chave: string, valor: string): void;
}

export interface Cripto {
  /** SHA-256 em hexadecimal. */
  hash(texto: string): string;
  /** Segredo aleatório (hexadecimal, ≥ 64 caracteres). */
  aleatorio(): string;
}

interface CodigoGuardado { papel: Papel; nome: string; expira: number }
interface SessaoGuardada { papel: Papel; nome: string; criada: number; aparelho: string; usadaEm: number }
/** Conta Google ligada a um acesso (a chave é o hash do `sub` da conta, nunca o e-mail). */
interface ContaGoogleGuardada { papel: Papel; nome: string; vinculada: number }

const CHAVE_CODIGOS = 'CODIGOS_ATIVACAO';
const CHAVE_SESSOES = 'SESSOES';
const CHAVE_CONTAS_GOOGLE = 'CONTAS_GOOGLE';
export const VALIDADE_CODIGO_MS = 24 * 60 * 60 * 1000;
export const VALIDADE_SESSAO_MS = 180 * 24 * 60 * 60 * 1000;

function lerMapa<T>(arm: Armazem, chave: string): Record<string, T> {
  try {
    return JSON.parse(arm.ler(chave) ?? '{}') as Record<string, T>;
  } catch {
    return {};
  }
}

/** Cria um código de uso único para o link de ativação. */
export function gerarCodigo(arm: Armazem, cripto: Cripto, papel: Papel, nome: string, agoraMs: number): string {
  const codigo = cripto.aleatorio();
  const codigos = lerMapa<CodigoGuardado>(arm, CHAVE_CODIGOS);
  for (const [h, c] of Object.entries(codigos)) if (c.expira < agoraMs) delete codigos[h];
  codigos[cripto.hash(codigo)] = { papel, nome, expira: agoraMs + VALIDADE_CODIGO_MS };
  arm.gravar(CHAVE_CODIGOS, JSON.stringify(codigos));
  return codigo;
}

/** Troca o código (uma vez só) por uma sessão. */
export function ativar(arm: Armazem, cripto: Cripto, codigo: string, aparelho: string, agoraMs: number): Sessao | null {
  const codigos = lerMapa<CodigoGuardado>(arm, CHAVE_CODIGOS);
  const h = cripto.hash(codigo);
  const guardado = codigos[h];
  if (!guardado || guardado.expira < agoraMs) return null;
  delete codigos[h];
  arm.gravar(CHAVE_CODIGOS, JSON.stringify(codigos));

  return criarSessao(arm, cripto, guardado.papel, guardado.nome, aparelho, agoraMs);
}

function criarSessao(arm: Armazem, cripto: Cripto, papel: Papel, nome: string, aparelho: string, agoraMs: number): Sessao {
  const token = cripto.aleatorio();
  const sessoes = lerMapa<SessaoGuardada>(arm, CHAVE_SESSOES);
  sessoes[cripto.hash(token)] = { papel, nome, criada: agoraMs, aparelho: aparelho.slice(0, 120), usadaEm: agoraMs };
  arm.gravar(CHAVE_SESSOES, JSON.stringify(sessoes));
  return { token, nome, papel };
}

/** Valida o token; renova o uso (validade deslizante). */
export function validarToken(arm: Armazem, cripto: Cripto, token: string, agoraMs: number): { nome: string; papel: Papel } | null {
  if (!token) return null;
  const sessoes = lerMapa<SessaoGuardada>(arm, CHAVE_SESSOES);
  const h = cripto.hash(token);
  const s = sessoes[h];
  if (!s || s.usadaEm + VALIDADE_SESSAO_MS < agoraMs) return null;
  if (agoraMs - s.usadaEm > 60 * 60 * 1000) {
    s.usadaEm = agoraMs;
    arm.gravar(CHAVE_SESSOES, JSON.stringify(sessoes));
  }
  return { nome: s.nome, papel: s.papel };
}

/** Sessões abertas, sem token nem nome (vai no status público do robô, para diagnóstico). */
export function resumoSessoes(arm: Armazem): Array<Omit<SessaoGuardada, 'nome'>> {
  return Object.values(lerMapa<SessaoGuardada>(arm, CHAVE_SESSOES)).map(({ papel, aparelho, criada, usadaEm }) => ({ papel, aparelho, criada, usadaEm }));
}

/**
 * Liga a conta Google a quem já entrou (só quem tem acesso consegue ligar): depois, "Entrar com o Google"
 * abre uma sessão igual a essa, sem link de ativação. Ligar de novo a mesma conta só atualiza.
 */
export function vincularContaGoogle(arm: Armazem, cripto: Cripto, sub: string, usuario: { nome: string; papel: Papel }, agoraMs: number): void {
  const contas = lerMapa<ContaGoogleGuardada>(arm, CHAVE_CONTAS_GOOGLE);
  contas[cripto.hash(sub)] = { papel: usuario.papel, nome: usuario.nome, vinculada: agoraMs };
  arm.gravar(CHAVE_CONTAS_GOOGLE, JSON.stringify(contas));
}

export function contaGoogleVinculada(arm: Armazem, cripto: Cripto, sub: string): boolean {
  return cripto.hash(sub) in lerMapa<ContaGoogleGuardada>(arm, CHAVE_CONTAS_GOOGLE);
}

/** Abre uma sessão para a conta Google vinculada (o token do Google já foi conferido); null se a conta não está ligada. */
export function entrarComGoogle(arm: Armazem, cripto: Cripto, sub: string, aparelho: string, agoraMs: number): Sessao | null {
  const conta = lerMapa<ContaGoogleGuardada>(arm, CHAVE_CONTAS_GOOGLE)[cripto.hash(sub)];
  return conta ? criarSessao(arm, cripto, conta.papel, conta.nome, aparelho, agoraMs) : null;
}

/** Se essa pessoa (mesmo nome e papel) já ligou alguma conta Google. */
export function usuarioTemContaGoogle(arm: Armazem, usuario: { nome: string; papel: Papel }): boolean {
  return Object.values(lerMapa<ContaGoogleGuardada>(arm, CHAVE_CONTAS_GOOGLE)).some((c) => c.nome === usuario.nome && c.papel === usuario.papel);
}

export function encerrar(arm: Armazem, cripto: Cripto, token: string): void {
  const sessoes = lerMapa<SessaoGuardada>(arm, CHAVE_SESSOES);
  delete sessoes[cripto.hash(token)];
  arm.gravar(CHAVE_SESSOES, JSON.stringify(sessoes));
}
