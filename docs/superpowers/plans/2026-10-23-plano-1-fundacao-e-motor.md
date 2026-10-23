# Ponto Certo — Plano 1: Fundação e Motor — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objetivo:** criar o repositório e o **motor**, uma biblioteca em TypeScript puro e testada que:
- lê os comprovantes do RHiD;
- classifica cada e-mail;
- calcula dia, período e banco de horas em segundos;
- confere o que está no Gmail contra o que foi gravado;
- gera os textos das notificações.

**Arquitetura:** monorepo com workspaces do npm. O motor fica em `motor/src` e não depende do Node nem do Google, o que é verificado por um `tsconfig` sem tipos de ambiente. Assim, o mesmo código roda no Apps Script (Plano 2) e no PWA (Plano 3). Scripts auxiliares ficam em `scripts/`:
- verificação de dados pessoais, rodando no hook de pre-commit e no CI;
- anonimização de comprovantes.

**Stack:** Node 24, TypeScript 5 (strict, ESM), Vitest 3, tsx, mailparser (só nos scripts), GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-23-ponto-certo-design.md`. Leia as seções 4, 5.3, 6, 7, 8, 14 e 16 antes de começar.

## Restrições globais

Todo comando roda na raiz do projeto (`c:\Users\Jéferson Santos\Desktop\PROJETOS\holerite`), no Git Bash.

**Linguagem e formato**
- **Unidade de tempo: segundos.** O tipo `Segundos` guarda segundos desde a meia-noite (hora local de Brasília) ou uma duração.
- **Datas:** `DataISO`, no formato `'AAAA-MM-DD'`. Nunca converter fuso.
- **Valores padrão** (spec §6.2–6.4):

  | Regra | Valor |
  |---|---|
  | Carga de segunda a sexta | 8h48 (31680 s) |
  | Carga de sábado e domingo | 0 |
  | Almoço padrão | 1h12 (4320 s) |
  | Janela do almoço (início do intervalo) | 12:00–15:00 (43200–54000 s), inclusive |
  | Batida duplicada | até 300 s depois da anterior mantida |
  | Tolerância (ligada) | ±600 s, inclusive |
  | Desconto de almoço com só 2 batidas | quando o par passa de 21600 s (6h) |
  | Atraso de e-mail que gera alerta | mais de 600 s |
  | Saída final (resumo) | batida de saída às 57600 s (16:00) ou depois |
  | Substituição de batida manual | comprovante a até 1800 s (30 min) |

- **Formatos de exibição** (Task 2): `formatarDuracao` → `13min05s`, `1h27`, `1h27min12s`, `45s`, `0min`. Saldo com sinal usa o menos tipográfico `−` (U+2212). Planilha usa `+0:12:05`.
- Todo texto visível para a usuária é em pt-BR.

**Motor e repositório**
- `motor/src` **não pode** importar `node:*` nem usar DOM. A checagem é `npm run typecheck` (o `tsconfig.src.json` tem `"types": []` e `lib` ES2022).
- **Nenhum dado pessoal no repositório (spec P6):**
  - CPF falso das fixtures: `12345678900`, com dígito verificador inválido de propósito;
  - nome falso: `MARIA EXEMPLO DA SILVA`;
  - CNPJ falso: `11111111000100`.
  - Nunca escreva CPF, nome, e-mail ou empregador reais em código, teste, comentário ou commit.
- Todo commit termina com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## Mapa de arquivos

```
.gitattributes                      LF em tudo (o hook de shell quebra com CRLF)
.gitignore
.githooks/pre-commit                roda a verificação de dados pessoais nos arquivos preparados
.github/workflows/testes.yml        CI: typecheck + testes + verificação de dados pessoais
package.json                        workspaces, scripts
tsconfig.base.json
vitest.config.ts
README.md
scripts/
  tsconfig.json
  dados-pessoais.ts                 procurarDadosPessoais(), cpfValido(), digitosVerificadores()
  dados-pessoais.test.ts
  verificar-dados-pessoais.ts       CLI (todos os arquivos ou --staged)
  anonimizar.ts                     anonimizarHtml(), regexTolerante()
  anonimizar.test.ts
  anonimizar-eml.ts                 CLI: .eml → HTML anonimizado
motor/
  package.json, tsconfig.json, tsconfig.src.json
  src/
    index.ts                        exporta a API pública
    tipos.ts                        todos os tipos compartilhados
    tempo.ts                        segundos, durações, datas
    feriados.ts                     Páscoa, nacionais, locais
    leitor/texto.ts                 HTML → texto, entidades, regex de rótulos
    leitor/comprovante.ts           lerComprovante()
    leitor/classificar.ts           classificarMensagem()
    calculo/jornada.ts              configPadrao(), infoDia()
    calculo/intervalos.ts           classificarIntervalos() (almoço × saída)
    calculo/dia.ts                  calcularDia()
    calculo/respostas.ts            respostasVigentes(), justificativaValida()
    calculo/manuais.ts              manuaisSubstituidas()
    calculo/previsao.ts             previsaoSaida()
    calculo/banco.ts                calcularPeriodo()
    calculo/eventos.ts              classificarNovaBatida()
    conferencia.ts                  conferirIds(), conferirCampos()
    textos/notificacoes.ts          gerarNotificacao()
  test/
    ajuda.ts, ajuda-dia.ts          ajudantes dos testes
    fixtures/dados-falsos.ts
    fixtures/comprovante-modelo.html
    *.test.ts
```

---

### Task 1: Fundação do repositório

**Arquivos:**
- Criar: `.gitattributes`, `.gitignore`, `package.json`, `tsconfig.base.json`, `vitest.config.ts`, `README.md`
- Criar: `motor/package.json`, `motor/tsconfig.json`, `motor/tsconfig.src.json`, `motor/src/index.ts`
- Criar: `scripts/tsconfig.json`, `scripts/dados-pessoais.ts`, `scripts/verificar-dados-pessoais.ts`, `.githooks/pre-commit`, `.github/workflows/testes.yml`
- Testar: `scripts/dados-pessoais.test.ts`

**Interfaces:**
- Produz:
  - `procurarDadosPessoais(arquivo: string, conteudo: string): Achado[]`
  - `cpfValido(digitos: string): boolean`
  - `digitosVerificadores(base9: string): string`
  - os scripts npm `test`, `typecheck` e `verificar:dados`

- [ ] **Passo 1: iniciar o git com identidade privada**

```bash
git init -b main
git config user.name "Jeferson Santos"
git config user.email "150202293+jefersonsantosjr@users.noreply.github.com"
```

A identidade fica só neste repositório. O e-mail `noreply` do GitHub evita que um e-mail real apareça nos commits públicos.

- [ ] **Passo 2: criar os arquivos de base**

`.gitattributes`:
```
* text=auto eol=lf
```

`.gitignore`:
```
node_modules/
dist/
coverage/
.superpowers/
.clasp.json
.env
.env.*
*.eml
originais/
*.log
.DS_Store
Thumbs.db
```

`package.json`:
```json
{
  "name": "ponto-certo",
  "private": true,
  "type": "module",
  "workspaces": ["motor"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p motor/tsconfig.json && tsc -p motor/tsconfig.src.json && tsc -p scripts/tsconfig.json",
    "verificar:dados": "tsx scripts/verificar-dados-pessoais.ts",
    "prepare": "git config core.hooksPath .githooks"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.8.0",
    "vitest": "^3.2.0"
  }
}
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  }
}
```

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['motor/test/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
});
```

`motor/package.json`:
```json
{
  "name": "@ponto-certo/motor",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts"
}
```

`motor/tsconfig.json` (código + testes, com os tipos do Node para os testes):
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["src", "test"]
}
```

`motor/tsconfig.src.json` (só o código e **sem** tipos de ambiente, o que garante que ele roda no Apps Script):
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "types": [] },
  "include": ["src"]
}
```

`motor/src/index.ts`:
```ts
// API pública do motor; cada task acrescenta as suas exportações.
export {};
```

`scripts/tsconfig.json`:
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": { "types": ["node"] },
  "include": ["."]
}
```

- [ ] **Passo 3: instalar**

Rodar: `npm install`
Esperado: instala sem erro. O `prepare` configura o hook, e `git config core.hooksPath` imprime `.githooks`.

- [ ] **Passo 4: escrever o teste que falha** em `scripts/dados-pessoais.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { cpfValido, digitosVerificadores, procurarDadosPessoais } from './dados-pessoais';

// Monta um CPF válido em tempo de execução, para que o próprio arquivo de teste não contenha um.
const BASE = '987654321';
const CPF_VALIDO = BASE + digitosVerificadores(BASE);

describe('cpfValido', () => {
  it('calcula os dígitos verificadores', () => {
    expect(digitosVerificadores(BASE)).toBe('00');
  });

  it('aceita CPF com dígitos corretos e recusa os demais', () => {
    expect(cpfValido(CPF_VALIDO)).toBe(true);
    expect(cpfValido('12345678900')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('123')).toBe(false);
  });
});

describe('procurarDadosPessoais', () => {
  it('acha CPF válido com e sem pontuação, informando a linha', () => {
    const formatado = `${CPF_VALIDO.slice(0, 3)}.${CPF_VALIDO.slice(3, 6)}.${CPF_VALIDO.slice(6, 9)}-${CPF_VALIDO.slice(9)}`;
    const achados = procurarDadosPessoais('x.ts', `a: ${formatado}\nb: ${CPF_VALIDO}`);
    expect(achados.map((a) => [a.linha, a.tipo])).toEqual([[1, 'cpf'], [2, 'cpf']]);
  });

  it('ignora o CPF falso das fixtures, CNPJ e números curtos', () => {
    expect(procurarDadosPessoais('x.ts', 'cpf 12345678900 cnpj 11111111000100 nsr 85747')).toEqual([]);
  });

  it('acha e-mail fora da lista permitida', () => {
    // Montado em tempo de execução para que o próprio arquivo não contenha um e-mail (o hook bloquearia o commit).
    const email = ['fulana', 'gmail.com'].join('@');
    expect(procurarDadosPessoais('x.ts', `contato: ${email}`)).toEqual([
      { arquivo: 'x.ts', linha: 1, tipo: 'email', valor: email },
    ]);
  });

  it('permite o remetente do RHiD, domínios de exemplo e o noreply do GitHub', () => {
    const texto = 'rhid.naoresponda@controlid.com.br usuaria@example.com a@example.org 1+a@users.noreply.github.com noreply@anthropic.com';
    expect(procurarDadosPessoais('x.ts', texto)).toEqual([]);
  });
});
```

- [ ] **Passo 5: rodar e ver falhar**

Rodar: `npx vitest run scripts/dados-pessoais.test.ts`
Esperado: FAIL, porque `./dados-pessoais` ainda não existe.

- [ ] **Passo 6: implementar** `scripts/dados-pessoais.ts`

```ts
export interface Achado {
  arquivo: string;
  linha: number;
  tipo: 'cpf' | 'email';
  valor: string;
}

const EMAILS_PERMITIDOS = new Set(['rhid.naoresponda@controlid.com.br', 'noreply@anthropic.com']);
const DOMINIOS_PERMITIDOS = /@(example\.(com|org|net)|users\.noreply\.github\.com)$/i;
const RE_CPF = /(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)/g;
const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function digitosVerificadores(base9: string): string {
  const dv = (base: string, pesoInicial: number): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = dv(base9, 10);
  const d2 = dv(base9 + d1, 11);
  return `${d1}${d2}`;
}

export function cpfValido(digitos: string): boolean {
  if (!/^\d{11}$/.test(digitos) || /^(\d)\1{10}$/.test(digitos)) return false;
  return digitos.slice(9) === digitosVerificadores(digitos.slice(0, 9));
}

export function procurarDadosPessoais(arquivo: string, conteudo: string): Achado[] {
  const achados: Achado[] = [];
  conteudo.split(/\r?\n/).forEach((texto, indice) => {
    for (const m of texto.matchAll(RE_CPF)) {
      if (cpfValido(m[0].replace(/\D/g, ''))) achados.push({ arquivo, linha: indice + 1, tipo: 'cpf', valor: m[0] });
    }
    for (const m of texto.matchAll(RE_EMAIL)) {
      const email = m[0].toLowerCase();
      if (!EMAILS_PERMITIDOS.has(email) && !DOMINIOS_PERMITIDOS.test(email)) {
        achados.push({ arquivo, linha: indice + 1, tipo: 'email', valor: m[0] });
      }
    }
  });
  return achados;
}
```

- [ ] **Passo 7: rodar e ver passar**

Rodar: `npx vitest run scripts/dados-pessoais.test.ts`
Esperado: PASS (6 testes).

- [ ] **Passo 8: criar a CLI e o hook**

`scripts/verificar-dados-pessoais.ts`:
```ts
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
```

`.githooks/pre-commit`:
```sh
#!/bin/sh
npx --no-install tsx scripts/verificar-dados-pessoais.ts --staged
```

- [ ] **Passo 9: verificar**

Rodar: `npm run verificar:dados && npm run typecheck`
Esperado: `OK: nenhum dado pessoal em N arquivo(s).` e o typecheck sem erros.

- [ ] **Passo 10: criar o CI e o README**

`.github/workflows/testes.yml`:
```yaml
name: testes
on:
  push:
    branches: [main]
  pull_request:
jobs:
  testes:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run verificar:dados
```

`README.md`:
````markdown
# Ponto Certo

App pessoal de banco de horas: lê os comprovantes de ponto (RHiD/iDFace) que chegam no Gmail, calcula o saldo e mostra tudo num PWA.

- Design: `docs/superpowers/specs/2026-10-23-ponto-certo-design.md`
- Planos: `docs/superpowers/plans/`

## Desenvolvimento

```bash
npm install
npm test
npm run typecheck
npm run verificar:dados   # garante que nenhum dado pessoal vai para o repositório
```
````

- [ ] **Passo 11: primeiro commit**

```bash
git add .gitattributes .gitignore package.json package-lock.json tsconfig.base.json vitest.config.ts README.md motor scripts .githooks .github docs
git update-index --chmod=+x .githooks/pre-commit
git status --short   # .superpowers/ NÃO pode aparecer
git commit -m "$(cat <<'EOF'
chore: fundação do repositório (monorepo, testes, verificação de dados pessoais)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```
Esperado: o hook imprime `OK: nenhum dado pessoal…` e o commit é criado.

- [ ] **Passo 12: criar o repositório no GitHub e enviar**

```bash
gh repo create ponto-certo --public --source=. --remote=origin --push --description "Banco de horas a partir dos comprovantes de ponto (RHiD/iDFace) — PWA pessoal"
sleep 10
gh run watch "$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
```
Esperado: repositório criado em `github.com/jefersonsantosjr/ponto-certo` e o workflow `testes` verde.

---

### Task 2: Tipos e tempo

**Arquivos:**
- Criar: `motor/src/tipos.ts`, `motor/src/tempo.ts`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/tempo.test.ts`

**Interfaces:**
- Produz:
  - **Tipos** (usados por todas as tasks seguintes): `Segundos`, `DataISO`, `Momento`, `Batida`, `BatidaNoDia`, `Lacuna`, `Intervalo`, `VersaoJornada`, `Regras`, `FeriadoLocal`, `FeriadosConfig`, `ConfigCalculo`, `ClassificacaoDia`, `Resposta`, `Ajuste`, `Pendencia`, `StatusDia`, `ResultadoDia`, `Alerta`.
  - **Funções:**
    - `paraSegundos(hora): Segundos`
    - `formatarHora(s)` → `"07:59:38"`, `formatarHoraCurta(s)` → `"07:59"`
    - `arredondarParaMinutoSeguinte(s)`
    - `formatarDuracao(s)`, `formatarSaldo(s)`, `formatarHorasPlanilha(s)`, `formatarSaldoPlanilha(s)`
    - `criarData(a, m, d)`, `dataValida(t)`, `diaDaSemana(d)`, `somarDias(d, n)`, `diasEntre(de, ate)`, `listarDatas(de, ate)`, `segundosEntre(a: Momento, b: Momento)`, `dataBR(d)`, `dataCurtaBR(d)`
  - **Constantes:** `MENOS`, `SEGUNDOS_POR_DIA`, `NOMES_DIAS`.

- [ ] **Passo 1: criar `motor/src/tipos.ts`** (só tipos, sem teste próprio)

```ts
/** Segundos desde a meia-noite (hora local de Brasília) ou uma duração em segundos. */
export type Segundos = number;

/** Data no formato AAAA-MM-DD, sem fuso horário. */
export type DataISO = string;

/** Um instante: data + segundos desde a meia-noite. */
export interface Momento {
  data: DataISO;
  segundos: Segundos;
}

export type OrigemBatida = 'comprovante' | 'provisoria' | 'manual';
export type StatusBatida = 'ativa' | 'substituida' | 'fora_da_conta';

export interface Batida {
  id: string;
  data: DataISO;
  segundos: Segundos;
  origem: OrigemBatida;
  status: StatusBatida;
  nsr?: string;
  hash?: string;
}

export interface BatidaNoDia extends Batida {
  duplicada: boolean;
}

export interface Lacuna {
  inicio: Segundos;
  fim: Segundos;
}

export interface Intervalo extends Lacuna {
  duracao: Segundos;
  tipo: 'almoco' | 'saida';
  abonado: boolean;
  almocoIncerto: boolean;
}

export interface VersaoJornada {
  /** Data a partir da qual esta versão vale. */
  inicio: DataISO;
  /** Carga por dia da semana; índice 0 = domingo. */
  cargaPorDiaSemana: [Segundos, Segundos, Segundos, Segundos, Segundos, Segundos, Segundos];
  almocoPadrao: Segundos;
  janelaAlmoco: Lacuna;
}

export interface Regras {
  toleranciaLigada: boolean;
  tolerancia: Segundos;
  limiteDuplicada: Segundos;
  minimoParaDescontarAlmoco: Segundos;
}

export interface FeriadoLocal {
  data: DataISO;
  nome: string;
}

export interface FeriadosConfig {
  incluir: FeriadoLocal[];
  excluir: DataISO[];
}

export interface ConfigCalculo {
  jornadas: VersaoJornada[];
  regras: Regras;
  feriados: FeriadosConfig;
  inicioBanco: DataISO;
  saldoInicial: Segundos;
}

export type ClassificacaoDia = 'folga_banco' | 'abonado' | 'ferias' | 'feriado';

export type Resposta =
  | { tipo: 'abono_intervalo'; data: DataISO; inicio: Segundos; fim: Segundos; abonado: boolean; justificativa: string }
  | { tipo: 'dia_sem_batida'; data: DataISO; classificacao: ClassificacaoDia; justificativa: string }
  | { tipo: 'so_duas_batidas'; data: DataISO; almocou: boolean; justificativa: string }
  | { tipo: 'almoco_escolhido'; data: DataISO; inicio: Segundos; fim: Segundos; justificativa: string }
  | { tipo: 'batida_conta'; data: DataISO; batidaId: string; justificativa: string }
  | { tipo: 'batida_faltando'; data: DataISO; justificativa: string };

export interface Ajuste {
  id: string;
  data: DataISO;
  tipo: 'abono_horas' | 'ajuste_banco';
  segundos: Segundos;
  justificativa: string;
  ativo: boolean;
}

export type Pendencia =
  | { tipo: 'abono_intervalo'; data: DataISO; inicio: Segundos; fim: Segundos }
  | { tipo: 'dia_sem_batida'; data: DataISO }
  | { tipo: 'batida_faltando'; data: DataISO }
  | { tipo: 'so_duas_batidas'; data: DataISO }
  | { tipo: 'almoco_ambiguo'; data: DataISO; opcoes: Lacuna[] };

export type StatusDia = 'normal' | 'sem_batida' | 'fim_de_semana' | 'feriado' | 'em_andamento' | 'futuro';

export interface ResultadoDia {
  data: DataISO;
  diaUtil: boolean;
  feriado: string | null;
  batidas: BatidaNoDia[];
  pares: Array<[Segundos, Segundos]>;
  intervalos: Intervalo[];
  trabalhado: Segundos;
  carga: Segundos;
  saldoBruto: Segundos;
  saldo: Segundos;
  toleranciaAplicada: boolean;
  almocoDescontado: Segundos;
  abonado: Segundos;
  classificacao?: ClassificacaoDia;
  pendencias: Pendencia[];
  status: StatusDia;
}

export type Alerta =
  | { tipo: 'outra_pessoa'; data: DataISO; segundos: Segundos; nome?: string }
  | { tipo: 'nome_diferente'; data: DataISO; segundos: Segundos; nome: string }
  | { tipo: 'empresa_diferente'; data: DataISO; segundos: Segundos }
  | { tipo: 'comprovante_incompleto'; data: DataISO; segundos: Segundos; faltando: string[] }
  | { tipo: 'provisorio'; data: DataISO; segundos: Segundos }
  | { tipo: 'atrasado'; data: DataISO; segundos: Segundos; atraso: Segundos }
  | { tipo: 'outro_tipo'; assunto: string }
  | { tipo: 'remetente_desconhecido'; remetente: string; assunto: string }
  | { tipo: 'ausente_no_gmail'; data: DataISO; segundos: Segundos }
  | { tipo: 'campo_divergente'; data: DataISO; segundos: Segundos; campo: string };
```

- [ ] **Passo 2: escrever o teste que falha** em `motor/test/tempo.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  MENOS, arredondarParaMinutoSeguinte, dataBR, dataCurtaBR, dataValida, diaDaSemana, diasEntre,
  formatarDuracao, formatarHora, formatarHoraCurta, formatarHorasPlanilha, formatarSaldo,
  formatarSaldoPlanilha, listarDatas, paraSegundos, segundosEntre, somarDias,
} from '../src/tempo';

describe('horários', () => {
  it('converte HH:MM:SS em segundos e volta', () => {
    expect(paraSegundos('07:59:38')).toBe(28778);
    expect(paraSegundos('8:00')).toBe(28800);
    expect(formatarHora(28778)).toBe('07:59:38');
    expect(formatarHoraCurta(28778)).toBe('07:59');
  });

  it('recusa horário inválido', () => {
    expect(() => paraSegundos('24:00')).toThrow('Horário inválido');
    expect(() => paraSegundos('07:60')).toThrow('Horário inválido');
    expect(() => paraSegundos('7h')).toThrow('Horário inválido');
  });

  it('arredonda para o minuto seguinte só quando há segundos', () => {
    expect(arredondarParaMinutoSeguinte(64778)).toBe(64800);
    expect(arredondarParaMinutoSeguinte(64740)).toBe(64740);
  });
});

describe('durações e saldos', () => {
  it.each([
    [0, '0min'], [45, '45s'], [780, '13min'], [785, '13min05s'], [3605, '1h00min05s'],
    [5220, '1h27'], [5232, '1h27min12s'], [31680, '8h48'], [477480, '132h38'], [-785, '13min05s'],
  ])('formatarDuracao(%i) = %s', (segundos, texto) => {
    expect(formatarDuracao(segundos)).toBe(texto);
  });

  it('formata saldo com sinal', () => {
    expect(formatarSaldo(785)).toBe('+13min05s');
    expect(formatarSaldo(-5232)).toBe(`${MENOS}1h27min12s`);
    expect(formatarSaldo(0)).toBe('0min');
  });

  it('formata para planilha', () => {
    expect(formatarSaldoPlanilha(725)).toBe('+0:12:05');
    expect(formatarSaldoPlanilha(-31680)).toBe(`${MENOS}8:48:00`);
    expect(formatarSaldoPlanilha(0)).toBe('0:00:00');
    expect(formatarHorasPlanilha(477480)).toBe('132:38:00');
  });
});

describe('datas', () => {
  it('dia da semana (0 = domingo)', () => {
    expect(diaDaSemana('2026-10-23')).toBe(5);
    expect(diaDaSemana('2026-10-25')).toBe(0);
  });

  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(somarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(somarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('diferença e lista de datas', () => {
    expect(diasEntre('2026-10-19', '2026-10-23')).toBe(4);
    expect(listarDatas('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
    expect(listarDatas('2026-10-02', '2026-10-01')).toEqual([]);
  });

  it('valida datas', () => {
    expect(dataValida('2026-02-29')).toBe(false);
    expect(dataValida('2028-02-29')).toBe(true);
    expect(dataValida('2026-13-01')).toBe(false);
    expect(dataValida('23/10/2026')).toBe(false);
  });

  it('segundos entre dois momentos, atravessando a meia-noite', () => {
    expect(segundosEntre({ data: '2026-10-23', segundos: 28778 }, { data: '2026-10-23', segundos: 39578 })).toBe(10800);
    expect(segundosEntre({ data: '2026-10-22', segundos: 86000 }, { data: '2026-10-23', segundos: 400 })).toBe(800);
  });

  it('formatos brasileiros', () => {
    expect(dataBR('2026-10-23')).toBe('23/10/2026');
    expect(dataCurtaBR('2026-10-23')).toBe('23/10');
  });
});
```

- [ ] **Passo 3: rodar e ver falhar**

Rodar: `npx vitest run motor/test/tempo.test.ts`
Esperado: FAIL, porque `../src/tempo` não existe.

- [ ] **Passo 4: implementar** `motor/src/tempo.ts`

```ts
import type { DataISO, Momento, Segundos } from './tipos';

export const SEGUNDOS_POR_DIA = 86_400;
/** Sinal de menos tipográfico, usado em todas as telas e relatórios. */
export const MENOS = '\u2212';
export const NOMES_DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'] as const;

const dois = (n: number): string => String(n).padStart(2, '0');

export function paraSegundos(hora: string): Segundos {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(hora.trim());
  if (!m) throw new Error(`Horário inválido: ${hora}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  const s = Number(m[3] ?? '0');
  if (h > 23 || min > 59 || s > 59) throw new Error(`Horário inválido: ${hora}`);
  return h * 3600 + min * 60 + s;
}

export function formatarHora(segundos: Segundos): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  return `${dois(h)}:${dois(m)}:${dois(segundos % 60)}`;
}

export function formatarHoraCurta(segundos: Segundos): string {
  return formatarHora(segundos).slice(0, 5);
}

export function arredondarParaMinutoSeguinte(segundos: Segundos): Segundos {
  return Math.ceil(segundos / 60) * 60;
}

/** Duração sem sinal: 45s, 13min, 13min05s, 1h27, 1h27min12s, 0min. */
export function formatarDuracao(segundos: Segundos): string {
  const abs = Math.abs(segundos);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return `${h}h${dois(m)}${s > 0 ? `min${dois(s)}s` : ''}`;
  if (m > 0) return `${m}min${s > 0 ? `${dois(s)}s` : ''}`;
  return s > 0 ? `${s}s` : '0min';
}

/** Saldo com sinal: +13min05s, −1h27min12s, 0min. */
export function formatarSaldo(segundos: Segundos): string {
  if (segundos === 0) return '0min';
  return (segundos > 0 ? '+' : MENOS) + formatarDuracao(segundos);
}

/** Duração estilo planilha, sem sinal: 8:23:41, 132:38:00. */
export function formatarHorasPlanilha(segundos: Segundos): string {
  const abs = Math.abs(segundos);
  return `${Math.floor(abs / 3600)}:${dois(Math.floor((abs % 3600) / 60))}:${dois(abs % 60)}`;
}

/** Saldo estilo planilha: +0:12:05, −8:48:00, 0:00:00. */
export function formatarSaldoPlanilha(segundos: Segundos): string {
  if (segundos === 0) return '0:00:00';
  return (segundos > 0 ? '+' : MENOS) + formatarHorasPlanilha(segundos);
}

export function criarData(ano: number, mes: number, dia: number): DataISO {
  return `${String(ano).padStart(4, '0')}-${dois(mes)}-${dois(dia)}`;
}

function partes(data: DataISO): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!m) throw new Error(`Data inválida: ${data}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function utc(data: DataISO): number {
  const [a, m, d] = partes(data);
  return Date.UTC(a, m - 1, d);
}

function deUtc(ms: number): DataISO {
  const dt = new Date(ms);
  return criarData(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function dataValida(data: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  return deUtc(utc(data)) === data;
}

export function diaDaSemana(data: DataISO): number {
  return new Date(utc(data)).getUTCDay();
}

export function somarDias(data: DataISO, dias: number): DataISO {
  return deUtc(utc(data) + dias * SEGUNDOS_POR_DIA * 1000);
}

export function diasEntre(de: DataISO, ate: DataISO): number {
  return Math.round((utc(ate) - utc(de)) / (SEGUNDOS_POR_DIA * 1000));
}

export function listarDatas(de: DataISO, ate: DataISO): DataISO[] {
  const datas: DataISO[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) datas.push(d);
  return datas;
}

export function segundosEntre(inicio: Momento, fim: Momento): Segundos {
  return diasEntre(inicio.data, fim.data) * SEGUNDOS_POR_DIA + (fim.segundos - inicio.segundos);
}

export function dataBR(data: DataISO): string {
  const [a, m, d] = partes(data);
  return `${dois(d)}/${dois(m)}/${a}`;
}

export function dataCurtaBR(data: DataISO): string {
  return dataBR(data).slice(0, 5);
}
```

- [ ] **Passo 5: atualizar `motor/src/index.ts`** (substituir o arquivo inteiro)

```ts
export type * from './tipos';
export * from './tempo';
```

- [ ] **Passo 6: rodar os testes e o typecheck**

Rodar: `npx vitest run motor/test/tempo.test.ts && npm run typecheck`
Esperado: PASS e typecheck sem erros.

- [ ] **Passo 7: commit**

```bash
git add motor/src/tipos.ts motor/src/tempo.ts motor/src/index.ts motor/test/tempo.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): tipos compartilhados e utilitários de tempo em segundos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 3: Feriados

**Arquivos:**
- Criar: `motor/src/feriados.ts`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/feriados.test.ts`

**Interfaces:**
- Consome: `criarData`, `somarDias` (Task 2); `DataISO`, `FeriadosConfig` (Task 2).
- Produz:
  - `pascoa(ano): DataISO`
  - `feriadosNacionais(ano): ReadonlyMap<DataISO, string>`
  - `nomeFeriado(data, config: FeriadosConfig): string | null`

- [ ] **Passo 1: escrever o teste que falha** em `motor/test/feriados.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { feriadosNacionais, nomeFeriado, pascoa } from '../src/feriados';

describe('feriados', () => {
  it('calcula o domingo de Páscoa', () => {
    expect(pascoa(2025)).toBe('2025-04-20');
    expect(pascoa(2026)).toBe('2026-04-05');
    expect(pascoa(2027)).toBe('2027-03-28');
  });

  it('lista os 10 feriados nacionais do ano, incluindo a Sexta-feira Santa', () => {
    const f = feriadosNacionais(2026);
    expect(f.size).toBe(10);
    expect(f.get('2026-04-03')).toBe('Sexta-feira Santa');
    expect(f.get('2026-10-12')).toBe('Nossa Senhora Aparecida');
    expect(f.get('2026-11-20')).toBe('Dia Nacional de Zumbi e da Consciência Negra');
    expect(feriadosNacionais(2027).get('2027-03-26')).toBe('Sexta-feira Santa');
  });

  it('aplica feriados locais e exclusões', () => {
    const cfg = { incluir: [{ data: '2026-07-09', nome: 'Revolução Constitucionalista' }], excluir: ['2026-04-03'] };
    expect(nomeFeriado('2026-07-09', cfg)).toBe('Revolução Constitucionalista');
    expect(nomeFeriado('2026-04-03', cfg)).toBeNull();
    expect(nomeFeriado('2026-10-12', cfg)).toBe('Nossa Senhora Aparecida');
    expect(nomeFeriado('2026-10-13', cfg)).toBeNull();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run motor/test/feriados.test.ts`
Esperado: FAIL, porque `../src/feriados` não existe.

- [ ] **Passo 3: implementar** `motor/src/feriados.ts`

```ts
import { criarData, somarDias } from './tempo';
import type { DataISO, FeriadosConfig } from './tipos';

const FIXOS: ReadonlyArray<readonly [number, number, string]> = [
  [1, 1, 'Confraternização Universal'],
  [4, 21, 'Tiradentes'],
  [5, 1, 'Dia do Trabalho'],
  [9, 7, 'Independência do Brasil'],
  [10, 12, 'Nossa Senhora Aparecida'],
  [11, 2, 'Finados'],
  [11, 15, 'Proclamação da República'],
  [11, 20, 'Dia Nacional de Zumbi e da Consciência Negra'],
  [12, 25, 'Natal'],
];

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano: number): DataISO {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return criarData(ano, mes, dia);
}

const cache = new Map<number, Map<DataISO, string>>();

export function feriadosNacionais(ano: number): ReadonlyMap<DataISO, string> {
  let mapa = cache.get(ano);
  if (!mapa) {
    mapa = new Map();
    for (const [mes, dia, nome] of FIXOS) mapa.set(criarData(ano, mes, dia), nome);
    mapa.set(somarDias(pascoa(ano), -2), 'Sexta-feira Santa');
    cache.set(ano, mapa);
  }
  return mapa;
}

export function nomeFeriado(data: DataISO, config: FeriadosConfig): string | null {
  if (config.excluir.includes(data)) return null;
  const local = config.incluir.find((f) => f.data === data);
  if (local) return local.nome;
  return feriadosNacionais(Number(data.slice(0, 4))).get(data) ?? null;
}
```

- [ ] **Passo 4: exportar.** Acrescentar ao final de `motor/src/index.ts`:

```ts
export * from './feriados';
```

- [ ] **Passo 5: rodar**

Rodar: `npx vitest run motor/test/feriados.test.ts && npm run typecheck`
Esperado: PASS.

- [ ] **Passo 6: commit**

```bash
git add motor/src/feriados.ts motor/src/index.ts motor/test/feriados.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): feriados nacionais (com Páscoa) e locais

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 4: Leitor, de HTML para texto

**Arquivos:**
- Criar: `motor/src/leitor/texto.ts`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/texto.test.ts`

**Interfaces:**
- Produz:
  - `ENTIDADES: Readonly<Record<string, string>>`
  - `decodificarEntidades(t)`
  - `normalizarEspacos(t)`
  - `htmlParaTexto(html): string`, que devolve uma linha por bloco, com células de tabela juntadas por espaço
  - `rotuloRegex(rotulo): string`: fonte de regex tolerante a acento, caixa e espaço, para usar com as flags `'iu'`

- [ ] **Passo 1: escrever o teste que falha** em `motor/test/texto.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { decodificarEntidades, htmlParaTexto, normalizarEspacos, rotuloRegex } from '../src/leitor/texto';

describe('decodificarEntidades', () => {
  it('decodifica entidades nomeadas e numéricas', () => {
    expect(decodificarEntidades('Hor&aacute;rio &amp; Servi&#231;o &#xE3;')).toBe('Horário & Serviço ã');
    expect(decodificarEntidades('a&nbsp;b')).toBe('a\u00a0b');
  });

  it('mantém entidade desconhecida', () => {
    expect(decodificarEntidades('a &foo; b')).toBe('a &foo; b');
  });
});

describe('normalizarEspacos', () => {
  it('junta espaços, remove linhas vazias e espaços nas pontas', () => {
    expect(normalizarEspacos('  a\u00a0\u00a0b \r\n\r\n\t c  ')).toBe('a b\nc');
  });
});

describe('htmlParaTexto', () => {
  it('converte HTML em linhas de texto, ignorando head, style e comentários', () => {
    const html =
      '<html><head><title>T</title><style>p{color:red}</style></head><body>' +
      '<h2>Dados do Trabalhador</h2><p>Nome: MARIA<br>CPF: 123</p>' +
      '<table><tr><td>Hash:</td><td>abc</td></tr></table><!-- x --></body></html>';
    expect(htmlParaTexto(html)).toBe('Dados do Trabalhador\nNome: MARIA\nCPF: 123\nHash: abc');
  });
});

describe('rotuloRegex', () => {
  it('é tolerante a acento, caixa e espaços (inclusive quebra de linha)', () => {
    const re = new RegExp(rotuloRegex('Data e Horário do Registro'), 'iu');
    expect(re.test('DATA E HORARIO DO REGISTRO')).toBe(true);
    expect(re.test('Data  e\nHorário do Registro')).toBe(true);
    expect(re.test('Data do Registro')).toBe(false);
  });

  it('escapa caracteres especiais', () => {
    expect(new RegExp(rotuloRegex('CPF/CNPJ'), 'iu').test('cpf/cnpj')).toBe(true);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run motor/test/texto.test.ts`
Esperado: FAIL, porque o módulo não existe.

- [ ] **Passo 3: implementar** `motor/src/leitor/texto.ts`

```ts
export const ENTIDADES: Readonly<Record<string, string>> = {
  nbsp: '\u00a0', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  copy: '©', reg: '®', ordm: 'º', ordf: 'ª', deg: '°', ndash: '–', mdash: '—', hellip: '…',
  laquo: '«', raquo: '»', middot: '·',
  aacute: 'á', Aacute: 'Á', agrave: 'à', Agrave: 'À', acirc: 'â', Acirc: 'Â', atilde: 'ã', Atilde: 'Ã', auml: 'ä', Auml: 'Ä',
  eacute: 'é', Eacute: 'É', egrave: 'è', Egrave: 'È', ecirc: 'ê', Ecirc: 'Ê', euml: 'ë', Euml: 'Ë',
  iacute: 'í', Iacute: 'Í', igrave: 'ì', Igrave: 'Ì', icirc: 'î', Icirc: 'Î', iuml: 'ï', Iuml: 'Ï',
  oacute: 'ó', Oacute: 'Ó', ograve: 'ò', Ograve: 'Ò', ocirc: 'ô', Ocirc: 'Ô', otilde: 'õ', Otilde: 'Õ', ouml: 'ö', Ouml: 'Ö',
  uacute: 'ú', Uacute: 'Ú', ugrave: 'ù', Ugrave: 'Ù', ucirc: 'û', Ucirc: 'Û', uuml: 'ü', Uuml: 'Ü',
  ccedil: 'ç', Ccedil: 'Ç', ntilde: 'ñ', Ntilde: 'Ñ',
};

export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (inteira, corpo: string) => {
    if (corpo.startsWith('#')) {
      const hexa = corpo[1] === 'x' || corpo[1] === 'X';
      const codigo = hexa ? parseInt(corpo.slice(2), 16) : parseInt(corpo.slice(1), 10);
      return Number.isFinite(codigo) && codigo > 0 && codigo <= 0x10ffff ? String.fromCodePoint(codigo) : inteira;
    }
    return ENTIDADES[corpo] ?? inteira;
  });
}

export function normalizarEspacos(texto: string): string {
  return texto
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v\u00a0\u2007\u202f]+/g, ' ')
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha.length > 0)
    .join('\n');
}

export function htmlParaTexto(html: string): string {
  const semTags = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(style|script|head)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li|table|section|header|footer)\s*>/gi, '\n')
    .replace(/<(p|div|tr|h[1-6]|li|table)\b[^>]*>/gi, '\n')
    .replace(/<\/t[dh]\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  return normalizarEspacos(decodificarEntidades(semTags));
}

const VARIANTES: Readonly<Record<string, string>> = {
  a: 'aáàâãä', e: 'eéèêë', i: 'iíìîï', o: 'oóòôõö', u: 'uúùûü', c: 'cç', n: 'nñ',
};

/** Fonte de regex que casa o rótulo com ou sem acento, em qualquer caixa, com qualquer espaço entre as palavras. Use com flags 'iu'. */
export function rotuloRegex(rotulo: string): string {
  let fonte = '';
  const base = rotulo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  for (const ch of base) {
    if (/\s/.test(ch)) {
      if (!fonte.endsWith('\\s+')) fonte += '\\s+';
      continue;
    }
    const variantes = VARIANTES[ch];
    fonte += variantes ? `[${variantes}]` : ch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  }
  return fonte;
}
```

- [ ] **Passo 4: exportar.** Acrescentar ao `motor/src/index.ts`:

```ts
export * from './leitor/texto';
```

- [ ] **Passo 5: rodar**

Rodar: `npx vitest run motor/test/texto.test.ts && npm run typecheck`
Esperado: PASS.

- [ ] **Passo 6: commit**

```bash
git add motor/src/leitor/texto.ts motor/src/index.ts motor/test/texto.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): conversão de HTML em texto e regex de rótulos tolerante

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 5: Leitor, campos do comprovante

**Arquivos:**
- Criar: `motor/src/leitor/comprovante.ts`, `motor/test/ajuda.ts`, `motor/test/fixtures/dados-falsos.ts`, `motor/test/fixtures/comprovante-modelo.html`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/comprovante.test.ts`

**Interfaces:**
- Consome: `rotuloRegex`, `htmlParaTexto` (Task 4); `criarData`, `dataValida`, `paraSegundos` (Task 2).
- Produz:
  - `lerComprovante(texto: string): CamposComprovante`
  - `interface RegistroLido { data: DataISO; hora: string /* HH:MM:SS */; segundos: Segundos }`
  - `interface CamposComprovante { temTitulo: boolean; nsr?; registradoEm?: RegistroLido; nomeEmpregador?; cnpjEmpregador?; nomeTrabalhador?; cpfTrabalhador?; inpi?; hash? }`
  - Ajudantes de teste: `lerFixture(nome)`, `batida(data, hora, origem?, status?)`, `h(hora)`, `FALSO`

- [ ] **Passo 1: criar as fixtures e os ajudantes**

`motor/test/fixtures/dados-falsos.ts`:
```ts
/** Dados FALSOS usados em todas as fixtures. O CPF tem dígito verificador inválido de propósito. */
export const FALSO = {
  cpf: '12345678900',
  nome: 'MARIA EXEMPLO DA SILVA',
  cnpj: '11111111000100',
  empresa: 'EMPRESA EXEMPLO LTDA',
  nsr: '12345',
  hash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
  inpi: 'BR5120210029364',
} as const;
```

`motor/test/fixtures/comprovante-modelo.html` (estrutura igual ao e-mail real de 23/10/2026, com os dados trocados pelos falsos):
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Comprovante de marca&ccedil;&atilde;o de ponto IDFace</title>
<style>body { font-family: Arial, sans-serif; background: #eeeeee; }</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eeeeee">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0">
<tr><td style="padding:20px 24px"><h1 style="font-size:22px;color:#333333">Comprovante de marca&ccedil;&atilde;o de ponto IDFace</h1></td></tr>
<tr><td style="background:#ffffff;padding:24px">
<h2>Notifica&ccedil;&atilde;o de Comprovante de Registro ao Funcion&aacute;rio</h2>
<p>Comprovante de marca&ccedil;&atilde;o de ponto IDFace</p>
<h2>Comprovante de Registro de Ponto do Trabalhador</h2>
<p>NSR: 12345</p>
<h3>Dados do Empregador</h3>
<p>Nome: EMPRESA EXEMPLO LTDA<br>CPF/CNPJ: 11111111000100<br>CNO/CAEPF: </p>
<p>Local de Presta&ccedil;&atilde;o de Servi&ccedil;o: </p>
<h3>Dados do Trabalhador</h3>
<p>Nome: MARIA EXEMPLO DA SILVA<br>CPF: 12345678900</p>
<p>Data e Hor&aacute;rio do Registro: 23/10/2026 07:59:38</p>
<p>Registro no INPI: BR5120210029364</p>
<p>Hash: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2</p>
</td></tr>
<tr><td style="padding:16px 24px;color:#999999;font-size:12px">
<p>&copy; 2026 - Control iD - RHiD</p>
<p>Mensagem gerada automaticamente, favor n&atilde;o responder.</p>
<p><strong>Control iD Ind&uacute;stria e Com&eacute;rcio Ltda</strong><br><a href="#">RUA EXEMPLO, 100</a><br><a href="#">S&Atilde;O PAULO-SP</a><br><a href="#">www.controlid.com.br</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
```

`motor/test/ajuda.ts`:
```ts
import { readFileSync } from 'node:fs';
import { paraSegundos } from '../src/tempo';
import type { Batida, DataISO, OrigemBatida, StatusBatida } from '../src/tipos';

export const h = paraSegundos;

export function lerFixture(nome: string): string {
  return readFileSync(new URL(`./fixtures/${nome}`, import.meta.url), 'utf8');
}

let sequencia = 0;
export function batida(data: DataISO, hora: string, origem: OrigemBatida = 'comprovante', status: StatusBatida = 'ativa'): Batida {
  sequencia += 1;
  return { id: `b${sequencia}`, data, segundos: paraSegundos(hora), origem, status };
}
```

- [ ] **Passo 2: escrever o teste que falha** em `motor/test/comprovante.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { lerComprovante } from '../src/leitor/comprovante';
import { htmlParaTexto } from '../src/leitor/texto';
import { lerFixture } from './ajuda';
import { FALSO } from './fixtures/dados-falsos';

const texto = htmlParaTexto(lerFixture('comprovante-modelo.html'));

describe('lerComprovante', () => {
  it('lê todos os campos do comprovante-modelo', () => {
    expect(lerComprovante(texto)).toEqual({
      temTitulo: true,
      nsr: FALSO.nsr,
      registradoEm: { data: '2026-10-23', hora: '07:59:38', segundos: 28778 },
      nomeEmpregador: FALSO.empresa,
      cnpjEmpregador: FALSO.cnpj,
      nomeTrabalhador: FALSO.nome,
      cpfTrabalhador: FALSO.cpf,
      inpi: FALSO.inpi,
      hash: FALSO.hash,
    });
  });

  it('aceita rótulos sem acento, em maiúsculas e com espaços extras', () => {
    const variado = texto
      .replace('Data e Horário do Registro:', 'DATA  E HORARIO DO REGISTRO :')
      .replace('Dados do Trabalhador', 'DADOS DO TRABALHADOR');
    const campos = lerComprovante(variado);
    expect(campos.registradoEm?.segundos).toBe(28778);
    expect(campos.cpfTrabalhador).toBe(FALSO.cpf);
  });

  it('aceita horário sem segundos (conta como :00)', () => {
    expect(lerComprovante(texto.replace('07:59:38', '07:59')).registradoEm).toEqual({
      data: '2026-10-23', hora: '07:59:00', segundos: 28740,
    });
  });

  it('aceita layout em células de tabela, CPF com pontuação e hash em maiúsculas', () => {
    const html =
      '<table><tr><td>Comprovante de Registro de Ponto do Trabalhador</td></tr>' +
      '<tr><td>NSR:</td><td>777</td></tr>' +
      '<tr><td><b>Dados do Trabalhador</b></td></tr>' +
      '<tr><td>Nome:</td><td>MARIA EXEMPLO DA SILVA</td></tr>' +
      '<tr><td>CPF:</td><td>123.456.789-00</td></tr>' +
      '<tr><td>Data e Hor&aacute;rio do Registro:</td><td>01/11/2026 18:02:05</td></tr>' +
      `<tr><td>Hash:</td><td>${FALSO.hash.toUpperCase()}</td></tr></table>`;
    const campos = lerComprovante(htmlParaTexto(html));
    expect(campos.nsr).toBe('777');
    expect(campos.cpfTrabalhador).toBe(FALSO.cpf);
    expect(campos.registradoEm?.hora).toBe('18:02:05');
    expect(campos.hash).toBe(FALSO.hash);
  });

  it('não inventa campos ausentes', () => {
    const campos = lerComprovante(texto.replace(/Hash:.*$/m, '').replace('NSR: 12345', ''));
    expect(campos.hash).toBeUndefined();
    expect(campos.nsr).toBeUndefined();
    expect(campos.registradoEm).toBeDefined();
  });

  it('recusa data impossível', () => {
    expect(lerComprovante(texto.replace('23/10/2026', '31/02/2026')).registradoEm).toBeUndefined();
  });

  it('identifica texto que não é comprovante', () => {
    expect(lerComprovante('Sua senha foi redefinida.').temTitulo).toBe(false);
  });
});
```

- [ ] **Passo 3: rodar e ver falhar**

Rodar: `npx vitest run motor/test/comprovante.test.ts`
Esperado: FAIL, porque `../src/leitor/comprovante` não existe.

- [ ] **Passo 4: implementar** `motor/src/leitor/comprovante.ts`

```ts
import { criarData, dataValida } from '../tempo';
import type { DataISO, Segundos } from '../tipos';
import { rotuloRegex } from './texto';

export interface RegistroLido {
  data: DataISO;
  /** HH:MM:SS (segundos = 00 quando o comprovante não traz). */
  hora: string;
  segundos: Segundos;
}

export interface CamposComprovante {
  temTitulo: boolean;
  nsr?: string;
  registradoEm?: RegistroLido;
  nomeEmpregador?: string;
  cnpjEmpregador?: string;
  nomeTrabalhador?: string;
  cpfTrabalhador?: string;
  inpi?: string;
  hash?: string;
}

const re = (rotulo: string, resto = ''): RegExp => new RegExp(rotuloRegex(rotulo) + resto, 'iu');

const RE_TITULO = re('Comprovante de Registro de Ponto do Trabalhador');
const RE_NSR = re('NSR', '\\s*:?\\s*(\\d+)');
const RE_ROTULO_DATA = re('Data e Horário do Registro');
const RE_DATA_HORA = re('Data e Horário do Registro', '\\s*:?\\s*(\\d{2})\\/(\\d{2})\\/(\\d{4})\\s+(\\d{2}):(\\d{2})(?::(\\d{2}))?');
const RE_BLOCO_EMPREGADOR = re('Dados do Empregador');
const RE_BLOCO_TRABALHADOR = re('Dados do Trabalhador');
const RE_LOCAL = re('Local de Prestação de Serviço');
const RE_NOME = re('Nome', '[ \\t]*:[ \\t]*([^\\n]+)');
const RE_CPF = re('CPF', '[ \\t]*:\\s*([\\d.\\- ]{11,20})');
const RE_CPF_CNPJ = re('CPF/CNPJ', '[ \\t]*:\\s*([\\d.\\/\\- ]{11,25})');
const RE_INPI = re('Registro no INPI', '\\s*:\\s*([A-Za-z0-9]+)');
const RE_HASH = re('Hash', '\\s*:\\s*([0-9a-fA-F]{64})(?![0-9a-fA-F])');

const soDigitos = (texto: string): string => texto.replace(/\D/g, '');
const limparNome = (texto: string): string => texto.replace(/\s+/g, ' ').trim();

/** Trecho do texto depois de `inicio` e antes do primeiro dos `fins` que aparecer. */
function trecho(texto: string, inicio: RegExp, fins: RegExp[]): string | undefined {
  const mi = inicio.exec(texto);
  if (!mi) return undefined;
  const resto = texto.slice(mi.index + mi[0].length);
  let corte = resto.length;
  for (const fim of fins) {
    const mf = fim.exec(resto);
    if (mf && mf.index < corte) corte = mf.index;
  }
  return resto.slice(0, corte);
}

export function lerComprovante(texto: string): CamposComprovante {
  const campos: CamposComprovante = { temTitulo: RE_TITULO.test(texto) };

  const nsr = RE_NSR.exec(texto);
  if (nsr) campos.nsr = nsr[1];

  const dh = RE_DATA_HORA.exec(texto);
  if (dh) {
    const [, dia, mes, ano, hh, mm, ss = '00'] = dh;
    const data = criarData(Number(ano), Number(mes), Number(dia));
    const h = Number(hh);
    const m = Number(mm);
    const s = Number(ss);
    if (dataValida(data) && h <= 23 && m <= 59 && s <= 59) {
      campos.registradoEm = { data, hora: `${hh}:${mm}:${ss}`, segundos: h * 3600 + m * 60 + s };
    }
  }

  const empregador = trecho(texto, RE_BLOCO_EMPREGADOR, [RE_LOCAL, RE_BLOCO_TRABALHADOR, RE_ROTULO_DATA]);
  if (empregador) {
    const nome = RE_NOME.exec(empregador);
    if (nome) campos.nomeEmpregador = limparNome(nome[1]);
    const documento = RE_CPF_CNPJ.exec(empregador);
    if (documento) {
      const digitos = soDigitos(documento[1]);
      if (digitos.length === 14 || digitos.length === 11) campos.cnpjEmpregador = digitos;
    }
  }

  const trabalhador = trecho(texto, RE_BLOCO_TRABALHADOR, [RE_ROTULO_DATA, RE_BLOCO_EMPREGADOR]);
  if (trabalhador) {
    const nome = RE_NOME.exec(trabalhador);
    if (nome) campos.nomeTrabalhador = limparNome(nome[1]);
    const cpf = RE_CPF.exec(trabalhador);
    if (cpf) {
      const digitos = soDigitos(cpf[1]);
      if (digitos.length === 11) campos.cpfTrabalhador = digitos;
    }
  }

  const inpi = RE_INPI.exec(texto);
  if (inpi) campos.inpi = inpi[1];

  const hash = RE_HASH.exec(texto);
  if (hash) campos.hash = hash[1].toLowerCase();

  return campos;
}
```

- [ ] **Passo 5: exportar.** Acrescentar ao `motor/src/index.ts`:

```ts
export * from './leitor/comprovante';
```

- [ ] **Passo 6: rodar**

Rodar: `npx vitest run motor/test/comprovante.test.ts && npm run typecheck && npm run verificar:dados`
Esperado: PASS e nenhum dado pessoal encontrado.

- [ ] **Passo 7: commit**

```bash
git add motor/src/leitor/comprovante.ts motor/src/index.ts motor/test/ajuda.ts motor/test/fixtures motor/test/comprovante.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): leitura dos campos do comprovante por rótulo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 6: Leitor, classificação do e-mail

**Arquivos:**
- Criar: `motor/src/leitor/classificar.ts`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/classificar.test.ts`

**Interfaces:**
- Consome: `lerComprovante`, `CamposComprovante` (Task 5); `segundosEntre`, `formatarHora` (Task 2); `Alerta`, `Momento` (Task 2).
- Produz:
  - `classificarMensagem(msg: MensagemParaClassificar, esperada: IdentidadeEsperada, chavesExistentes: ReadonlySet<string>): ResultadoClassificacao`
  - `chaveComprovante(nsr, hash): string`, no formato `"nsr|hash"`
  - `normalizarNome(nome)`
  - `LIMITE_ATRASO = 600`
  - Tipos: `Classificacao`, `MensagemParaClassificar`, `IdentidadeEsperada`, `BatidaLida`, `ResultadoClassificacao`

- [ ] **Passo 1: escrever o teste que falha** em `motor/test/classificar.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { classificarMensagem, normalizarNome, type MensagemParaClassificar } from '../src/leitor/classificar';
import { htmlParaTexto } from '../src/leitor/texto';
import { lerFixture } from './ajuda';
import { FALSO } from './fixtures/dados-falsos';

const ESPERADA = { cpf: FALSO.cpf, nome: 'Maria Exemplo da Silva', cnpj: FALSO.cnpj };
const texto = htmlParaTexto(lerFixture('comprovante-modelo.html'));
const NENHUMA = new Set<string>();

function msg(sobrescrever: Partial<MensagemParaClassificar> = {}): MensagemParaClassificar {
  return {
    id: 'm1',
    assunto: 'Comprovante de marcação de ponto IDFace',
    texto,
    recebidoEm: { data: '2026-10-23', segundos: 28790 },
    ...sobrescrever,
  };
}

describe('classificarMensagem', () => {
  it('classifica comprovante completo e confere a identidade', () => {
    const r = classificarMensagem(msg(), ESPERADA, NENHUMA);
    expect(r.classificacao).toBe('comprovante');
    expect(r.chave).toBe(`${FALSO.nsr}|${FALSO.hash}`);
    expect(r.batida).toMatchObject({
      data: '2026-10-23', segundos: 28778, hora: '07:59:38', origem: 'comprovante', status: 'ativa',
      nsr: FALSO.nsr, hash: FALSO.hash, cpfConfere: true, nomeConfere: true, cnpjConfere: true, atraso: 12,
    });
    expect(r.alertas).toEqual([]);
  });

  it('CPF de outra pessoa fica fora da conta e gera alerta', () => {
    const r = classificarMensagem(msg(), { ...ESPERADA, cpf: '98765432199' }, NENHUMA);
    expect(r.batida?.status).toBe('fora_da_conta');
    expect(r.alertas).toEqual([{ tipo: 'outra_pessoa', data: '2026-10-23', segundos: 28778, nome: FALSO.nome }]);
  });

  it('CPF dela com nome diferente: conta e avisa', () => {
    const r = classificarMensagem(msg(), { ...ESPERADA, nome: 'Joana Teste' }, NENHUMA);
    expect(r.batida?.status).toBe('ativa');
    expect(r.alertas).toEqual([{ tipo: 'nome_diferente', data: '2026-10-23', segundos: 28778, nome: FALSO.nome }]);
  });

  it('CNPJ diferente: conta e avisa', () => {
    const r = classificarMensagem(msg(), { ...ESPERADA, cnpj: '22222222000100' }, NENHUMA);
    expect(r.batida?.status).toBe('ativa');
    expect(r.alertas).toEqual([{ tipo: 'empresa_diferente', data: '2026-10-23', segundos: 28778 }]);
  });

  it('comprovante sem hash é incompleto, mas conta', () => {
    const r = classificarMensagem(msg({ texto: texto.replace(/Hash:.*$/m, '') }), ESPERADA, NENHUMA);
    expect(r.classificacao).toBe('comprovante_incompleto');
    expect(r.batida?.status).toBe('ativa');
    expect(r.alertas).toEqual([{ tipo: 'comprovante_incompleto', data: '2026-10-23', segundos: 28778, faltando: ['hash'] }]);
  });

  it('mesmo NSR e hash de um comprovante já registrado é repetido e não vira batida', () => {
    const r = classificarMensagem(msg({ id: 'm2' }), ESPERADA, new Set([`${FALSO.nsr}|${FALSO.hash}`]));
    expect(r.classificacao).toBe('repetido');
    expect(r.batida).toBeUndefined();
    expect(r.alertas).toEqual([]);
  });

  it('corpo ilegível com assunto de comprovante vira batida provisória pelo cabeçalho Date', () => {
    const r = classificarMensagem(
      msg({ texto: 'conteúdo num formato novo', cabecalhoData: { data: '2026-10-23', segundos: 28781 } }),
      ESPERADA,
      NENHUMA,
    );
    expect(r.classificacao).toBe('provisorio');
    expect(r.batida).toMatchObject({ data: '2026-10-23', segundos: 28781, origem: 'provisoria', status: 'ativa' });
    expect(r.alertas).toEqual([{ tipo: 'provisorio', data: '2026-10-23', segundos: 28781 }]);
  });

  it('sem cabeçalho Date, a provisória usa a hora de chegada', () => {
    expect(classificarMensagem(msg({ texto: '???' }), ESPERADA, NENHUMA).batida?.segundos).toBe(28790);
  });

  it('e-mail do RHiD que não é comprovante é "outro tipo" e gera alerta', () => {
    const r = classificarMensagem(msg({ assunto: 'Ajuste de ponto aprovado', texto: 'Seu ajuste foi aprovado.' }), ESPERADA, NENHUMA);
    expect(r.classificacao).toBe('outro_tipo');
    expect(r.alertas).toEqual([{ tipo: 'outro_tipo', assunto: 'Ajuste de ponto aprovado' }]);
  });

  it('marca atraso acima de 10 minutos', () => {
    const r = classificarMensagem(msg({ recebidoEm: { data: '2026-10-23', segundos: 28778 + 10800 } }), ESPERADA, NENHUMA);
    expect(r.batida?.atraso).toBe(10800);
    expect(r.alertas).toEqual([{ tipo: 'atrasado', data: '2026-10-23', segundos: 28778, atraso: 10800 }]);
  });

  it('atraso de exatamente 10 minutos não gera alerta', () => {
    const r = classificarMensagem(msg({ recebidoEm: { data: '2026-10-23', segundos: 28778 + 600 } }), ESPERADA, NENHUMA);
    expect(r.alertas).toEqual([]);
  });
});

describe('normalizarNome', () => {
  it('remove acentos, espaços extras e ignora caixa', () => {
    expect(normalizarNome('  José  da   Conceição ')).toBe('JOSE DA CONCEICAO');
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run motor/test/classificar.test.ts`
Esperado: FAIL, porque o módulo não existe.

- [ ] **Passo 3: implementar** `motor/src/leitor/classificar.ts`

```ts
import { formatarHora, segundosEntre } from '../tempo';
import type { Alerta, DataISO, Momento, Segundos } from '../tipos';
import { lerComprovante, type CamposComprovante } from './comprovante';

export type Classificacao = 'comprovante' | 'comprovante_incompleto' | 'provisorio' | 'repetido' | 'outro_tipo';

export interface MensagemParaClassificar {
  id: string;
  assunto: string;
  /** Corpo já convertido em texto (htmlParaTexto ou a parte text/plain). */
  texto: string;
  /** Hora local de chegada do e-mail (internalDate do Gmail). */
  recebidoEm: Momento;
  /** Hora local do cabeçalho Date, quando houver. */
  cabecalhoData?: Momento;
}

export interface IdentidadeEsperada {
  cpf: string;
  nome: string;
  cnpj: string;
}

export interface BatidaLida {
  data: DataISO;
  segundos: Segundos;
  hora: string;
  origem: 'comprovante' | 'provisoria';
  status: 'ativa' | 'fora_da_conta';
  nsr?: string;
  hash?: string;
  inpi?: string;
  cpfConfere: boolean;
  nomeConfere: boolean;
  cnpjConfere: boolean;
  nomeNoComprovante?: string;
  atraso: Segundos;
}

export interface ResultadoClassificacao {
  id: string;
  classificacao: Classificacao;
  campos: CamposComprovante;
  chave?: string;
  batida?: BatidaLida;
  alertas: Alerta[];
}

export const LIMITE_ATRASO: Segundos = 600;
const RE_ASSUNTO_COMPROVANTE = /comprovante\s+de\s+marca[cç][aã]o\s+de\s+ponto/iu;

export function chaveComprovante(nsr: string, hash: string): string {
  return `${nsr}|${hash}`;
}

export function normalizarNome(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
}

interface ConferenciaIdentidade {
  cpfConfere: boolean;
  nomeConfere: boolean;
  cnpjConfere: boolean;
  nomeNoComprovante?: string;
}

function conferirIdentidade(campos: CamposComprovante, esperada: IdentidadeEsperada): ConferenciaIdentidade {
  const cpfConfere = campos.cpfTrabalhador === undefined || campos.cpfTrabalhador === esperada.cpf.replace(/\D/g, '');
  const nomeConfere = campos.nomeTrabalhador === undefined || normalizarNome(campos.nomeTrabalhador) === normalizarNome(esperada.nome);
  const cnpjConfere = campos.cnpjEmpregador === undefined || campos.cnpjEmpregador === esperada.cnpj.replace(/\D/g, '');
  const resultado: ConferenciaIdentidade = { cpfConfere, nomeConfere, cnpjConfere };
  if ((!cpfConfere || !nomeConfere) && campos.nomeTrabalhador) resultado.nomeNoComprovante = campos.nomeTrabalhador;
  return resultado;
}

function alertasIdentidade(id: ConferenciaIdentidade, m: Momento): Alerta[] {
  const alertas: Alerta[] = [];
  if (!id.cpfConfere) alertas.push({ tipo: 'outra_pessoa', data: m.data, segundos: m.segundos, nome: id.nomeNoComprovante });
  else if (!id.nomeConfere) alertas.push({ tipo: 'nome_diferente', data: m.data, segundos: m.segundos, nome: id.nomeNoComprovante ?? '' });
  if (!id.cnpjConfere) alertas.push({ tipo: 'empresa_diferente', data: m.data, segundos: m.segundos });
  return alertas;
}

export function classificarMensagem(
  msg: MensagemParaClassificar,
  esperada: IdentidadeEsperada,
  chavesExistentes: ReadonlySet<string>,
): ResultadoClassificacao {
  const campos = lerComprovante(msg.texto);
  if (!campos.temTitulo && !RE_ASSUNTO_COMPROVANTE.test(msg.assunto)) {
    return { id: msg.id, classificacao: 'outro_tipo', campos, alertas: [{ tipo: 'outro_tipo', assunto: msg.assunto }] };
  }

  const identidade = conferirIdentidade(campos, esperada);
  const status = identidade.cpfConfere ? 'ativa' : 'fora_da_conta';

  if (!campos.registradoEm) {
    const base = msg.cabecalhoData ?? msg.recebidoEm;
    const batida: BatidaLida = {
      data: base.data, segundos: base.segundos, hora: formatarHora(base.segundos),
      origem: 'provisoria', status, ...identidade, atraso: 0,
    };
    return {
      id: msg.id, classificacao: 'provisorio', campos, batida,
      alertas: [{ tipo: 'provisorio', data: base.data, segundos: base.segundos }, ...alertasIdentidade(identidade, base)],
    };
  }

  const { data, segundos, hora } = campos.registradoEm;
  const chave = campos.nsr && campos.hash ? chaveComprovante(campos.nsr, campos.hash) : undefined;
  if (chave && chavesExistentes.has(chave)) {
    return { id: msg.id, classificacao: 'repetido', campos, chave, alertas: [] };
  }

  const faltando: string[] = [];
  if (!campos.nsr) faltando.push('NSR');
  if (!campos.hash) faltando.push('hash');
  if (!campos.cpfTrabalhador) faltando.push('CPF');

  const atraso = Math.max(0, segundosEntre({ data, segundos }, msg.recebidoEm));
  const batida: BatidaLida = {
    data, segundos, hora, origem: 'comprovante', status,
    nsr: campos.nsr, hash: campos.hash, inpi: campos.inpi, ...identidade, atraso,
  };

  const alertas: Alerta[] = alertasIdentidade(identidade, { data, segundos });
  if (faltando.length > 0) alertas.push({ tipo: 'comprovante_incompleto', data, segundos, faltando });
  if (atraso > LIMITE_ATRASO) alertas.push({ tipo: 'atrasado', data, segundos, atraso });

  return {
    id: msg.id,
    classificacao: faltando.length > 0 ? 'comprovante_incompleto' : 'comprovante',
    campos, chave, batida, alertas,
  };
}
```

- [ ] **Passo 4: exportar.** Acrescentar ao `motor/src/index.ts`:

```ts
export * from './leitor/classificar';
```

- [ ] **Passo 5: rodar**

Rodar: `npx vitest run motor/test/classificar.test.ts && npm run typecheck`
Esperado: PASS (12 testes).

- [ ] **Passo 6: commit**

```bash
git add motor/src/leitor/classificar.ts motor/src/index.ts motor/test/classificar.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): classificação de e-mails (identidade, repetido, atraso, provisório)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 7: Jornada e configuração padrão

**Arquivos:**
- Criar: `motor/src/calculo/jornada.ts`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/jornada.test.ts`

**Interfaces:**
- Consome: `nomeFeriado` (Task 3); `diaDaSemana` (Task 2).
- Produz:
  - `HORA = 3600`, `MINUTO = 60`
  - `REGRAS_PADRAO`
  - `configPadrao(inicioBanco): ConfigCalculo`
  - `jornadaVigente(data, jornadas): VersaoJornada | null`
  - `infoDia(data, config): InfoDia`, com `InfoDia { jornada: VersaoJornada | null; feriado: string | null; diaUtil: boolean; carga: Segundos }`

- [ ] **Passo 1: escrever o teste que falha** em `motor/test/jornada.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { configPadrao, infoDia } from '../src/calculo/jornada';
import type { VersaoJornada } from '../src/tipos';

const cfg = configPadrao('2026-09-01');

describe('jornada', () => {
  it('tem os valores padrão combinados', () => {
    expect(cfg.jornadas[0]).toMatchObject({
      inicio: '2026-09-01', almocoPadrao: 4320, janelaAlmoco: { inicio: 43200, fim: 54000 },
      cargaPorDiaSemana: [0, 31680, 31680, 31680, 31680, 31680, 0],
    });
    expect(cfg.regras).toEqual({ toleranciaLigada: true, tolerancia: 600, limiteDuplicada: 300, minimoParaDescontarAlmoco: 21600 });
    expect(cfg.saldoInicial).toBe(0);
    expect(cfg.inicioBanco).toBe('2026-09-01');
  });

  it('segunda a sexta têm 8h48; sábado e domingo, zero', () => {
    expect(infoDia('2026-10-23', cfg)).toMatchObject({ diaUtil: true, carga: 31680, feriado: null });
    expect(infoDia('2026-10-24', cfg)).toMatchObject({ diaUtil: false, carga: 0 });
  });

  it('feriado zera a carga', () => {
    expect(infoDia('2026-10-12', cfg)).toMatchObject({ diaUtil: false, carga: 0, feriado: 'Nossa Senhora Aparecida' });
  });

  it('usa a versão de jornada vigente em cada data', () => {
    const nova: VersaoJornada = { ...cfg.jornadas[0], inicio: '2026-11-01', cargaPorDiaSemana: [0, 28800, 28800, 28800, 28800, 28800, 0] };
    const c = { ...cfg, jornadas: [nova, cfg.jornadas[0]] };
    expect(infoDia('2026-10-30', c).carga).toBe(31680);
    expect(infoDia('2026-11-03', c).carga).toBe(28800);
  });

  it('antes da primeira versão não há jornada', () => {
    expect(infoDia('2026-08-31', cfg)).toMatchObject({ jornada: null, carga: 0, diaUtil: false });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run motor/test/jornada.test.ts`
Esperado: FAIL, porque o módulo não existe.

- [ ] **Passo 3: implementar** `motor/src/calculo/jornada.ts`

```ts
import { nomeFeriado } from '../feriados';
import { diaDaSemana } from '../tempo';
import type { ConfigCalculo, DataISO, Regras, Segundos, VersaoJornada } from '../tipos';

export const MINUTO = 60;
export const HORA = 3600;

const CARGA_DIA_UTIL = 8 * HORA + 48 * MINUTO;

export const REGRAS_PADRAO: Readonly<Regras> = {
  toleranciaLigada: true,
  tolerancia: 10 * MINUTO,
  limiteDuplicada: 5 * MINUTO,
  minimoParaDescontarAlmoco: 6 * HORA,
};

export function configPadrao(inicioBanco: DataISO): ConfigCalculo {
  return {
    jornadas: [
      {
        inicio: inicioBanco,
        cargaPorDiaSemana: [0, CARGA_DIA_UTIL, CARGA_DIA_UTIL, CARGA_DIA_UTIL, CARGA_DIA_UTIL, CARGA_DIA_UTIL, 0],
        almocoPadrao: HORA + 12 * MINUTO,
        janelaAlmoco: { inicio: 12 * HORA, fim: 15 * HORA },
      },
    ],
    regras: { ...REGRAS_PADRAO },
    feriados: { incluir: [], excluir: [] },
    inicioBanco,
    saldoInicial: 0,
  };
}

export function jornadaVigente(data: DataISO, jornadas: VersaoJornada[]): VersaoJornada | null {
  let escolhida: VersaoJornada | null = null;
  for (const jornada of jornadas) {
    if (jornada.inicio <= data && (!escolhida || jornada.inicio > escolhida.inicio)) escolhida = jornada;
  }
  return escolhida;
}

export interface InfoDia {
  jornada: VersaoJornada | null;
  feriado: string | null;
  diaUtil: boolean;
  carga: Segundos;
}

export function infoDia(data: DataISO, config: ConfigCalculo): InfoDia {
  const jornada = jornadaVigente(data, config.jornadas);
  const feriado = nomeFeriado(data, config.feriados);
  const cargaSemana = jornada ? jornada.cargaPorDiaSemana[diaDaSemana(data)] : 0;
  const diaUtil = cargaSemana > 0 && feriado === null;
  return { jornada, feriado, diaUtil, carga: diaUtil ? cargaSemana : 0 };
}
```

- [ ] **Passo 4: exportar.** Acrescentar ao `motor/src/index.ts`:

```ts
export * from './calculo/jornada';
```

- [ ] **Passo 5: rodar**

Rodar: `npx vitest run motor/test/jornada.test.ts && npm run typecheck`
Esperado: PASS.

- [ ] **Passo 6: commit**

```bash
git add motor/src/calculo/jornada.ts motor/src/index.ts motor/test/jornada.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): jornada com vigência, carga do dia e configuração padrão

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 8: Intervalos (almoço × saída)

**Arquivos:**
- Criar: `motor/src/calculo/intervalos.ts`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/intervalos.test.ts`

**Interfaces:**
- Consome: `Intervalo`, `Lacuna`, `Pendencia`, `Resposta`, `Segundos`, `DataISO` (Task 2).
- Produz:
  - `lacunasEntrePares(pares: Array<[Segundos, Segundos]>): Lacuna[]`
  - `classificarIntervalos(e: EntradaIntervalos): { intervalos: Intervalo[]; pendencias: Pendencia[] }`
  - `interface EntradaIntervalos { data; lacunas; janelaAlmoco: Lacuna; almocoPadrao; respostas: Resposta[]; emAndamento: boolean }`

- [ ] **Passo 1: escrever o teste que falha** em `motor/test/intervalos.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { classificarIntervalos, lacunasEntrePares, type EntradaIntervalos } from '../src/calculo/intervalos';
import type { Resposta } from '../src/tipos';
import { h } from './ajuda';

const base: Omit<EntradaIntervalos, 'lacunas'> = {
  data: '2026-10-20',
  janelaAlmoco: { inicio: h('12:00'), fim: h('15:00') },
  almocoPadrao: h('01:12'),
  respostas: [],
  emAndamento: false,
};
const SAIDA = { inicio: h('10:00'), fim: h('10:50') };
const ALMOCO = { inicio: h('12:10'), fim: h('13:22') };

describe('lacunasEntrePares', () => {
  it('pega o espaço entre o fim de um par e o início do próximo', () => {
    expect(lacunasEntrePares([[1, 2], [5, 9], [10, 20]])).toEqual([{ inicio: 2, fim: 5 }, { inicio: 9, fim: 10 }]);
    expect(lacunasEntrePares([[1, 2]])).toEqual([]);
  });
});

describe('classificarIntervalos', () => {
  it('o intervalo que começa no horário de almoço é o almoço; o outro vira pergunta de abono', () => {
    const r = classificarIntervalos({ ...base, lacunas: [SAIDA, ALMOCO] });
    expect(r.intervalos.map((i) => [i.tipo, i.abonado, i.almocoIncerto, i.duracao])).toEqual([
      ['saida', false, false, 3000],
      ['almoco', false, false, 4320],
    ]);
    expect(r.pendencias).toEqual([{ tipo: 'abono_intervalo', data: '2026-10-20', ...SAIDA }]);
  });

  it('resposta de abono resolve a pendência e marca como abonado', () => {
    const respostas: Resposta[] = [{ tipo: 'abono_intervalo', data: '2026-10-20', ...SAIDA, abonado: true, justificativa: 'Dentista' }];
    const r = classificarIntervalos({ ...base, respostas, lacunas: [SAIDA, ALMOCO] });
    expect(r.intervalos[0]).toMatchObject({ tipo: 'saida', abonado: true });
    expect(r.pendencias).toEqual([]);
  });

  it('com dois intervalos no horário de almoço, almoço é o de duração mais perto de 1h12', () => {
    const r = classificarIntervalos({ ...base, lacunas: [{ inicio: h('12:00'), fim: h('12:20') }, { inicio: h('13:00'), fim: h('14:10') }] });
    expect(r.intervalos.map((i) => i.tipo)).toEqual(['saida', 'almoco']);
  });

  it('empate deixa o almoço incerto e pergunta qual foi', () => {
    const lacunas = [{ inicio: h('12:00'), fim: h('12:30') }, { inicio: h('13:00'), fim: h('13:30') }];
    const r = classificarIntervalos({ ...base, lacunas });
    expect(r.intervalos.map((i) => [i.tipo, i.almocoIncerto])).toEqual([['almoco', true], ['saida', false]]);
    expect(r.pendencias[0]).toEqual({ tipo: 'almoco_ambiguo', data: '2026-10-20', opcoes: lacunas });
    expect(r.pendencias[1]).toMatchObject({ tipo: 'abono_intervalo', inicio: h('13:00') });
  });

  it('nenhum intervalo no horário de almoço: provisório é o mais perto de 1h12 e pergunta', () => {
    const lacunas = [{ inicio: h('10:00'), fim: h('11:12') }];
    const r = classificarIntervalos({ ...base, lacunas });
    expect(r.intervalos[0]).toMatchObject({ tipo: 'almoco', almocoIncerto: true });
    expect(r.pendencias).toEqual([{ tipo: 'almoco_ambiguo', data: '2026-10-20', opcoes: lacunas }]);
  });

  it('a resposta "qual foi o almoço" resolve a dúvida', () => {
    const lacunas = [{ inicio: h('12:00'), fim: h('12:30') }, { inicio: h('13:00'), fim: h('13:30') }];
    const respostas: Resposta[] = [{ tipo: 'almoco_escolhido', data: '2026-10-20', ...lacunas[1], justificativa: 'Almocei às 13h' }];
    const r = classificarIntervalos({ ...base, respostas, lacunas });
    expect(r.intervalos.map((i) => i.tipo)).toEqual(['saida', 'almoco']);
    expect(r.pendencias).toEqual([{ tipo: 'abono_intervalo', data: '2026-10-20', ...lacunas[0] }]);
  });

  it('no dia em andamento com almoço incerto, ainda não pergunta nada', () => {
    expect(classificarIntervalos({ ...base, emAndamento: true, lacunas: [SAIDA] }).pendencias).toEqual([]);
  });

  it('sem lacunas, nada a classificar', () => {
    expect(classificarIntervalos({ ...base, lacunas: [] })).toEqual({ intervalos: [], pendencias: [] });
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run motor/test/intervalos.test.ts`
Esperado: FAIL, porque o módulo não existe.

- [ ] **Passo 3: implementar** `motor/src/calculo/intervalos.ts`

```ts
import type { DataISO, Intervalo, Lacuna, Pendencia, Resposta, Segundos } from '../tipos';

export interface EntradaIntervalos {
  data: DataISO;
  lacunas: Lacuna[];
  janelaAlmoco: Lacuna;
  almocoPadrao: Segundos;
  respostas: Resposta[];
  emAndamento: boolean;
}

export function lacunasEntrePares(pares: Array<[Segundos, Segundos]>): Lacuna[] {
  return pares.slice(1).map((par, i) => ({ inicio: pares[i][1], fim: par[0] }));
}

const mesmaLacuna = (a: Lacuna, b: Lacuna): boolean => a.inicio === b.inicio && a.fim === b.fim;

function identificarAlmoco(e: EntradaIntervalos): { almoco: Lacuna | null; incerto: boolean } {
  if (e.lacunas.length === 0) return { almoco: null, incerto: false };

  const escolhido = e.respostas.find((r) => r.tipo === 'almoco_escolhido');
  if (escolhido?.tipo === 'almoco_escolhido') {
    const lacuna = e.lacunas.find((l) => l.inicio === escolhido.inicio && l.fim === escolhido.fim);
    if (lacuna) return { almoco: lacuna, incerto: false };
  }

  const naJanela = e.lacunas.filter((l) => l.inicio >= e.janelaAlmoco.inicio && l.inicio <= e.janelaAlmoco.fim);
  const candidatas = naJanela.length > 0 ? naJanela : e.lacunas;
  const distancia = (l: Lacuna): number => Math.abs(l.fim - l.inicio - e.almocoPadrao);
  const ordenadas = [...candidatas].sort((a, b) => distancia(a) - distancia(b) || a.inicio - b.inicio);
  const melhor = ordenadas[0];
  const empate = ordenadas.length > 1 && distancia(ordenadas[1]) === distancia(melhor);
  return { almoco: melhor, incerto: naJanela.length === 0 || empate };
}

export function classificarIntervalos(e: EntradaIntervalos): { intervalos: Intervalo[]; pendencias: Pendencia[] } {
  const { almoco, incerto } = identificarAlmoco(e);
  const pendencias: Pendencia[] = [];

  const intervalos = e.lacunas.map((lacuna): Intervalo => {
    const duracao = lacuna.fim - lacuna.inicio;
    if (almoco && mesmaLacuna(lacuna, almoco)) {
      return { ...lacuna, duracao, tipo: 'almoco', abonado: false, almocoIncerto: incerto };
    }
    const resposta = e.respostas.find((r) => r.tipo === 'abono_intervalo' && r.inicio === lacuna.inicio && r.fim === lacuna.fim);
    const abonado = resposta?.tipo === 'abono_intervalo' && resposta.abonado;
    if (!resposta && !(e.emAndamento && incerto)) {
      pendencias.push({ tipo: 'abono_intervalo', data: e.data, inicio: lacuna.inicio, fim: lacuna.fim });
    }
    return { ...lacuna, duracao, tipo: 'saida', abonado, almocoIncerto: false };
  });

  if (incerto && !e.emAndamento) {
    pendencias.unshift({ tipo: 'almoco_ambiguo', data: e.data, opcoes: e.lacunas.map(({ inicio, fim }) => ({ inicio, fim })) });
  }
  return { intervalos, pendencias };
}
```

- [ ] **Passo 4: exportar.** Acrescentar ao `motor/src/index.ts`:

```ts
export * from './calculo/intervalos';
```

- [ ] **Passo 5: rodar**

Rodar: `npx vitest run motor/test/intervalos.test.ts && npm run typecheck`
Esperado: PASS (9 testes).

- [ ] **Passo 6: commit**

```bash
git add motor/src/calculo/intervalos.ts motor/src/index.ts motor/test/intervalos.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): identificação do almoço e das saídas a abonar

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 9: Cálculo do dia

**Arquivos:**
- Criar: `motor/src/calculo/dia.ts`, `motor/test/ajuda-dia.ts`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/dia.test.ts`

**Interfaces:**
- Consome: `infoDia` (Task 7); `classificarIntervalos`, `lacunasEntrePares` (Task 8); `batida`, `h` (Task 5).
- Produz:
  - `calcularDia(e: EntradaDia): ResultadoDia`
  - `interface EntradaDia { data; hoje; batidas: Batida[]; respostas: Resposta[]; ajustes: Ajuste[]; config: ConfigCalculo }`
  - Ajudantes de teste: `HOJE = '2026-10-23'`, `CONFIG`, `diaDeTeste(data, horas, extra?)`

- [ ] **Passo 1: criar o ajudante** `motor/test/ajuda-dia.ts`

```ts
import { calcularDia, type EntradaDia } from '../src/calculo/dia';
import { configPadrao } from '../src/calculo/jornada';
import type { DataISO, ResultadoDia } from '../src/tipos';
import { batida } from './ajuda';

export const HOJE = '2026-10-23';
export const CONFIG = configPadrao('2026-09-01');

export function diaDeTeste(data: DataISO, horas: string[], extra: Partial<EntradaDia> = {}): ResultadoDia {
  return calcularDia({
    data,
    hoje: HOJE,
    batidas: horas.map((hora) => batida(data, hora)),
    respostas: [],
    ajustes: [],
    config: CONFIG,
    ...extra,
  });
}
```

- [ ] **Passo 2: escrever o teste que falha** em `motor/test/dia.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import type { Resposta } from '../src/tipos';
import { batida, h } from './ajuda';
import { CONFIG, diaDeTeste } from './ajuda-dia';

const SEM_TOLERANCIA = { ...CONFIG, regras: { ...CONFIG.regras, toleranciaLigada: false } };

describe('calcularDia: base', () => {
  it('dia normal fecha no zero e identifica o almoço', () => {
    const d = diaDeTeste('2026-10-19', ['08:00', '12:00', '13:12', '18:00']);
    expect(d).toMatchObject({ trabalhado: 31680, carga: 31680, saldo: 0, status: 'normal', diaUtil: true, pendencias: [] });
    expect(d.intervalos).toMatchObject([{ tipo: 'almoco', inicio: h('12:00'), fim: h('13:12') }]);
  });

  it('os segundos entram na conta', () => {
    const d = diaDeTeste('2026-10-19', ['07:59:38', '12:03:12', '13:15:12', '18:00:00'], { config: SEM_TOLERANCIA });
    expect(d.trabalhado).toBe(31702);
    expect(d.saldo).toBe(22);
  });

  it.each([
    ['17:50:00', -600, 0, true],
    ['17:49:59', -601, -601, false],
    ['18:10:00', 600, 0, true],
    ['18:10:01', 601, 601, false],
  ])('tolerância: saída %s → bruto %i, saldo %i', (saida, bruto, saldo, aplicada) => {
    const d = diaDeTeste('2026-10-19', ['08:00', '12:00', '13:12', saida]);
    expect(d.saldoBruto).toBe(bruto);
    expect(d.saldo).toBe(saldo);
    expect(d.toleranciaAplicada).toBe(aplicada);
  });

  it('batida até 5min00s depois é duplicada; 5min01s não', () => {
    const dup = diaDeTeste('2026-10-19', ['08:00:00', '08:05:00', '12:00', '13:12', '18:00']);
    expect(dup.batidas.map((b) => b.duplicada)).toEqual([false, true, false, false, false]);
    expect(dup.saldo).toBe(0);
    const naoDup = diaDeTeste('2026-10-19', ['08:00:00', '08:05:01', '12:00', '13:12', '18:00']);
    expect(naoDup.batidas.every((b) => !b.duplicada)).toBe(true);
    expect(naoDup.pendencias).toContainEqual({ tipo: 'batida_faltando', data: '2026-10-19' });
  });

  it('comprovante vale mais que batida manual próxima', () => {
    const data = '2026-10-19';
    const manual = batida(data, '08:00:00', 'manual');
    const comprovante = batida(data, '08:02:10');
    const d = diaDeTeste(data, [], { batidas: [manual, comprovante, batida(data, '12:00'), batida(data, '13:12'), batida(data, '18:00')] });
    expect(d.batidas.find((b) => b.id === manual.id)?.duplicada).toBe(true);
    expect(d.batidas.find((b) => b.id === comprovante.id)?.duplicada).toBe(false);
    expect(d.trabalhado).toBe(31550); // 08:02:10→12:00 (14270) + 13:12→18:00 (17280)
    expect(d.saldoBruto).toBe(-130);
    expect(d.saldo).toBe(0); // dentro da tolerância
  });

  it('a resposta "essa batida conta" desfaz a duplicada', () => {
    const data = '2026-10-19';
    const segunda = batida(data, '08:03:00');
    const respostas: Resposta[] = [{ tipo: 'batida_conta', data, batidaId: segunda.id, justificativa: 'Saí e voltei' }];
    const d = diaDeTeste(data, [], { respostas, batidas: [batida(data, '08:00'), segunda, batida(data, '12:00'), batida(data, '13:12')] });
    expect(d.batidas.every((b) => !b.duplicada)).toBe(true);
    expect(d.pares).toHaveLength(2);
  });

  it('número ímpar: conta só os pares completos e pede a batida que falta', () => {
    const d = diaDeTeste('2026-10-21', ['08:00', '12:00', '13:12']);
    expect(d.trabalhado).toBe(14400);
    expect(d.saldo).toBe(14400 - 31680);
    expect(d.pendencias).toEqual([{ tipo: 'batida_faltando', data: '2026-10-21' }]);
  });

  it('batidas fora da conta aparecem, mas não entram no cálculo', () => {
    const data = '2026-10-19';
    const fora = batida(data, '10:00', 'comprovante', 'fora_da_conta');
    const d = diaDeTeste(data, [], { batidas: [batida(data, '08:00'), fora, batida(data, '12:00'), batida(data, '13:12'), batida(data, '18:00')] });
    expect(d.batidas).toHaveLength(5);
    expect(d.saldo).toBe(0);
  });

  it('fim de semana trabalhado é todo positivo', () => {
    expect(diaDeTeste('2026-10-17', ['09:00', '13:00'])).toMatchObject({ diaUtil: false, carga: 0, saldo: 14400, status: 'normal' });
  });

  it('feriado sem batida não deve nada', () => {
    expect(diaDeTeste('2026-10-12', [])).toMatchObject({ status: 'feriado', feriado: 'Nossa Senhora Aparecida', saldo: 0, pendencias: [] });
  });

  it('dia útil sem batida desconta a carga e pergunta o que foi', () => {
    expect(diaDeTeste('2026-10-21', [])).toMatchObject({
      status: 'sem_batida', saldo: -31680, classificacao: 'folga_banco',
      pendencias: [{ tipo: 'dia_sem_batida', data: '2026-10-21' }],
    });
  });

  it.each([['abonado'], ['ferias'], ['feriado']] as const)('dia sem batida respondido como %s não desconta', (classificacao) => {
    const respostas: Resposta[] = [{ tipo: 'dia_sem_batida', data: '2026-10-21', classificacao, justificativa: 'Atestado' }];
    expect(diaDeTeste('2026-10-21', [], { respostas })).toMatchObject({ carga: 0, saldo: 0, classificacao, pendencias: [] });
  });

  it('dia futuro não é calculado', () => {
    expect(diaDeTeste('2026-10-26', [])).toMatchObject({ status: 'futuro', carga: 31680, saldo: 0, pendencias: [] });
  });

  it('abono manual de horas soma no trabalhado', () => {
    const ajustes = [{ id: 'a1', data: '2026-10-19', tipo: 'abono_horas' as const, segundos: 7200, justificativa: 'Consulta', ativo: true }];
    expect(diaDeTeste('2026-10-19', ['08:00', '12:00', '13:12', '16:00'], { ajustes })).toMatchObject({ trabalhado: 31680, abonado: 7200, saldo: 0 });
  });
});

describe('calcularDia: intervalos e almoço', () => {
  const EXEMPLO = ['07:56', '07:57', '10:00', '10:50', '12:10', '13:22', '18:21'];

  it('exemplo 6.7 da spec, sem resposta: −25min e pendência de abono', () => {
    const d = diaDeTeste('2026-10-20', EXEMPLO);
    expect(d.trabalhado).toBe(30180);
    expect(d.saldo).toBe(-1500);
    expect(d.intervalos.map((i) => [i.tipo, i.inicio, i.fim])).toEqual([['saida', h('10:00'), h('10:50')], ['almoco', h('12:10'), h('13:22')]]);
    expect(d.pendencias).toEqual([{ tipo: 'abono_intervalo', data: '2026-10-20', inicio: h('10:00'), fim: h('10:50') }]);
  });

  it('exemplo 6.7 com abono: +25min', () => {
    const respostas: Resposta[] = [{ tipo: 'abono_intervalo', data: '2026-10-20', inicio: h('10:00'), fim: h('10:50'), abonado: true, justificativa: 'Dentista' }];
    expect(diaDeTeste('2026-10-20', EXEMPLO, { respostas })).toMatchObject({ trabalhado: 33180, saldo: 1500, abonado: 3000, pendencias: [] });
  });

  it('só 2 batidas num dia longo: desconta 1h12 e pergunta', () => {
    expect(diaDeTeste('2026-10-19', ['08:00', '18:00'])).toMatchObject({
      almocoDescontado: 4320, trabalhado: 31680, saldo: 0,
      pendencias: [{ tipo: 'so_duas_batidas', data: '2026-10-19' }],
    });
  });

  it('só 2 batidas respondido "não almocei": não desconta', () => {
    const respostas: Resposta[] = [{ tipo: 'so_duas_batidas', data: '2026-10-19', almocou: false, justificativa: 'Sem almoço' }];
    expect(diaDeTeste('2026-10-19', ['08:00', '18:00'], { respostas })).toMatchObject({ almocoDescontado: 0, saldo: 4320, pendencias: [] });
  });

  it('2 batidas num dia curto não descontam almoço', () => {
    expect(diaDeTeste('2026-10-19', ['08:00', '12:00'])).toMatchObject({ almocoDescontado: 0, saldo: 14400 - 31680, pendencias: [] });
  });
});
```

- [ ] **Passo 3: rodar e ver falhar**

Rodar: `npx vitest run motor/test/dia.test.ts`
Esperado: FAIL, porque `../src/calculo/dia` não existe.

- [ ] **Passo 4: implementar** `motor/src/calculo/dia.ts`

```ts
import type {
  Ajuste, Batida, BatidaNoDia, ClassificacaoDia, ConfigCalculo, DataISO, OrigemBatida,
  Pendencia, Resposta, ResultadoDia, Segundos, StatusDia,
} from '../tipos';
import { classificarIntervalos, lacunasEntrePares } from './intervalos';
import { infoDia } from './jornada';

export interface EntradaDia {
  data: DataISO;
  hoje: DataISO;
  /** Batidas desta data, em qualquer status. */
  batidas: Batida[];
  /** Respostas vigentes desta data (veja respostasVigentes). */
  respostas: Resposta[];
  /** Ajustes desta data. */
  ajustes: Ajuste[];
  config: ConfigCalculo;
}

const PRIORIDADE: Record<OrigemBatida, number> = { comprovante: 0, provisoria: 1, manual: 2 };
const ordenar = (a: Batida, b: Batida): number => a.segundos - b.segundos || PRIORIDADE[a.origem] - PRIORIDADE[b.origem];

export function calcularDia(e: EntradaDia): ResultadoDia {
  const info = infoDia(e.data, e.config);
  const { regras } = e.config;

  if (e.data > e.hoje) {
    return {
      data: e.data, diaUtil: info.diaUtil, feriado: info.feriado, batidas: [], pares: [], intervalos: [],
      trabalhado: 0, carga: info.carga, saldoBruto: 0, saldo: 0, toleranciaAplicada: false,
      almocoDescontado: 0, abonado: 0, pendencias: [], status: 'futuro',
    };
  }

  const emAndamento = e.data === e.hoje;
  const fechado = !emAndamento;
  const almocoPadrao = info.jornada?.almocoPadrao ?? 0;
  const janelaAlmoco = info.jornada?.janelaAlmoco ?? { inicio: 0, fim: 0 };
  const resposta = <T extends Resposta['tipo']>(tipo: T) =>
    e.respostas.find((r): r is Extract<Resposta, { tipo: T }> => r.tipo === tipo);

  // 1–2: batidas ativas em ordem; duplicadas ficam de fora (o comprovante vale mais que a manual).
  const forcadas = new Set(e.respostas.flatMap((r) => (r.tipo === 'batida_conta' ? [r.batidaId] : [])));
  const mantidas: Batida[] = [];
  const duplicadas = new Set<string>();
  for (const b of e.batidas.filter((x) => x.status === 'ativa').sort(ordenar)) {
    const anterior = mantidas[mantidas.length - 1];
    if (anterior && b.segundos - anterior.segundos <= regras.limiteDuplicada && !forcadas.has(b.id)) {
      if (anterior.origem === 'manual' && b.origem !== 'manual') {
        duplicadas.add(anterior.id);
        mantidas[mantidas.length - 1] = b;
      } else {
        duplicadas.add(b.id);
      }
      continue;
    }
    mantidas.push(b);
  }
  const batidas: BatidaNoDia[] = [...e.batidas].sort(ordenar).map((b) => ({ ...b, duplicada: duplicadas.has(b.id) }));

  // 3: pares.
  const pares: Array<[Segundos, Segundos]> = [];
  for (let i = 0; i + 1 < mantidas.length; i += 2) pares.push([mantidas[i].segundos, mantidas[i + 1].segundos]);
  const pendencias: Pendencia[] = [];
  if (mantidas.length % 2 === 1 && fechado && !resposta('batida_faltando')) {
    pendencias.push({ tipo: 'batida_faltando', data: e.data });
  }

  // 4: intervalos (almoço × saídas).
  const classificados = classificarIntervalos({
    data: e.data, lacunas: lacunasEntrePares(pares), janelaAlmoco, almocoPadrao, respostas: e.respostas, emAndamento,
  });
  pendencias.push(...classificados.pendencias);

  // 5: só duas batidas num dia longo.
  let almocoDescontado = 0;
  if (mantidas.length === 2 && pares[0][1] - pares[0][0] > regras.minimoParaDescontarAlmoco) {
    const r = resposta('so_duas_batidas');
    if (r ? r.almocou : true) almocoDescontado = almocoPadrao;
    if (!r && fechado) pendencias.push({ tipo: 'so_duas_batidas', data: e.data });
  }

  // 6: trabalhado.
  const somaPares = pares.reduce((s, [a, b]) => s + (b - a), 0);
  const abonoIntervalos = classificados.intervalos.reduce((s, i) => s + (i.tipo === 'saida' && i.abonado ? i.duracao : 0), 0);
  const abonoManual = e.ajustes.reduce((s, a) => s + (a.ativo && a.tipo === 'abono_horas' ? a.segundos : 0), 0);
  const trabalhado = somaPares + abonoIntervalos + abonoManual - almocoDescontado;

  // 7 e 10: carga e dia útil sem batida.
  let carga = info.carga;
  let classificacao: ClassificacaoDia | undefined;
  if (mantidas.length === 0 && info.diaUtil) {
    const r = resposta('dia_sem_batida');
    classificacao = r ? r.classificacao : 'folga_banco';
    if (classificacao !== 'folga_banco') carga = 0;
    if (!r && fechado) pendencias.push({ tipo: 'dia_sem_batida', data: e.data });
  }

  // 8–9: saldo e tolerância da CLT.
  const saldoBruto = trabalhado - carga;
  const toleranciaAplicada = regras.toleranciaLigada && saldoBruto !== 0 && Math.abs(saldoBruto) <= regras.tolerancia;
  const saldo = toleranciaAplicada ? 0 : saldoBruto;

  let status: StatusDia = 'normal';
  if (emAndamento) status = 'em_andamento';
  else if (mantidas.length === 0) status = info.diaUtil ? 'sem_batida' : info.feriado ? 'feriado' : 'fim_de_semana';

  return {
    data: e.data, diaUtil: info.diaUtil, feriado: info.feriado, batidas, pares, intervalos: classificados.intervalos,
    trabalhado, carga, saldoBruto, saldo, toleranciaAplicada, almocoDescontado,
    abonado: abonoIntervalos + abonoManual, classificacao, pendencias, status,
  };
}
```

- [ ] **Passo 5: exportar.** Acrescentar ao `motor/src/index.ts`:

```ts
export * from './calculo/dia';
```

- [ ] **Passo 6: rodar**

Rodar: `npx vitest run motor/test/dia.test.ts && npm run typecheck`
Esperado: PASS em todos os casos.

- [ ] **Passo 7: commit**

```bash
git add motor/src/calculo/dia.ts motor/src/index.ts motor/test/ajuda-dia.ts motor/test/dia.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): cálculo do dia (duplicadas, pares, almoço, abonos, tolerância)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 10: Respostas vigentes e batidas manuais substituídas

**Arquivos:**
- Criar: `motor/src/calculo/respostas.ts`, `motor/src/calculo/manuais.ts`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/respostas.test.ts`

**Interfaces:**
- Consome: `Resposta`, `Batida` (Task 2).
- Produz:
  - `interface RespostaRegistrada { id: string; criadaEm: string /* ISO */; resposta: Resposta }`
  - `chaveResposta(r): string`
  - `respostasVigentes(lista: RespostaRegistrada[]): Resposta[]`: mantém a mais recente de cada chave
  - `justificativaValida(texto): boolean`, com `MINIMO_JUSTIFICATIVA = 3`
  - `manuaisSubstituidas(batidas: Batida[], janela?: Segundos): string[]`, com `JANELA_SUBSTITUICAO = 1800`

- [ ] **Passo 1: escrever o teste que falha** em `motor/test/respostas.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { manuaisSubstituidas } from '../src/calculo/manuais';
import { chaveResposta, justificativaValida, respostasVigentes, type RespostaRegistrada } from '../src/calculo/respostas';
import { batida, h } from './ajuda';

const abono = (abonado: boolean, inicio = h('10:00'), fim = h('10:50')) =>
  ({ tipo: 'abono_intervalo', data: '2026-10-20', inicio, fim, abonado, justificativa: 'x' }) as const;

describe('respostas', () => {
  it('a chave identifica o que está sendo respondido', () => {
    expect(chaveResposta(abono(true))).toBe(`abono_intervalo|2026-10-20|${h('10:00')}-${h('10:50')}`);
    expect(chaveResposta({ tipo: 'dia_sem_batida', data: '2026-10-21', classificacao: 'ferias', justificativa: 'x' })).toBe('dia_sem_batida|2026-10-21');
    expect(chaveResposta({ tipo: 'batida_conta', data: '2026-10-21', batidaId: 'b9', justificativa: 'x' })).toBe('batida_conta|2026-10-21|b9');
  });

  it('vale a versão mais recente de cada resposta; respostas diferentes convivem', () => {
    const lista: RespostaRegistrada[] = [
      { id: 'r1', criadaEm: '2026-10-21T09:00:00', resposta: abono(true) },
      { id: 'r2', criadaEm: '2026-10-22T10:00:00', resposta: abono(false) },
      { id: 'r3', criadaEm: '2026-10-21T09:30:00', resposta: abono(true, h('15:00'), h('15:30')) },
    ];
    const vigentes = respostasVigentes(lista);
    expect(vigentes).toHaveLength(2);
    expect(vigentes).toContainEqual(abono(false));
    expect(vigentes).toContainEqual(abono(true, h('15:00'), h('15:30')));
  });

  it('justificativa precisa de pelo menos 3 caracteres de verdade', () => {
    expect(justificativaValida('  ab ')).toBe(false);
    expect(justificativaValida('abc')).toBe(true);
  });
});

describe('manuaisSubstituidas', () => {
  it('manual a até 30 min de um comprovante do mesmo dia é substituída', () => {
    const manual = batida('2026-10-20', '18:00', 'manual');
    expect(manuaisSubstituidas([manual, batida('2026-10-20', '18:25')])).toEqual([manual.id]);
    expect(manuaisSubstituidas([manual, batida('2026-10-20', '18:30:00')])).toEqual([manual.id]);
  });

  it('não substitui com comprovante longe, em outro dia, ou manual já inativa', () => {
    const manual = batida('2026-10-20', '18:00', 'manual');
    expect(manuaisSubstituidas([manual, batida('2026-10-20', '18:30:01')])).toEqual([]);
    expect(manuaisSubstituidas([manual, batida('2026-10-21', '18:00')])).toEqual([]);
    expect(manuaisSubstituidas([batida('2026-10-20', '18:00', 'manual', 'substituida'), batida('2026-10-20', '18:01')])).toEqual([]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run motor/test/respostas.test.ts`
Esperado: FAIL, porque os módulos não existem.

- [ ] **Passo 3: implementar** `motor/src/calculo/respostas.ts`

```ts
import type { Resposta } from '../tipos';

export interface RespostaRegistrada {
  id: string;
  /** Data e hora ISO da gravação (todas no mesmo formato, então a ordem de texto é a ordem do tempo). */
  criadaEm: string;
  resposta: Resposta;
}

export const MINIMO_JUSTIFICATIVA = 3;

export function chaveResposta(r: Resposta): string {
  switch (r.tipo) {
    case 'abono_intervalo':
      return `${r.tipo}|${r.data}|${r.inicio}-${r.fim}`;
    case 'batida_conta':
      return `${r.tipo}|${r.data}|${r.batidaId}`;
    default:
      return `${r.tipo}|${r.data}`;
  }
}

export function respostasVigentes(registradas: RespostaRegistrada[]): Resposta[] {
  const ultimas = new Map<string, RespostaRegistrada>();
  for (const registro of registradas) {
    const chave = chaveResposta(registro.resposta);
    const atual = ultimas.get(chave);
    if (!atual || registro.criadaEm >= atual.criadaEm) ultimas.set(chave, registro);
  }
  return [...ultimas.values()].map((r) => r.resposta);
}

export function justificativaValida(texto: string): boolean {
  return texto.trim().length >= MINIMO_JUSTIFICATIVA;
}
```

- [ ] **Passo 4: implementar** `motor/src/calculo/manuais.ts`

```ts
import type { Batida, Segundos } from '../tipos';

export const JANELA_SUBSTITUICAO: Segundos = 30 * 60;

/** IDs das batidas manuais ativas que têm um comprovante (ou provisória) ativo no mesmo dia a até `janela` segundos (spec §4.6). */
export function manuaisSubstituidas(batidas: Batida[], janela: Segundos = JANELA_SUBSTITUICAO): string[] {
  const provas = batidas.filter((b) => b.status === 'ativa' && b.origem !== 'manual');
  return batidas
    .filter((m) => m.status === 'ativa' && m.origem === 'manual')
    .filter((m) => provas.some((p) => p.data === m.data && Math.abs(p.segundos - m.segundos) <= janela))
    .map((m) => m.id);
}
```

- [ ] **Passo 5: exportar.** Acrescentar ao `motor/src/index.ts`:

```ts
export * from './calculo/respostas';
export * from './calculo/manuais';
```

- [ ] **Passo 6: rodar**

Rodar: `npx vitest run motor/test/respostas.test.ts && npm run typecheck`
Esperado: PASS.

- [ ] **Passo 7: commit**

```bash
git add motor/src/calculo/respostas.ts motor/src/calculo/manuais.ts motor/src/index.ts motor/test/respostas.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): respostas vigentes, justificativa obrigatória e substituição de manuais

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 11: Dia em andamento e previsão de saída

**Arquivos:**
- Criar: `motor/src/calculo/previsao.ts`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/previsao.test.ts`

**Interfaces:**
- Consome: `ResultadoDia` (Task 2); `lacunasEntrePares` (Task 8); `diaDeTeste`, `CONFIG`, `HOJE` (Task 9).
- Produz: `previsaoSaida(dia: ResultadoDia, jornada: Pick<VersaoJornada, 'almocoPadrao' | 'janelaAlmoco'>): Segundos | null`. O valor sai em segundos, **sem** arredondar; a tela arredonda com `arredondarParaMinutoSeguinte`.

- [ ] **Passo 1: escrever o teste que falha** em `motor/test/previsao.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { previsaoSaida } from '../src/calculo/previsao';
import { arredondarParaMinutoSeguinte, formatarHora, formatarHoraCurta } from '../src/tempo';
import { h } from './ajuda';
import { CONFIG, HOJE, diaDeTeste } from './ajuda-dia';

const jornada = CONFIG.jornadas[0];

describe('dia em andamento', () => {
  it('não abre pendência de batida faltando nem de dia sem batida antes do dia acabar', () => {
    const d = diaDeTeste(HOJE, ['07:59:38', '12:03:12', '13:15:12']);
    expect(d.status).toBe('em_andamento');
    expect(d.pendencias).toEqual([]);
    expect(d.trabalhado).toBe(14614);
    expect(diaDeTeste(HOJE, []).pendencias).toEqual([]);
  });
});

describe('previsaoSaida', () => {
  it('depois do almoço: última entrada + o que falta da carga', () => {
    const previsao = previsaoSaida(diaDeTeste(HOJE, ['07:59:38', '12:03:12', '13:15:12']), jornada);
    expect(previsao).toBe(64778);
    expect(formatarHora(previsao ?? 0)).toBe('17:59:38');
    expect(formatarHoraCurta(arredondarParaMinutoSeguinte(previsao ?? 0))).toBe('18:00');
  });

  it('antes do almoço: soma o almoço padrão', () => {
    expect(previsaoSaida(diaDeTeste(HOJE, ['07:59:38']), jornada)).toBe(64778);
  });

  it('uma saída no meio da manhã não conta como almoço', () => {
    expect(previsaoSaida(diaDeTeste(HOJE, ['08:00', '10:00', '10:50']), jornada)).toBe(h('18:50'));
  });

  it('sem previsão quando ela está fora ou o dia não tem carga', () => {
    expect(previsaoSaida(diaDeTeste(HOJE, ['08:00', '12:00']), jornada)).toBeNull();
    expect(previsaoSaida(diaDeTeste('2026-10-17', ['09:00']), jornada)).toBeNull();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run motor/test/previsao.test.ts`
Esperado: FAIL, porque `../src/calculo/previsao` não existe.

- [ ] **Passo 3: implementar** `motor/src/calculo/previsao.ts`

```ts
import type { Lacuna, ResultadoDia, Segundos, VersaoJornada } from '../tipos';
import { lacunasEntrePares } from './intervalos';

/**
 * Horário (em segundos) em que ela fecha o dia no zero, se sair nele.
 * Só existe quando ela está "dentro" (a última batida foi uma entrada) e o dia tem carga.
 * Se ainda não houve almoço (nenhum intervalo começando no horário de almoço), soma o almoço padrão.
 */
export function previsaoSaida(dia: ResultadoDia, jornada: Pick<VersaoJornada, 'almocoPadrao' | 'janelaAlmoco'>): Segundos | null {
  const mantidas = dia.batidas.filter((b) => b.status === 'ativa' && !b.duplicada);
  if (dia.carga === 0 || mantidas.length % 2 === 0) return null;

  const ultimaEntrada = mantidas[mantidas.length - 1].segundos;
  const lacunas: Lacuna[] = lacunasEntrePares(dia.pares);
  if (mantidas.length >= 3) lacunas.push({ inicio: mantidas[mantidas.length - 2].segundos, fim: ultimaEntrada });

  const { inicio, fim } = jornada.janelaAlmoco;
  const jaAlmocou =
    dia.intervalos.some((i) => i.tipo === 'almoco') || lacunas.some((l) => l.inicio >= inicio && l.inicio <= fim);
  const restante = Math.max(0, dia.carga - dia.trabalhado);
  return ultimaEntrada + restante + (jaAlmocou ? 0 : jornada.almocoPadrao);
}
```

- [ ] **Passo 4: exportar.** Acrescentar ao `motor/src/index.ts`:

```ts
export * from './calculo/previsao';
```

- [ ] **Passo 5: rodar**

Rodar: `npx vitest run motor/test/previsao.test.ts && npm run typecheck`
Esperado: PASS.

- [ ] **Passo 6: commit**

```bash
git add motor/src/calculo/previsao.ts motor/src/index.ts motor/test/previsao.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): previsão de saída e regras do dia em andamento

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 12: Período e banco de horas

**Arquivos:**
- Criar: `motor/src/calculo/banco.ts`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/banco.test.ts`

**Interfaces:**
- Consome: `calcularDia` (Task 9); `listarDatas` (Task 2); `configPadrao` (Task 7); `batida` (Task 5).
- Produz:
  - `calcularPeriodo(e: EntradaPeriodo): ResultadoPeriodo`
  - `EntradaPeriodo { de; ate; hoje; batidas; respostas; ajustes; config }`
  - `ResultadoPeriodo { dias; bancoPorDia: Record<DataISO, Segundos>; bancoInicio; bancoFim; resumo: ResumoPeriodo; pendencias }`
  - `ResumoPeriodo { saldo; trabalhado; carga; abonado; ajustesBanco; diasTrabalhados; feriados; pendencias: number }`

- [ ] **Passo 1: escrever o teste que falha** em `motor/test/banco.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { calcularPeriodo, type EntradaPeriodo } from '../src/calculo/banco';
import { configPadrao } from '../src/calculo/jornada';
import type { Ajuste, Batida, VersaoJornada } from '../src/tipos';
import { batida } from './ajuda';

const HOJE = '2026-10-23';
const CONFIG = { ...configPadrao('2026-10-19'), saldoInicial: -7500 };

const DIAS: Record<string, string[]> = {
  '2026-10-19': ['08:00', '12:00', '13:12', '18:12'],                     // +12min
  '2026-10-20': ['07:56', '07:57', '10:00', '10:50', '12:10', '13:22', '18:21'], // −25min (abono pendente)
  '2026-10-21': ['07:58', '12:01', '13:13', '18:30'],                     // +32min
  '2026-10-22': ['08:01', '12:30', '13:42', '18:14'],                     // +13min
  '2026-10-23': ['07:59:38', '12:03:12', '13:15:12'],                     // hoje, em andamento
};
const BATIDAS: Batida[] = Object.entries(DIAS).flatMap(([data, horas]) => horas.map((hora) => batida(data, hora)));

function periodo(extra: Partial<EntradaPeriodo> = {}) {
  return calcularPeriodo({ de: '2026-10-19', ate: '2026-10-25', hoje: HOJE, batidas: BATIDAS, respostas: [], ajustes: [], config: CONFIG, ...extra });
}

describe('calcularPeriodo', () => {
  it('soma os dias fechados, ignora o dia em andamento e acumula o banco', () => {
    const r = periodo();
    expect(r.dias.map((d) => d.saldo)).toEqual([720, -1500, 1920, 780, expect.any(Number), 0, 0]);
    expect(r.dias[4].status).toBe('em_andamento');
    expect(r.resumo).toMatchObject({ saldo: 1920, diasTrabalhados: 4, feriados: 0, pendencias: 1, ajustesBanco: 0 });
    expect(r.bancoInicio).toBe(-7500);
    expect(r.bancoFim).toBe(-5580);
    expect(r.bancoPorDia['2026-10-20']).toBe(-8280);
    expect(r.bancoPorDia['2026-10-22']).toBe(-5580);
    expect(r.pendencias).toEqual([{ tipo: 'abono_intervalo', data: '2026-10-20', inicio: 36000, fim: 39000 }]);
  });

  it('um recorte no meio herda o banco dos dias anteriores', () => {
    const r = periodo({ de: '2026-10-21', ate: '2026-10-22' });
    expect(r.bancoInicio).toBe(-8280);
    expect(r.resumo.saldo).toBe(2700);
    expect(r.bancoFim).toBe(-5580);
  });

  it('ajuste de banco entra na data dele; ajuste futuro ainda não', () => {
    const pago: Ajuste = { id: 'a1', data: '2026-10-21', tipo: 'ajuste_banco', segundos: -18000, justificativa: 'RH pagou 5h', ativo: true };
    const futuro: Ajuste = { id: 'a2', data: '2026-10-30', tipo: 'ajuste_banco', segundos: 3600, justificativa: 'x', ativo: true };
    const inativo: Ajuste = { ...pago, id: 'a3', ativo: false };
    const r = periodo({ ate: '2026-10-31', ajustes: [pago, futuro, inativo] });
    expect(r.bancoFim).toBe(-5580 - 18000);
    expect(r.resumo.ajustesBanco).toBe(-18000);
  });

  it('período começando antes do início do banco só traz dias a partir do início', () => {
    const r = periodo({ de: '2026-10-01' });
    expect(r.dias[0].data).toBe('2026-10-19');
    expect(r.bancoInicio).toBe(-7500);
  });

  it('mudança de jornada vale só a partir da data dela', () => {
    const oito: VersaoJornada = { ...CONFIG.jornadas[0], inicio: '2026-10-21', cargaPorDiaSemana: [0, 28800, 28800, 28800, 28800, 28800, 0] };
    const r = periodo({ config: { ...CONFIG, jornadas: [CONFIG.jornadas[0], oito] } });
    expect(r.dias.map((d) => d.saldo).slice(0, 4)).toEqual([720, -1500, 4800, 3660]);
  });
});
```

O dia 22/10 com carga de 8h fica 32460 − 28800 = 3660, o que confere com o último valor do teste de jornada.

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run motor/test/banco.test.ts`
Esperado: FAIL, porque o módulo não existe.

- [ ] **Passo 3: implementar** `motor/src/calculo/banco.ts`

```ts
import { listarDatas } from '../tempo';
import type { Ajuste, Batida, ConfigCalculo, DataISO, Pendencia, Resposta, ResultadoDia, Segundos } from '../tipos';
import { calcularDia } from './dia';

export interface EntradaPeriodo {
  de: DataISO;
  ate: DataISO;
  hoje: DataISO;
  batidas: Batida[];
  /** Respostas vigentes (veja respostasVigentes). */
  respostas: Resposta[];
  ajustes: Ajuste[];
  config: ConfigCalculo;
}

export interface ResumoPeriodo {
  saldo: Segundos;
  trabalhado: Segundos;
  carga: Segundos;
  abonado: Segundos;
  ajustesBanco: Segundos;
  diasTrabalhados: number;
  feriados: number;
  pendencias: number;
}

export interface ResultadoPeriodo {
  dias: ResultadoDia[];
  /** Banco ao fim de cada dia do período até hoje (hoje: sem o saldo do dia em andamento). */
  bancoPorDia: Record<DataISO, Segundos>;
  bancoInicio: Segundos;
  bancoFim: Segundos;
  resumo: ResumoPeriodo;
  pendencias: Pendencia[];
}

function agruparPorData<T extends { data: DataISO }>(itens: T[]): Map<DataISO, T[]> {
  const mapa = new Map<DataISO, T[]>();
  for (const item of itens) {
    const lista = mapa.get(item.data);
    if (lista) lista.push(item);
    else mapa.set(item.data, [item]);
  }
  return mapa;
}

const entraNoBanco = (dia: ResultadoDia): boolean => dia.status !== 'em_andamento' && dia.status !== 'futuro';

export function calcularPeriodo(e: EntradaPeriodo): ResultadoPeriodo {
  const batidas = agruparPorData(e.batidas);
  const respostas = agruparPorData(e.respostas);
  const ajustes = agruparPorData(e.ajustes.filter((a) => a.ativo));
  const inicio = e.config.inicioBanco;
  const primeiroDia = e.de > inicio ? e.de : inicio;

  let banco = e.config.saldoInicial;
  let bancoInicio = banco;
  const dias: ResultadoDia[] = [];
  const bancoPorDia: Record<DataISO, Segundos> = {};
  const pendencias: Pendencia[] = [];
  const resumo: ResumoPeriodo = { saldo: 0, trabalhado: 0, carga: 0, abonado: 0, ajustesBanco: 0, diasTrabalhados: 0, feriados: 0, pendencias: 0 };

  for (const data of listarDatas(inicio, e.ate)) {
    if (data === primeiroDia) bancoInicio = banco;
    const ajustesDoDia = ajustes.get(data) ?? [];
    const dia = calcularDia({ data, hoje: e.hoje, batidas: batidas.get(data) ?? [], respostas: respostas.get(data) ?? [], ajustes: ajustesDoDia, config: e.config });
    const ajusteBanco = data <= e.hoje ? ajustesDoDia.reduce((s, a) => s + (a.tipo === 'ajuste_banco' ? a.segundos : 0), 0) : 0;
    if (entraNoBanco(dia)) banco += dia.saldo;
    banco += ajusteBanco;
    if (data < primeiroDia) continue;

    dias.push(dia);
    pendencias.push(...dia.pendencias);
    if (data <= e.hoje) bancoPorDia[data] = banco;
    resumo.ajustesBanco += ajusteBanco;
    if (entraNoBanco(dia)) {
      resumo.saldo += dia.saldo;
      resumo.trabalhado += dia.trabalhado;
      resumo.carga += dia.carga;
      resumo.abonado += dia.abonado;
      if (dia.pares.length > 0) resumo.diasTrabalhados += 1;
      if (dia.feriado) resumo.feriados += 1;
    }
  }
  resumo.pendencias = pendencias.length;
  return { dias, bancoPorDia, bancoInicio, bancoFim: banco, resumo, pendencias };
}
```

- [ ] **Passo 4: exportar.** Acrescentar ao `motor/src/index.ts`:

```ts
export * from './calculo/banco';
```

- [ ] **Passo 5: rodar**

Rodar: `npx vitest run motor/test/banco.test.ts && npm run typecheck`
Esperado: PASS.

- [ ] **Passo 6: commit**

```bash
git add motor/src/calculo/banco.ts motor/src/index.ts motor/test/banco.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): período e banco de horas acumulado com ajustes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 13: Conferência (Gmail × planilha)

**Arquivos:**
- Criar: `motor/src/conferencia.ts`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/conferencia.test.ts`

**Interfaces:**
- Consome: `formatarHora` (Task 2).
- Produz:
  - `conferirIds(idsGmail: Iterable<string>, idsPlanilha: Iterable<string>): ResultadoConferencia`
  - `ResultadoConferencia { ok; totalGmail; totalPlanilha; faltandoNaPlanilha: string[]; ausentesNoGmail: string[] }`
  - `conferirCampos(relidos: RegistroComparavel[], gravados: RegistroComparavel[]): Divergencia[]`
  - `RegistroComparavel { id; data; segundos; nsr?; hash?; cpfConfere? }`
  - `Divergencia { id; campo: 'data'|'hora'|'nsr'|'hash'|'cpf'; esperado; gravado }`

- [ ] **Passo 1: escrever o teste que falha** em `motor/test/conferencia.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { conferirCampos, conferirIds, type RegistroComparavel } from '../src/conferencia';

describe('conferirIds', () => {
  it('ok quando os conjuntos são iguais', () => {
    expect(conferirIds(['a', 'b'], ['b', 'a'])).toEqual({ ok: true, totalGmail: 2, totalPlanilha: 2, faltandoNaPlanilha: [], ausentesNoGmail: [] });
  });

  it('aponta e-mails que faltam na planilha e registros que sumiram do Gmail', () => {
    expect(conferirIds(['a', 'b', 'c'], ['a', 'b', 'x'])).toEqual({
      ok: false, totalGmail: 3, totalPlanilha: 3, faltandoNaPlanilha: ['c'], ausentesNoGmail: ['x'],
    });
  });
});

describe('conferirCampos', () => {
  const base: RegistroComparavel = { id: 'm1', data: '2026-10-23', segundos: 28778, nsr: '12345', hash: 'abc', cpfConfere: true };

  it('sem divergência quando tudo bate', () => {
    expect(conferirCampos([base], [{ ...base }])).toEqual([]);
  });

  it('aponta cada campo diferente com o valor do e-mail e o da planilha', () => {
    const gravado = { ...base, segundos: 28740, nsr: '99999' };
    expect(conferirCampos([base], [gravado])).toEqual([
      { id: 'm1', campo: 'hora', esperado: '07:59:38', gravado: '07:59:00' },
      { id: 'm1', campo: 'nsr', esperado: '12345', gravado: '99999' },
    ]);
  });

  it('ignora registros que não estão na planilha (isso é papel do conferirIds)', () => {
    expect(conferirCampos([base], [])).toEqual([]);
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run motor/test/conferencia.test.ts`
Esperado: FAIL, porque o módulo não existe.

- [ ] **Passo 3: implementar** `motor/src/conferencia.ts`

```ts
import { formatarHora } from './tempo';
import type { DataISO, Segundos } from './tipos';

export interface ResultadoConferencia {
  ok: boolean;
  totalGmail: number;
  totalPlanilha: number;
  faltandoNaPlanilha: string[];
  ausentesNoGmail: string[];
}

export function conferirIds(idsGmail: Iterable<string>, idsPlanilha: Iterable<string>): ResultadoConferencia {
  const gmail = new Set(idsGmail);
  const planilha = new Set(idsPlanilha);
  const faltandoNaPlanilha = [...gmail].filter((id) => !planilha.has(id)).sort();
  const ausentesNoGmail = [...planilha].filter((id) => !gmail.has(id)).sort();
  return {
    ok: faltandoNaPlanilha.length === 0 && ausentesNoGmail.length === 0,
    totalGmail: gmail.size,
    totalPlanilha: planilha.size,
    faltandoNaPlanilha,
    ausentesNoGmail,
  };
}

export interface RegistroComparavel {
  id: string;
  data: DataISO;
  segundos: Segundos;
  nsr?: string;
  hash?: string;
  cpfConfere?: boolean;
}

export interface Divergencia {
  id: string;
  campo: 'data' | 'hora' | 'nsr' | 'hash' | 'cpf';
  esperado: string;
  gravado: string;
}

export function conferirCampos(relidos: RegistroComparavel[], gravados: RegistroComparavel[]): Divergencia[] {
  const porId = new Map(gravados.map((g) => [g.id, g]));
  const divergencias: Divergencia[] = [];
  for (const r of relidos) {
    const g = porId.get(r.id);
    if (!g) continue;
    const comparar = (campo: Divergencia['campo'], esperado: string, gravado: string): void => {
      if (esperado !== gravado) divergencias.push({ id: r.id, campo, esperado, gravado });
    };
    comparar('data', r.data, g.data);
    comparar('hora', formatarHora(r.segundos), formatarHora(g.segundos));
    comparar('nsr', r.nsr ?? '', g.nsr ?? '');
    comparar('hash', r.hash ?? '', g.hash ?? '');
    comparar('cpf', String(r.cpfConfere ?? ''), String(g.cpfConfere ?? ''));
  }
  return divergencias;
}
```

- [ ] **Passo 4: exportar.** Acrescentar ao `motor/src/index.ts`:

```ts
export * from './conferencia';
```

- [ ] **Passo 5: rodar**

Rodar: `npx vitest run motor/test/conferencia.test.ts && npm run typecheck`
Esperado: PASS.

- [ ] **Passo 6: commit**

```bash
git add motor/src/conferencia.ts motor/src/index.ts motor/test/conferencia.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): conferência de IDs e de campos entre Gmail e planilha

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 14: Eventos e textos das notificações

**Arquivos:**
- Criar: `motor/src/calculo/eventos.ts`, `motor/src/textos/notificacoes.ts`
- Modificar: `motor/src/index.ts`
- Testar: `motor/test/notificacoes.test.ts`

**Interfaces:**
- Consome: `ResultadoDia`, `Lacuna`, `Alerta`, `Pendencia` (Task 2); funções de formato (Task 2); `calcularDia` (Task 9).
- Produz:
  - `classificarNovaBatida(dia, batidaId, janelaAlmoco): TipoNovaBatida | null`, com `TipoNovaBatida = {tipo:'entrada'} | {tipo:'saida_intermediaria'; almoco:boolean} | {tipo:'volta'} | {tipo:'saida_final'}` e `INICIO_SAIDA_FINAL = 57600`
  - `gerarNotificacao(evento: EventoNotificacao, ctx: ContextoTexto): Notificacao`
  - `saudacao(agora)`, `cenarioResumo(dia, antes, depois)`
  - Listas de modelos: `MODELOS_ENTRADA`, `MODELOS_SAIDA_ALMOCO`, `MODELOS_SAIDA`, `MODELOS_VOLTA`, `MODELOS_VOLTA_COM_PREVISAO`, `RESUMO`
  - `Notificacao { titulo; corpo; destino }`; as rotas são `#/hoje`, `#/pendencias` e `#/dia/AAAA-MM-DD`

- [ ] **Passo 1: escrever o teste que falha** em `motor/test/notificacoes.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { calcularDia } from '../src/calculo/dia';
import { classificarNovaBatida } from '../src/calculo/eventos';
import { MENOS } from '../src/tempo';
import {
  MODELOS_ENTRADA, MODELOS_SAIDA, MODELOS_SAIDA_ALMOCO, MODELOS_VOLTA, MODELOS_VOLTA_COM_PREVISAO,
  RESUMO, gerarNotificacao, saudacao,
} from '../src/textos/notificacoes';
import { batida, h } from './ajuda';
import { CONFIG, HOJE } from './ajuda-dia';

const ctx = (agora: string) => ({ nome: 'Maria', agora: h(agora), sortear: () => 0 });

describe('saudacao', () => {
  it('muda ao meio-dia e às 18h', () => {
    expect(saudacao(h('11:59:59'))).toBe('Bom dia');
    expect(saudacao(h('12:00'))).toBe('Boa tarde');
    expect(saudacao(h('17:59:59'))).toBe('Boa tarde');
    expect(saudacao(h('18:00'))).toBe('Boa noite');
  });
});

describe('modelos', () => {
  it('toda mensagem de batida e todo cenário de resumo têm pelo menos 3 frases', () => {
    const listas = [MODELOS_ENTRADA, MODELOS_SAIDA_ALMOCO, MODELOS_SAIDA, MODELOS_VOLTA, MODELOS_VOLTA_COM_PREVISAO, ...Object.values(RESUMO)];
    for (const lista of listas) expect(lista.length).toBeGreaterThanOrEqual(3);
  });
});

describe('gerarNotificacao: batidas', () => {
  it('entrada com saudação, nome e horário com segundos', () => {
    expect(gerarNotificacao({ tipo: 'entrada', segundos: h('07:59:38') }, ctx('07:59:40'))).toEqual({
      titulo: 'Entrada registrada', corpo: '☀️ Bom dia, Maria! Entrada às 07:59:38 registrada.', destino: '#/hoje',
    });
  });

  it('volta com previsão arredondada para o minuto seguinte', () => {
    const n = gerarNotificacao({ tipo: 'volta', segundos: h('13:15:12'), previsao: 64778 }, ctx('13:15:20'));
    expect(n.corpo).toBe('⏰ De volta! Pra fechar o dia no zero, sua saída é às 18:00.');
  });

  it('saída pro almoço e saída comum usam modelos diferentes', () => {
    expect(gerarNotificacao({ tipo: 'saida_intermediaria', segundos: h('12:03:12'), almoco: true }, ctx('12:03:20')).corpo)
      .toBe('🍽️ Bom almoço, Maria! Saída às 12:03:12 registrada.');
    expect(gerarNotificacao({ tipo: 'saida_intermediaria', segundos: h('10:00'), almoco: false }, ctx('10:00:10')).corpo)
      .toBe('Saída às 10:00:00 registrada. Até já! 👋');
  });
});

describe('gerarNotificacao: resumo da saída', () => {
  const resumo = (saldoDia: number, bancoAntes: number) =>
    gerarNotificacao({ tipo: 'resumo_saida', saldoDia, bancoAntes, bancoDepois: bancoAntes + saldoDia }, ctx('18:30')).corpo;

  it('banco negativo e dia positivo: motivação com o que falta', () => {
    expect(resumo(780, -6000)).toBe('Boa noite, Maria! Isso aí, hoje pagamos +13min. Falta só 1h27 pra zerar 💪');
  });

  it('acabou de zerar', () => {
    expect(resumo(600, -300)).toBe('ZERAMOS, Maria! 🥳 Banco no azul: +5min.');
  });

  it('banco negativo e dia negativo', () => {
    expect(resumo(-1500, -5000)).toBe(`Boa noite, Maria. Hoje ficou ${MENOS}25min, mas amanhã a gente recupera 😉 Faltam 1h48min20s.`);
  });

  it('banco positivo e dia positivo', () => {
    expect(resumo(1920, 13080)).toBe('Hoje rendeu +32min 🎉 Banco: +4h10.');
  });

  it('banco positivo e dia negativo', () => {
    expect(resumo(-900, 15000)).toBe('Hoje usamos 15min do banco. Ainda sobram 3h55 😌');
  });

  it('banco virou negativo', () => {
    expect(resumo(-900, 300)).toBe(`Hoje ficou ${MENOS}15min e o banco foi pra ${MENOS}10min. Amanhã a gente recupera 😉`);
  });
});

describe('gerarNotificacao: pendências e alertas', () => {
  it('pendência de abono abre a tela de pendências', () => {
    expect(gerarNotificacao({ tipo: 'nova_pendencia', pendencia: { tipo: 'abono_intervalo', data: '2026-10-20', inicio: h('10:00'), fim: h('10:50') } }, ctx('14:00'))).toEqual({
      titulo: 'Pendência', corpo: '🤔 Você saiu das 10:00 às 10:50 em 20/10. Foi abonado? Toca pra responder.', destino: '#/pendencias',
    });
  });

  it('alerta de outra pessoa abre o dia do comprovante', () => {
    const n = gerarNotificacao({ tipo: 'alerta', alerta: { tipo: 'outra_pessoa', data: '2026-10-23', segundos: h('07:59:38'), nome: 'FULANA DE TAL' } }, ctx('08:00'));
    expect(n.corpo).toBe('⚠️ O comprovante de 23/10 às 07:59:38 está no nome de FULANA DE TAL. Provavelmente o RH lançou errado.');
    expect(n.destino).toBe('#/dia/2026-10-23');
  });

  it('pendências antigas no singular e no plural', () => {
    expect(gerarNotificacao({ tipo: 'pendencias_antigas', quantidade: 1 }, ctx('12:00')).corpo).toBe('Ainda tem 1 resposta esperando por você 🙏');
    expect(gerarNotificacao({ tipo: 'pendencias_antigas', quantidade: 3 }, ctx('12:00')).corpo).toBe('Ainda tem 3 respostas esperando por você 🙏');
  });
});

describe('classificarNovaBatida', () => {
  const janela = CONFIG.jornadas[0].janelaAlmoco;
  const b = ['07:59:38', '12:03:12', '13:15:12', '18:00:00'].map((hora) => batida(HOJE, hora));
  const dia = calcularDia({ data: HOJE, hoje: HOJE, batidas: b, respostas: [], ajustes: [], config: CONFIG });

  it('entrada, saída pro almoço, volta e saída final', () => {
    expect(b.map((x) => classificarNovaBatida(dia, x.id, janela))).toEqual([
      { tipo: 'entrada' }, { tipo: 'saida_intermediaria', almoco: true }, { tipo: 'volta' }, { tipo: 'saida_final' },
    ]);
  });

  it('saída antes do horário de almoço não é almoço; duplicada não gera evento', () => {
    const saida = batida(HOJE, '10:00');
    const dup = batida(HOJE, '10:02');
    const d = calcularDia({ data: HOJE, hoje: HOJE, batidas: [batida(HOJE, '08:00'), saida, dup], respostas: [], ajustes: [], config: CONFIG });
    expect(classificarNovaBatida(d, saida.id, janela)).toEqual({ tipo: 'saida_intermediaria', almoco: false });
    expect(classificarNovaBatida(d, dup.id, janela)).toBeNull();
  });
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rodar: `npx vitest run motor/test/notificacoes.test.ts`
Esperado: FAIL, porque os módulos não existem.

- [ ] **Passo 3: implementar** `motor/src/calculo/eventos.ts`

```ts
import type { Lacuna, ResultadoDia, Segundos } from '../tipos';

/** A partir deste horário, uma batida de saída fecha o dia e gera o resumo (spec §8). */
export const INICIO_SAIDA_FINAL: Segundos = 16 * 3600;

export type TipoNovaBatida =
  | { tipo: 'entrada' }
  | { tipo: 'saida_intermediaria'; almoco: boolean }
  | { tipo: 'volta' }
  | { tipo: 'saida_final' };

export function classificarNovaBatida(dia: ResultadoDia, batidaId: string, janelaAlmoco: Lacuna): TipoNovaBatida | null {
  const mantidas = dia.batidas.filter((b) => b.status === 'ativa' && !b.duplicada);
  const posicao = mantidas.findIndex((b) => b.id === batidaId);
  if (posicao < 0) return null;
  if (posicao === 0) return { tipo: 'entrada' };
  if (posicao % 2 === 0) return { tipo: 'volta' };
  const { segundos } = mantidas[posicao];
  if (segundos >= INICIO_SAIDA_FINAL) return { tipo: 'saida_final' };
  return { tipo: 'saida_intermediaria', almoco: segundos >= janelaAlmoco.inicio && segundos <= janelaAlmoco.fim };
}
```

- [ ] **Passo 4: implementar** `motor/src/textos/notificacoes.ts`

```ts
import {
  arredondarParaMinutoSeguinte, dataCurtaBR, formatarDuracao, formatarHora, formatarHoraCurta, formatarSaldo,
} from '../tempo';
import type { Alerta, DataISO, Pendencia, Segundos } from '../tipos';

export interface ContextoTexto {
  nome: string;
  /** Hora local atual em segundos (define a saudação). */
  agora: Segundos;
  /** Sorteio injetável; recebe a quantidade de opções. Os testes usam () => 0. */
  sortear?: (quantidade: number) => number;
}

export interface Notificacao {
  titulo: string;
  corpo: string;
  /** Rota do app aberta ao tocar. */
  destino: string;
}

export type EventoNotificacao =
  | { tipo: 'entrada'; segundos: Segundos }
  | { tipo: 'saida_intermediaria'; segundos: Segundos; almoco: boolean }
  | { tipo: 'volta'; segundos: Segundos; previsao: Segundos | null }
  | { tipo: 'resumo_saida'; saldoDia: Segundos; bancoAntes: Segundos; bancoDepois: Segundos }
  | { tipo: 'nova_pendencia'; pendencia: Pendencia }
  | { tipo: 'lembrete_entrada' }
  | { tipo: 'dia_incompleto'; quantidade: number }
  | { tipo: 'alerta'; alerta: Alerta }
  | { tipo: 'pendencias_antigas'; quantidade: number };

interface DadosBatida { s: string; nome: string; hora: string; previsao: string }
interface DadosResumo { s: string; nome: string; dia: string; diaAbs: string; falta: string; banco: string; bancoAbs: string }
type Modelo<T> = (dados: T) => string;

export const MODELOS_ENTRADA: Modelo<DadosBatida>[] = [
  ({ s, nome, hora }) => `☀️ ${s}, ${nome}! Entrada às ${hora} registrada.`,
  ({ nome, hora }) => `Entrada às ${hora} anotada ✓ Bom trabalho, ${nome}!`,
  ({ s, hora }) => `${s}! Bati aqui: entrada às ${hora} ✓`,
];

export const MODELOS_SAIDA_ALMOCO: Modelo<DadosBatida>[] = [
  ({ nome, hora }) => `🍽️ Bom almoço, ${nome}! Saída às ${hora} registrada.`,
  ({ hora }) => `Saída pro almoço às ${hora} ✓ Aproveita! 🍽️`,
  ({ hora }) => `Hora de recarregar 🍽️ Saída às ${hora} anotada.`,
];

export const MODELOS_SAIDA: Modelo<DadosBatida>[] = [
  ({ hora }) => `Saída às ${hora} registrada. Até já! 👋`,
  ({ hora }) => `Anotei sua saída às ${hora} ✓`,
  ({ hora }) => `Saída às ${hora} ✓ Quando voltar, eu registro.`,
];

export const MODELOS_VOLTA_COM_PREVISAO: Modelo<DadosBatida>[] = [
  ({ previsao }) => `⏰ De volta! Pra fechar o dia no zero, sua saída é às ${previsao}.`,
  ({ hora, previsao }) => `Volta às ${hora} ✓ Saída prevista pro zero: ${previsao} ⏰`,
  ({ previsao }) => `Que bom que voltou! Hoje dá pra sair às ${previsao} no zero 😉`,
];

export const MODELOS_VOLTA: Modelo<DadosBatida>[] = [
  ({ hora }) => `De volta às ${hora} ✓`,
  ({ hora }) => `Volta registrada às ${hora} ✓`,
  ({ hora }) => `Anotei sua volta às ${hora} 👍`,
];

export type CenarioResumo =
  | 'zerou' | 'virouNegativo' | 'pagando' | 'devendoNegativo' | 'devendoZero' | 'positivo' | 'usandoBanco' | 'positivoZero';

export const RESUMO: Record<CenarioResumo, Modelo<DadosResumo>[]> = {
  zerou: [
    ({ nome, banco }) => `ZERAMOS, ${nome}! 🥳 Banco no azul: ${banco}.`,
    ({ banco }) => `Banco zerado! 🥳 Agora estamos com ${banco}.`,
    ({ nome, banco }) => `Conseguimos, ${nome}! Saímos do vermelho 🎉 Banco: ${banco}.`,
  ],
  pagando: [
    ({ s, nome, dia, falta }) => `${s}, ${nome}! Isso aí, hoje pagamos ${dia}. Falta só ${falta} pra zerar 💪`,
    ({ dia, falta }) => `Mais um passo! Hoje foram ${dia}. Faltam ${falta} pra zerar o banco 💪`,
    ({ s, nome, diaAbs, falta }) => `${s}, ${nome}! Pagamos ${diaAbs} hoje 👏 Agora faltam ${falta}.`,
  ],
  devendoNegativo: [
    ({ s, nome, dia, falta }) => `${s}, ${nome}. Hoje ficou ${dia}, mas amanhã a gente recupera 😉 Faltam ${falta}.`,
    ({ dia, falta }) => `Hoje ficou ${dia}. Tudo bem, amanhã a gente compensa 😉 Faltam ${falta} pra zerar.`,
    ({ nome, dia, falta }) => `${nome}, hoje foi ${dia}. Bora recuperar amanhã 💪 Faltam ${falta}.`,
  ],
  devendoZero: [
    ({ falta }) => `Dia fechado no zero ✓ Faltam ${falta} pra zerar o banco.`,
    ({ s, nome, falta }) => `${s}, ${nome}! Dia certinho ✓ Ainda faltam ${falta} pra zerar.`,
    ({ falta }) => `Fechamos o dia no zero ✓ Faltam ${falta}.`,
  ],
  positivo: [
    ({ dia, banco }) => `Hoje rendeu ${dia} 🎉 Banco: ${banco}.`,
    ({ s, nome, dia, banco }) => `${s}, ${nome}! Mais ${dia} pro banco 🎉 Total: ${banco}.`,
    ({ dia, banco }) => `Dia produtivo: ${dia} 🙌 Banco em ${banco}.`,
  ],
  usandoBanco: [
    ({ diaAbs, bancoAbs }) => `Hoje usamos ${diaAbs} do banco. Ainda sobram ${bancoAbs} 😌`,
    ({ s, nome, diaAbs, bancoAbs }) => `${s}, ${nome}. Hoje saíram ${diaAbs} do banco, que segue com ${bancoAbs} 😌`,
    ({ diaAbs, banco }) => `Usamos ${diaAbs} do banco hoje. Saldo: ${banco} 👍`,
  ],
  virouNegativo: [
    ({ dia, banco }) => `Hoje ficou ${dia} e o banco foi pra ${banco}. Amanhã a gente recupera 😉`,
    ({ s, nome, dia, banco }) => `${s}, ${nome}. Hoje foi ${dia} e o banco ficou em ${banco}. Bora compensar 💪`,
    ({ dia, banco }) => `Dia de ${dia}. O banco ficou em ${banco}, mas dá pra recuperar 😉`,
  ],
  positivoZero: [
    ({ banco }) => `Dia fechado no zero ✓ Banco: ${banco}.`,
    ({ s, nome, banco }) => `${s}, ${nome}! Dia certinho ✓ Banco segue em ${banco}.`,
    ({ banco }) => `Fechamos o dia no zero ✓ Banco em ${banco}.`,
  ],
};

export function saudacao(agora: Segundos): string {
  if (agora < 12 * 3600) return 'Bom dia';
  if (agora < 18 * 3600) return 'Boa tarde';
  return 'Boa noite';
}

export function cenarioResumo(saldoDia: Segundos, bancoAntes: Segundos, bancoDepois: Segundos): CenarioResumo {
  if (bancoAntes < 0 && bancoDepois >= 0) return 'zerou';
  if (bancoAntes >= 0 && bancoDepois < 0) return 'virouNegativo';
  if (bancoAntes < 0) return saldoDia > 0 ? 'pagando' : saldoDia < 0 ? 'devendoNegativo' : 'devendoZero';
  return saldoDia > 0 ? 'positivo' : saldoDia < 0 ? 'usandoBanco' : 'positivoZero';
}

function escolher<T>(opcoes: T[], ctx: ContextoTexto): T {
  const sortear = ctx.sortear ?? ((n: number) => Math.floor(Math.random() * n));
  return opcoes[sortear(opcoes.length) % opcoes.length];
}

const quando = (data: DataISO, segundos: Segundos): string => `${dataCurtaBR(data)} às ${formatarHora(segundos)}`;

function textoPendencia(p: Pendencia): string {
  const d = dataCurtaBR(p.data);
  switch (p.tipo) {
    case 'abono_intervalo':
      return `🤔 Você saiu das ${formatarHoraCurta(p.inicio)} às ${formatarHoraCurta(p.fim)} em ${d}. Foi abonado? Toca pra responder.`;
    case 'dia_sem_batida':
      return `📅 ${d} ficou sem nenhuma batida. Foi folga, atestado, férias ou feriado?`;
    case 'batida_faltando':
      return `⚠️ ${d} ficou com uma batida faltando. Toca pra completar.`;
    case 'so_duas_batidas':
      return `🍽️ Em ${d} só teve entrada e saída. Você almoçou sem bater o ponto?`;
    case 'almoco_ambiguo':
      return `🤔 Em ${d} não deu pra saber qual saída foi o almoço. Me ajuda?`;
  }
}

function textoAlerta(a: Alerta): string {
  switch (a.tipo) {
    case 'outra_pessoa':
      return `⚠️ O comprovante de ${quando(a.data, a.segundos)} está no nome de ${a.nome ?? 'outra pessoa'}. Provavelmente o RH lançou errado.`;
    case 'nome_diferente':
      return `⚠️ O comprovante de ${quando(a.data, a.segundos)} está com o seu CPF, mas com o nome "${a.nome}". A batida foi contada; vale avisar o RH.`;
    case 'empresa_diferente':
      return `⚠️ O comprovante de ${quando(a.data, a.segundos)} veio com o CNPJ de outra empresa. A batida foi contada; vale conferir com o RH.`;
    case 'comprovante_incompleto':
      return `⚠️ O comprovante de ${quando(a.data, a.segundos)} veio sem ${a.faltando.join(' e ')}. A batida foi contada e o aviso ficou guardado.`;
    case 'provisorio':
      return `⚠️ Chegou um comprovante num formato novo. Anotei a batida pelo horário do e-mail (${quando(a.data, a.segundos)}) e avisei o desenvolvedor.`;
    case 'atrasado':
      return `📬 Chegou o comprovante de ${quando(a.data, a.segundos)}, com ${formatarDuracao(a.atraso)} de atraso. Já reorganizei o dia ✓`;
    case 'outro_tipo':
      return `📩 Chegou um e-mail do RHiD que não é comprovante: "${a.assunto}". Dá uma olhada no app.`;
    case 'remetente_desconhecido':
      return `⚠️ Chegou um comprovante de um remetente desconhecido (${a.remetente}). Confere no app.`;
    case 'ausente_no_gmail':
      return `⚠️ O e-mail do comprovante de ${quando(a.data, a.segundos)} não está mais no Gmail. A cópia continua guardada.`;
    case 'campo_divergente':
      return `⚠️ A planilha está diferente do e-mail no comprovante de ${quando(a.data, a.segundos)} (campo: ${a.campo}). Alguém mexeu na planilha?`;
  }
}

export function gerarNotificacao(evento: EventoNotificacao, ctx: ContextoTexto): Notificacao {
  const s = saudacao(ctx.agora);
  const nome = ctx.nome;
  switch (evento.tipo) {
    case 'entrada':
      return { titulo: 'Entrada registrada', corpo: escolher(MODELOS_ENTRADA, ctx)({ s, nome, hora: formatarHora(evento.segundos), previsao: '' }), destino: '#/hoje' };
    case 'saida_intermediaria': {
      const modelos = evento.almoco ? MODELOS_SAIDA_ALMOCO : MODELOS_SAIDA;
      return { titulo: 'Saída registrada', corpo: escolher(modelos, ctx)({ s, nome, hora: formatarHora(evento.segundos), previsao: '' }), destino: '#/hoje' };
    }
    case 'volta': {
      const previsao = evento.previsao === null ? null : formatarHoraCurta(arredondarParaMinutoSeguinte(evento.previsao));
      const modelos = previsao ? MODELOS_VOLTA_COM_PREVISAO : MODELOS_VOLTA;
      return { titulo: 'Volta registrada', corpo: escolher(modelos, ctx)({ s, nome, hora: formatarHora(evento.segundos), previsao: previsao ?? '' }), destino: '#/hoje' };
    }
    case 'resumo_saida': {
      const cenario = cenarioResumo(evento.saldoDia, evento.bancoAntes, evento.bancoDepois);
      const corpo = escolher(RESUMO[cenario], ctx)({
        s, nome,
        dia: formatarSaldo(evento.saldoDia),
        diaAbs: formatarDuracao(evento.saldoDia),
        falta: formatarDuracao(evento.bancoDepois),
        banco: formatarSaldo(evento.bancoDepois),
        bancoAbs: formatarDuracao(evento.bancoDepois),
      });
      return { titulo: 'Resumo do dia', corpo, destino: '#/hoje' };
    }
    case 'nova_pendencia':
      return { titulo: 'Pendência', corpo: textoPendencia(evento.pendencia), destino: '#/pendencias' };
    case 'lembrete_entrada':
      return { titulo: 'Lembrete', corpo: `${s}! Ainda não chegou o comprovante de entrada de hoje. Você já bateu? Eu aviso quando chegar 😉`, destino: '#/hoje' };
    case 'dia_incompleto':
      return { titulo: 'Batida faltando?', corpo: `⚠️ Hoje ficaram ${evento.quantidade} batidas. Falta alguma?`, destino: '#/hoje' };
    case 'alerta':
      return { titulo: 'Atenção', corpo: textoAlerta(evento.alerta), destino: 'data' in evento.alerta ? `#/dia/${evento.alerta.data}` : '#/hoje' };
    case 'pendencias_antigas':
      return {
        titulo: 'Pendências',
        corpo: evento.quantidade === 1 ? 'Ainda tem 1 resposta esperando por você 🙏' : `Ainda tem ${evento.quantidade} respostas esperando por você 🙏`,
        destino: '#/pendencias',
      };
  }
}
```

- [ ] **Passo 5: exportar.** Acrescentar ao `motor/src/index.ts`:

```ts
export * from './calculo/eventos';
export * from './textos/notificacoes';
```

- [ ] **Passo 6: rodar a suíte inteira**

Rodar: `npm test && npm run typecheck`
Esperado: todos os testes do motor e dos scripts passam e o typecheck fica limpo.

- [ ] **Passo 7: commit**

```bash
git add motor/src/calculo/eventos.ts motor/src/textos/notificacoes.ts motor/src/index.ts motor/test/notificacoes.test.ts
git commit -m "$(cat <<'EOF'
feat(motor): eventos de batida e textos das notificações

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 15: Anonimização de comprovantes reais

**Arquivos:**
- Criar: `scripts/anonimizar.ts`, `scripts/anonimizar-eml.ts`
- Modificar: `package.json` (devDependencies)
- Testar: `scripts/anonimizar.test.ts`

**Interfaces:**
- Consome: `htmlParaTexto`, `lerComprovante`, `ENTIDADES` (motor); `FALSO` (Task 5).
- Produz:
  - `anonimizarHtml(html): { html: string; substituicoes: number; camposEncontrados: string[] }`. Lança erro se algum dado real sobrar.
  - `regexTolerante(valor): RegExp`
  - A CLI `npx tsx scripts/anonimizar-eml.ts <original.eml> <saida.html>`

- [ ] **Passo 1: instalar o mailparser**

Rodar: `npm install -D mailparser@^3.7.1 @types/mailparser@^3.4.4`
Esperado: instalado.

- [ ] **Passo 2: escrever o teste que falha** em `scripts/anonimizar.test.ts`

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { htmlParaTexto, lerComprovante } from '../motor/src/index';
import { FALSO } from '../motor/test/fixtures/dados-falsos';
import { anonimizarHtml, regexTolerante } from './anonimizar';

const modelo = readFileSync(new URL('../motor/test/fixtures/comprovante-modelo.html', import.meta.url), 'utf8');

/** Monta um comprovante "real" de mentira: troca os falsos por outros valores e acrescenta e-mail e pixel de rastreio. */
function htmlReal(): string {
  return modelo
    .replace(FALSO.cpf, '987.654.321-99')
    .replace(FALSO.nome, 'JO&Atilde;O REAL DE TESTE')
    .replace(FALSO.cnpj, '22333444000155')
    .replace(FALSO.empresa, 'EMPRESA REAL S.A.')
    .replace(FALSO.hash, 'f'.repeat(64))
    .replace('</body>', '<img src="https://rastreio.example.org/p.gif?u=abc"><p>Enviado para joao.real@example.org</p></body>');
}

describe('anonimizarHtml', () => {
  it('troca os dados reais pelos falsos e o comprovante continua legível', () => {
    const { html } = anonimizarHtml(htmlReal());
    for (const real of ['98765432199', '987.654.321-99', 'JO&Atilde;O', 'JOÃO REAL', '22333444000155', 'EMPRESA REAL', 'f'.repeat(64), 'joao.real@example.org', 'rastreio.example.org']) {
      expect(html).not.toContain(real);
    }
    expect(lerComprovante(htmlParaTexto(html))).toMatchObject({
      cpfTrabalhador: FALSO.cpf, nomeTrabalhador: FALSO.nome, cnpjEmpregador: FALSO.cnpj,
      nomeEmpregador: FALSO.empresa, hash: FALSO.hash, nsr: FALSO.nsr,
    });
    expect(html).toContain('usuaria@example.com');
  });

  it('mantém o remetente do RHiD', () => {
    const { html } = anonimizarHtml(modelo.replace('</body>', '<p>rhid.naoresponda@controlid.com.br</p></body>'));
    expect(html).toContain('rhid.naoresponda@controlid.com.br');
  });
});

describe('regexTolerante', () => {
  it('casa o valor mesmo quando ele vem com entidades HTML', () => {
    const re = regexTolerante('JOÃO DA SILVA');
    expect('JO&Atilde;O DA&nbsp;SILVA'.replace(re, 'X')).toBe('X');
    expect('JO&#195;O DA SILVA'.replace(re, 'X')).toBe('X');
    expect('João da Silva'.replace(re, 'X')).toBe('X');
  });
});
```

- [ ] **Passo 3: rodar e ver falhar**

Rodar: `npx vitest run scripts/anonimizar.test.ts`
Esperado: FAIL, porque `./anonimizar` não existe.

- [ ] **Passo 4: implementar** `scripts/anonimizar.ts`

```ts
import { ENTIDADES, htmlParaTexto, lerComprovante } from '../motor/src/index';
import { FALSO } from '../motor/test/fixtures/dados-falsos';

const REMETENTE_RHID = 'rhid.naoresponda@controlid.com.br';
const REVERSO = new Map(Object.entries(ENTIDADES).map(([nome, caractere]) => [caractere, nome]));

const formatarCpf = (d: string): string => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
const formatarCnpj = (d: string): string => `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;

/** Regex que casa o valor com ou sem entidades HTML no lugar dos acentos e dos espaços. */
export function regexTolerante(valor: string): RegExp {
  let fonte = '';
  for (const ch of valor) {
    if (/\s/.test(ch)) {
      fonte += '(?:\\s|&nbsp;|&#160;)+';
      continue;
    }
    const escapado = ch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    if (/[\x20-\x7e]/.test(ch)) {
      fonte += escapado;
      continue;
    }
    const codigo = ch.codePointAt(0) ?? 0;
    const alternativas = [escapado, `&#${codigo};`, `&#x${codigo.toString(16)};`];
    const nome = REVERSO.get(ch);
    if (nome) alternativas.push(`&${nome};`);
    fonte += `(?:${alternativas.join('|')})`;
  }
  return new RegExp(fonte, 'giu');
}

export interface ResultadoAnonimizacao {
  html: string;
  substituicoes: number;
  camposEncontrados: string[];
}

export function anonimizarHtml(html: string): ResultadoAnonimizacao {
  const campos = lerComprovante(htmlParaTexto(html));
  const trocas: Array<[string, string]> = [];
  if (campos.cpfTrabalhador) {
    trocas.push([formatarCpf(campos.cpfTrabalhador), formatarCpf(FALSO.cpf)], [campos.cpfTrabalhador, FALSO.cpf]);
  }
  if (campos.nomeTrabalhador) trocas.push([campos.nomeTrabalhador, FALSO.nome]);
  if (campos.cnpjEmpregador?.length === 14) {
    trocas.push([formatarCnpj(campos.cnpjEmpregador), formatarCnpj(FALSO.cnpj)], [campos.cnpjEmpregador, FALSO.cnpj]);
  }
  if (campos.nomeEmpregador) trocas.push([campos.nomeEmpregador, FALSO.empresa]);
  if (campos.hash) trocas.push([campos.hash, FALSO.hash]);

  let saida = html;
  let substituicoes = 0;
  for (const [real, falso] of trocas) {
    saida = saida.replace(regexTolerante(real), () => {
      substituicoes += 1;
      return falso;
    });
  }
  saida = saida
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/\shref\s*=\s*("[^"]*"|'[^']*')/gi, ' href="#"')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (email) =>
      email.toLowerCase() === REMETENTE_RHID ? email : 'usuaria@example.com',
    );

  const reais = trocas.map(([real]) => real.toLowerCase());
  const texto = htmlParaTexto(saida).toLowerCase();
  const sobrou = reais.filter((real) => texto.includes(real) || saida.toLowerCase().includes(real));
  if (sobrou.length > 0) {
    throw new Error(`Anonimização incompleta: ${sobrou.length} dado(s) real(is) ainda aparecem. Revise o arquivo à mão.`);
  }
  return { html: saida, substituicoes, camposEncontrados: Object.keys(campos).filter((k) => k !== 'temTitulo') };
}
```

- [ ] **Passo 5: implementar a CLI** `scripts/anonimizar-eml.ts`

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { simpleParser } from 'mailparser';
import { anonimizarHtml } from './anonimizar';

const [entrada, saida] = process.argv.slice(2);
if (!entrada || !saida) {
  console.error('Uso: npx tsx scripts/anonimizar-eml.ts <original.eml> <saida.html>');
  process.exit(1);
}

const email = await simpleParser(readFileSync(entrada));
const html = typeof email.html === 'string' ? email.html : (email.textAsHtml ?? '');
if (!html) {
  console.error('O e-mail não tem corpo HTML.');
  process.exit(1);
}

const resultado = anonimizarHtml(html);
writeFileSync(saida, resultado.html, 'utf8');
console.log(`OK: ${resultado.substituicoes} substituição(ões). Campos lidos: ${resultado.camposEncontrados.join(', ')}`);
console.log(`Partes MIME: html=${typeof email.html === 'string'} text=${Boolean(email.text)} | Date: ${email.date?.toISOString() ?? '-'}`);
```

- [ ] **Passo 6: rodar**

Rodar: `npx vitest run scripts/anonimizar.test.ts && npm run typecheck && npm run verificar:dados`
Esperado: PASS e nenhum dado pessoal encontrado.

- [ ] **Passo 7: commit**

```bash
git add scripts/anonimizar.ts scripts/anonimizar-eml.ts scripts/anonimizar.test.ts package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat(scripts): anonimização de comprovantes reais para virar fixture

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

---

### Task 16: Fixture com um comprovante real (depende de um arquivo do usuário)

**Pré-requisito:** o arquivo original de um comprovante. No Gmail, abrir o e-mail → ⋮ → **Mostrar original** → **Baixar original**. Salvar em `originais/comprovante-1.eml`. A pasta `originais/` está no `.gitignore` e o arquivo **nunca** entra no repositório.

**Arquivos:**
- Criar: `motor/test/fixtures/comprovante-real-anonimizado.html` (gerado pela CLI)
- Testar: `motor/test/comprovante-real.test.ts`

**Interfaces:**
- Consome: a CLI da Task 15; `lerComprovante`, `classificarMensagem`, `htmlParaTexto`; `FALSO`.
- Produz: a fixture fiel ao formato real. O Plano 2 usa essa mesma fixture como "comprovante-modelo" no check-up diário do robô.

- [ ] **Passo 1: gerar a fixture anonimizada**

```bash
npx tsx scripts/anonimizar-eml.ts originais/comprovante-1.eml motor/test/fixtures/comprovante-real-anonimizado.html
```
Esperado: `OK: N substituição(ões). Campos lidos: nsr, registradoEm, …`. Se der "Anonimização incompleta", **não** continue: abra o HTML, veja como o dado aparece e ajuste `regexTolerante` com TDD, acrescentando o caso em `scripts/anonimizar.test.ts`.

- [ ] **Passo 2: conferir à mão**

Abra `motor/test/fixtures/comprovante-real-anonimizado.html` e procure qualquer nome, CPF, CNPJ, e-mail ou endereço reais. Depois rode `npm run verificar:dados`.
Esperado: nada pessoal e `OK`.

- [ ] **Passo 3: escrever o teste** `motor/test/comprovante-real.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { classificarMensagem } from '../src/leitor/classificar';
import { lerComprovante } from '../src/leitor/comprovante';
import { htmlParaTexto } from '../src/leitor/texto';
import { lerFixture } from './ajuda';
import { FALSO } from './fixtures/dados-falsos';

const texto = htmlParaTexto(lerFixture('comprovante-real-anonimizado.html'));

describe('comprovante real (anonimizado)', () => {
  it('o leitor encontra todos os campos no formato real', () => {
    const campos = lerComprovante(texto);
    expect(campos.temTitulo).toBe(true);
    expect(campos.nsr).toMatch(/^\d+$/);
    expect(campos.registradoEm?.hora).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(campos).toMatchObject({
      cpfTrabalhador: FALSO.cpf, nomeTrabalhador: FALSO.nome, cnpjEmpregador: FALSO.cnpj,
      nomeEmpregador: FALSO.empresa, hash: FALSO.hash,
    });
    expect(campos.inpi).toMatch(/^BR\d+$/);
  });

  it('é classificado como comprovante completo, sem alertas', () => {
    const registro = lerComprovante(texto).registradoEm;
    if (!registro) throw new Error('registro não lido');
    const r = classificarMensagem(
      { id: 'real-1', assunto: 'Comprovante de marcação de ponto IDFace', texto, recebidoEm: { data: registro.data, segundos: registro.segundos + 5 } },
      { cpf: FALSO.cpf, nome: FALSO.nome, cnpj: FALSO.cnpj },
      new Set(),
    );
    expect(r.classificacao).toBe('comprovante');
    expect(r.alertas).toEqual([]);
  });
});
```

- [ ] **Passo 4: rodar**

Rodar: `npx vitest run motor/test/comprovante-real.test.ts`
Esperado: PASS. **Se falhar, o formato real é diferente do modelo.** Nesse caso:
1. acrescente em `motor/test/comprovante.test.ts` um caso que reproduza a diferença (TDD);
2. corrija `lerComprovante`;
3. rode `npm test` até passar tudo.

- [ ] **Passo 5: commit**

```bash
git add motor/test/fixtures/comprovante-real-anonimizado.html motor/test/comprovante-real.test.ts
git commit -m "$(cat <<'EOF'
test(motor): leitura de um comprovante real anonimizado

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push
```

- [ ] **Passo 6: conferência final do plano**

Rodar: `npm test && npm run typecheck && npm run verificar:dados && gh run watch "$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status`
Esperado: tudo verde, local e no GitHub Actions.

---

## Próximos planos (fora do escopo deste)

Cada um será escrito quando o anterior terminar, já com o que aprendermos no caminho.

1. **Plano 2: Robô e planilha** (precisa da conta Google dela).
   - **Base:** planilha "Ponto Certo — Dados"; Apps Script vinculado à planilha via `clasp`; bundle do motor com esbuild.
   - **Leitura e sincronização:** Gmail API avançada; sincronização incremental e completa; gatilhos `tick`, `vigia` e `checkupDiario`; `LockService`.
   - **Conferência:** profunda e varredura ampla.
   - **Configuração privada:** CPF, nome e CNPJ esperados ficam nas Propriedades do Script.
   - **Saúde:** Healthchecks.io.
   - **API:** web app com login validado por `tokeninfo` e sessões.
   - **Entregável:** todos os comprovantes já existentes importados e conferidos (homologação, itens 1–3 e 5).
2. **Plano 3: App PWA e notificações.**
   - **Base:** Vite + Preact; telas aprovadas (estilo A); login com o Google (GIS); cache offline.
   - **Notificações:** Firebase Cloud Messaging, com envio pelo robô.
   - **Exportação:** Excel com 4 abas (ExcelJS) e PDF.
   - **Publicação:** GitHub Pages via Actions.
   - **Entregável:** app instalado no celular dela.
3. **Plano 4: Homologação.** Roteiro da spec §17, com registro dos resultados e a semana em paralelo.
