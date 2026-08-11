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
partidas. Cabe num único snapshot. Então o contrato tem **duas rotas de dados**:
uma que devolve a edição inteira e uma que executa uma operação e devolve a
edição inteira de novo. Não há atualização otimista: **a resposta do servidor é a
verdade**, e todo id nasce lá.

O formato do snapshot é o tipo `FrontendState`
(`apps/web/app/lib/frontend-state.ts`), que é praticamente o schema do banco.

## Rotas

| Método | Rota | Devolve |
| --- | --- | --- |
| `GET` | `/editions/active/snapshot` | `FrontendState` da edição vigente |
| `GET` | `/editions/:id/snapshot` | `FrontendState` da edição pedida |
| `POST` | `/editions/:id/actions` | `FrontendState` já com a operação aplicada |
| `POST` | `/auth/login` | `{ token, expiresAt, user: { email, name, role, scope? } }` |
| `POST` | `/auth/logout` | `204` |

Coleções vazias podem ser omitidas no snapshot: o cliente completa
(`normalizeSnapshot`). `role` é `SUPER_ADMIN`, `EDITION_ADMIN` ou
`DISCIPLINE_MANAGER`.

Toda requisição autenticada leva `Authorization: Bearer <token>`. **`401` em
qualquer rota encerra a sessão** e devolve o usuário ao login com aviso
(`/?access=expired`) — é o mesmo caminho do prazo vencido.

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

As 33 operações que o servidor precisa aceitar:

| Domínio | `type` |
| --- | --- |
| Partida | `match/schedule`, `match/update`, `match/start`, `match/updateClock`, `match/registerEvent`, `match/claimOperator`, `match/releaseOperator`, `match/undoEvent`, `match/finish`, `match/correctResult` |
| Categoria | `category/create`, `category/update`, `category/generateMatches` |
| Modalidade | `discipline/update` |
| Equipe e atleta | `team/create`, `team/update`, `athlete/create`, `athlete/update` |
| Ranking geral | `ranking/addMetric`, `ranking/updateMetric`, `ranking/removeMetric`, `ranking/addAwards`, `ranking/revokeAward`, `ranking/close`, `ranking/reopen` |
| Torneio e edição | `competition/create`, `competition/rename`, `competition/activate`, `edition/create`, `edition/update`, `edition/activate` |
| Staff | `staff/upsert` |
| Preferências | `preferences/update` |

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

Namespace Socket.IO `live-matches` (o gateway já existe em
`apps/api/src/live/live-matches.gateway.ts`). O cliente conecta com
`auth: { token }` e escuta um evento:

| Evento | Payload |
| --- | --- |
| `edition-snapshot` | `FrontendState` — o estado novo da edição |

O servidor emite depois de cada operação aceita. Como o snapshot é pequeno, não
há patch para reconciliar nem ordem de eventos para acertar: quem recebe,
substitui. É o que faz o placar do ginásio e o celular da arquibancada mostrarem
o mesmo número.

## O que o front-end continua fazendo sozinho

- Toda a navegação, permissões de tela e componentes.
- O cálculo de regras antes de enviar (regulamento, elegibilidade, conflito de
  agenda): o payload já vai com o resultado. O servidor **revalida** — as funções
  `canManageEdition` e companhia são guarda de navegação, não segurança.
- O modo `local`, que continua servindo os testes e2e sem servidor nenhum.
