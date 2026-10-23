# Ponto Certo: documento de design

- **Data:** 2026-10-23
- **Status:** aguardando revisão
- **Nome do app:** Ponto Certo (nome de trabalho, pode mudar)

> Este documento vai para um repositório público. Ele não contém, e o código também nunca deve conter, nenhum dado pessoal: CPF, nome completo, e-mail, empregador ou batidas. Esses dados ficam só na conta Google da usuária (seção 14).

---

## 1. Objetivo

A usuária bate o ponto num iDFace (Control iD). A cada batida, o sistema RHiD manda para o Gmail pessoal dela um **Comprovante de Registro de Ponto do Trabalhador**. O RH diz que ela tem saldo negativo, mas não entrega espelho de ponto nem nenhum outro documento para conferência.

O **Ponto Certo** lê esses comprovantes, calcula o banco de horas pelas regras da seção 6, avisa no celular o que está acontecendo e gera relatórios que servem de prova numa conversa com o RH.

**Critérios de sucesso:**

1. Todo comprovante que está no Gmail aparece no app, e o app mostra essa conferência.
2. O saldo pode ser refeito à mão a partir das batidas e das regras, e o resultado é o mesmo.
3. Ela usa no celular sem esforço: abre, vê o saldo e responde as pendências.
4. O relatório exportado traz a prova de cada batida (NSR e hash).

## 2. Princípios inegociáveis

| # | Princípio | Na prática |
|---|---|---|
| P1 | **O Gmail é a fonte da verdade.** | A planilha e o app são cópias conferidas. Toda batida vem de um comprovante. A única exceção são as batidas manuais, que ficam sempre marcadas. |
| P2 | **Nada some sem aviso.** | Todo e-mail do remetente aparece no app, seja como comprovante, como "outro tipo de e-mail" ou como alerta. Toda divergência gera aviso. |
| P3 | **Prova fica separada de declaração.** | Comprovante (com NSR e hash), batida manual e justificativa são coisas diferentes e aparecem diferentes em todas as telas e relatórios. |
| P4 | **Na dúvida, pergunta.** | Enquanto ela não responde, o dia é calculado como o RH calcularia (o cenário mais conservador), e a pendência fica visível. |
| P5 | **Parada atrasa, nunca perde.** | Cada sincronização confere o Gmail inteiro. Se o robô parar, quando voltar ele recupera tudo sozinho. |
| P6 | **Nenhum dado pessoal no repositório.** | CPF, nome, e-mails, empregador e batidas ficam só na conta Google dela. |

## 3. Visão geral da arquitetura

```
iDFace → RHiD → e-mail → Gmail dela                      (fonte da verdade)
                            │  a cada 1 min no horário de trabalho
                            ▼  e sob demanda quando o app abre
   Robô (Google Apps Script, vinculado à planilha, roda como ela)
     ├─ Leitor ........ lê e classifica cada e-mail do remetente
     ├─ Conferência ... IDs no Gmail = IDs na planilha?
     ├─ Cálculo ....... motor compartilhado (mesmo código do app)
     ├─ Notificador ... Firebase Cloud Messaging → celular
     └─ Saúde ......... batimento, autocorreção e check-ups ──► vigia externo (Healthchecks.io)
                            │
                            ▼
   Planilha "Ponto Certo — Dados" (Drive dela)
                            ▲
                            │  API do robô (web app) com sessão autenticada
   App PWA (GitHub Pages) instalado no Android, com "Entrar com Google"
```

| Componente | Responsabilidade | Tecnologia |
|---|---|---|
| **Robô** | Ler o Gmail, classificar, gravar, conferir, calcular, notificar, vigiar a própria saúde e servir a API do app. | Google Apps Script (V8), vinculado à planilha, com o serviço avançado do Gmail. |
| **Planilha** | Guardar os dados de forma que dê para ler e conferir. | Google Sheets, no Drive dela. |
| **Motor** | Leitura do comprovante, regras de cálculo, conferência e textos das notificações. TypeScript puro, sem nenhuma dependência do Google. | TypeScript, empacotado para o robô (esbuild) e para o app (Vite). |
| **App** | Telas, respostas, exportação, cache offline e recebimento de notificações. | PWA com Vite, Preact e TypeScript, publicado no GitHub Pages. |
| **Notificações** | Entregar o push no celular. | Firebase Cloud Messaging (plano gratuito). O robô envia pela API HTTP v1 com uma conta de serviço. |
| **Login** | Identificar quem está usando o app. | Google Identity Services. O robô valida o token e confere a lista de e-mails autorizados. |
| **Vigia externo** | Avisar se o robô parar, mesmo que o Google inteiro esteja fora do ar. | Healthchecks.io (plano gratuito). |

Como o motor é o mesmo código no robô e no app, a conta que aparece na tela, na planilha, na notificação e no Excel é sempre a mesma.

## 4. Comprovantes: leitura e identificação

### 4.1 Formato atual (observado em 23/10/2026)

- **Remetente:** `rhid.naoresponda@controlid.com.br`
- **Assunto:** `Comprovante de marcação de ponto IDFace`
- **Corpo (HTML):** título "Comprovante de Registro de Ponto do Trabalhador", seguido de:
  - `NSR: <número>`
  - **Dados do Empregador:** `Nome`, `CPF/CNPJ`, `CNO/CAEPF`
  - `Local de Prestação de Serviço`
  - **Dados do Trabalhador:** `Nome`, `CPF`
  - `Data e Horário do Registro: dd/mm/aaaa hh:mm:ss`
  - `Registro no INPI: <código>`
  - `Hash: <64 caracteres hexadecimais>`

### 4.2 Como o e-mail é lido

1. O robô busca a mensagem completa pela API do Gmail e percorre as partes MIME. Se houver `text/plain`, usa essa parte. Se não, converte o `text/html` em texto:
   - remove `style` e `script`;
   - troca `br`, `p`, `div`, `tr` e `h*` por quebras de linha;
   - remove as outras tags e decodifica as entidades HTML;
   - normaliza o Unicode (NFC) e os espaços (inclusive `&nbsp;`).
2. Cada campo é encontrado **pelo rótulo, e não pela posição**. A busca ignora acentos, maiúsculas e minúsculas e variações de espaço. O CPF e o nome do trabalhador são procurados dentro do bloco "Dados do Trabalhador", e o CNPJ dentro do bloco "Dados do Empregador".
3. Validações:
   - a data existe e não está no futuro (com margem de 5 min);
   - o NSR tem só dígitos;
   - o hash tem 64 caracteres hexadecimais;
   - o CPF tem 11 dígitos.

### 4.3 Classificação de cada e-mail do remetente

Todo e-mail do remetente ganha **exatamente uma** classificação. Nenhum fica sem.

| Classificação | Quando | Efeito |
|---|---|---|
| **comprovante** | Todos os campos foram lidos. | Vira uma batida. |
| **comprovante incompleto** | A data e a hora foram lidas, mas falta o NSR ou o hash. | Vira uma batida e gera um alerta. |
| **provisório** (plano B) | O assunto é de comprovante, mas não foi possível ler a data e a hora no corpo. | Vira uma batida **provisória** com o horário do cabeçalho `Date` do e-mail, com segundos. O e-mail sai segundos depois da batida (por exemplo, registro 07:59:38 e e-mail às 07:59). Gera alerta imediato. Quando o leitor for corrigido, o e-mail é lido de novo e a batida provisória é substituída pela exata. |
| **repetido** | Tem o mesmo NSR e o mesmo hash de um comprovante já registrado. | Fica ligado à batida original e **não conta de novo**. |
| **outro tipo** | É um e-mail do remetente que não é comprovante (por exemplo, um aviso de ajuste). | Aparece no app com alerta e nunca é ignorado. Não vira batida. |

A meta é que nenhum e-mail seja classificado como provisório. Antes de o app começar a valer, todos os e-mails que já existem precisam ser lidos como comprovante (seção 17).

### 4.4 Identidade

O robô compara cada comprovante com os dados guardados na configuração privada (seção 11.2). O CPF é comparado só pelos dígitos. O nome é comparado sem acentos e sem diferença entre maiúsculas e minúsculas.

| Situação | Efeito |
|---|---|
| **CPF diferente** do dela | A batida fica **fora da conta** e o app avisa: "O comprovante de dd/mm às hh:mm está no nome de <nome do comprovante>. Provavelmente o RH lançou errado." |
| CPF igual, **nome diferente** | A batida **conta**, porque o CPF é o que identifica ela legalmente, e o app avisa que o nome no comprovante está diferente do cadastro. |
| **CNPJ diferente** do esperado | A batida conta e o app avisa que a empresa no comprovante é diferente. |

### 4.5 Atraso

- **Atraso** = hora em que o e-mail chegou − hora do registro.
- Se o atraso passar de 10 min, a batida fica marcada como "atrasada", com o valor do atraso, e a usuária é avisada quando o e-mail é processado (seção 8).
- A batida sempre entra no dia certo, porque o dia vem da data do registro.

### 4.6 Batida manual × comprovante

O comprovante sempre vale mais que a batida manual. Se chegar um comprovante até 30 min antes ou depois de uma batida manual do mesmo dia, a batida manual passa a "substituída pelo comprovante", o dia é recalculado e a usuária é avisada.

## 5. Sincronização e conferência

### 5.1 Gatilhos

| Gatilho | Frequência | O que faz |
|---|---|---|
| `tick` | a cada 1 min | Das 06:30 às 21:30: sincronização incremental dos e-mails recebidos nos últimos 2 dias. Fora desse horário, roda só nos minutos múltiplos de 15. A cada 15 min, também faz a **conferência completa** (5.3), o check-up leve e o ping no vigia externo (seção 13). |
| `vigia` | a cada 10 min | Autocorreção (seção 13). |
| `checkupDiario` | todo dia às 03:00 | Check-up completo (seção 13). |
| sob demanda | quando o app abre ou ela puxa a tela pra atualizar | Sincronização incremental imediata. |

Todo trabalho de escrita roda com `LockService`, para que duas execuções nunca aconteçam ao mesmo tempo.

### 5.2 Passos de uma sincronização

1. Listar os IDs das mensagens do remetente em todas as pastas, inclusive spam e lixeira.
2. Comparar com a aba Mensagens.
3. Ler e classificar os e-mails novos.
4. Gravar.
5. Recalcular os dias afetados.
6. Gerar as notificações.
7. Gravar o resultado da conferência.
8. Registrar o batimento.

### 5.3 Conferência

- **Conferência OK** quando o conjunto de IDs no Gmail é igual ao conjunto de IDs na aba Mensagens. A comparação é 1 para 1: cada e-mail corresponde a uma linha.
- O app mostra o total e o detalhamento. Exemplo: "Conferido às 15:41 · 187 e-mails = 187 registros (185 comprovantes, 1 repetido, 1 outro tipo)".
- Se um ID está na planilha mas sumiu do Gmail, ele é marcado como "não está mais no Gmail" e gera alerta. O registro nunca é apagado. Esse caso não é esperado, porque os e-mails nunca são apagados, mas fica coberto.
- **Conferência profunda** (diária): o robô lê todos os e-mails de novo e compara com a planilha campo por campo (data, hora, NSR, hash, identidade). Se algum campo divergir, por exemplo por edição manual da planilha, gera alerta.

### 5.4 Varredura ampla (diária)

O robô também busca `from:controlid.com.br` e e-mails de qualquer remetente com "comprovante" e "ponto" no assunto. Se encontrar uma mensagem de outro remetente que ainda não conhece, avisa: "chegou comprovante de um remetente desconhecido". Isso detecta, por exemplo, uma troca de sistema pela empresa.

## 6. Regras de cálculo

### 6.1 Convenções

- **Unidade:** segundos. O comprovante traz os segundos (07:59:38) e o RH conta os segundos, então o cálculo também conta. Telas, notificações e relatórios mostram os segundos: horários como 07:59:38 e durações como −1h27min12s (no Excel, −1:27:12).
- **Dia da batida:** a data do "Data e Horário do Registro", no horário local de Brasília, sem nenhuma conversão de fuso.
- **Saldo do mês:** soma dos dias fechados do mês do calendário.
- **Dia útil:** dia com carga maior que zero na jornada vigente e que não é feriado.
- **Horários-limite:** os limites de horário (12:00–15:00, 16:00, 06:30–21:30) incluem as duas pontas.

### 6.2 Jornada (com data de início)

A jornada fica na configuração como uma lista de versões, cada uma com uma data de início. Quando a jornada muda, entra uma versão nova e os dias anteriores continuam calculados com a regra antiga. Mudanças são feitas pelo desenvolvedor, a pedido dela.

Versão inicial, que vale desde o início do banco:

| Item | Valor |
|---|---|
| Dias | segunda a sexta |
| Carga diária | 8h48 (horário de referência 08:00–18:00) |
| Almoço padrão | 1h12 |
| Horário de saída para o almoço | entre 12:00 e 15:00 |
| Sábado e domingo | carga 0 |

### 6.3 Feriados

- **Automáticos (nacionais):** 01/01, Sexta-feira Santa (Páscoa − 2 dias), 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11 e 25/12.
- **Locais:** lista na configuração, onde dá para incluir ou excluir dias (municipais, estaduais, pontes da empresa).
- Em feriado, a carga é 0.

### 6.4 Cálculo de um dia

1. **Batidas:** comprovantes da pessoa certa (inclusive incompletos e provisórios) mais as batidas manuais ativas, em ordem de horário.
2. **Duplicadas:** uma batida até **5 min (300 s)** depois da batida anterior que ficou é marcada "duplicada" e não conta. Fica a primeira, e o comprovante sempre vale mais que uma batida manual. Ela pode desfazer isso respondendo "essa batida conta".
3. **Pares:** as batidas são agrupadas de duas em duas (1ª–2ª, 3ª–4ª, …). Se a quantidade for ímpar, contam só os pares completos e abre a pendência "batida faltando".
4. **Intervalos entre os pares:**
   - O **almoço** é o intervalo que começa entre 12:00 e 15:00. Se houver mais de um, é o que durou mais perto de 1h12.
   - Se nenhum intervalo começar nesse horário, ou se houver empate, o almoço provisório é o intervalo mais perto de 1h12, e abre a pendência "qual foi o almoço?".
   - Os outros intervalos são **saídas intermediárias** e abrem a pendência de abono. Enquanto não houver resposta, contam como **não abonadas**.
5. **Só 2 batidas** com mais de 6h entre elas: desconta o almoço padrão (1h12) e abre a pendência "almoçou sem bater o ponto?". Se a resposta for "não almocei", o desconto é desfeito.
6. **Trabalhado** = soma dos pares + saídas abonadas + abonos manuais do dia − almoço descontado (passo 5).
7. **Carga do dia:** a da jornada vigente. É 0 em fim de semana e feriado, e também quando o dia foi classificado como atestado, abonado, férias ou feriado.
8. **Saldo bruto** = trabalhado − carga.
9. **Tolerância da CLT (art. 58 §1º)**, ligada por padrão: se o saldo bruto ficar entre −10 min e +10 min (±600 s, inclusive), o saldo é 0. Fora disso, conta o saldo inteiro.
10. **Dia útil sem nenhuma batida:** saldo = −carga, e abre a pendência "folga, atestado, férias ou feriado?". Enquanto não houver resposta, conta como **folga do banco**.

### 6.5 Dia em andamento e previsão de saída

- O dia de hoje aparece com as horas trabalhadas até agora, mas só entra no banco quando termina (23:59). A notificação de saída usa um cálculo provisório do dia.
- **Previsão de saída:** quando ela está "dentro" (a última batida foi uma entrada), a previsão é a hora dessa última entrada + (carga − horas já trabalhadas).
  - Se ela ainda não almoçou (nenhuma saída começando no horário de almoço), soma o almoço padrão (1h12).
  - A conta é feita em segundos, e a tela mostra o horário arredondado para o minuto seguinte. Assim, sair naquele minuto fecha o dia sem ficar devendo.

### 6.6 Banco de horas

- **Início:** uma data e um saldo inicial, os dois configuráveis. O padrão é a data do primeiro comprovante, com saldo 0.
- **Acumula** e não zera no fim do mês.
- **Uma hora trabalhada vale uma hora no banco**, inclusive em fim de semana e feriado.
- **Ajustes manuais:** soma ou subtrai minutos numa data, sempre com justificativa. Exemplo: "RH pagou 5h em dinheiro".

### 6.7 Exemplo de referência (também vira teste)

Terça, 20/10. Batidas (todas com segundos :00): 07:56, 07:57, 10:00, 10:50, 12:10, 13:22, 18:21.

- 07:57 está a 1 min de 07:56, então é duplicada e não conta.
- Pares: 07:56–10:00 (2h04), 10:50–12:10 (1h20), 13:22–18:21 (4h59). Trabalhado = 8h23.
- Intervalos:
  - 12:10–13:22 começa no horário de almoço e dura 1h12, então é o almoço;
  - 10:00–10:50 é uma saída intermediária de 50 min e abre a pendência de abono.
- **Sem abono:** 8h23 − 8h48 = **−25 min**.
- **Com abono:** 8h23 + 50 min − 8h48 = **+25 min**.

## 7. Pendências, respostas e justificativas

| Pendência | Opções | Até ela responder |
|---|---|---|
| Saída intermediária | abonado / não abonado | não abonado |
| Dia útil sem batida | folga do banco / atestado ou abonado / férias / feriado | folga do banco |
| Batida faltando | informar o horário (vira batida manual) / não sei | contam só os pares completos |
| Só 2 batidas num dia longo | almocei sem bater / não almocei | almoçou (desconta 1h12) |
| Almoço ambíguo | escolher qual intervalo foi o almoço | o intervalo mais perto de 1h12 |
| Batida marcada como duplicada | "essa batida conta" | duplicada |
| Comprovante de outra pessoa, nome diferente ou empresa diferente | "ciente" | só informa, não muda a conta |

- **A justificativa é obrigatória** (mínimo de 3 caracteres) em toda resposta que muda a conta, seja Sim ou Não. Atalhos: Consulta médica, Atestado, Declaração, Banco/cartório, Assunto pessoal.
- Antes de salvar, a folha de resposta mostra o efeito no dia e no banco.
- As respostas podem ser alteradas depois. Cada versão fica guardada, e nenhuma versão anterior é apagada.
- O histórico de respostas tem busca por texto (tela Pendências).

## 8. Notificações

**Tom:** parceira e animada, na primeira pessoa do plural ("hoje pagamos"). Saudação conforme o horário: bom dia antes das 12h, boa tarde antes das 18h e boa noite depois. Usa o nome de exibição da configuração. Emoji com moderação, nunca em tom de culpa. Cada mensagem de batida e cada cenário do resumo têm pelo menos 3 frases diferentes, sorteadas. Pendências e alertas têm texto fixo, para ficarem claros. Os horários aparecem com segundos (07:59:38) e as durações no formato +13min05s. Tocar na notificação abre a tela relacionada.

| Evento | Quando | Exemplo | Desligável |
|---|---|---|---|
| Entrada | 1ª batida do dia | ☀️ Bom dia, {nome}! Entrada às 07:59 registrada. | sim |
| Saída durante o dia | batida par antes das 16:00 | 🍽️ Bom almoço! Saída às 12:03 registrada. | sim |
| Volta | batida ímpar depois da primeira | ⏰ De volta! Pra fechar o dia no zero, sua saída é às 17:57. | sim |
| Resumo da saída | batida par às 16:00 ou depois | ver a tabela abaixo | sim |
| Nova pendência | quando uma pendência é aberta | 🤔 Você saiu das 10:00 às 10:50. Foi abonado? Toca pra responder. | não |
| Lembrete de entrada | dia útil sem comprovante às 08:30 | Bom dia! Ainda não chegou o comprovante de entrada de hoje. Você já bateu? Eu aviso quando chegar 😉 | sim |
| Dia incompleto | número ímpar de batidas às 20:00 | ⚠️ Hoje ficaram 3 batidas. Falta uma? | sim |
| Comprovante atrasado | quando é processado | Chegou o comprovante de 20/10 às 10:00, com 3h de atraso. Já reorganizei o dia ✓ | não |
| Identidade | CPF, nome ou CNPJ diferente | ⚠️ O comprovante de 20/10 às 10:00 está no nome de outra pessoa. Provavelmente o RH lançou errado. | não |
| Leitura | provisório, outro tipo ou remetente desconhecido | ⚠️ Um comprovante chegou num formato novo. Já anotei pelo horário do e-mail e avisei o desenvolvedor. | não |
| Pendências antigas | 12:00, se houver pendência com mais de 1 dia | Ainda tem 2 respostas esperando por você 🙏 | sim |

Resumo da saída, conforme o banco e o dia:

| Banco | Dia | Exemplo |
|---|---|---|
| negativo | positivo | Boa noite, {nome}! Isso aí, hoje pagamos +13 min. Falta só 1h27 pra zerar 💪 |
| negativo | negativo | Boa noite, {nome}. Hoje ficou −25 min, mas amanhã a gente recupera 😉 Faltam 1h50. |
| acabou de zerar | — | ZERAMOS, {nome}! 🥳 Banco no azul: +5 min. |
| positivo | positivo | Hoje rendeu +32 min 🎉 Banco: +4h10. |
| positivo | negativo | Hoje usamos 15 min do banco. Ainda sobram 3h55 😌 |

Os alertas de saúde do robô são enviados pelo vigia externo, por e-mail (seção 13).

## 9. Telas

As telas 2, 3, 4, 6, 7, 8 e 9 foram aprovadas nos mockups de 23/10/2026. As telas 1 e 5 seguem o mesmo estilo.

**Estilo visual "A":**

| Elemento | Definição |
|---|---|
| Fundo | `#F4F5FA` |
| Cartões | brancos, cantos arredondados de 20–24 px, sombra suave |
| Fonte | Plus Jakarta Sans |
| Devendo | `#E5484D` |
| Sobrando | `#16A34A` |
| Pendente | amarelo/âmbar |
| Ação | `#3B82F6` |
| Abas | Hoje · Mês · Pendências · Caderninho |

1. **Entrar:** botão "Entrar com Google".
2. **Hoje:**
   - saudação com o nome;
   - banco de horas em destaque, com "faltam X pra zerar" e o selo "+X pagos no mês";
   - cartão "Hoje" com trabalhado/carga, barra de progresso, batidas e previsão de saída;
   - "Esta semana" com barras positivas e negativas;
   - pendência com Sim/Não, que abre a folha de resposta;
   - linha "Conferido às HH:MM · N e-mails = N registros ✓", que fica amarela ou vermelha se o robô atrasar (seção 13).
3. **Mês:** calendário com o saldo de cada dia (verde, vermelho, amarelo para pendente, roxo para feriado ou abono), o resumo do mês (trabalhado, previsto, banco) e a legenda. Tocar num dia abre o detalhe.
4. **Detalhe do dia:**
   - a conta do dia (trabalhado − carga = saldo);
   - o efeito de um abono pendente;
   - os intervalos (almoço e saídas);
   - as batidas, com o NSR, a duplicada riscada (mas visível) e a manual marcada;
   - as ações "Lançar abono" e "Batida que faltou".
5. **Comprovante** (abre ao tocar numa batida): data e hora completas, NSR, hash, INPI, hora de chegada do e-mail, atraso, classificação, situação de identidade, ID do e-mail e link para abrir o e-mail no Gmail.
6. **Folha de resposta:** a pergunta, as opções, a justificativa obrigatória com atalhos, a prévia do efeito e o botão "Salvar resposta".
7. **Pendências:** "para responder" no topo e, embaixo, o histórico de respostas com as justificativas e uma busca.
8. **Caderninho:** período por Dia, Semana, Mês, Ano ou livre (De/Até). Mostra o resumo (saldo, banco no início e no fim, trabalhado, previsto, dias trabalhados, abonos, feriados, pendências) e um gráfico por dia, com os botões **Exportar Excel (.xlsx)** e **Gerar PDF**.
9. **Configurações** (abre pelo avatar na tela Hoje):
   - jornada (só leitura no app);
   - regras (tolerância, limite de duplicada, início do banco, feriados locais);
   - notificações;
   - acesso (dona e leitura);
   - saúde do robô e "Sincronizar agora".

**Sem internet:** o app abre com os últimos dados e mostra o aviso "sem conexão, dados de HH:MM". Para responder uma pendência, precisa de conexão.

## 10. Exportação

### 10.1 Excel

O arquivo é gerado no próprio app (ExcelJS), com o nome `ponto_AAAA-MM-DD_a_AAAA-MM-DD.xlsx`. Os números são os mesmos da tela, porque vêm do mesmo motor.

| Aba | Conteúdo |
|---|---|
| **Resumo** | período, saldo, banco no início e no fim, dias trabalhados, abonos, feriados, pendências e a conferência com o Gmail no momento da exportação |
| **Dias** | uma linha por dia do período (inclusive fins de semana): data, dia da semana, até 8 batidas, trabalhado, carga, saldo (texto "+0:12:05" e também em segundos, para quem quiser somar), banco acumulado, ocorrências e justificativas |
| **Comprovantes** | uma linha por batida: data, hora com segundos, origem (comprovante, provisório ou manual), NSR, hash, INPI, hora de chegada do e-mail, atraso, situação (válida, duplicada, substituída ou fora da conta) e ID do e-mail |
| **Justificativas** | todas as respostas e ajustes: data de referência, tipo, decisão, texto, quem respondeu e quando, e versões anteriores |

Formatação: o cabeçalho fica fixo e em destaque, os saldos aparecem em verde ou vermelho e as linhas pendentes ficam destacadas.

### 10.2 PDF

Uma tela própria para impressão (CSS de impressão), com `window.print()`. No Android, o próprio diálogo de impressão permite salvar como PDF.

## 11. Dados

### 11.1 Planilha "Ponto Certo — Dados"

| Aba | Colunas principais | Quem escreve |
|---|---|---|
| **Mensagens** | id_gmail, recebido_em, assunto, classificacao, batida_id, observacao, lido_em, versao_leitor | robô (uma linha por e-mail) |
| **Batidas** | batida_id, data, hora, registrado_em, origem, nsr, hash, inpi, cpf_confere, nome_confere, cnpj_confere, nome_no_comprovante (só se divergente), atraso_min, status, id_gmail | robô |
| **Respostas** | resposta_id, criada_em, autor, tipo, referencia, decisao, justificativa, substitui_id | robô (a partir do app); só acrescenta, nunca apaga |
| **Ajustes** | ajuste_id, criado_em, autor, data, tipo, minutos, justificativa, ativo | robô (a partir do app) |
| **Dias** | data, batidas, trabalhado, carga, saldo, banco, status, pendencias | robô (gerada a cada recálculo) |
| **Conferencias** | quando, tipo, total_gmail, total_planilha, por_classificacao, divergencias, duracao_ms, ok | robô |
| **Saude** | quando, verificacao, ok, detalhe | robô |
| **Config** | nome de exibição, início e saldo inicial do banco, tolerância, limite da duplicada, horários dos lembretes, feriados locais, versões da jornada | desenvolvedor; a usuária edita algumas pelo app |

- Todas as abas ficam protegidas com aviso, para desestimular edição manual. A conferência profunda detecta qualquer edição.
- Na aba Batidas, o CPF não é guardado inteiro, só o resultado da comparação. O nome do comprovante só é guardado quando é diferente do esperado.

### 11.2 Configuração privada (Propriedades do Script, fora da planilha e do repositório)

- CPF, nome completo e CNPJ esperados;
- e-mails autorizados e o papel de cada um (dona ou leitura);
- credencial da conta de serviço do Firebase e ID do cliente OAuth;
- URL de ping do vigia externo;
- sessões ativas (só o hash);
- batimento e estado dos gatilhos.

## 12. API do robô

Web app que executa como a dona, com acesso "qualquer pessoa". As requisições são `POST` com JSON no corpo (`text/plain`, para evitar o pré-voo de CORS), e toda ação exceto `login` exige o token de sessão.

| Ação | Papel | Descrição |
|---|---|---|
| `login` | — | Recebe o ID token do Google, valida no endpoint `tokeninfo` (audiência = nosso cliente, e-mail verificado e autorizado) e devolve um token de sessão aleatório de 256 bits. A sessão vale 90 dias e é renovada com o uso. |
| `estado` | leitura | Dados de um período: dias, batidas, pendências, resumo, banco, conferência, saúde e configuração visível. |
| `comprovante` | leitura | Detalhe de uma batida. |
| `responder` | dona | Grava uma resposta com justificativa e devolve os dias recalculados. |
| `ajustar` | dona | Grava um ajuste manual com justificativa. |
| `configurar` | dona | Altera as configurações editáveis pelo app. |
| `sincronizar` | leitura | Dispara a sincronização imediata e devolve o resultado. |
| `registrarDispositivo` | leitura | Grava o token do FCM do aparelho. |
| `sair` | leitura | Encerra a sessão. |

Os erros voltam como `{ ok: false, erro: "<código>", mensagem: "<texto>" }`. O login tem limite de tentativas.

## 13. Saúde do robô

**O que é garantido:** nenhum serviço, nem o Google, garante 100% de tempo no ar. O compromisso aqui é:

1. se o robô parar, vocês ficam sabendo **em minutos**, por um vigia que não depende do Google;
2. quando ele volta, **recupera tudo sozinho e sem perder nada** (P5).

| Camada | Frequência | O que faz |
|---|---|---|
| **Batimento** | a cada execução bem-sucedida | Grava o horário da última execução. |
| **Vigia interno** | 10 min | Se o batimento estiver atrasado (mais de 3 min entre 06:30 e 21:30, ou mais de 20 min fora desse horário), recria os gatilhos do `tick`, roda a sincronização, registra o incidente e avisa (push + falha no vigia externo). |
| **Check-up leve** | 15 min | Testa o acesso ao Gmail, a escrita na planilha, a presença dos gatilhos e a conferência. Se tudo estiver OK, faz o ping no vigia externo. Se algo falhar, faz o ping `/fail`, que gera alerta imediato. |
| **Check-up diário** | 03:00 | Conferência profunda (5.3), teste do leitor com um comprovante-modelo anonimizado, teste de autenticação do Firebase, varredura ampla (5.4), limpeza de tokens de aparelho inválidos e registro do tempo de execução usado no dia. |
| **Vigia externo** | contínuo | O Healthchecks.io espera um ping a cada 15 min, com tolerância de 10 min. Se o ping não chegar, ou se chegar um `/fail`, ele manda e-mail para os dois. Dá para ligar também alerta no celular, por Telegram ou ntfy. |
| **Falha de gatilho** | — | A notificação de falha do Apps Script fica configurada como "imediatamente". |
| **No app** | — | A linha de conferência na tela Hoje fica amarela se passar mais de 5 min sem conferência no horário de trabalho, e vermelha se passar de 20 min ou se o check-up falhar, mostrando o motivo. |

## 14. Segurança e privacidade

- **Escopos do robô:**
  - `gmail.readonly` (só leitura; não envia, não apaga e não altera e-mails);
  - `spreadsheets.currentonly` (só a planilha dele; se o web app não aceitar esse escopo, usa `spreadsheets`);
  - `script.external_request` (Firebase, `tokeninfo` e vigia externo);
  - `script.scriptapp` (gatilhos).
- **O código só busca e só abre** e-mails do remetente (5.2) e, na varredura diária, os da busca ampla (5.4).
- **Acesso ao web app:** o token de sessão é obrigatório, os e-mails autorizados ficam numa lista, as sessões são guardadas como hash SHA-256 e o papel "leitura" não consegue gravar nada.
- **Repositório público, sem nenhum dado pessoal:**
  - os arquivos de exemplo (fixtures) usam dados falsos;
  - o `.gitignore` cobre `.clasp.json`, `.env`, `*.eml`, a pasta de originais e `.superpowers/`;
  - antes de cada commit, um script procura padrões de CPF e de e-mail e só deixa passar os dados falsos conhecidos.
- **Firebase:** a configuração web é pública por natureza. A conta de serviço fica nas Propriedades do Script.

## 15. Repositório e tecnologias

```
ponto-certo/
├─ motor/      TypeScript puro: leitor, cálculo, conferência, feriados, textos (+ testes Vitest)
├─ robo/       Apps Script em TypeScript → bundle esbuild → clasp; appsscript.json com escopos explícitos
├─ app/        PWA: Vite + Preact + TypeScript; service worker (cache + FCM); ExcelJS; GIS
├─ scripts/    verificação de dados pessoais, deploy do robô
└─ docs/
```

- Workspaces do npm. Node 24.
- **App:** o GitHub Actions publica no GitHub Pages a cada push na `main`.
- **Robô:** `npm run deploy:robo` (build, `clasp push` e nova versão da implantação do web app).

## 16. Testes

- **Motor (Vitest):** toda regra da seção 6 tem pelo menos um teste. Os casos obrigatórios são:
  - dia normal;
  - segundos entrando na soma (07:59:38 → 12:03:12);
  - duplicada (5min00s depois é duplicada, 5min01s não), inclusive comprovante × manual;
  - saída intermediária abonada e não abonada (o exemplo 6.7);
  - almoço ambíguo;
  - número ímpar de batidas;
  - só 2 batidas;
  - dia útil sem batida e cada uma das respostas possíveis;
  - feriado fixo, Sexta-feira Santa (03/04/2026) e feriado local;
  - trabalho no fim de semana;
  - tolerância no limite (±10min00s zera, ±10min01s conta);
  - banco passando de um mês para outro;
  - ajuste manual;
  - mudança de versão da jornada;
  - batida atrasada recalculando o dia;
  - previsão de saída.
- **Leitor:**
  - o comprovante real anonimizado, em texto e em HTML;
  - variações de espaço, quebra de linha, acento, maiúsculas e sem segundos;
  - corpo ilegível (deve virar provisório);
  - outro tipo de e-mail;
  - repetido;
  - CPF diferente, nome diferente e CNPJ diferente.
- **Conferência:** um Gmail simulado contra a planilha, cobrindo e-mail novo, faltando, sobrando e editado.
- **Notificações:** um texto para cada cenário, a saudação conforme o horário e a variação entre frases.
- **App:**
  - formatação e cores do saldo;
  - a folha de resposta não salva sem justificativa;
  - o Excel sai com as 4 abas e totais iguais aos da tela.
- **Robô:** os adaptadores do Google são finos e são validados com o roteiro da seção 17.

## 17. Validação antes de valer (homologação)

O app só passa a valer quando **todos** os itens abaixo forem aprovados:

1. **Importação:** o robô importa todos os comprovantes que já existem. A quantidade na busca do Gmail (`from:` o remetente, todas as pastas) é igual à da aba Mensagens, com **0 provisórios e 0 incompletos**.
2. **Campos:** a conferência profunda passa em 100% dos registros. Além disso, vocês conferem no app, lado a lado com o e-mail, **20 comprovantes sorteados** (data, hora, NSR e hash).
3. **Identidade:** 100% dos comprovantes com CPF, nome e CNPJ conferidos. Qualquer exceção precisa estar explicada.
4. **Cálculo:**
   - todos os testes automáticos passando;
   - um mês inteiro gerado com as batidas e o resultado, e vocês refazem pelo menos 5 dias à mão;
   - a conta precisa bater em todos.
5. **Saúde:**
   - apagar o gatilho: o vigia recria em até 10 min e avisa;
   - desativar o robô: o e-mail do vigia externo chega em até 30 min;
   - forçar uma falha no check-up: o alerta chega na hora.
6. **App no celular dela:**
   - instalar o app e entrar com o Google;
   - uma batida real gera notificação em até 3 min;
   - responder uma pendência com justificativa;
   - exportar o Excel e abrir;
   - gerar o PDF.
7. **Segurança:**
   - a verificação de dados pessoais no repositório passa;
   - a API recusa requisição sem sessão;
   - o papel "leitura" não consegue gravar.
8. **Uma semana em paralelo:** ela confere cada notificação com as batidas reais. Com **zero divergências**, o app passa a valer.

## 18. Configuração inicial (feita junto, passo a passo)

1. **GitHub:** criar o repositório `ponto-certo` (público) na conta do desenvolvedor e ativar o GitHub Pages.
2. **Conta Google dela:**
   - criar a planilha;
   - vincular o robô (`clasp`) e ativar o serviço avançado do Gmail;
   - autorizar (vai aparecer o aviso de "app não verificado", porque é um script pessoal);
   - preencher as Propriedades do Script **diretamente lá**;
   - criar os gatilhos e publicar o web app.
3. **Firebase (conta dela):**
   - criar o projeto e o app web;
   - no Cloud Messaging, gerar a chave VAPID;
   - criar a conta de serviço e guardar a credencial nas Propriedades do Script;
   - na tela de consentimento do OAuth, liberar só os escopos básicos e publicar;
   - criar o cliente OAuth web, com a origem do GitHub Pages.
4. **Healthchecks.io:** criar uma conta gratuita e um check com período de 15 min e tolerância de 10 min, com alerta por e-mail para os dois.
5. **Original de um comprovante:** no Gmail, abrir o e-mail → ⋮ → "Mostrar original" → "Baixar original". O arquivo é anonimizado para virar fixture, e o original nunca entra no repositório.
6. **Filtro no Gmail** (boa prática): mensagens do remetente → "Nunca enviar para spam" + marcador "Ponto". O robô lê todas as pastas de qualquer forma.
7. **Celular dela:** abrir o app, instalar na tela inicial, entrar com o Google e permitir as notificações.

## 19. Fora do escopo

- Importar ou ler espelho de ponto do RH.
- iPhone. O alvo é Android com Chrome.
- Mais de uma pessoa sendo controlada.
- Anexar foto de atestado.
- Calcular valores de pagamento ou adicional de hora extra. O banco é 1 para 1.
- Jornada noturna ou que passa da meia-noite.
- Editar a jornada pelo app. A mudança é feita pelo desenvolvedor.

## 20. Limitações conhecidas

- **Cotas do Apps Script para contas gmail.com** (por exemplo, 90 min por dia de execução de gatilhos). A sincronização incremental mantém o uso bem abaixo disso, e o check-up diário registra o tempo usado.
- **O gatilho de 1 min não é exato.** A notificação costuma chegar de 1 a 3 min depois do e-mail.
- **O FCM entrega no "melhor esforço"**, e uma notificação pode atrasar. Os dados do app não dependem dela.
- **Aviso de "app não verificado"** na primeira autorização do robô, por ser um script pessoal.
