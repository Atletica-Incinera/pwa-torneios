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
| Front — telas e regras | **100%** — 40 rotas, 32 ações nomeadas, 190 testes | — |
| Front — falar com API | **100%** — adaptadores `http`, SSE, sessão com refresh single-flight, 8 e2e contra HTTP real | — |
| Pacote de contrato | **90%** — 18 módulos movidos, build duplo ESM+CJS, `attw` verde nas quatro resoluções, ensaio de tarball, reexports dissolvidos | publicar a `0.1.0` |
| Ambiente Docker | **80%** — compose sem API embutida, quatro overrides, contexto na raiz, build args | rodar `docker compose build web` e `up web` |
| Pedido à API | **100%** — 11 tasks escritas em [TASKS_API.md](TASKS_API.md) | colar no repositório da API |
| API (outro repositório) | **23 de 25** tasks deles; **0 de 11** novas | segurado por decisão |
| PWA | **~70%** — manifesto, service worker v6, tela offline, atualização sob confirmação, ícones e maskable | as seis lacunas abaixo |
| Integração ponta a ponta | **0%** | bloqueada pela API |

## O que falta para o app ser funcional em rede

Cinco das onze tasks da API são pré-requisito — não três, porque não existe
banco:

| Task | Por que é pré-requisito |
| --- | --- |
| TASK-16 | não há uma única migration; o schema nunca virou tabela |
| TASK-17 | `externalId` é a chave do snapshot e o que torna o reenvio idempotente |
| TASK-18 | `main.ts` não chama `enableCors`; nenhuma chamada de navegador sai do lugar |
| TASK-19 | o snapshot — sem ele as telas ficam vazias |
| TASK-21 | o despachante — sem ele o app é somente leitura |

As outras seis são melhoria: TASK-20 libera a área pública sem sessão; TASK-22
troca o polling de 5s por SSE; TASK-23 permite o gate automatizado; e TASK-24 a
26 transformam os `501` do despachante em `200`.

## As seis lacunas do PWA

Todas verificadas no código, nenhuma dependendo de servidor:

1. **Sem `<meta name="theme-color">`** — `app/layout.tsx` exporta `metadata`
   mas não `viewport`, que o Next separou na 14. Junto vai o `viewport-fit`,
   sem o qual os `env(safe-area-inset-*)` já escritos no CSS voltam zero no iOS.
2. **Manifesto sem `screenshots`** — Chrome e Edge mostram a ficha mínima de
   instalação em vez da rica.
3. **Atalho "Agenda" aponta para `/public/matches`**, que só redireciona. Um
   atalho da tela inicial gasta uma navegação inteira.
4. **Sem splash de iOS** — abrir o app instalado mostra tela branca até o React
   montar, o oposto do que o `background_color` promete.
5. **Escudos fora do pré-cache** — os 10 arquivos de `public/teams/` só entram
   no cache depois de vistos. Primeira abertura offline mostra imagem quebrada.
6. **Notificações que nunca chegam** — `app/profile/page.tsx` pede permissão e
   grava a preferência; o service worker não tem handler de `push`. A interface
   promete o que nada entrega.

## Pendências e donos

| Pendência | Dono | Destrava |
| --- | --- | --- |
| Publicar `@atletica-incinera/intereng-contract@0.1.0` | precisa de `NODE_AUTH_TOKEN` com escrita em packages | a API poder importar `applyAction` |
| `docker compose build web` / `up web` | precisa do daemon de pé | o portão da paridade de build |
| Colar as tasks e religar o `ralph-loop.sh` | manual, por decisão | as 11 tasks da API |
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
