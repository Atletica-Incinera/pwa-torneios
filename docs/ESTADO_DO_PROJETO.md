# Estado do projeto

Onde o InterEng está, o que falta e de quem depende cada pendência. Existe para
responder "onde estamos" sem reconstruir o histórico a partir dos commits.

> Atualizado em 2026-08-17, sobre a branch `integracao-modulos`.

> **A arquitetura da integração mudou em 2026-08-17.** A API não terá snapshot
> da edição nem despachante de ações: é REST granular, um controller por
> recurso, e já está assim. O front foi adaptado a essa realidade. Quatro das
> doze tasks pedidas à API descreviam o que não vai existir — o veredito de
> cada uma está em [TASKS_API.md](TASKS_API.md), e o que a API oferece de fato
> está em [CONTRATO_API.md](CONTRATO_API.md).

## O app já é funcional, em um aparelho

Todos os critérios de MVP do [BACKLOG.md](BACKLOG.md) estão atendidos em modo
`local`: staff, competições, edições, modalidades por edição, equipes, atletas,
torneios, inscrição, fases, grupos, partidas, placar ao vivo, classificação,
área pública e auditoria. O estado vive no `localStorage` e as 32 ações passam
pelo redutor do pacote de contrato.

O limite é estrutural, não de funcionalidade: **um aparelho**. Dois operadores
não veem o mesmo jogo e o dado não sai do navegador. É isso, e só isso, que a
integração com a API resolve.

## Por frente

| Frente | Situação | Falta |
| --- | --- | --- |
| Front — telas e regras | **100%** — 41 rotas, 32 ações nomeadas | — |
| Front — ler da API REST | **100%** — `loadEditionState` remonta a edição de 14 famílias de rota em quatro ondas | — |
| Front — escrever na API REST | **9 de 32 ações** traduzidas; as 23 restantes têm dono e rota registrados em `pendingActions` | ver a tabela de pendências |
| Front — sessão | **100%** — a entrada tem duas etapas porque a API tem duas: `POST /auth/login` e `GET /auth/me`, de onde sai o papel; renovação em voo único e 401 já estavam prontos | — |
| Front — tempo real | **quebrado em modo `http`** — o canal aponta para `/editions/:id/stream`, que a API não tem | decisão sobre a TASK-22 morta |
| Pacote de contrato | **90%** — 19 módulos, build duplo ESM+CJS, `attw` verde nas quatro resoluções, ensaio de tarball, reexports dissolvidos | publicar a `0.1.0` |
| Ambiente Docker | **80%** — compose sem API embutida, três overrides (`api`, `ghcr`, `host-api`), contexto na raiz, build args | rodar `docker compose build web` e `up web` |
| Pedido à API | **reconciliado** — 8 tasks de pé (2 reescritas), 2 mortas, 2 mortas com pergunta em aberto | colar no repositório da API |
| API (outro repositório) | REST granular, sem migration versionada; as rotas públicas agregadas estão no ar | 8 tasks, mais as decisões humanas |
| PWA | **100% do que não depende de servidor** — manifesto com capturas e atalhos, service worker v8, tela offline, atualização sob confirmação, ícones e maskable, splash de iOS, escudos no pré-cache, sons guardados ao serem tocados, handler de `push` | inscrição de push, que é a TASK-27 |
| Integração ponta a ponta | **0%** | bloqueada pela ausência de banco (TASK-16) |

O que era uma linha de "100% — falar com API" virou quatro, porque a virada
partiu a frente em quatro pedaços de saúde diferente: ler e entrar funcionam
inteiro, escrever funciona em parte, e o tempo real não funciona. Somar os
quatro num número só esconderia exatamente o que interessa.

### Os testes, contados onde eles moram

A migração para o pacote partiu a suíte em duas, e somar os dois lados num
número só esconde justamente o que interessa: as regras são testadas contra o
`dist` publicado, não contra o código do app. Isso continua valendo depois da
virada — só deixou de ser "o artefato que a API instala", porque ela não
instala mais nada; é o artefato que o front consome, e o único lugar onde as
regras do torneio têm teste.

| Onde | Casos | Como rodam |
| --- | --- | --- |
| `packages/intereng-contract/tests/` — regras | 96 | `npm run test:contract` |
| `packages/intereng-contract/tests/` — empacotamento (ESM, CJS) | 3 | idem |
| `apps/web/tests/unit/` | 36 | `npm run test:unit` |
| `apps/web/tests/components/` | 121 | `npm run test:components` |
| `apps/web/tests/e2e/` | 47 cenários | `npm run test:e2e`, em dois projetos (móvel e desktop) |
| `apps/web/tests/e2e-http/` | 12 cenários | `npm run test:e2e:http` |

São 99 casos no pacote e 157 no front, contados no commit `5d58b22`. Os 47
cenários e2e rodam duas vezes cada, num projeto móvel e num desktop — 94
execuções, 47 cenários; contar execução como teste é o tipo de inflação que este
documento existe para não fazer.

**Os doze cenários de `e2e-http` passam.** Foram reescritos em `5d58b22`, o
mesmo commit que virou o front para o REST granular, e falam as rotas que
existem: `/auth/login`, `/auth/me`, `/editions/:id/rosters`, `POST /teams`,
`/editions/:id/tournaments`.
Nada aponta mais para `/editions/active/snapshot`, `/public-snapshot` ou
`POST /editions/active/actions`. Os três que descreviam o que deixou de existir
foram **repensados, não reapontados**: o do espectador afirma agora que o
servidor nega catálogo e papéis a quem não tem sessão e que a área pública fica
de pé assim mesmo; o da carga única conta remontagens da edição — a primeira
requisição de toda carga é `GET /competitions`, e só dela — em vez de snapshots;
e o da mudança que chega sozinha é o que não roda.

Na configuração padrão — mock, transporte `sse` — **onze rodam e um fica de
fora**. O de fora é "o que outro operador cadastra chega na tela sem
recarregar", marcado `test.fixme`
(`apps/web/tests/e2e-http/api-mode.spec.ts:272`) porque em modo `sse` o canal
aponta para uma rota que a API não tem: ele reprovaria pelo defeito de tempo
real já registrado acima, e não por regressão. Com `NEXT_PUBLIC_REALTIME=poll`
ele roda e prova o comportamento. Outros seis cenários têm `test.skip`
condicional que não dispara aqui — quatro dependem de ganchos do mock e só pulam
contra a API real (`npm run test:e2e:api`), dois dependem do `sse` e só pulam
sob `poll`.

Os números acima envelhecem a cada commit. O que não envelhece é onde cada
suíte mora, e por quê: regra é do pacote, tela é do front, e o que a API
responde é do mock — uma implementação só (`tests/mock-api/api.ts`),
exercitada pelo portão rápido e pelo e2e.

## O que falta para o app ser funcional em rede

Os pré-requisitos caíram de cinco para **um**. Dois morreram com a virada —
snapshot e despachante —, um foi contornado no front com documento sintético
(TASK-17) e um foi pago no front com uma segunda chamada (TASK-18). Sobrou o
que nenhum trabalho aqui resolve.

| Pré-requisito | Por quê |
| --- | --- |
| TASK-16 — migrations | não há uma única migration; o schema nunca virou tabela por caminho versionado, e sem banco nada roda |

O papel do usuário no login, que era o segundo pré-requisito, **deixou de ser**:
`POST /auth/login` continua devolvendo `staff` sem papel, mas a entrada passou a
ter duas etapas, com `GET /auth/me` logo em seguida. O front pagou; a TASK-18
sobrevive como economia de uma requisição, não como bloqueio.

As sete restantes são degradação, não bloqueio: TASK-17 tira do banco os
documentos sintéticos que o cadastro de atleta está gravando; TASK-18 economiza
uma requisição por entrada; TASK-23 permite o gate automatizado contra uma tag
fixa; TASK-24, 25 e 26 são o que destrava 16
das 23 ações que hoje só mostram uma mensagem ao operador; e TASK-27 é a única
pendência de PWA que sobrou — o service worker já trata `push` e
`notificationclick`, mas ninguém envia, porque não há chave VAPID nem rota de
inscrição. É melhoria e não pré-requisito porque o app avisa localmente sobre a
partida da modalidade escolhida enquanto a aba estiver aberta em segundo plano;
o que falta é o aviso com o app fechado.

### O que o front perdeu na troca, e ninguém garante hoje

Vale estar aqui e não só no contrato, porque é o tipo de coisa que se descobre
no meio de um jogo. O reducer do pacote garantia estas regras nas duas metades;
agora elas dependem do servidor, e a divergência não emite sinal:

- **placar** calculado por estratégia indexada pelo slug da modalidade — slug
  fora do mapa soma zero para tudo, em silêncio;
- **desempate e pontuação 3/1/0**, que o front continua calculando pelo seu
  lado e sem ler o `tiebreakers` gravado na fase;
- **vencedor da partida**, carimbado uma vez e nunca revisto;
- **elegibilidade**, que a API confere sem olhar o status da inscrição — atleta
  suspenso marca gol;
- **exclusividade da edição ativa**, que deixou de existir como conceito.

## As 23 ações que ainda não falam com a API

| Dono | Quantas | Destravadas por |
| --- | --- | --- |
| operação de partida | 8 | TASK-25 |
| ranking geral | 7 | TASK-24 |
| categorias | 3 | nenhuma task cobre a geração de chaveamento |
| competições | 2 | nenhuma task; falta `PATCH /competitions/:id` |
| modalidades | 1 | TASK-26 |
| staff | 1 | nenhuma task; a API não tem cadastro de `Staff` |
| equipes | 1 | nenhuma task; o catálogo só tem POST e GET |

Cada uma tem dono e a rota onde encaixaria registrados em `pendingActions`
(`apps/web/app/lib/repositories/http-adapter.ts:136`), e a mensagem inteira vai
para o toast — o operador precisa parar de tentar, não só a tela.

## As seis lacunas do PWA, fechadas

Eram seis, nenhuma dependendo de servidor, e as seis foram corrigidas entre
`5b90b79` e `f88d309`. Ficam registradas com o que resolveu cada uma, porque
saber por que uma linha existe é o que impede alguém de removê-la depois:

| Era | Hoje |
| --- | --- |
| Sem `<meta name="theme-color">`, e `env(safe-area-inset-*)` voltando zero no iOS | `app/layout.tsx` exporta `viewport` separado de `metadata` — o Next os dividiu na 14 — com `themeColor` e `viewportFit: 'cover'` |
| Manifesto sem `screenshots`: ficha mínima de instalação no Chrome e no Edge | `app/manifest.ts` publica as capturas de `public/screenshots/`, geradas por `npm run pwa:assets` |
| Atalho "Agenda" apontando para `/public/matches`, que só redireciona | os três atalhos vão para rotas finais: `/public`, `/public/tournaments` e `/public/teams`. `/public/matches` continua existindo, para endereço antigo compartilhado por aí não quebrar |
| Sem splash de iOS: tela branca até o React montar | `appleWebApp.startupImage` com as dez imagens de `public/splash/`, uma por resolução declarada em `app/lib/pwa-assets.ts` |
| Escudos fora do pré-cache: primeira abertura offline com imagem quebrada | os 16 arquivos de `public/teams/` entram no `install`, no cache de recursos — que é onde `staleWhileRevalidate` procura. `tests/unit/service-worker.test.ts` confere que a lista bate com a pasta |
| Preferência de notificação sem handler de `push` | o service worker trata `push` e `notificationclick`, e o app avisa sozinho quando uma partida da modalidade escolhida começa ou termina |

A versão do service worker subiu junto, e voltou a subir quando os sons
passaram a ser guardados: `public/sw.js` está em `intereng-v8`. O número no fim
não é decorativo — é o que o `activate` usa para apagar o cache anterior, e há
um teste exigindo o formato.

Os sons ficaram **fora** do pré-cache, e a razão vale registro porque a primeira
tentativa fez o contrário. São 5,9 MB contra 0,5 MB de todo o resto: baixá-los
na instalação castiga quem só quer ver o placar da arquibancada, e derrubou o
navegador na suíte assim que muitos contextos instalaram o worker em sequência.
Quem precisa deles é o mesário, e `warmSportsSounds()` os carrega ao abrir o
placar ao vivo — ainda com rede, antes de a do ginásio cair. O
`staleWhileRevalidate` os guarda a partir daí, porque `new Audio()` pede com
`destination: 'audio'`.

O que sobrou de PWA não é do front: **aviso com o app fechado depende do
servidor** — chave VAPID, rota de inscrição e envio. É a TASK-27.

## Pendências e donos

| Pendência | Dono | Destrava |
| --- | --- | --- |
| Decidir o que o tempo real vira sem stream por edição | **decisão humana** | o selo "Ao vivo"; hoje a barra fica em "Sem conexão" |
| Apontar `realtime-channel.ts` para o que existir | módulo de tempo real, depois da decisão | o mesmo selo, e o cenário `test.fixme` de `e2e-http` |
| Traduzir as 23 ações restantes, na ordem em que a API ganhar tabela | os donos em `pendingActions` | o app deixar de ser quase somente leitura |
| Navegação depois de criar registro (`/teams/<id>`) | módulo de telas | cadastrar sem cair em rota inexistente |
| Formulário de atleta pedir documento | módulo de equipes e atletas | parar de gravar `sem-documento-<id>` no banco |
| Publicar `@atletica-incinera/intereng-contract@0.1.0` | precisa de `NODE_AUTH_TOKEN` com escrita em packages | o front consumir o `dist` publicado como a API faria |
| `docker compose build web` / `up web` | precisa do daemon de pé | o portão da paridade de build |
| Colar as tasks reconciliadas e religar o `ralph-loop.sh` | manual, por decisão | as 8 tasks que sobraram |
| TASK-16 | repositório da API | o app funcional em rede — é o único pré-requisito que sobrou |

## Regras que não se negociam

- **Nada é escrito na árvore de `intereng-api` por ferramenta.** O loop de
  agentes faz `git add -A` e commitaria como iteração dele; em rejeição de QA
  ele faz `git reset --soft HEAD~1` e a iteração seguinte herda a sujeira. O
  trabalho para a API é entregue como texto, colado por uma pessoa. Detalhes em
  [DEVELOPMENT.md](DEVELOPMENT.md).
- **A API tem as próprias regras, e o pacote é o motor do front.** Era o
  contrário até 2026-08-17: a API instalaria `@atletica-incinera/intereng-contract`
  e rodaria `applyAction`. A equipe decidiu REST granular, e com isso o placar,
  o desempate, o vencedor e a elegibilidade passaram para o servidor. **A
  divergência entre as duas implementações não emite sinal nenhum** — é o custo
  aceito da decisão, e está enumerado em [CONTRATO_API.md](CONTRATO_API.md).
  Registrar não é reabrir: a decisão está tomada.
- **O mock da API não roda o reducer do contrato.** Rodar seria mais fácil e
  seria mentira: é a granularidade da API que o adaptador precisa enfrentar no
  portão antes de enfrentar na integração. Pelo mesmo motivo ele não serve
  `/editions/:id/snapshot` nem `/editions/:id/stream`.
- **`test:visual:update` não é remédio para snapshot vermelho.** Regenerar
  mascara exatamente a regressão que o teste existe para mostrar.
