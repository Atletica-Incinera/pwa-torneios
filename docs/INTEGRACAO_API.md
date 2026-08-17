# Integração com a API — estado, comparação e custo

> **Decidido em 2026-08-17: o caminho B.** Este documento recomendava o caminho
> A — a API ganhar a borda de snapshot e o despachante de ações. A equipe
> decidiu o contrário: **REST granular fica, e o front se adapta**. A
> recomendação da seção 5 está mantida no texto porque o argumento continua
> valendo como registro do custo que se aceitou pagar, não porque a discussão
> siga aberta. **Não a reabra.** O que a API oferece está em
> [CONTRATO_API.md](CONTRATO_API.md); o que restou a pedir a ela, em
> [TASKS_API.md](TASKS_API.md).
>
> O que o caminho B custou, medido depois de andado: o adaptador HTTP passou de
> 93 para ~509 linhas mais um arquivo de tradução de ~600; das 32 ações, **9**
> falam com a API e 23 esperam tabela; o id do cliente foi trocado pelo do
> servidor, com a navegação depois de criar e a idempotência do reenvio junto;
> e as oito lacunas de schema da seção 3 **continuam todas existindo**, como
> este documento previa.

Levantamento feito **de fora**, sem tocar em `Atletica-Incinera/intereng-api`.
Aquele repositório tem um loop de agentes que commita direto na `main`; este
documento existe para a decisão ser tomada com número na mão, não para virar
código lá.

> Leitura de `origin/main` em `d527c49` (2026-08-09). Se o loop voltar a rodar,
> reconfira antes de decidir.

## 1. Onde a API está

23 das 25 tasks concluídas. Faltam **TASK-14** (leitura de audit logs) e
**TASK-15** (rotas públicas agregadas).

Implementado: `auth` (login/refresh/logout/me), `catalog` (teams, athletes),
`competitions` + `editions`, `disciplines`, `edition-rosters`,
`edition-staff-roles`, `tournaments` (com validator e máquina de status),
`phases`, `groups`, `tournament-entries`, `matches`, `match-events`, `realtime`
(SSE sobre Redis Streams), `standings` e a escrita de auditoria. Com e2e para
cada módulo.

Três fatos que pesam na decisão:

- **`schema.prisma` não mudou** desde a foto anterior — o diagnóstico de lacunas
  abaixo continua válido.
- **Não existe nenhuma migration versionada.** O banco nunca foi materializado:
  23 tasks de serviço foram escritas contra um schema que ainda é papel.
- **Só existe a branch `main`.** O loop commita nela direto, com QA gate.

## 2. As 32 operações do contrato × o que a API oferece

Legenda: ✅ atende · 🟡 atende em parte · ❌ não existe.

### Partida

| Operação | Rota mais próxima | |
| --- | --- | --- |
| `match/schedule` | `POST /phases/:phaseId/matches` | 🟡 exige `phaseId`; não aceita id do cliente nem regulamento congelado |
| `match/update` | `PATCH /matches/:id` | 🟡 sem cascata de chaveamento |
| `match/start` | `PATCH /matches/:id/status` | 🟡 sem `startedBy`/`startNote` |
| `match/updateClock` | — | ❌ não há cronômetro no schema |
| `match/registerEvent` | `POST /matches/:matchId/events` | 🟡 `EventType` é enum fechado de 13 valores; o front tem ações de placar configuráveis por modalidade |
| `match/claimOperator` | — | ❌ não há trava de operador |
| `match/releaseOperator` | — | ❌ idem |
| `match/undoEvent` | `DELETE /matches/:matchId/events/:id` | 🟡 apaga o evento, não restaura o placar anterior |
| `match/finish` | `PATCH /matches/:id/status` | 🟡 recalcula standings; não gera a rodada seguinte |
| `match/correctResult` | — | ❌ sem retificação e sem limpeza a jusante |

### Categoria, modalidade, equipe e atleta

| Operação | Rota mais próxima | |
| --- | --- | --- |
| `category/create` | `POST /editions/:id/tournaments` | 🟡 |
| `category/update` | `PATCH /tournaments/:id` + fases + grupos + entries | 🟡 vira ~5 chamadas |
| `category/generateMatches` | — | ❌ não há geração de confrontos a partir de seeds e grupos |
| `discipline/update` | `PATCH /editions/:id/disciplines/:id` | 🟡 regulamento vive em `config Json?` |
| `team/create` | `POST /teams` | ✅ |
| `team/update` | — | ❌ não há `PATCH /teams/:id` |
| `athlete/create` | `POST /athletes` | 🟡 `document` é obrigatório e único |
| `athlete/update` | `PATCH /editions/:id/rosters/:id` | 🟡 muda o vínculo, não o cadastro |

### Ranking geral

`ranking/addMetric`, `updateMetric`, `removeMetric`, `addAwards`,
`revokeAward`, `close`, `reopen` — **❌ as sete.** Não há rota, service nem
tabela. É o domínio inteiro de bonificação, estorno e fechamento da edição.

### Torneio, edição e staff

| Operação | Rota mais próxima | |
| --- | --- | --- |
| `competition/create` | `POST /competitions` + `POST /competitions/:id/editions` | 🟡 duas chamadas |
| `competition/rename` | — | ❌ não há `PATCH /competitions/:id` |
| `competition/activate` | — | ❌ não há coluna `active` |
| `edition/create` | `POST /competitions/:id/editions` | ✅ |
| `edition/update` | `PATCH /editions/:editionId` | ✅ |
| `edition/activate` | — | ❌ não há coluna `active` |
| `staff/upsert` | `POST /editions/:id/staff-roles` | 🟡 concede papel; não cadastra a pessoa |

**Placar: 4 atendem, 13 atendem em parte, 15 não existem.**

### Leitura

O contrato pede **1** `GET`. A API entrega ~15 rotas de leitura. Para desenhar a
tela de uma categoria hoje seriam 6 chamadas — torneio, fases, grupos, entries,
partidas, classificação — e ainda faltaria traduzir id para nome, porque as
telas do front falam nome de equipe.

### Autenticação e tempo real

Login e logout existem e batem. Divergem: a API usa access de 15 min + refresh
de 7 dias; o contrato usa um token com `expiresAt`. O tempo real da API é **SSE
por partida** (`GET /matches/:matchId/stream`, com replay por `Last-Event-ID`);
o front assina **a edição**.

> Na foto acima o front ainda esperava Socket.IO. Não espera mais: a decisão
> registrada na seção 5 foi tomada e o canal do front é SSE desde então. O que
> continua divergindo é a granularidade — partida contra edição.

## 3. O que falta no banco — vale para os dois caminhos

1. **Ranking geral**: `OverallMetric`, `OverallAward` (com estorno), `OverallClosure`.
2. **Operação da partida**: trava de operador, cronômetro, parciais por etapa,
   desempate, retificação, `walkoverWinner`, byes do chaveamento.
3. **Regulamento versionado** e congelado por partida — hoje é `config Json?`,
   e é o que permite mudar a regra sem reescrever jogos passados.
4. **Contexto ativo**: `isActive` em competição e edição, com índice único parcial.
5. **`TournamentStatus` sem `ARCHIVED`** — é `Rascunho`+`Arquivado` que define o
   que não sai no snapshot público.
6. **Campos das telas**: equipe (sigla, responsável, logo, arquivamento),
   categoria (`generated`, `advancement`), fase (`qualifiers`).
7. **Id escolhido pelo cliente** — `externalId @unique` nas entidades que o
   front cria; o `409` sai da constraint.
8. **`document` obrigatório** em atleta, sendo que documentação está fora do
   escopo do produto.

Custo hoje é maior do que era: 23 tasks de serviço já foram escritas contra esse
schema. Acrescentar coluna é barato; mudar semântica — placar nulo, `document`
opcional, enum de status — mexe em código e teste entregues.

## 4. Os dois caminhos

### A — a API ganha a borda de snapshot (vaga da TASK-15)

As 5 rotas do contrato viram uma camada fina sobre os services que já existem: o
montador de snapshot compõe o que hoje são 15 GETs, e o despachante de ações
traduz os 32 tipos para os services. O REST continua vivo para quem quiser.

- Front: **nenhuma mudança**. A troca do canal de tempo real para SSE, orçada
  aqui em um arquivo e ~30 linhas, já foi feita — ver a seção 5.
- API: as 8 lacunas de schema + 3 controllers + o despachante.
- Os testes seguem valendo — 90 de regra no pacote, 31 de app no front — e
  `npm run test:e2e:http` passa a apontar para a API real em vez do mock, que é
  o que `npm run test:e2e:api` já faz.

### B — o front se adapta ao REST + SSE

- Reescrever o adaptador HTTP para ~15 rotas de leitura com composição por tela
  e ~20 de escrita.
- Trocar id do cliente por id do servidor: quebra a navegação após criar, quebra
  a idempotência do reenvio e **quebra os ids semânticos do chaveamento**
  (`-advanced-r1-2`), de que a progressão do mata-mata depende hoje.
- Trocar assinatura de edição por SSE por partida.
- Traduzir nome ↔ id em seis pontos do domínio.
- **E as 8 lacunas de schema continuam existindo.** Ranking geral, trava de
  operador, cronômetro e retificação não têm tabela — nenhum retrabalho no front
  cria isso.

## 5. Recomendação

**Caminho A.** O argumento decisivo não é preferência de arquitetura: é que as
lacunas de schema existem nos dois caminhos. O caminho B soma a reescrita do
front sem remover nenhuma delas — paga duas vezes.

### Decidida em 2026-08-17, contra a recomendação acima

**Fica o caminho B.** A única questão que este documento deixou em aberto — se a
TASK-15 viraria a borda de snapshot e quem a escreveria — foi respondida: não
vira, e ninguém a escreve. A API continua REST granular, um controller por
recurso, e o front absorveu a composição.

O argumento do caminho A não foi refutado; foi superado por outra ordem de
razões, que não é minha para registrar. O que era previsão e virou fato: as
lacunas de schema continuam intactas, e agora estão nomeadas nas tasks que
sobraram ([TASKS_API.md](TASKS_API.md)) em vez de escondidas atrás de um
despachante que responderia 501.

### Decididas em 2026-08-13, e já implementadas

As duas questões abaixo estavam nesta lista. Não estão mais — ficam registradas
com o que se decidiu e o que foi feito, para ninguém reabrir a discussão lendo a
versão antiga deste documento.

**O tempo real fica em SSE.** Era "o front cede ou a API cede"; o front cedeu,
porque o custo estava do lado barato e a API já tinha SSE sobre Redis Streams
funcionando por partida. O canal vive em
`apps/web/app/lib/repositories/realtime-channel.ts`, escuta `edition-changed` e
`edition-snapshot`, e trata reconexão com recuo exponencial, `Last-Event-ID` e
queda visível na barra de contexto. Socket.IO saiu do front inteiro; o que
restou de polling é `polling-channel.ts`, atrás de `NEXT_PUBLIC_REALTIME=poll`,
como plano B para quando o stream não sobe. O que a API precisa entregar está na
TASK-22.

**Os módulos de regra moram num pacote consumido pelos dois.** Era a opção
barata e virou a opção tomada: as regras saíram de `apps/web/app/lib` para
`packages/intereng-contract`, publicado deste repositório e instalado pela API.
O pacote compila em ESM e CJS — o consumidor NestJS é CommonJS —, e os testes de
regra passaram a rodar contra o `dist`, que é exatamente o artefato que a API
importa. Deixaram de ser "os unitários do front" e viraram a suíte de contrato
das duas metades. A regra que sustenta isso está em
[ESTADO_DO_PROJETO.md](ESTADO_DO_PROJETO.md): a API importa, não reescreve.
