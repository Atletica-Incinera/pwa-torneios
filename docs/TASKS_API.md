# Tasks para a API — o que falta para o front ligar

Texto pronto para colar em `Atletica-Incinera/intereng-api`. **Nada daqui deve
ser escrito na árvore daquele repositório por uma ferramenta**: o loop de
agentes faz `git add -A` e commitaria como iteração dele. Cole você, à mão, em
dois lugares:

1. o bloco de checklist no fim de `tasks.md`;
2. as seções `-EXEC` no fim da *Seção 3* de `plano-execucao-api-competicoes.md`,
   depois de `TASK-15-EXEC`.

> Levantado sobre `origin/main` em `d527c49`. Estado naquela foto: 23 de 25
> tasks concluídas, faltando TASK-14 (audit logs) e TASK-15 (rotas públicas).
> A numeração abaixo continua de onde a delas para. Se o loop tiver avançado,
> reconfira os IDs antes de colar.

---

## O que precisa estar claro antes da primeira task

### O contrato é um pacote instalado, não um documento a reimplementar

As regras do torneio — regulamento por modalidade, elegibilidade, conflito de
agenda, ciclo de vida da partida, classificação e desempate, chaveamento,
progressão e ranking geral — já existem, testadas, em
`@atletica-incinera/intereng-contract`, publicado a partir de
`Atletica-Incinera/pwa-torneios`.

**A API instala e importa. Não reescreve.** Duas implementações da mesma regra
divergem em silêncio, e a divergência só aparece quando o placar da tela e o
do banco discordam no meio de um jogo.

```ts
import { applyAction } from '@atletica-incinera/intereng-contract/actions';
import { checkMatchEligibility, resolveRegulation } from '@atletica-incinera/intereng-contract/rules';
import type { Action } from '@atletica-incinera/intereng-contract/actions';
import type { FrontendState } from '@atletica-incinera/intereng-contract/state';
```

O pacote é compilado duas vezes. Este repositório é CommonJS (`type` ausente no
`package.json`) com `module: nodenext` e TypeScript `^5.7.3` — a resolução
`nodenext` lê a condição `require` e cai em `dist/cjs`. Um pacote só-ESM daria
**TS1479** aqui, porque `require(esm)` sob `nodenext` só passou a compilar no
TypeScript 5.8. Não é o caso; se der, o problema é de instalação, não de uso.

O registro é o GitHub Packages. Precisa de um `.npmrc` com
`@atletica-incinera:registry=https://npm.pkg.github.com` e um token de leitura
em `NODE_AUTH_TOKEN`.

### Dois critérios que valem para todas as tasks abaixo

**As coleções do snapshot são indexadas por `externalId`, não pelo `cuid`.**
O front identifica registros por um id semântico que ele próprio gera —
`aurora`, `futsal-masculino`, `-advanced-r1-2`. O motor de progressão do
chaveamento (`tournament-progression`) *lê significado* nesse formato: o sufixo
`-advanced-r1-2` diz de qual rodada e de qual posição a equipe veio. Devolver
`cuid` nas chaves quebra a cascata do mata-mata sem erro nenhum — as partidas
seguintes simplesmente não são geradas. O `cuid` continua sendo a chave
primária no banco; ele só não aparece no snapshot.

**Tipo de ação sem domínio responde `501 NOT_IMPLEMENTED`, nunca 500.** O
despachante vai nascer cobrindo parte das 32 ações. O front mostra ao operador
a mensagem que o servidor mandar, então **a mensagem é a interface**: um 501
dizendo "esta operação ainda não existe no servidor" faz o operador parar de
tentar; um 500 genérico o faz repetir a mesma ação para sempre, achando que é
a rede. O código também importa para quem lê log: 501 é lacuna conhecida, 500 é
defeito.

---

## Bloco para o `tasks.md`

Cole no fim do arquivo, mantendo a convenção `- [ ]` / `- [x]`:

```markdown
## Lote 10 — Integração com o front (PWA)
- [ ] TASK-16 — Migrations versionadas e baseline do banco
- [ ] TASK-17 — Campos que o front precisa no schema
- [ ] TASK-18 — CORS e sessão completa no login
- [ ] TASK-19 — Snapshot autenticado da edição
- [ ] TASK-20 — Snapshot público da edição
- [ ] TASK-21 — Despachante das ações do contrato
- [ ] TASK-22 — Stream SSE por edição
- [ ] TASK-23 — Imagem no GHCR, seed e gancho de reset
- [ ] TASK-24 — Ranking geral da edição
- [ ] TASK-25 — Estado de operação da partida
- [ ] TASK-26 — Regulamento versionado e congelado na partida
```

---

## Seções para o `plano-execucao-api-competicoes.md`

### TASK-16-EXEC — Migrations versionadas e baseline do banco

**Como implementar**: não existe uma única migration no repositório. As 23
tasks anteriores foram escritas contra um schema que ainda é papel — nenhum
serviço jamais falou com uma tabela real.
* Gerar a baseline a partir de `schema.prisma` com `prisma migrate dev --name baseline`,
  versionando `prisma/migrations/` no repositório.
* Mover `schema.prisma` para `prisma/schema.prisma`, que é onde o Prisma o
  procura por padrão; hoje ele está na raiz e depende de configuração explícita.
* As três `CHECK CONSTRAINT` anotadas como comentário no schema (participante
  vencedor, e as demais marcadas como `[CORREÇÕES ... NOTAS SQL]`) precisam
  virar SQL de verdade dentro da migration. Comentário não restringe nada.
* Adicionar `prisma migrate deploy` ao roteiro de subida do container.

**Decisões que exigem validação humana**: se o baseline deve nascer já com as
constraints ou se elas entram numa migration seguinte, separada e revisável.

**Critério de aceite verificável**: num banco vazio, `prisma migrate deploy`
seguido da suíte e2e existente passa sem nenhum `prisma db push`. Tentar
gravar um `winnerEntryId` que não seja `entryAId` nem `entryBId` é recusado
**pelo banco**, não pelo serviço.

---

### TASK-17-EXEC — Campos que o front precisa no schema

**Como implementar**: uma migration incremental, depois da baseline.
* `Competition` e `CompetitionEdition` ganham `isActive Boolean @default(false)`
  com índice parcial garantindo **no máximo uma ativa** por escopo. O front
  resolve a edição corrente pelo alias `active` na URL; sem esse campo o alias
  não tem como ser respondido.
* `EditionStatus` ganha `ARCHIVED`. O front já mostra edições arquivadas e a
  API hoje não sabe representá-las.
* Toda entidade que o front cria ganha `externalId String @unique` — o id
  semântico escolhido pelo cliente. Vale para `Team`, `Athlete`, `Tournament`,
  `Phase`, `Group`, `TournamentEntry`, `Match`, `Discipline` e
  `EditionDiscipline`. É isso que torna o reenvio idempotente: a mesma operação
  repetida por falha de rede não pode criar dois registros.
* `Athlete.document` passa a ser opcional. O front cadastra atleta com nome e
  equipe; CPF é dado que a atlética muitas vezes não tem no momento do
  cadastro, e obrigatoriedade aqui trava o fluxo inteiro de inscrição.
* `Match` ganha `reason String?` — o motivo de adiamento, cancelamento ou W.O.,
  que hoje o front mostra e a API não tem onde guardar.

**Decisões que exigem validação humana**: se `document` deve continuar único
quando presente (recomendado: sim, índice único parcial `WHERE document IS NOT NULL`).

**Critério de aceite verificável**: criar duas vezes o mesmo `externalId`
devolve o registro existente ou 409, nunca dois registros. Ativar uma segunda
edição da mesma competição é recusado pelo índice. Um atleta sem `document` é
criado com sucesso.

---

### TASK-18-EXEC — CORS e sessão completa no login

**Como implementar**: é o gargalo real — sem esta task **nenhuma chamada de
navegador sai do lugar**, e as 23 tasks já entregues permanecem inalcançáveis
pelo front.
* `app.enableCors()` em `src/main.ts`, com origem por variável de ambiente
  (`CORS_ORIGINS`, lista separada por vírgula), `credentials: true` e os
  cabeçalhos `Authorization` e `Content-Type` liberados. Hoje `main.ts` não
  chama `enableCors` de forma alguma.
* A resposta de `POST /auth/login` hoje devolve `accessToken`, `refreshToken`,
  `expiresIn: 900` e `staff { id, name, email, isSuperAdmin }`. Falta o que o
  front usa para decidir o que mostrar:
  * **`role`** — o papel efetivo do usuário. O front tem três — `SUPER_ADMIN`,
    `EDITION_ADMIN` e `DISCIPLINE_MANAGER` — e o menu inteiro, além dos
    guardas de rota, dependem dele. `isSuperAdmin` sozinho
    não distingue coordenador de operador.
  * **`scope`** — a que edições e modalidades o papel se aplica. O serviço já
    monta `editionRoles` em `/auth/me`; a mesma estrutura precisa vir no login,
    senão o front faz duas chamadas para montar uma tela.
  * **`expiresAt`** — instante absoluto ISO, além do `expiresIn` relativo. O
    relógio do aparelho e o do servidor divergem, e é o absoluto que o front usa
    para decidir renovar.
* `POST /auth/refresh` deve aceitar o refresh token **no corpo**, além do
  cookie. O front roda em `app.localhost` e a API em `api.localhost`: são sites
  diferentes, e um cookie `SameSite=Strict` não atravessa.

**Decisões que exigem validação humana**: como derivar um `role` único quando o
usuário acumula papéis diferentes em edições diferentes — o front espera o papel
mais alto, com o detalhe ficando em `scope`.

**Critério de aceite verificável**: um `fetch` disparado de
`http://app.localhost` para `POST /api/v1/auth/login` completa sem erro de CORS
e o corpo traz `role`, `scope` e `expiresAt`. Um refresh com o token só no corpo,
sem cookie nenhum, renova a sessão.

---

### TASK-19-EXEC — Snapshot autenticado da edição

**Como implementar**: `GET /editions/:editionId/snapshot`, autenticada, aceitando
o alias `active` no lugar do id. Devolve o estado inteiro da edição no formato
`FrontendState`, exportado por `@atletica-incinera/intereng-contract/state` —
não invente um DTO paralelo, importe o tipo.
* É **uma** consulta agregada, não uma composição de chamadas: equipes, atletas,
  modalidades, categorias, partidas, staff, auditoria e ranking geral de uma vez.
  O front chama isto uma vez ao abrir e depois só reage a evento.
* Coleções vêm como objeto indexado por `externalId` (ver o critério transversal
  no topo), não como array.
* O conteúdo é filtrado pelo escopo do solicitante: um operador de uma
  modalidade não recebe a auditoria da edição inteira.

**Autonomia de pesquisa**: como evitar N+1 nesta agregação com Prisma — provável
combinação de `include` seletivo com consultas separadas e junção em memória,
medida antes de escolher.

**Decisões que exigem validação humana**: se a auditoria vem completa ou
paginada no snapshot; o front hoje mostra as últimas entradas.

**Critério de aceite verificável**: com a edição de exemplo carregada, uma única
requisição devolve um objeto que satisfaz o tipo `FrontendState` importado do
pacote (verificável compilando um teste que o atribui ao tipo), e
`snapshot.matches` tem como chaves os `externalId`, não `cuid`.

---

### TASK-20-EXEC — Snapshot público da edição

**Como implementar**: `GET /editions/:editionId/public-snapshot`, sem
autenticação. Mesmo formato da TASK-19, **reduzido**.
* Sai: `staff`, `audit`, e tudo que esteja em rascunho — categoria não
  publicada, partida não confirmada, prêmio de ranking ainda não fechado.
* A redução acontece **no servidor**. Devolver o estado completo e esconder na
  tela é vazamento: o dado viaja.
* Cache curto em Redis com proteção contra efeito manada, pelo mesmo motivo já
  registrado na TASK-15-EXEC.

**Critério de aceite verificável**: a resposta não contém as chaves `staff` nem
`audit` em nenhuma circunstância, e um torneio com status de rascunho não
aparece. Um `diff` entre o snapshot autenticado e o público de uma mesma edição
mostra apenas remoções, nunca valores diferentes para a mesma chave.

---

### TASK-21-EXEC — Despachante das ações do contrato

**Como implementar**: `POST /editions/:editionId/actions`, autenticada. O corpo é
uma ação da união `Action` do pacote — 32 tipos, de `match/finish` a
`ranking/close`. A resposta é o snapshot novo, no mesmo formato da
TASK-19.
* **Porte, não reescreva.** `applyAction(state, action, { actor })` já existe no
  pacote e é o mesmo código que o front roda. O caminho honesto é: carregar o
  estado da edição, chamar `applyAction`, persistir o diff, devolver o resultado.
* Autorização por ação e por escopo, antes de aplicar: um operador de futsal não
  encerra uma partida de vôlei.
* Cada ação aplicada gera uma entrada de auditoria com o autor real, vindo do
  token — nunca do corpo da requisição.
* Idempotência pelo `externalId` do payload: reenviar a mesma criação não cria
  dois registros.
* Tipos ainda sem domínio no banco respondem **`501 NOT_IMPLEMENTED`** com o
  tipo da ação no corpo (ver o critério transversal no topo). As TASK-24 a
  TASK-26 vão transformando esses 501 em 200.

**Autonomia de pesquisa**: como persistir o resultado de `applyAction` sem
reescrever a edição inteira a cada operação — provável diff por coleção dentro
de uma transação.

**Decisões que exigem validação humana**: o que fazer quando `applyAction` recusa
a operação por regra (ex.: elenco abaixo do mínimo) — 409 com a mensagem da
regra é a leitura natural, mas o código de status merece confirmação.

**Critério de aceite verificável**: `match/finish` numa semifinal encerra a
partida **e gera a final**, porque a cascata de `progressTournament` roda no
servidor; o snapshot devolvido já contém a partida nova. Uma ação de tipo
desconhecido devolve 501, e o `curl` mostra o tipo recusado no corpo.

---

### TASK-22-EXEC — Stream SSE por edição

**Como implementar**: `GET /editions/:editionId/stream`. O módulo `realtime` já
tem SSE sobre Redis Streams por partida (TASK-12); esta task é o mesmo mecanismo
com granularidade de edição.
* **O stream é público e carrega apenas `{ revision, at }`.** `EventSource` não
  manda cabeçalho `Authorization`; token em query string vaza em log de proxy,
  histórico e `Referer`; e cookie não serve porque `app.localhost` e
  `api.localhost` são sites diferentes. Quem tem sessão usa o evento como
  gatilho e rebusca o snapshot autenticado com Bearer. **Nenhum dado da edição
  trafega no canal.**
* Nome do evento: `edition-changed`. O front já escuta exatamente esse nome.
* Opcionalmente, um evento `edition-snapshot` carregando o snapshot **público** —
  o front o absorve apenas quando não há sessão.
* `retry:` explícito, heartbeat `: ping` a cada 25s e suporte a `Last-Event-ID`
  para o catch-up, como já feito na TASK-12.
* O contador de revisão é por edição e monotônico; toda ação aplicada na
  TASK-21 o incrementa.

**Decisões que exigem validação humana**: se o `edition-snapshot` inicial deve
existir ou se todo cliente deve buscar o snapshot por HTTP antes de assinar.

**Critério de aceite verificável**: `curl -N` na rota recebe `: ping` dentro de
30s; um `POST /actions` disparado em outro terminal produz um `edition-changed`
com `revision` maior que o anterior; e o corpo do evento **não contém** nome de
equipe, placar ou qualquer campo da edição.

---

### TASK-23-EXEC — Imagem no GHCR, seed e gancho de reset

**Como implementar**: o front já tem os arquivos de composição esperando este
lado.
* `Dockerfile` multi-estágio na raiz do repositório e publicação em
  `ghcr.io/atletica-incinera/intereng-api`, com **tag por versão** além da
  `latest`. O front vai apontar seus testes de integração para uma tag fixa: a
  `main` se move sozinha e um gate contra ela não prova nada.
* Seed determinística reproduzindo a edição de exemplo do front, disponível em
  `@atletica-incinera/intereng-contract/seed`. Importe de lá — a ordem das
  chaves importa e é o que mantém os testes visuais do front estáveis.
* `POST /test/reset`, que devolve a edição ao estado semeado.

> **O gancho de reset precisa de trava dupla.** Ele só pode existir com
> `ENABLE_TEST_ENDPOINTS=true` **e** `NODE_ENV !== 'production'`. A aplicação
> deve **recusar subir** na combinação proibida, em vez de apenas ignorar a
> rota — e a rota não deve ser exposta no proxy reverso.

**Critério de aceite verificável**: `docker compose up` com a imagem publicada
sobe API, banco e Redis; `POST /test/reset` devolve a edição semeada; e subir o
container com `NODE_ENV=production ENABLE_TEST_ENDPOINTS=true` falha no boot,
com a razão no log.

---

### TASK-24-EXEC — Ranking geral da edição

**Como implementar**: o domínio inteiro está ausente do `schema.prisma` — não
há modelo de métrica, de prêmio nem de fechamento. Sete das 32 ações do
contrato dependem dele.
* Três modelos novos: `OverallMetric` (nome, pontuação padrão, posição de pódio
  associada), `OverallAward` (edição, equipe, modalidade, métrica, pontos, nota,
  origem manual ou automática, e os campos de revogação) e `OverallClosure` (o
  fechamento por modalidade, com autor e instante).
* A regra de cálculo já existe em `overall-ranking` dentro do pacote:
  `computeOverallRanking`, `suggestAutomaticAwards`, `activeAwards`,
  `isRankingClosed`. Importe.
* Prêmio revogado **não é apagado**: ganha `revokedAt`, `revokedBy` e
  `revokeReason`. O histórico é o que sustenta a contestação de um resultado.

**Decisões que exigem validação humana**: se o fechamento por modalidade pode
ser reaberto e por quem.

**Critério de aceite verificável**: encerrar a final de uma modalidade sugere
automaticamente os prêmios de campeão, vice e terceiro com a pontuação padrão;
revogar um prêmio o remove da soma **sem** o apagar da tabela; e uma modalidade
fechada recusa novo prêmio.

---

### TASK-25-EXEC — Estado de operação da partida

**Como implementar**: `Match` hoje tem placar, status, horário e local. Falta
tudo que acontece **durante** o jogo — cinco ações do contrato dependem disto.
* **Trava de operador**: `operatorId`, `operatorName`, `operatorHeartbeat`. Dois
  operadores no mesmo jogo é o cenário que corrompe placar. A trava expira por
  ausência de heartbeat; a constante já está no pacote (`operatorLockMs`).
* **Cronômetro**: `currentPeriod`, `clockSeconds`, `runningSince`, `paused`. O
  relógio corre no cliente mas a verdade é do servidor, senão dois aparelhos
  mostram tempos diferentes.
* **Parciais por período**: `periodScoreA`, `periodScoreB` e o histórico
  `periodResults`. Vôlei e afins classificam por sets, não por pontos totais.
* **Início**: `startedAt`, `startedBy`, `startNote`.
* **Desempate obrigatório** de eliminatória empatada: método, rótulo, placar do
  desempate, vencedor, motivo, quem decidiu e quando.
* **Retificação após o encerramento**: lista de correções com autor, motivo,
  antes e depois. `match/correctResult` ainda dispara a limpeza do que veio
  depois no chaveamento — `clearDownstream`, no pacote.
* `MatchEvent.type` é hoje um enum fechado de 13 valores. O regulamento do front
  é configurável por modalidade: ações de placar com nomes e pontuações
  próprias. O enum precisa dar lugar a um tipo aberto validado contra o
  regulamento da modalidade.

**Decisões que exigem validação humana**: por quanto tempo uma partida
encerrada continua aceitando retificação.

**Critério de aceite verificável**: um segundo operador tentando assumir uma
partida com trava viva é recusado com 409; deixar de mandar heartbeat pelo tempo
da constante libera a trava; e retificar o resultado de uma semifinal já
encerrada limpa a final que dela decorria.

---

### TASK-26-EXEC — Regulamento versionado e congelado na partida

**Como implementar**: o regulamento esportivo vive hoje em
`EditionDiscipline.config Json?`, sem versão e sem histórico.
* Versionar: cada alteração cria uma versão nova, com autor e instante, em vez
  de sobrescrever.
* **Congelar na partida**: a partida guarda o regulamento vigente no momento em
  que começou. Mudar a regra no meio da competição não pode reescrever o
  resultado de um jogo que já aconteceu — e hoje reescreveria.
* A validação da forma do JSON usa `regulationFromRule` e `resolveRegulation`,
  do pacote, em vez de um schema paralelo.

**Decisões que exigem validação humana**: se alterar o regulamento com partidas
em andamento deve ser bloqueado ou apenas avisado.

**Critério de aceite verificável**: encerrar uma partida, alterar a pontuação da
modalidade e reabrir a partida encerrada mostra o placar calculado pela regra
**antiga**; a partida seguinte já usa a nova.

---

## Ordem, e o que cada uma destrava no front

| Task | Sem ela | Com ela |
| --- | --- | --- |
| TASK-16 | nada funciona: o schema nunca virou tabela | o banco existe |
| TASK-17 | alias `active`, id do cliente e cadastro de atleta travados | o front consegue endereçar e criar |
| **TASK-18** | **nenhuma chamada de navegador sai do lugar** | o login funciona e o menu sabe o que mostrar |
| TASK-19 | as telas ficam vazias | `load()` — as telas enchem |
| TASK-20 | o espectador não vê nada | a área pública funciona sem sessão |
| TASK-21 | o app é somente leitura | `dispatch()` — o app escreve |
| TASK-22 | a barra avisa "sem tempo real" e o front cai para polling | o selo "Ao vivo" acende |
| TASK-23 | não há como rodar os dois juntos num gate | `test:e2e:api` verde contra uma tag |
| TASK-24–26 | os `501` do despachante | as 32 ações respondem 200 |
