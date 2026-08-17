# Tasks para a API — o que sobrou depois da virada

> **A arquitetura mudou em 2026-08-17: REST granular, um controller por
> recurso.** As doze tasks abaixo foram escritas em 2026-08-09 para uma API de
> snapshot e despachante de ações. Quatro delas descrevem o que não vai
> existir. Este documento separa o que continua de pé do que morreu, e diz por
> quê — antes de qualquer coisa ser colada no repositório da API.

Texto pronto para colar em `Atletica-Incinera/intereng-api`. **Nada daqui deve
ser escrito na árvore daquele repositório por uma ferramenta**: o loop de
agentes faz `git add -A` e commitaria como iteração dele. Cole você, à mão, em
dois lugares:

1. o bloco de checklist no fim de `tasks.md`;
2. as seções `-EXEC` no fim da *Seção 3* de `plano-execucao-api-competicoes.md`,
   depois de `TASK-15-EXEC`.

**Os dois arquivos são de `Atletica-Incinera/intereng-api`, não deste
repositório.** Procurar `tasks.md` ou `plano-execucao-api-competicoes.md` aqui
não acha nada, e não é link quebrado: são o destino do texto, e ficam no
checkout da API — que mora ao lado deste, nunca dentro
([DEVELOPMENT.md](DEVELOPMENT.md)).

> A numeração continua de onde a deles para. O inventário mais recente mostra
> as rotas públicas agregadas **no ar** (`/editions/:id/live`,
> `/editions/:id/schedule`, `/tournaments/:id/bracket`), o que sugere a TASK-15
> concluída; de leitura de audit logs (TASK-14) não há rota nenhuma no
> levantamento. **Reconfira os IDs e o checklist deles antes de colar** — o
> loop se move sozinho.

---

## O veredito, task a task

| Task | Situação | Por quê |
| --- | --- | --- |
| TASK-16 — Migrations versionadas | **de pé, sem mudança** | não existe uma única migration; a arquitetura do front não altera isso |
| TASK-17 — Campos que faltam no schema | **de pé, reescrita** | metade dos itens morreu com o `externalId`; um deles já está feito; dois continuam |
| TASK-18 — CORS e sessão no login | **de pé, muito menor** | CORS existe agora; sobrou um campo, e o front já pagou por ele com uma segunda chamada |
| TASK-19 — Snapshot autenticado | **morta** | o front remonta a edição das rotas granulares |
| TASK-20 — Snapshot público | **morta como escrita** | sobra um resíduo de privacidade que precisa de decisão |
| TASK-21 — Despachante de ações | **morta** | cada ação virou chamada REST no front |
| TASK-22 — Stream SSE por edição | **morta como escrita** | sobra a pergunta de como o tempo real funciona, sem resposta |
| TASK-23 — Imagem no GHCR, seed e reset | **de pé, sem mudança** | o gate de integração depende disso do mesmo jeito |
| TASK-24 — Ranking geral | **de pé, sem mudança** | o domínio inteiro está ausente do banco |
| TASK-25 — Estado de operação da partida | **de pé, mais urgente** | é a maior das 23 ações que o front não consegue enviar |
| TASK-26 — Regulamento versionado | **de pé, ampliada** | ganhou o problema do placar que soma zero em silêncio |
| TASK-27 — Push (Web Push / VAPID) | **de pé, gancho trocado** | o gatilho deixa de ser a ação e passa a ser a mudança de status |

**Oito de pé (duas reescritas), duas mortas, duas mortas com pergunta em
aberto.**

---

## O que mudou de premissa

Três critérios transversais sustentavam as tasks antigas. Dois caíram junto com
a arquitetura, e um mudou de escopo. Ler o bloco antigo sem isto leva a
implementar o que ninguém vai usar.

### O pacote de contrato não é mais um pré-requisito da API

`@atletica-incinera/intereng-contract` continua sendo o motor de regras **do
front** — regulamento, elegibilidade, conflito de agenda, ciclo de vida,
classificação, chaveamento, ranking. O que mudou é que **a API não o instala e
não roda `applyAction`**: ela tem as próprias regras, e é essa a decisão
tomada.

Onde as tasks abaixo ainda apontam para o pacote, é conveniência, não
obrigação: `demoUsers` na TASK-23, para as credenciais de teste baterem dos
dois lados; `computeOverallRanking` na TASK-24, para as duas metades não
divergirem no cálculo do pódio. **Se a API instala o pacote para isso é decisão
humana**, e a alternativa — reimplementar — tem o custo já conhecido: duas
implementações da mesma regra divergem em silêncio.

O que o front perdeu ao deixar de compartilhar o motor está listado em
[CONTRATO_API.md](CONTRATO_API.md), na seção *As regras que passaram para o
servidor*. São cinco, e nenhuma delas emite sinal quando diverge.

### `externalId` morreu

O critério dizia que as coleções do snapshot eram indexadas pelo id semântico
do cliente (`aurora`, `futsal-masculino`, `-advanced-r1-2`) e que devolver
`cuid` quebraria a cascata do mata-mata.

Não há mais snapshot, e **o front adotou o id do servidor**: o `createId` do
cliente viaja no payload e é ignorado. O que isso custou está registrado, e
vale conhecer antes de alguém propor reabrir:

- **A navegação depois de criar quebra.** As telas empurram para
  `/teams/<id-escolhido-pelo-cliente>`; o id do servidor é outro.
- **O reenvio deixou de ser idempotente.** Repetir a mesma criação por falha de
  rede cria dois registros — não há mais chave do cliente para o 409 bater.
- **A progressão do mata-mata perdeu o significado no id.** Como
  `category/generateMatches` também não tem rota, isso ainda não dói; se a
  geração de chaveamento voltar à mesa, volta junto.

Reabrir `externalId` é **decisão humana**. Só faz sentido se o custo acima
virar problema real; hoje é dívida conhecida, não bloqueio.

### `501 NOT_IMPLEMENTED` morreu

Não há despachante, então não há tipo de ação sem domínio para responder 501. A
lacuna mudou de lugar: quem informa o operador agora é o front, pelo mapa
`pendingActions` (`apps/web/app/lib/repositories/http-adapter.ts:123`), onde
cada uma das 23 ações não traduzidas tem dono e a rota onde encaixaria. A
mensagem continua sendo a interface — mas ela é escrita aqui, não lá.

---

## O que morreu, e por quê

### TASK-19 — Snapshot autenticado da edição

**Morta.** `loadEditionState` (`http-adapter.ts:203`) remonta a edição em quatro
ondas encadeadas sobre ~10 famílias de rota que já existem. O custo ficou do
lado do front e já foi pago.

O que a API deixa de precisar entregar: a consulta agregada, o DTO
`FrontendState`, a indexação por `externalId`, a filtragem por escopo do
solicitante.

O que o front paga no lugar, e fica registrado porque alguém vai perguntar:
abrir uma edição são dezenas de requisições em quatro ondas; **toda escrita
relê a edição inteira**, porque nenhuma rota devolve estado; e a coerência
entre coleções, que um snapshot dava de graça, passou a depender da remontagem.

### TASK-21 — Despachante das ações do contrato

**Morta.** As 32 ações viraram tradução para REST dentro do front: **9 falam com
a API hoje**, 23 esperam. A lista com dono e rota está em
[CONTRATO_API.md](CONTRATO_API.md).

Repare que a morte desta task **não** resolve as 23 pendências. A maioria delas
não espera um despachante: espera **tabela**. São as TASK-24, 25 e 26 que as
destravam, e por isso elas continuam de pé sem uma vírgula de mudança no
motivo.

### TASK-20 — Snapshot público da edição

**Morta como escrita** — não há snapshot para reduzir. Mas o que a task
protegia não era o formato, era a privacidade, e essa parte **não tem dono
hoje**:

- `GET /editions/:editionId/rosters` é **aberta** e devolve nome de atleta,
  equipe, número de camisa e status.
- `GET /editions/:editionId/tournaments` é **aberta** e devolve torneios em
  `DRAFT` — o rascunho que o front esconde do espectador sai do servidor mesmo
  assim.
- No sentido inverso, `GET /teams` e `GET /athletes` **exigem sessão**, e não
  há rota pública equivalente: o espectador do front recebe 401 nas duas e as
  telas públicas de equipe e atleta ficam sem catálogo.

**Precisa de decisão humana**: se rascunho e elenco devem sair de rotas
abertas, e se o catálogo precisa de uma leitura pública. Não decido isso
sozinho — a primeira é política de privacidade e a segunda muda o desenho das
telas públicas.

### TASK-22 — Stream SSE por edição

**Morta como escrita.** A API tem SSE **por partida**
(`GET /matches/:matchId/stream`), aberto, com evento `match-event`, e é isso que
vai existir.

Sobra um problema com endereço e sem dono: `realtime-channel.ts:135` abre
`/editions/:id/stream`, que não existe. **Em modo `http` a barra de contexto
fica em "Sem conexão" permanentemente.** Três saídas, e nenhuma é minha:

1. a API ganha um stream por edição — é a task antiga, e a equipe já decidiu
   contra;
2. o front assina a partida que está sendo operada e usa polling para o resto;
3. o front fica só com o polling (`NEXT_PUBLIC_REALTIME=poll`, já existe) e o
   selo "Ao vivo" some do produto.

**Precisa de decisão humana.** Enquanto não houver, o tempo real do modo `http`
não funciona, e o app se sustenta na releitura por operação.

---

## Bloco para o `tasks.md`

Cole no fim do arquivo, mantendo a convenção `- [ ]` / `- [x]`:

```markdown
## Lote 10 — Integração com o front (PWA)
- [ ] TASK-16 — Migrations versionadas e baseline do banco
- [ ] TASK-17 — Campos que o front precisa no schema
- [ ] TASK-18 — O papel do usuário na resposta do login
- [ ] TASK-23 — Imagem no GHCR, seed e gancho de reset
- [ ] TASK-24 — Ranking geral da edição
- [ ] TASK-25 — Estado de operação da partida
- [ ] TASK-26 — Regulamento versionado, congelado e com placar auditável
- [ ] TASK-27 — Inscrição de push (Web Push / VAPID)
```

TASK-19 a 22 não entram: a arquitetura de snapshot e despachante foi descartada
em 2026-08-17. Os números ficam vagos de propósito, para não confundir quem
leia um commit antigo.

---

## Seções para o `plano-execucao-api-competicoes.md` (no repositório da API)

### TASK-16-EXEC — Migrations versionadas e baseline do banco

*Sem mudança em relação à versão anterior. Continua sendo a primeira.*

**Como implementar**: não existe uma única migration no repositório.
`git ls-tree -r --name-only origin/main | grep -iE 'prisma|migration'` devolve
quatro caminhos — `schema.prisma`, `schema.prisma.rtf` e os dois arquivos de
`src/common/prisma/`. Não há diretório `prisma/`, não há `prisma/migrations/`,
não há um único `.sql`, e o `package.json` não tem script de banco. O schema
nunca virou tabela por um caminho versionado e reproduzível.

* Gerar a baseline a partir de `schema.prisma` com
  `prisma migrate dev --name baseline`, versionando `prisma/migrations/`.
* Mover `schema.prisma` para `prisma/schema.prisma`, que é onde o Prisma o
  procura por padrão; hoje ele está na raiz.
* As duas `CHECK CONSTRAINT` que existem **apenas como comentário** precisam
  virar SQL de verdade: `entry_exactly_one`
  (`CHECK (num_nonnulls(team_id, athlete_id) = 1)` em `tournament_entries`) e
  `winner_is_participant`
  (`CHECK (winner_entry_id IS NULL OR winner_entry_id IN (entry_a_id, entry_b_id))`
  em `matches`). Comentário não restringe nada, e hoje nada no banco impede uma
  inscrição com time **e** atleta, ou um vencedor que não jogou a partida.
* Adicionar `prisma migrate deploy` ao roteiro de subida do container.

**Decisões que exigem validação humana**: se o baseline nasce já com as
constraints ou se elas entram numa migration seguinte, separada e revisável.

**Critério de aceite verificável**: num banco vazio, `prisma migrate deploy`
seguido da suíte e2e existente passa sem nenhum `prisma db push`. Tentar gravar
um `winnerEntryId` que não seja `entryAId` nem `entryBId` é recusado **pelo
banco**, não pelo serviço.

**Por que continua de pé**: nada aqui dependia da forma do contrato. Enquanto
não houver migration, todo campo que o front lê do `schema.prisma` é
expectativa, não fato — inclusive os que as tasks abaixo pedem.

---

### TASK-17-EXEC — Campos que o front precisa no schema

*Reescrita. Dois dos cinco itens originais morreram, um já está feito, dois
continuam.*

**Como implementar**: uma migration incremental, depois da baseline.

* **`Athlete.document` passa a ser opcional.** Continua de pé, e ficou pior do
  que era: o formulário de cadastro do front nunca coletou documento, e para
  não morrer no 400 o adaptador hoje **sintetiza** um valor —
  `sem-documento-<id>` (`http-adapter.ts:507`). O banco está enchendo de
  documento falso, único e inútil. Enquanto o campo for obrigatório, esta é a
  única alternativa a travar o cadastro numa validação que o operador não tem
  como corrigir na tela.
* **`Match` ganha `reason String?`** — o motivo de adiamento, cancelamento ou
  W.O., que o front mostra e a API não tem onde guardar. Continua de pé.

**O que saiu desta task, e por quê**:

| Item original | Situação |
| --- | --- |
| `EditionStatus` ganha `ARCHIVED` | **já existe** — o enum atual é `PLANNING\|ONGOING\|FINISHED\|ARCHIVED` |
| `externalId String @unique` em nove entidades | **morto** — o front adotou o id do servidor (ver *O que mudou de premissa*) |
| `isActive` em `Competition` e `CompetitionEdition` | **em aberto** — o alias `active` não existe mais no front, então o campo deixou de ser obrigatório; mas a exclusividade que ele daria continua sem dono (abaixo) |

**Decisões que exigem validação humana**:

1. Se `document` continua único quando presente. Recomendado: sim, índice único
   parcial `WHERE document IS NOT NULL`.
2. **Se "edição ativa" volta a existir.** O front resolve a edição vigente por
   heurística — entre as edições onde o usuário tem papel, a `ONGOING` mais
   recente (`resolveEditionId`, `http-adapter.ts:105`). Nada na API impede duas
   edições `ONGOING` da mesma competição ao mesmo tempo, e a exclusividade era
   garantida pelo reducer do pacote. Se duas ficarem em andamento, **a tela
   abre numa delas sem ninguém ter decidido isso**. `isActive` com índice único
   parcial resolveria; assumir que só há uma `ONGOING` por convenção também.
   Não escolho por vocês.

**Critério de aceite verificável**: um atleta sem `document` é criado com
sucesso, e dois atletas sem documento coexistem. Uma partida adiada guarda o
motivo e o devolve no `GET`.

---

### TASK-18-EXEC — O papel do usuário na resposta do login

*Reescrita, e muito menor. Era a task mais larga do lote; sobrou um campo, e o
front já pagou por ele.*

**O que saiu**: a task pedia `enableCors`, dizendo que `main.ts` não o chamava.
**Ele chama** (`src/main.ts:8-12`), com `origin: '*'` e `credentials: true`.
Para o front isso já funciona, porque o refresh token viaja no corpo e o cliente
não manda `credentials: 'include'`. Também saiu o `POST /auth/refresh` aceitando
o token no corpo: **já aceita** (`refresh.dto.ts`), com o cookie como
alternativa.

Ficam duas ressalvas, nenhuma bloqueante: `origin: '*'` não é postura de
produção, e a combinação `'*'` + `credentials: true` é recusada pelo navegador
— se alguém quiser usar o cookie `httpOnly` cross-origin, a API precisará ecoar
a origem em vez de responder `*`.

**O que fica**: `POST /auth/login` devolve
`staff: { id, name, email, isSuperAdmin }` — **sem papel**. `isSuperAdmin`
sozinho não distingue coordenador de operador, e o front recusa sessão sem
papel em vez de adivinhar um: o papel é por edição, a guarda de navegação
decide a rota antes de qualquer carga, e chutar concederia acesso que o
servidor nega depois.

**Isso deixou de ser bloqueio.** O front encadeia `GET /auth/me` logo após o
login e deriva o papel de `editionRoles`
(`apps/web/app/lib/repositories/http-auth-adapter.ts`). A escolha entre as duas
saídas — front paga, ou API devolve — já está feita **na prática, do lado do
front**, e a task sobrevive como economia, não como pedido urgente:

* **A API devolver `role` e `scope` no login** elimina uma requisição por
  entrada. `role` é uma das três constantes em maiúsculas — `SUPER_ADMIN`,
  `EDITION_ADMIN`, `DISCIPLINE_MANAGER` — e **nunca** o rótulo em português do
  staff. `scope` é a mesma estrutura `editionRoles` que `/auth/me` já monta. O
  mapeador do front já aceita as duas formas; se o campo aparecer, a segunda
  chamada deixa de ser necessária e nada mais muda.
* **`expiresAt` como instante absoluto ISO**, além do `expiresIn: 900`
  relativo. O relógio do aparelho e o do servidor divergem, e é o absoluto que
  decide renovar. O front hoje deriva do relativo; funciona, e é menos exato.

**Decisões que exigem validação humana**: se vale mexer nisso. Se valer: como
derivar um `role` único quando o usuário acumula papéis diferentes em edições
diferentes — o front espera o papel mais alto, com o detalhe em `scope`.

**Critério de aceite verificável**: um `POST /api/v1/auth/login` com credencial
válida devolve `role` como uma das três constantes em maiúsculas, e um `scope`
com a mesma forma de `editionRoles`. Entrar continua funcionando para quem já
usava as duas chamadas.

---

### TASK-23-EXEC — Imagem no GHCR, seed e gancho de reset

*Sem mudança de intenção. Um detalhe do seed depende da TASK-18.*

**Como implementar**: o front já tem os arquivos de composição esperando este
lado.

* `Dockerfile` multi-estágio na raiz e publicação em
  `ghcr.io/atletica-incinera/intereng-api`, com **tag por versão** além da
  `latest`. O front vai apontar seus testes de integração para uma tag fixa: a
  `main` se move sozinha e um gate contra ela não prova nada.
* Seed determinística com uma edição de exemplo: competição, edição em
  andamento, modalidades, equipes, atletas com elenco, um torneio com fases e
  partidas. É contra ela que `npm run test:e2e:api` roda.
* **As credenciais de teste precisam bater dos dois lados.** O front as guarda
  em `demoUsers`, no pacote de contrato
  (`@atletica-incinera/intereng-contract/seed`): `[{ email, password, name,
  role, scope? }]`, três acessos. É a mesma lista que o adaptador local e a API
  de mentira conferem. Enquanto cada ponta mantiver a sua, um acesso entra no
  modo `local` e é recusado no modo `http`. Importar do pacote é o caminho
  curto; copiar a lista à mão funciona e envelhece.
* `POST /test/reset`, que devolve a edição ao estado semeado.

> **O gancho de reset precisa de trava dupla.** Só pode existir com
> `ENABLE_TEST_ENDPOINTS=true` **e** `NODE_ENV !== 'production'`. A aplicação
> deve **recusar subir** na combinação proibida, em vez de apenas ignorar a
> rota — e a rota não deve ser exposta no proxy reverso.
>
> Enquanto isso, **seis rotas de depuração já estão publicadas no build de
> produção**: `/test-request-context`, `/test-pagination`, `/test-not-found`,
> `/test-prisma-unique`, `/test-prisma-not-found` e `/test-prisma-fk`
> (`src/app.controller.ts:14-72`). Três delas lançam exceção de propósito. Se a
> trava dupla vale para o reset, vale para essas.

**Critério de aceite verificável**: `docker compose up` com a imagem publicada
sobe API, banco e Redis; `POST /test/reset` devolve a edição semeada; logo
depois do reset, o login com uma credencial de `demoUsers` devolve `200`; e
subir o container com `NODE_ENV=production ENABLE_TEST_ENDPOINTS=true` falha no
boot, com a razão no log.

---

### TASK-24-EXEC — Ranking geral da edição

*Sem mudança. O domínio continua ausente por inteiro.*

**Como implementar**: `git grep -i 'ranking|overall|leaderboard|medal'` sobre
`origin/main -- src schema.prisma` só encontra a palavra num comentário de
`src/standings/standings-calculator.ts:6`. Não há modelo, rota nem cálculo. A
classificação da API existe só **por fase** (`PhaseStanding`) e é reconstruída
do zero a cada `MATCH_FINISHED`.

* Três modelos novos: `OverallMetric` (nome, pontuação padrão, posição de pódio
  associada), `OverallAward` (edição, equipe, modalidade, métrica, pontos, nota,
  origem manual ou automática, e os campos de revogação) e `OverallClosure` (o
  fechamento por modalidade, com autor e instante).
* A regra de cálculo existe em `overall-ranking`, no pacote de contrato:
  `computeOverallRanking`, `suggestAutomaticAwards`, `activeAwards`,
  `isRankingClosed`. **Se a API instala o pacote para isso é decisão humana**
  (ver *O que mudou de premissa*); reimplementar é a alternativa, com o custo de
  divergir em silêncio.
* Prêmio revogado **não é apagado**: ganha `revokedAt`, `revokedBy` e
  `revokeReason`. O histórico é o que sustenta a contestação de um resultado.

**Sete das 32 ações do front dependem disto** — `ranking/addMetric`,
`updateMetric`, `removeMetric`, `addAwards`, `revokeAward`, `close`, `reopen` —
e as sete estão no mapa de pendências do adaptador, sem rota para onde ir.

**Decisões que exigem validação humana**: se o fechamento por modalidade pode
ser reaberto e por quem.

**Critério de aceite verificável**: encerrar a final de uma modalidade sugere
automaticamente os prêmios de campeão, vice e terceiro com a pontuação padrão;
revogar um prêmio o remove da soma **sem** o apagar da tabela; e uma modalidade
fechada recusa novo prêmio.

---

### TASK-25-EXEC — Estado de operação da partida

*Sem mudança de conteúdo, e agora é a maior das que sobraram: oito das 23 ações
que o front não consegue enviar caem aqui.*

**Como implementar**: `Match` hoje tem placar, status, horário, local e
`lastEventSequence`. Falta tudo que acontece **durante** o jogo.

* **Trava de operador**: `operatorId`, `operatorName`, `operatorHeartbeat`. Dois
  operadores no mesmo jogo é o cenário que corrompe placar. O que a API tem hoje
  é um lock **pessimista de transação** (`SELECT ... FOR UPDATE` em
  `match-events.service.ts`), que serializa escritas concorrentes mas **não
  impede dois operadores de mexerem na mesma partida** — só garante que a
  sequência de eventos não se corrompa. A trava expira por ausência de
  heartbeat; a constante já está no pacote (`operatorLockMs`, 120 s, com
  renovação a cada 90 s).
* **Cronômetro**: `currentPeriod`, `clockSeconds`, `runningSince`, `paused`.
  Não existe nenhum campo de relógio em `Match`. O único vestígio de tempo é
  `matchDurationMinutes` no `config` da `EditionDiscipline` — um número
  declarativo que nenhum serviço lê.
* **Parciais por período**: `periodScoreA`, `periodScoreB` e o histórico
  `periodResults`. Hoje o período só existe **carimbado no metadata do evento**,
  e só em algumas modalidades (`quarter` no basquete, `minute` no futsal,
  `setNumber` no vôlei). Dá para derivar relendo os eventos e agrupando no
  cliente, mas o servidor não agrega nada.
* **Início**: `startedAt`, `startedBy`, `startNote`.
* **Desempate obrigatório** de eliminatória empatada: método, rótulo, placar do
  desempate, vencedor, motivo, quem decidiu e quando. Hoje um empate em
  `FINISHED` simplesmente grava `winnerEntryId = null`. O motor de desempate que
  existe (`TIEBREAKER_STRATEGIES`) é de **tabela**, não de partida.
* **Retificação após o encerramento**: lista de correções com autor, motivo,
  antes e depois. Hoje a única forma de corrigir um resultado é apagar e recriar
  eventos, e isso tem três consequências que ninguém trata: (a) o
  `winnerEntryId` **não é recalculado**, porque só é atribuído na transição para
  `FINISHED`, então o placar muda e o vencedor gravado fica velho; (b) a
  classificação não recomputa, porque só `MATCH_FINISHED` dispara o recálculo;
  (c) o `DELETE` de evento **não emite nada** — nem SSE, nem invalidação do
  cache público.
* `MatchEvent.type` é hoje um enum fechado de 13 valores. O regulamento do front
  é configurável por modalidade: ações de placar com nomes e pontuações
  próprias. O enum precisa dar lugar a um tipo aberto validado contra o
  regulamento da modalidade (ver TASK-26).

**Decisões que exigem validação humana**: por quanto tempo uma partida encerrada
continua aceitando retificação; e se `PATCH /matches/:id/status` deve ganhar uma
tabela de transições válidas, como a de torneio — hoje `SCHEDULED→FINISHED`
direto é aceito, e `WALKOVER` não define vencedor nenhum.

**Critério de aceite verificável**: um segundo operador tentando assumir uma
partida com trava viva é recusado com 409; deixar de mandar heartbeat pelo tempo
da constante libera a trava; retificar o resultado de uma semifinal já encerrada
recalcula o vencedor **e** a classificação; e desfazer um evento chega a quem
está no SSE.

---

### TASK-26-EXEC — Regulamento versionado, congelado e com placar auditável

*Ampliada. Ganhou o problema que a virada de arquitetura criou: o placar passou
a ser calculado no servidor, indexado por slug, e falha em silêncio.*

**Como implementar**: o regulamento esportivo vive hoje em
`EditionDiscipline.config Json?`, sem versão e sem histórico.

* Versionar: cada alteração cria uma versão nova, com autor e instante, em vez
  de sobrescrever.
* **Congelar na partida**: a partida guarda o regulamento vigente no momento em
  que começou. Mudar a regra no meio da competição não pode reescrever o
  resultado de um jogo que já aconteceu — e hoje reescreveria, porque o placar é
  recalculado do zero a cada evento.
* **O placar não pode somar zero em silêncio.** `ScoringStrategyRegistry` é
  indexado pelo **slug da modalidade**. Slug fora do mapa — `futsal`,
  `handebol`, `handball`, `volei`, `volleyball`, `tenis-de-mesa`,
  `table-tennis`, `basquete`, `basquetebol`, `basketball`, `xadrez`, `chess` —
  cai na `DefaultScoringStrategy`, que **soma zero para tudo**: os eventos
  entram, o placar fica 0×0, nenhum erro é levantado e o front não tem como
  saber. Uma modalidade nova cadastrada com slug próprio produz exatamente
  isso. O mesmo vale para a validação de `metadata`, indexada pelo mesmo par
  slug+tipo: fora do mapa, qualquer objeto passa. Recusar a modalidade sem
  estratégia no cadastro, ou expor a estratégia em uso na resposta de
  `GET /editions/:id/disciplines`, resolve — as duas são aceitáveis; **qual
  delas é decisão humana**.

**Decisões que exigem validação humana**: se alterar o regulamento com partidas
em andamento deve ser bloqueado ou apenas avisado.

**Critério de aceite verificável**: encerrar uma partida, alterar a pontuação da
modalidade e reler a partida encerrada mostra o placar calculado pela regra
**antiga**; a partida seguinte já usa a nova. E cadastrar uma modalidade com um
slug desconhecido, registrar um evento de placar e ver 0×0 **falha** o teste em
vez de passar.

---

### TASK-27-EXEC — Inscrição de push (Web Push / VAPID)

*De pé. Só o gancho mudou: não há mais ação para interceptar.*

**Como implementar**: o front já tem a metade dele. O service worker trata
`push` e `notificationclick`, e o app avisa localmente quando uma partida da
modalidade escolhida começa ou termina — mas só com a aba aberta em segundo
plano. Aviso com o app fechado depende do servidor.

* Par de chaves VAPID em variável de ambiente, com a pública exposta numa rota
  de configuração para o front usar em `pushManager.subscribe`.
* `POST /me/push-subscriptions` guarda `endpoint`, `p256dh` e `auth` por membro
  do staff; `DELETE` remove. Endpoint é único: reinscrição substitui.
* **O gatilho é `PATCH /matches/:id/status`** — quando o status vira `LIVE` ou
  `FINISHED` —, não mais as ações `match/start` e `match/finish`, que não
  chegam à API. Enviar para quem tem inscrição no escopo daquela modalidade. O
  corpo é `{ title, body, tag, url }`, que é o que o service worker do front já
  espera.
* Endpoint que responder 404 ou 410 é apagado na hora: navegador desinstalado
  não pode virar fila de erro permanente.

**Autonomia de pesquisa**: `web-push` no Node e o formato de payload
criptografado; envio em lote sem bloquear a resposta da requisição.

**Decisões que exigem validação humana**: se espectador sem sessão também pode
se inscrever — hoje a inscrição pressupõe staff autenticado.

**Critério de aceite verificável**: com o navegador fechado, encerrar uma
partida entrega a notificação no aparelho inscrito; e um endpoint que devolve
410 desaparece da tabela sem intervenção.

---

## O que precisa de decisão humana antes de virar task

Nada abaixo foi decidido por mim, e nenhum deles é derivável do código: são
escolhas de produto ou de política.

| Pergunta | Onde dói hoje |
| --- | --- |
| Como o tempo real funciona em modo `http`? | `realtime-channel.ts` aponta para uma rota inexistente; a barra fica em "Sem conexão" |
| Rascunho de torneio e elenco de atleta podem sair de rotas abertas? | `GET /tournaments` e `GET /rosters` são públicos |
| O espectador precisa de catálogo de equipes e atletas? | `GET /teams` e `/athletes` exigem sessão; as telas públicas ficam sem eles |
| "Edição ativa" volta a existir como campo, ou fica como convenção? | duas edições `ONGOING` fazem a tela abrir numa delas por sorteio de data |
| `externalId` volta? | navegação depois de criar quebra; reenvio duplica |
| A API instala o pacote de contrato para ranking e credenciais de seed? | a alternativa é reimplementar e divergir em silêncio |
| Rotas de depuração continuam no build de produção? | seis delas estão no ar |

---

## Ordem, e o que cada uma destrava no front

| Task | Sem ela | Com ela |
| --- | --- | --- |
| **TASK-16** | **nada funciona: o schema nunca virou tabela** | o banco existe, e as duas invariantes deixam de ser comentário |
| TASK-17 | o banco enche de documento sintético; adiamento sem motivo | o cadastro de atleta fica honesto |
| TASK-18 | toda entrada custa duas requisições | uma só, e o prazo de renovação fica exato |
| TASK-23 | não há como rodar os dois juntos num gate | `test:e2e:api` verde contra uma tag fixa |
| TASK-25 | 8 das 23 ações pendentes continuam sem destino | operação de partida ao vivo funciona em rede |
| TASK-24 | as 7 ações de ranking continuam sem destino | o pódio da edição existe fora do navegador |
| TASK-26 | mudar a regra reescreve jogo passado; slug novo zera o placar | o regulamento tem história e o placar tem dono |
| TASK-27 | o aviso só chega com a aba aberta em segundo plano | a notificação chega com o app fechado |
