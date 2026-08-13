# Contrato da API

O front-end está pronto para receber o backend. Ele fala com a origem de dados
por trás de dois adaptadores comutáveis, escolhidos por ambiente:

```env
NEXT_PUBLIC_DATA_SOURCE=local   # estado no navegador (padrão, usado pelos e2e)
NEXT_PUBLIC_DATA_SOURCE=http    # tudo vem da API
NEXT_PUBLIC_API_URL=http://api.localhost
```

Este documento é o que a API precisa oferecer para `http` funcionar. Nada aqui é
negociável pelo front-end: as telas já foram escritas contra este formato.

## O princípio

Uma edição inteira é pequena — ~16 equipes, ~50 atletas, ~10 categorias, ~100
partidas. Cabe num único snapshot. Então o contrato é curto: rotas que devolvem
a edição inteira e uma que executa uma operação e devolve a edição inteira de
novo. Não há atualização otimista — **a resposta do servidor é a verdade** — mas
o id de quem nasce vem do cliente, para a navegação e o reenvio funcionarem
(veja *Quem escolhe o id*).

O formato do snapshot é o tipo `FrontendState`
(`apps/web/app/lib/frontend-state.ts`), que é praticamente o schema do banco.

## Rotas

| Método | Rota | Autenticação | Devolve |
| --- | --- | --- | --- |
| `GET` | `/editions/:id/snapshot` | obrigatória | `FrontendState` completo |
| `GET` | `/editions/:id/public-snapshot` | nenhuma | `FrontendState` reduzido |
| `POST` | `/editions/:id/actions` | obrigatória | `FrontendState` já com a operação aplicada |
| `POST` | `/auth/login` | nenhuma | `{ token, expiresAt, user: { email, name, role, scope? } }` |
| `POST` | `/auth/refresh` | nenhuma | o mesmo formato do login |
| `POST` | `/auth/logout` | obrigatória | `204` |
| `GET` | `/editions/:id/stream` | nenhuma | `text/event-stream` |

`:id` aceita `active`, e aí é o servidor que resolve qual é a edição vigente.
Coleções vazias podem ser omitidas: o cliente completa (`normalizeSnapshot`).
`role` é `SUPER_ADMIN`, `EDITION_ADMIN` ou `DISCIPLINE_MANAGER`.

### O snapshot público é outro payload, não o mesmo filtrado

O app do espectador roda sem sessão e chama `public-snapshot`. Esse payload
**não pode conter**:

- `staff` (são e-mails de pessoas),
- `audit` (o histórico de quem mexeu em quê),
- categorias em `Rascunho` ou `Arquivado`, nem as partidas delas.

Filtrar só na tela não resolve: o dado sairia do servidor de qualquer forma. O
front-end já sabe qual dos dois pedir — a decisão é a presença do token.

Toda requisição autenticada leva `Authorization: Bearer <token>`. **`401` em
qualquer rota tenta renovar uma vez** com o `refreshToken` guardado, em voo
único — várias requisições que caem juntas compartilham a mesma renovação, em
vez de disputarem um token já rotacionado. Falhando a renovação, a sessão é
encerrada e o usuário volta ao login com aviso (`/?access=expired`), pelo mesmo
caminho do prazo vencido.

O `refreshToken` viaja **no corpo**, não em cookie: `SameSite=Strict` não
atravessa origem, e afrouxar isso exigiria TLS no ambiente local.

Sobre prazos: o app guarda `expiresAt` como o horizonte da **sessão** (o da
renovação), não o do token de acesso. Guardar o prazo curto ali expulsaria quem
está trabalhando a cada renovação. O campo `accessExpiresAt` existe para o prazo
do acesso, quando o servidor o informa.

## Operações

O corpo de `POST /editions/:id/actions` é uma ação da união em
`apps/web/app/lib/repositories/actions.ts`:

```jsonc
{
  "type": "match/finish",
  "payload": { "id": "semifinal-1", "patch": { "status": "Encerrada", "scoreA": 3, "scoreB": 2 } },
  "audit": { "action": "Partida encerrada", "entity": "Alcateia × Cangaceiros" }
}
```

O `audit` é o que entra no registro; **autor e horário são carimbados pelo
servidor**, a partir do token — nunca pelo cliente.

As 32 operações que o servidor precisa aceitar:

| Domínio | `type` |
| --- | --- |
| Partida | `match/schedule`, `match/update`, `match/start`, `match/updateClock`, `match/registerEvent`, `match/claimOperator`, `match/releaseOperator`, `match/undoEvent`, `match/finish`, `match/correctResult` |
| Categoria | `category/create`, `category/update`, `category/generateMatches` |
| Modalidade | `discipline/update` |
| Equipe e atleta | `team/create`, `team/update`, `athlete/create`, `athlete/update` |
| Ranking geral | `ranking/addMetric`, `ranking/updateMetric`, `ranking/removeMetric`, `ranking/addAwards`, `ranking/revokeAward`, `ranking/close`, `ranking/reopen` |
| Torneio e edição | `competition/create`, `competition/rename`, `competition/activate`, `edition/create`, `edition/update`, `edition/activate` |
| Staff | `staff/upsert` |

### Quem escolhe o id

**O cliente.** Todo `payload.id` vem pronto na operação e o servidor o aceita
como veio. Isso mantém a navegação depois de criar (`/teams/<id>` logo após o
cadastro) e torna o reenvio idempotente: repetir a mesma operação por falha de
rede não pode criar dois registros.

Em troca, o servidor precisa garantir a unicidade:

- id repetido numa criação → `409`, e a mesma operação byte a byte é tratada
  como repetição inofensiva (devolve o estado, não duplica);
- equipe usa slug legível (`aurora`), então **nome duplicado também é `409`** —
  o formulário já mostra "Já existe uma equipe com este nome".

### Consequências que o servidor precisa reproduzir

O cliente aplica a ação com `applyAction` (`repositories/reducer.ts`), que usa os
mesmos módulos puros de regra. O servidor deve rodar o equivalente:

- `match/finish` e `match/correctResult` disparam a **cascata do chaveamento**
  (`progressTournament`); a retificação ainda limpa o que veio depois
  (`clearDownstream`).
- `match/claimOperator` respeita a **trava do operador** (2 min, renovação a cada
  90 s) e só passa por cima com `force`.
- `match/releaseOperator` só solta a trava de quem a detém.
- `category/generateMatches` substitui os confrontos gerados **e** o mata-mata que
  nasceu deles.
- `competition/activate` e `edition/activate` são exclusivos: ativar um desativa
  os outros.

Os 87 testes unitários do front-end são a suíte de contrato dessas regras.

## Tempo real

`GET /editions/:id/stream`, **sem autenticação**, `text/event-stream`. Dois
eventos nomeados, com a revisão da edição no campo `id:` de cada quadro:

| Evento | `data` |
| --- | --- |
| `edition-changed` | `{ revision, at }` — só o gatilho |
| `edition-snapshot` | o snapshot **público** da edição |

O canal é público de propósito e **não carrega estado privado**. Quem tem sessão
usa `edition-changed` como gatilho e rebusca `/editions/:id/snapshot` com o
Bearer; quem não tem consome o payload de `edition-snapshot` e não paga uma
segunda viagem.

Não é preferência: `EventSource` não envia `Authorization`, token na query vaza
em log de proxy, histórico e `Referer`, e cookie não atravessa
`app.localhost` × `api.localhost` com `SameSite=Strict`. Um canal sem segredo
resolve os três de uma vez.

O servidor emite depois de cada operação aceita. Como o snapshot é pequeno, não
há patch para reconciliar nem ordem de eventos para acertar: quem recebe,
substitui. É o que faz o placar do ginásio e o celular da arquibancada mostrarem
o mesmo número.

Requisitos do lado do servidor: `retry:` no início do fluxo, heartbeat (`: ping`)
a cada ~25 s, e replay aceito por **`Last-Event-ID` (header) e `?lastEventId=`
(query)** — o navegador só reenvia o header nas reconexões que ele mesmo faz;
quando o cliente reabre depois de uma falha terminal, o id volta pela query.

Queda de conexão não é silenciosa: o cliente distingue `CONNECTING` (o navegador
reconecta sozinho) de `CLOSED` (ele desistiu — resposta não-2xx, content-type
errado), agenda a própria reconexão com recuo exponencial e troca o selo da
barra de contexto para **Sem conexão**. Quando a rede volta, recarrega o
snapshot sozinho.

## Como verificar sem o backend pronto

`apps/web/tests/mock-api/server.ts` é uma API de mentira que cumpre este
contrato: roda o mesmo reducer, exige token, separa o snapshot público e
carimba autor e horário da auditoria. A suíte do modo `http` compila o app
contra ela e prova o caminho inteiro:

```bash
npm run test:e2e:http
```

São seis cenários: sessão emitida pela API, credencial recusada, operação que
vai ao servidor e volta como verdade, snapshot público sem staff nem auditoria,
`401` devolvendo ao login com aviso, e a barra de contexto avisando quando o
tempo real não sobe. Quando o NestJS existir, é essa suíte que aponta para ele.

## O que o front-end continua fazendo sozinho

- Toda a navegação, permissões de tela e componentes.
- As **preferências do aparelho** — modalidade selecionada, som do placar e
  notificações. Ficam em `intereng:preferences:v1`, não viram operação, não
  entram na auditoria e nunca chegam ao servidor: o celular do operador e o
  telão do ginásio podem discordar sem que isso seja conflito.
- O cálculo de regras antes de enviar (regulamento, elegibilidade, conflito de
  agenda): o payload já vai com o resultado. O servidor **revalida** — as funções
  `canManageEdition` e companhia são guarda de navegação, não segurança.
- O modo `local`, que continua servindo os testes e2e sem servidor nenhum.
