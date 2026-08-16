# PWA Torneios — InterEng

Sistema PWA para gestão de torneios independentes, cadastro de equipes e atletas, organização de partidas, operação de placar ao vivo e visualização pública de jogos e classificações.

## Status do projeto

Projeto em fase inicial de estruturação do MVP.

Backlog oficial:

- [`docs/BACKLOG.md`](docs/BACKLOG.md)

Branch inicial de trabalho:

- `feature/s1-01-estrutura-inicial`

## Contrato de integração congelado

A integração com `intereng-api` preserva as páginas e os requisitos atuais. O contrato de compatibilidade do frontend é formado por:

- `apps/web/app/lib/frontend-state.ts`: formato do snapshot consumido pelas telas;
- `apps/web/app/lib/repositories/actions.ts`: as 32 mutações aceitas pelo servidor;
- `apps/web/app/lib/repositories/auth-adapter.ts`: sessão usada pelas guardas de navegação;
- `apps/web/app/lib/repositories/state-adapter.ts`: fronteira entre as telas e a fonte de dados.

O frontend trata toda resposta JSON da API no envelope `{ "data": T, "meta"?: object }`. Erros usam `{ "error": { "code": string, "message": string, "details"?: unknown, "requestId"?: string } }`. O identificador `active` é aceito no lugar do ID para resolver a edição ativa.

| Método | Rota | Contrato |
| --- | --- | --- |
| `POST` | `/api/v1/auth/login` | recebe e-mail/senha; devolve `{ token, expiresAt, user }` e cria cookie HttpOnly de refresh |
| `POST` | `/api/v1/auth/refresh` | rotaciona o cookie e devolve uma nova sessão |
| `POST` | `/api/v1/auth/logout` | revoga a sessão e limpa o cookie |
| `GET` | `/api/v1/auth/me` | devolve usuário, papel e escopo atuais |
| `GET` | `/api/v1/editions/:id/snapshot` | snapshot privado no formato `FrontendState`; `meta.revision` é obrigatório |
| `GET` | `/api/v1/editions/:id/public-snapshot` | snapshot público sem `staff`, `audit` ou dados pessoais |
| `POST` | `/api/v1/editions/:id/actions` | recebe uma `Action`, aplica de forma atômica e devolve o snapshot confirmado |
| `GET` | `/api/v1/editions/:id/stream` | SSE de invalidação com `{ editionId, revision }` |
| `GET` | `/api/v1/editions/:id/live` | visão pública resumida das partidas ao vivo |
| `GET` | `/api/v1/tournaments/:id/bracket` | chaveamento público do torneio |
| `GET` | `/api/v1/audit-logs` | auditoria paginada para super administrador |
| `GET` | `/api/v1/editions/:id/audit-logs` | auditoria paginada e escopada à edição |
| `POST` | `/api/v1/teams/:id/logo-upload-url` | URL pré-assinada para upload direto de WebP; persiste-se apenas `fileKey` |

As mutações congeladas são:

| Domínio | Tipos aceitos |
| --- | --- |
| Partida | `match/schedule`, `match/update`, `match/start`, `match/updateClock`, `match/registerEvent`, `match/claimOperator`, `match/releaseOperator`, `match/undoEvent`, `match/finish`, `match/correctResult` |
| Categoria | `category/create`, `category/update`, `category/generateMatches` |
| Modalidade | `discipline/update` |
| Equipe | `team/create`, `team/update` |
| Atleta | `athlete/create`, `athlete/update` |
| Ranking | `ranking/addMetric`, `ranking/updateMetric`, `ranking/removeMetric`, `ranking/addAwards`, `ranking/revokeAward`, `ranking/close`, `ranking/reopen` |
| Competição | `competition/create`, `competition/rename`, `competition/activate` |
| Edição | `edition/create`, `edition/update`, `edition/activate` |
| Staff | `staff/upsert` |

Regras de compatibilidade:

- o servidor é a fonte de verdade; não há atualização otimista no modo HTTP;
- IDs enviados pelo cliente são validados e preservados para manter navegação e referências;
- cada ação leva `Idempotency-Key`, é transacional e incrementa a revisão uma única vez;
- classificação, chaveamento, auditoria e snapshot já estão consistentes quando a ação responde;
- preferências de dispositivo continuam locais e podem ser omitidas pelo snapshot;
- o modo local e a API simulada só serão removidos depois da validação integral do backend real.

### Baseline antes da integração

Em 2026-08-16, `apps/web` passou em 87 testes unitários e 11 testes de componentes. Esse resultado é a referência mínima para todas as fases seguintes.

## Escopo do MVP

O MVP contempla:

- autenticação de usuários administrativos;
- perfis Super Admin e Staff;
- competições e edições;
- modalidades por edição;
- equipes;
- atletas cadastrados dentro da equipe;
- torneios;
- equipes inscritas no torneio;
- fases, grupos e partidas;
- placar ao vivo;
- eventos de partida;
- classificação;
- área pública para visitantes;
- auditoria básica.

Fora do MVP inicial:

- módulo separado de atletas;
- aprovação/reprovação/suspensão de elenco;
- autoinscrição pública;
- relatórios avançados;
- observabilidade completa com ELK/Loki em produção.

## Stack oficial

A stack técnica definida para o backend e infraestrutura é:

- **Traefik** — proxy reverso, TLS, roteamento e suporte a múltiplas réplicas.
- **NestJS** — API REST e WebSocket Gateway com Socket.IO.
- **PostgreSQL** — banco relacional principal e fonte de verdade.
- **Redis** — pub/sub, cache de estado ao vivo e fila leve com BullMQ.
- **Pino** — logs estruturados em JSON.

Detalhes completos da arquitetura:

- [`docs/STACK.md`](docs/STACK.md)
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)

## Estrutura planejada do repositório

```txt
.
├── apps/
│   └── api/                 # Backend NestJS
├── docs/
│   ├── BACKLOG.md           # Backlog do MVP
│   ├── STACK.md             # Stack e decisões técnicas
│   └── DEVELOPMENT.md       # Fluxo de desenvolvimento
├── infra/
│   └── traefik/             # Configuração do Traefik
├── docker-compose.yml       # Serviços locais
├── .env.example             # Variáveis de ambiente de exemplo
└── README.md
```

## Fluxo de desenvolvimento

Cada tarefa do backlog deve seguir este padrão:

```txt
feature/s1-01-estrutura-inicial
feature/s1-02-login
feature/s1-03-authguard
```

Ao finalizar uma tarefa, abrir um Pull Request vinculando a Issue correspondente.

## Primeira entrega técnica

A primeira entrega é a Issue:

- `S1-01 — Configurar estrutura inicial da PWA`

Essa etapa deve criar a base do projeto, organização das pastas, configuração inicial do backend, containers locais e estrutura mínima para evolução do MVP.
