# Integração com a API — estado, comparação e custo

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
o front assina **a edição** e espera `edition-snapshot` por Socket.IO.

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

- Front: **nenhuma mudança**, exceto trocar o canal de tempo real de Socket.IO
  para SSE — um arquivo, ~30 linhas, se a API preferir manter o SSE dela.
- API: as 8 lacunas de schema + 3 controllers + o despachante.
- Os 190 testes do front seguem valendo, e `npm run test:e2e:http` passa a
  apontar para a API real em vez do mock.

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

O que precisa de decisão humana, e não minha:

1. Se a TASK-15 passa a ser a borda de snapshot, e quem escreve isso.
2. Se o tempo real fica em SSE (o front cede, custo baixo) ou vira Socket.IO com
   snapshot de edição (a API cede).
3. Onde moram os módulos de regra. Se a API reimplementar a cascata do
   chaveamento e a trava do operador, as duas metades divergem e os 87 unitários
   do front deixam de valer como contrato. O caminho barato é extraí-los para um
   pacote consumido pelos dois.
