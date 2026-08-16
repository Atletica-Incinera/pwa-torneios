# Estado do projeto

Onde o InterEng está, o que falta e de quem depende cada pendência. Existe para
responder "onde estamos" sem reconstruir o histórico a partir dos commits.

> Atualizado em 2026-08-16, sobre a branch `integracao-api`.

## O app já é funcional, em um aparelho

Todos os critérios de MVP do [BACKLOG.md](BACKLOG.md) estão atendidos em modo
`local`: staff, competições, edições, modalidades por edição, equipes, atletas,
torneios, inscrição, fases, grupos, partidas, placar ao vivo, classificação,
área pública e auditoria. O estado vive no `localStorage` e as 32 ações passam
pelo mesmo redutor que a API vai rodar.

O limite é estrutural, não de funcionalidade: **um aparelho**. Dois operadores
não veem o mesmo jogo e o dado não sai do navegador. É isso, e só isso, que a
integração com a API resolve.

## Por frente

| Frente | Situação | Falta |
| --- | --- | --- |
| Front — telas e regras | **100%** — 41 rotas, 32 ações nomeadas | — |
| Front — falar com API | **100%** — adaptadores `http`, SSE, sessão com refresh single-flight, 10 e2e contra HTTP real | — |
| Pacote de contrato | **90%** — 19 módulos, build duplo ESM+CJS, `attw` verde nas quatro resoluções, ensaio de tarball, reexports dissolvidos | publicar a `0.1.0` |
| Ambiente Docker | **80%** — compose sem API embutida, quatro overrides, contexto na raiz, build args | rodar `docker compose build web` e `up web` |
| Pedido à API | **100%** — 12 tasks escritas em [TASKS_API.md](TASKS_API.md) | colar no repositório da API |
| API (outro repositório) | **23 de 25** tasks deles; **0 de 12** novas | segurado por decisão |
| PWA | **100% do que não depende de servidor** — manifesto com capturas e atalhos, service worker v8, tela offline, atualização sob confirmação, ícones e maskable, splash de iOS, escudos no pré-cache, sons guardados ao serem tocados, handler de `push` | inscrição de push, que é a TASK-27 |
| Integração ponta a ponta | **0%** | bloqueada pela API |

### Os testes, contados onde eles moram

A migração para o pacote partiu a suíte em duas, e somar os dois lados num
número só esconde justamente o que interessa: as regras não são mais testadas
pelo front, são testadas pelo artefato que a API instala.

| Onde | Casos | Como rodam |
| --- | --- | --- |
| `packages/intereng-contract/tests/` — regras | 90 | `npm run test:contract` |
| `packages/intereng-contract/tests/` — empacotamento (ESM, CJS) | 3 | idem |
| `apps/web/tests/unit/` | 18 | `npm run test:unit` |
| `apps/web/tests/components/` | 13 | `npm run test:components` |
| `apps/web/tests/e2e/` | 47 cenários | `npm run test:e2e`, em dois projetos (móvel e desktop) |
| `apps/web/tests/e2e-http/` | 10 cenários | `npm run test:e2e:http` |

São 93 casos no pacote e 88 no front. Os 47 cenários e2e rodam duas vezes cada,
num projeto móvel e num desktop — 94 execuções, 47 cenários; contar execução
como teste é o tipo de inflação que este documento existe para não fazer.

Os números acima envelhecem a cada commit. O que não envelhece é onde cada
suíte mora, e por quê: regra é do pacote, tela é do front.

## O que falta para o app ser funcional em rede

Cinco das doze tasks da API são pré-requisito — não três, porque não existe
banco:

| Task | Por que é pré-requisito |
| --- | --- |
| TASK-16 | não há uma única migration; o schema nunca virou tabela |
| TASK-17 | `externalId` é a chave do snapshot e o que torna o reenvio idempotente |
| TASK-18 | `main.ts` não chama `enableCors`; nenhuma chamada de navegador sai do lugar |
| TASK-19 | o snapshot — sem ele as telas ficam vazias |
| TASK-21 | o despachante — sem ele o app é somente leitura |

As outras sete são melhoria: TASK-20 libera a área pública sem sessão; TASK-22
troca o polling de 5s por SSE; TASK-23 permite o gate automatizado; TASK-24 a 26
transformam os `501` do despachante em `200`; e TASK-27 é a única pendência de
PWA que sobrou — o service worker já trata `push` e `notificationclick`, mas
ninguém envia, porque não há chave VAPID nem rota de inscrição. É melhoria e não
pré-requisito porque o app avisa localmente sobre a partida da modalidade
escolhida enquanto a aba estiver aberta em segundo plano; o que falta é o aviso
com o app fechado.

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
| Publicar `@atletica-incinera/intereng-contract@0.1.0` | precisa de `NODE_AUTH_TOKEN` com escrita em packages | a API poder importar `applyAction` |
| `docker compose build web` / `up web` | precisa do daemon de pé | o portão da paridade de build |
| Colar as tasks e religar o `ralph-loop.sh` | manual, por decisão | as 12 tasks da API |
| TASK-16, 17, 18, 19 e 21 | repositório da API | o app funcional em rede |

## Regras que não se negociam

- **Nada é escrito na árvore de `intereng-api` por ferramenta.** O loop de
  agentes faz `git add -A` e commitaria como iteração dele; em rejeição de QA
  ele faz `git reset --soft HEAD~1` e a iteração seguinte herda a sujeira. O
  trabalho para a API é entregue como texto, colado por uma pessoa. Detalhes em
  [DEVELOPMENT.md](DEVELOPMENT.md).
- **A API importa as regras do pacote, não as reescreve.** Duas implementações
  da mesma regra divergem em silêncio, e a divergência só aparece quando o
  placar da tela e o do banco discordam no meio de um jogo.
- **`test:visual:update` não é remédio para snapshot vermelho.** Regenerar
  mascara exatamente a regressão que o teste existe para mostrar.
