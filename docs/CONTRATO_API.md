# Contrato da API

> **A arquitetura mudou em 2026-08-17.** Este documento pedia uma API de
> snapshot e despachante de ações. A equipe decidiu o contrário — REST
> granular, um controller por recurso — e a API **já está assim**. O que segue
> descreve o que ela oferece e como o front a consome. Deixou de ser um pedido;
> virou uma descrição. Quem procura o pedido antigo o encontra no histórico
> deste arquivo, e não deve ressuscitá-lo: a decisão está tomada.

O front-end fala com a origem de dados por trás de dois adaptadores
comutáveis, escolhidos por ambiente:

```env
NEXT_PUBLIC_DATA_SOURCE=local   # estado no navegador (padrão, usado pelos e2e)
NEXT_PUBLIC_DATA_SOURCE=http    # tudo vem da API
NEXT_PUBLIC_API_URL=http://api.localhost/api/v1
```

A interface `StateAdapter` não mudou — é ela que mantém as 41 rotas do app sem
saber de onde vem o dado. O que mudou foi tudo atrás dela.

## O que trocou de lado

| Antes (o que este documento pedia) | Agora (o que existe) |
| --- | --- |
| `GET /editions/:id/snapshot` devolve a edição inteira | ~10 famílias de rota, remontadas em memória por `loadEditionState` |
| `POST /editions/:id/actions` aceita 32 ações nomeadas | 9 ações traduzidas para REST; 23 sem rota, com dono nomeado |
| O id de quem nasce vem do cliente | **O id vem do servidor**; o `createId` do front é ignorado |
| A API roda `applyAction` do pacote | A API tem regras próprias — placar, desempate, vencedor |
| `GET /editions/:id/stream` assina a edição | `GET /matches/:matchId/stream` assina **uma partida** |
| `GET /editions/:id/public-snapshot` é o payload do espectador | rotas abertas e granulares, sem redução por privacidade |

A tradução vive em dois arquivos, separados de propósito:
`apps/web/app/lib/repositories/api-mapping.ts` é pura — campo a campo, sem
`fetch`, sem token, sem ordem de chamada — e
`apps/web/app/lib/repositories/http-adapter.ts` é o transporte. A metade onde o
defeito costuma morar é a primeira, e é a única que dá para provar sem subir
servidor (`apps/web/tests/components/ApiMapping.test.ts`).

## O fio

Prefixo global `/api/v1` (`src/main.ts:14`). O servidor escuta em
`process.env.PORT ?? 3000`.

**CORS**: `origin: '*'` com `credentials: true` (`src/main.ts:8-12`). A
combinação é recusada pelo navegador quando o cliente manda
`credentials: 'include'` — o front **não** manda, porque o refresh token viaja
no corpo, e por isso hoje funciona. Se alguém tentar usar o cookie `httpOnly`,
a API precisará ecoar a origem em vez de responder `*`.

**`ValidationPipe` global** com `transform: true, whitelist: true,
forbidNonWhitelisted: true` (`src/app.module.ts:73-78`). Campo extra no corpo
vira **400**, não é ignorado. É por isso que o adaptador monta cada corpo
campo a campo em vez de espalhar o `patch` da ação: mandar `year` num
`PATCH /editions/:id` derruba a requisição inteira.

### O envelope

`ResponseInterceptor` global (`src/common/interceptors/response.interceptor.ts`).
Toda resposta de sucesso é `{ data: ... }`. `meta` só aparece nas rotas
paginadas, como `{ page, pageSize, total, totalPages }`. Um `content-type` de
`text/event-stream` passa cru — é o que preserva o SSE. Rotas `204` não têm
corpo.

Do lado do cliente, `unwrap` (em `api-client.ts`) reconhece o envelope pela
**forma**: `data` na raiz acompanhada só de `meta`, `links`, `statusCode`,
`timestamp`, `path` ou `success`. `data` com companhia fora dessa lista é
**recusado em voz alta**. É de propósito: passar adiante um corpo embrulhado
que não foi reconhecido termina na remontagem, que completaria cada coleção com
vazio — a tela fica pronta, plausível e sem nada dentro, que é a pior falha
possível porque não parece falha.

### O erro

`GlobalExceptionFilter` global
(`src/common/filters/global-exception.filter.ts`). O corpo é sempre
`{ error: { code, message, details? } }` — **nunca** `{ data }`. Não há
`statusCode`, `timestamp` nem `path` no corpo; o status só vem no cabeçalho.

| Status | `code` | Observação |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | validação de DTO, ou `BadRequestException` à mão |
| 401 | `UNAUTHORIZED` | `Token de acesso inválido ou expirado.` / `Credenciais inválidas.` |
| 403 | `FORBIDDEN` | quase sempre o genérico `Forbidden resource` |
| 404 | `NOT_FOUND` | mensagem de domínio, com o id |
| 409 | `CONFLICT` | `ConflictException`, ou Prisma `P2002`/`P2003` |
| 500 | `INTERNAL_ERROR` | `Error` cru vaza a mensagem no corpo |

Duas armadilhas que o cliente já contorna e que vale conhecer antes de depurar:

**No 400 de validação a mensagem legível não está em `message`.** O filtro troca
`message` pelo literal fixo `"Erro de validação nos campos enviados."` e guarda
o resto em `details: [{ field, issue }]` — onde `field` é a **primeira palavra
da mensagem do class-validator**, e como as mensagens do projeto são em
português (`"O nome da competição é obrigatório."`), `field` sai como `"O"` na
maioria dos casos. Não dá para destacar campo no formulário a partir disso. Só
`details[].issue` é legível, e `readError` (em `api-client.ts`) o concatena à
frase base justamente para o operador ler o que corrigir.

**O 403 quase nunca diz por quê.** O `AuthorizationGuard` retorna `false` em vez
de lançar (`src/common/guards/authorization.guard.ts:129,138,157,161,166`), e o
Nest converte isso no genérico `Forbidden resource`. Só `SuperAdminGuard` e
`CanManageCatalogGuard` dão mensagem útil. Por isso o adaptador decide por
**status**, não por texto: `ApiError` carrega `status` e `code` ao lado da
frase.

## A sessão

**Transporte**: `Authorization: Bearer <accessToken>`. O `JwtAuthGuard` exige o
header e literalmente o prefixo `Bearer ` (`src/auth/guards/jwt-auth.guard.ts:26-47`).
Não há token de acesso em cookie; só o refresh viaja em cookie, e é opcional.

| Rota | Status | Corpo | Devolve |
| --- | --- | --- | --- |
| `POST /auth/login` | **200**, não 201 | `{ email, password }` | `{ accessToken, refreshToken, expiresIn: 900, staff: { id, name, email, isSuperAdmin } }` |
| `POST /auth/refresh` | 200 | `{ refreshToken? }` — sem ele, lê o cookie | o mesmo shape, com refresh rotacionado |
| `POST /auth/logout` | 200 | — | `{ message }`; só limpa o cookie |
| `GET /auth/me` | 200 | — | `{ id, name, email, isSuperAdmin, editionRoles: [...] }` |

`expiresIn` é o número fixo `900`, hardcoded (`src/auth/auth.service.ts:47`) —
não é timestamp. O front deriva `accessExpiresAt` dele. O horizonte da
**sessão** (`expiresAt`) é do front: guardar o prazo do acesso ali expulsaria
quem está trabalhando a cada renovação.

`POST /auth/logout` **não invalida o refresh token no servidor** — não há
denylist. Um refresh vazado continua válido por sete dias.

### `editionRoles`, e o campo que falta no login

`GET /auth/me` devolve uma lista **plana**, um item por linha de
`edition_staff_roles`, não agrupada por edição:

```jsonc
{ "data": { "id": "...", "name": "...", "email": "...", "isSuperAdmin": false,
  "editionRoles": [
    { "editionId": "...", "editionName": "...", "disciplineId": null,
      "disciplineName": null, "role": "EDITION_ADMIN" }
  ] } }
```

`disciplineId`/`disciplineName` são `null` para `EDITION_ADMIN` e preenchidos
para `DISCIPLINE_MANAGER`. **Não existe `editionDisciplineId` na resposta**, nem
`competitionId`, `year` ou `status` da edição — para saber se a edição está
`ONGOING` é preciso uma chamada a `GET /editions/:editionId`. Um mesmo staff
aparece várias vezes com a mesma `editionId` e disciplinas diferentes.

> **`POST /auth/login` não devolve papel. A entrada tem duas etapas porque a
> API tem duas.** O corpo do login traz `staff: { id, name, email,
> isSuperAdmin }` e mais nada; o papel é por edição e quem o tem é
> `GET /auth/me`, em `editionRoles`. `createHttpAuthAdapter` encadeia as duas
> chamadas e monta a sessão a partir da segunda. Sem ela ninguém entra:
> `sessionFromLogin` recusa sessão sem papel, e recusa de propósito — a guarda
> de navegação decide a rota antes de qualquer carga, e chutar concederia
> acesso que o servidor nega depois.
>
> Duas consequências que valem estar escritas: a segunda chamada usa
> `retryOnUnauthorized: false`, porque a sessão ainda não foi gravada e uma
> renovação ali usaria a credencial da sessão **anterior**, devolvendo os
> papéis de outra pessoa; e quem entra sem papel em nenhuma edição é barrado
> com uma frase que diz o que fazer (`Peça acesso ao administrador.`), em vez
> de cair numa tela de administração que o servidor recusa a cada clique.
>
> Se a API passar a devolver `role` e `scope` no login, a segunda chamada
> deixa de ser necessária e nada mais muda — o mapeador já aceita as duas
> formas. É a TASK-18, hoje rebaixada de bloqueio a economia de uma
> requisição.

## As rotas

`aberta` = sem guard nenhum. `sessão` = qualquer token válido.
`ADMIN` = `EDITION_ADMIN` naquela edição. `GESTOR` = `DISCIPLINE_MANAGER` da
modalidade, com `EDITION_ADMIN` herdando. `isSuperAdmin: true` fura todos.

### Infra

| Método | Rota | Auth | Nota |
| --- | --- | --- | --- |
| `GET` | `/health` | aberta | `{ data: { status: 'ok' } }` — serve de probe |
| `GET` | `/` | aberta | `{ data: 'Hello World!' }` |
| `GET` | `/test-request-context`, `/test-pagination`, `/test-not-found`, `/test-prisma-unique`, `/test-prisma-not-found`, `/test-prisma-fk` | aberta | **seis rotas de depuração publicadas no build de produção** (`src/app.controller.ts:14-72`). Não usar |

### Competições e edições

| Método | Rota | Auth | Nota |
| --- | --- | --- | --- |
| `GET` | `/competitions` | aberta | paginada, `page`/`pageSize` (1..100), ordem por nome |
| `POST` | `/competitions` | SuperAdmin | `{ name, slug ^[a-z0-9-]+$ }` |
| `GET` | `/competitions/:id` | aberta | |
| `GET` | `/competitions/:id/editions` | aberta | array puro, sem paginação, ano desc |
| `POST` | `/competitions/:id/editions` | SuperAdmin | `{ year 1900..2100, name, startDate, endDate }`; nasce `PLANNING`; `[competitionId, year]` único → 409 |
| `GET` | `/editions/:editionId` | aberta | |
| `PATCH` | `/editions/:editionId` | ADMIN | só `name`, `startDate`, `endDate`. **Ano e competição não são editáveis** |
| `PATCH` | `/editions/:editionId/status` | ADMIN | `PLANNING\|ONGOING\|FINISHED\|ARCHIVED`. Sem tabela de transições |

### Modalidades

| Método | Rota | Auth | Nota |
| --- | --- | --- | --- |
| `GET` | `/disciplines` | aberta | paginada |
| `POST` | `/disciplines` | sessão + checagem no serviço | exige SuperAdmin **ou** ADMIN em alguma edição; a regra está em `disciplines.service.ts:47-59`, não em guard |
| `GET` | `/editions/:editionId/disciplines` | aberta | o `id` é o da associação `EditionDiscipline`, **não** o da `Discipline` |
| `POST` | `/editions/:editionId/disciplines` | ADMIN | `config` validado por slug: vôlei exige `{ setsToWin, pointsPerSet }`; futsal/handebol/basquete exigem `{ matchDurationMinutes }`; demais slugs aceitam qualquer objeto |
| `PATCH` | `/editions/:editionId/disciplines/:id` | GESTOR | `:id` é o `editionDisciplineId`; **só `config` é editável** |
| `DELETE` | `/editions/:editionId/disciplines/:disciplineId` | ADMIN | 204. O último segmento é o `disciplineId` — assimétrico em relação ao PATCH acima |

### Catálogo global

| Método | Rota | Auth | Nota |
| --- | --- | --- | --- |
| `POST` | `/athletes` | SuperAdmin ou ADMIN | `{ name, document, birthDate?, email? }`. **`document` é obrigatório e único** |
| `GET` | `/athletes` | sessão | paginada, `search?`; `document` mascarado para quem não administra catálogo |
| `GET` | `/athletes/:id` | sessão | |
| `GET` | `/athletes/:id/history` | sessão | só nomes, sem ids — não dá para navegar dali |
| `POST` | `/teams` | SuperAdmin ou ADMIN | `{ name, slug }`; slug único → 409 |
| `GET` | `/teams`, `/teams/:id` | sessão | paginada, `search?` |

**Não existe rota pública de equipes nem de atletas.** O espectador do front,
sem sessão, recebe 401 nas duas e a carga segue com as coleções vazias
(`optional`, em `http-adapter.ts:83`).

### Elencos da edição

| Método | Rota | Auth | Nota |
| --- | --- | --- | --- |
| `GET` | `/editions/:editionId/rosters` | **aberta** | `disciplineId?`, `teamId?`; sem paginação. Rota aberta apesar de expor nome de atleta |
| `POST` | `/editions/:editionId/rosters` | GESTOR | `{ disciplineId, athleteId, teamId, jerseyNumber? }`. **`teamId` é obrigatório inclusive em modalidade individual** |
| `PATCH` | `/editions/:editionId/rosters/:id` | GESTOR | só `status` e `teamId`; **`jerseyNumber` não é editável** |
| `DELETE` | `/editions/:editionId/rosters/:id` | ADMIN | 204. Gestor de modalidade não remove — só muda status |

### Papéis da edição

| Método | Rota | Auth | Nota |
| --- | --- | --- | --- |
| `GET` | `/editions/:editionId/staff-roles` | ADMIN | único lugar onde o front descobre nome e e-mail de outros staffs |
| `POST` | `/editions/:editionId/staff-roles` | ADMIN | exige um `staffId` **preexistente** |
| `DELETE` | `/editions/:editionId/staff-roles/:id` | ADMIN | 204 |

**Não existe cadastro nem busca de `Staff`**: nenhum controller, nenhum
`POST /auth/register`. Criar usuário hoje é seed ou banco.

### Torneios, inscrições e fases

| Método | Rota | Auth | Nota |
| --- | --- | --- | --- |
| `GET` | `/editions/:editionId/tournaments` | aberta | `status?`, `disciplineId?`; sem paginação. **Rascunhos saem para qualquer um** |
| `POST` | `/editions/:editionId/tournaments` | GESTOR | `{ disciplineId, name, format }`; nasce `DRAFT`; `[editionDisciplineId, name]` único |
| `GET` \| `PATCH` | `/tournaments/:id` | aberta \| GESTOR | PATCH aceita `name`, `format` |
| `PATCH` | `/tournaments/:id/status` | GESTOR | transições em `tournament-status-transitions.ts`: `DRAFT→SCHEDULED\|CANCELLED`; `SCHEDULED→DRAFT\|ONGOING\|CANCELLED`; `ONGOING→FINISHED\|CANCELLED`; `FINISHED` e `CANCELLED` são terminais |
| `GET` \| `POST` | `/tournaments/:tournamentId/entries` | aberta \| GESTOR | `{ teamId?, athleteId?, seed? }`; a regra "exatamente um" está nas estratégias do serviço, e no banco só como comentário |
| `DELETE` | `/tournaments/:tournamentId/entries/:id` | GESTOR | 204 |
| `GET` \| `POST` | `/tournaments/:tournamentId/phases` | aberta \| GESTOR | `config` é **obrigatório na prática**: `GROUP` e `LEAGUE` exigem `{ advanceCount, tiebreakers }`, `KNOCKOUT` aceita `{}`; `[tournamentId, order]` único |
| `POST` | `/phases/:phaseId/groups` | GESTOR | **não há GET de grupos**: grupo só aparece em `/tournaments/:id/bracket` |
| `POST` \| `DELETE` | `/groups/:groupId/entries[/:entryId]` | GESTOR | o último segmento é o id da alocação, não o da inscrição |

### Partidas e eventos

| Método | Rota | Auth | Nota |
| --- | --- | --- | --- |
| `GET` | `/phases/:phaseId/matches` | aberta | `status?`, `round?`; ordem por round, slot, horário |
| `POST` | `/phases/:phaseId/matches` | GESTOR | uma a uma. **Não existe geração de chaveamento nem de rodada em lote** |
| `GET` | `/matches/:id` | aberta | |
| `PATCH` | `/matches/:id` | GESTOR | `groupId`, `round`, `bracketSlot`, `entryAId`, `entryBId`, `scheduledAt`, `venue`. **Não aceita placar**: com `forbidNonWhitelisted`, mandar `scoreA` vira 400 |
| `PATCH` | `/matches/:id/status` | GESTOR | `SCHEDULED\|LIVE\|FINISHED\|WALKOVER\|CANCELLED\|POSTPONED`. **Sem tabela de transições** — `SCHEDULED→FINISHED` direto é aceito |
| `GET` \| `POST` | `/matches/:matchId/events` | aberta \| GESTOR | `sequence` é do servidor, sob lock pessimista; o placar é recalculado do zero a cada evento |
| `DELETE` | `/matches/:matchId/events/:id` | GESTOR | 204. É o desfazer — e **não emite nada no SSE nem invalida o cache público** |
| `GET` | `/phases/:phaseId/standings` | aberta | lista **plana**: se a fase tem grupos, todos vêm misturados e os ranks se repetem |

`EventType` é um enum fechado de 13 valores (`GOAL`, `ASSIST`, `YELLOW_CARD`,
`RED_CARD`, `POINT`, `SET_WON`, `FOUL`, `TIMEOUT_CALLED`, `SUBSTITUTION`,
`DISQUALIFICATION`, `CHECKMATE`, `WALKOVER_DECLARED`, `OTHER`). O `metadata` é
validado pelo par slug+tipo; combinação não mapeada aceita qualquer objeto.

Ao virar `FINISHED`, o `winnerEntryId` é calculado por `determineWinner` —
empate deixa `null` — e o evento `MATCH_FINISHED` dispara o recálculo da
classificação. **É o único gatilho de recálculo**: não há rota para forçar.

### Público (espectador)

| Método | Rota | Auth | Nota |
| --- | --- | --- | --- |
| `GET` | `/editions/:editionId/live` | aberta | só partidas `LIVE`; `entryA`/`entryB` são **nomes**, não objetos; cache 5 s |
| `GET` | `/editions/:editionId/schedule?date=YYYY-MM-DD` | aberta | `date` obrigatório; **a janela do dia é fixada em UTC**, então a agenda sai deslocada em 3 h para o Brasil |
| `GET` | `/tournaments/:id/bracket` | aberta | cache 60 s. **Única rota que devolve grupo e a associação grupo↔classificação**. Nas partidas do mata-mata não vem `matchId` |

## Como o front remonta a edição

`loadEditionState` (`http-adapter.ts:203`) faz quatro ondas encadeadas, com
`Promise.all` dentro de cada uma. As ondas existem porque a API não deixa
escolher: não há como pedir os torneios sem saber a edição, nem as partidas sem
saber as fases.

| Onda | Rotas |
| --- | --- |
| 1 | `/competitions` (paginada), `/auth/me` |
| 2 | `/competitions/:id/editions` de cada competição → resolve a edição vigente |
| 3 | `/editions/:id/disciplines`, `/rosters`, `/tournaments`, `/teams`, `/athletes`, `/staff-roles` |
| 4 | por torneio: `/entries`, `/phases`, `/bracket`; depois `/phases/:id/matches` de cada fase |

**Uma falha derruba a carga.** A primeira rejeição rejeita tudo. Completar a
coleção que faltou com vazio é indistinguível de "ninguém cadastrou" na tela — e
faz o operador cadastrar tudo de novo. A única exceção é `optional`
(`http-adapter.ts:83`): **403 é sempre tolerado**, porque o servidor negou por
papel e a tela apenas não tem aquela parte; **401 é tolerado só sem token**,
porque com token na mão 401 é sessão vencida, e engolir devolveria a visão de
espectador sem nenhum aviso.

**Não existe apelido `active`.** `resolveEditionId` (`http-adapter.ts:105`)
escolhe: entre as edições onde o usuário tem papel, a `ONGOING` mais recente;
sem nenhuma, a mais recente de todas. A exclusividade de "uma edição ativa"
era garantida pelo reducer do pacote e **não é garantida por ninguém agora**.

## Como o front escreve

Não há despachante. Cada ação vira as chamadas REST que a realizam, e o
adaptador relê a edição inteira depois — nenhuma rota da API devolve estado, e
remendar o estado local seria a atualização otimista que este adaptador nunca
fez. É caro (uma escrita = uma releitura) e está registrado como dívida.

### As 9 que falam com a API

| Ação | Chamadas |
| --- | --- |
| `competition/create` | `POST /competitions` + `POST /competitions/:id/editions` |
| `edition/create` | `POST /competitions/:id/editions` |
| `edition/update` | `PATCH /editions/:id` (nome e datas) + `PATCH /editions/:id/status` |
| `edition/activate` | `PATCH /editions/:id/status` para `ONGOING` — **sem rebaixar as outras** |
| `team/create` | `POST /teams` |
| `athlete/create` | `POST /athletes` + um `POST /rosters` por modalidade |
| `athlete/update` | `PATCH /rosters/:id` (status, equipe) e `POST /rosters` para modalidade nova |
| `match/schedule` | `POST /phases/:phaseId/matches` |
| `match/update` | `PATCH /matches/:id` + `PATCH /matches/:id/status` |

### As 23 que ainda não

Cada uma tem dono e a rota onde encaixar, no mapa `pendingActions`
(`http-adapter.ts:123`). A mensagem inteira vai para o toast — o operador
também precisa parar de tentar.

| Dono | Ações | Por quê |
| --- | --- | --- |
| categorias | `category/create`, `category/update`, `category/generateMatches` | as rotas existem (torneio, fase, grupo, inscrição) mas são quatro famílias distintas; **geração de chaveamento não existe** |
| operação de partida | `match/start`, `match/updateClock`, `match/registerEvent`, `match/undoEvent`, `match/claimOperator`, `match/releaseOperator`, `match/finish`, `match/correctResult` | eventos e status existem; **cronômetro, trava de operador, parciais, desempate e retificação não têm campo** |
| ranking geral | as sete `ranking/*` | o domínio inteiro está ausente: nem tabela, nem rota |
| modalidades | `discipline/update` | `PATCH` aceita só `config`; o regulamento do front não tem coluna |
| staff | `staff/upsert` | exige `staffId` preexistente e não há cadastro nem busca de `Staff` |
| competições | `competition/rename`, `competition/activate` | não há `PATCH /competitions/:id` nem coluna de ativa |
| equipes | `team/update` | o catálogo global só tem POST e GET |

## Tempo real

**Só existe stream por partida**: `GET /matches/:matchId/stream`, **aberto**,
sem guard nenhum (`src/realtime/realtime.controller.ts:33`).

```
id: 1699999999999-0
event: match-event
data: {"eventId":"...","type":"GOAL","sequence":7,"entryId":"...","athleteId":"","metadata":"","scoreA":2,"scoreB":1}
```

- O nome do evento é literalmente `match-event`.
- O payload **não inclui `matchId`** — é retirado antes de publicar.
- A serialização por Redis Stream converte `null` em **string vazia**:
  `entryId`, `athleteId` e `metadata` nulos chegam como `''`.
- Heartbeat a cada 25 s é `data: {"type":"heartbeat"}` **sem linha `event:`** —
  chega no listener default `message`, não num nomeado.
- Replay por `Last-Event-ID` usa `XRANGE`. **O id do quadro é do Redis Stream,
  não a `sequence` do evento**: são dois espaços de numeração diferentes e
  confundi-los quebra o replay.
- **Só criação de evento trafega.** Mudança de status da partida e remoção de
  evento não geram quadro nenhum.

> **Defeito conhecido, e não é do transporte.** `realtime-channel.ts:135` abre
> `${apiBaseUrl()}/editions/${edition}/stream` e escuta `edition-changed` e
> `edition-snapshot`. Essa rota não existe na API. Em modo `http` a barra de
> contexto fica em **Sem conexão** permanentemente e o app cai para releitura
> por operação. Reconciliar isso é do módulo de tempo real; o `pull()` do canal
> já foi apontado para `loadEditionState`.

## As regras que passaram para o servidor

O pacote `@atletica-incinera/intereng-contract` continua sendo o motor de
regras **do front**. A API não o instala e não roda `applyAction`. Cinco regras
que o pacote garantia passam a depender do servidor, e a divergência entre os
dois não emite sinal nenhum:

1. **Placar.** Recalculado no servidor por estratégia indexada pelo **slug da
   modalidade**. Slug fora do mapa (`futsal`, `handebol`, `handball`, `volei`,
   `volleyball`, `tenis-de-mesa`, `table-tennis`, `basquete`, `basquetebol`,
   `basketball`, `xadrez`, `chess`) cai na `DefaultScoringStrategy`, que soma
   **zero para tudo, em silêncio**: eventos entram, placar fica 0×0, nenhum
   erro. O front não tem como saber.
2. **Desempate e pontuação 3/1/0.** Vivem em `standings-calculator.ts`, com
   `tiebreakers` gravado no `config` da fase. O front calcula a própria tabela
   pelo contrato e **hoje nem lê `config.tiebreakers`**: se a ordem dos
   critérios divergir, a tabela exibida diverge da calculada sem aviso.
3. **Vencedor.** Decidido na transição para `FINISHED` e **nunca revisto**.
   Corrigir eventos depois muda o placar e deixa `winnerEntryId` mentindo — e a
   classificação só recalcula em `MATCH_FINISHED`.
4. **Elegibilidade.** A API confere que o atleta pertence ao elenco, mas **não
   filtra `RosterStatus`**: um atleta `SUSPENDED` ou `WITHDRAWN` marca gol
   normalmente. O módulo `eligibility.ts` do pacote cobria isso e virou regra só
   de cliente.
5. **Sequência de evento.** Atribuída pelo servidor sob lock; o front não pode
   mais prevê-la.

Outras divergências que a remontagem introduz, e que estão registradas onde
nascem, em `api-mapping.ts`: `CANCELLED` da API cai em `Arquivado` do front e
volta como `CANCELLED` (arquivar no app cancela no servidor); `0×0` de partida
`SCHEDULED` vira placar nulo, então uma partida `LIVE` recém-iniciada aparece
`0×0` em vez de `×`; um atleta com equipes diferentes por modalidade fica com a
primeira inscrição, e a segunda equipe some da tela; sigla, logo, tom,
responsável, regulamento da modalidade, ranking geral e auditoria **não têm
coluna** e não sobrevivem a um recarregamento.

## Como verificar sem o backend

`apps/web/tests/mock-api/api.ts` é o roteador da API de mentira: 61 rotas sobre
um store em forma de API, reproduzindo o envelope, o filtro de erro, a
paginação com `meta`, os guards por papel com herança, as transições de status
de torneio, o placar recalculado dos eventos e o `whitelist` do corpo.
`server.ts` é só o fio — porta, CORS, corpo e o SSE por partida.

O mock **não roda o reducer do contrato**, de propósito: rodar seria mais fácil
e seria mentira, porque é a granularidade da API que o adaptador precisa
enfrentar. E **não serve `/editions/:id/snapshot` nem `/editions/:id/stream`**:
servi-las manteria os cenários verdes e a integração quebrada.

O mesmo roteador é embrulhado num `fetch` pelos testes de componente
(`createMockFetch`, `api.ts:1000`), então uma implementação só é exercitada
pelo portão rápido e pelo e2e.

> **`apps/web/tests/e2e-http/api-mode.spec.ts` está desatualizado.** Os onze
> cenários ainda esperam `/editions/active/snapshot`, `/public-snapshot` e
> `POST /editions/active/actions`, e nenhum passa contra o mock novo. Três deles
> descrevem coisas que deixaram de existir — snapshot público sem staff, uma
> conexão e um snapshot por página, mudança chegando pelo stream da edição — e
> precisam ser repensados, não reapontados.

## O que o front continua fazendo sozinho

- Toda a navegação, permissões de tela e componentes.
- As **preferências do aparelho** — modalidade selecionada, som do placar e
  notificações. Ficam em `intereng:preferences:v1`, não viram operação, não
  entram em auditoria e nunca chegam ao servidor: o celular do operador e o
  telão do ginásio podem discordar sem que isso seja conflito.
- O cálculo de regras antes de enviar (regulamento, elegibilidade, conflito de
  agenda). As funções `canManageEdition` e companhia são guarda de navegação,
  não segurança — quem decide é o servidor, e onde ele não decide (item 4
  acima) a regra ficou só aqui.
- O **fuso**. `toScheduledAt`/`fromScheduledAt` (`api-mapping.ts:209,218`) usam
  hora local: "20:00" é vinte horas no ginásio, e operador, ginásio e navegador
  estão no mesmo fuso. Ler o texto como UTC gravaria 17:00 locais no Brasil, e
  o defeito só apareceria no dia do jogo. Preço: quem abrir em outro fuso vê o
  horário convertido, e `GET /editions/:id/schedule` recorta o dia em UTC.
- O modo `local`, que continua servindo os 47 cenários e2e sem servidor nenhum.
