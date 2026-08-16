# PWA Torneios — InterEng

Sistema PWA para gestão de torneios independentes, cadastro de equipes e atletas, organização de partidas, operação de placar ao vivo e visualização pública de jogos e classificações.

## Status do projeto

Projeto em fase inicial de estruturação do MVP.

Backlog oficial:

- [`docs/BACKLOG.md`](docs/BACKLOG.md)

Branch inicial de trabalho:

- `feature/s1-01-estrutura-inicial`

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
- **NestJS** — API REST e stream SSE, em repositório próprio (`Atletica-Incinera/intereng-api`).
- **PostgreSQL** — banco relacional principal e fonte de verdade.
- **Redis** — pub/sub, cache de estado ao vivo e fila leve com BullMQ.
- **Pino** — logs estruturados em JSON.

Onde o projeto está agora, o que falta e de quem depende cada pendência:
[`docs/ESTADO_DO_PROJETO.md`](docs/ESTADO_DO_PROJETO.md). O resto da
documentação está na tabela mais abaixo.

## Estrutura do repositório

Este repositório é um **workspace npm**: um `package.json` e um lockfile na
raiz, dois membros declarados em `workspaces`, e `npm install` na raiz
resolvendo os dois de uma vez. O `packages/` não é uma pasta de conveniência —
é onde vive o artefato que a API instala, e essa é a razão de o repositório ser
um workspace em vez de só uma aplicação.

```txt
pwa_torneios/
├── pwa-torneios/                    # este repositório, o workspace
│   ├── apps/
│   │   └── web/                     # a PWA em Next.js
│   ├── packages/
│   │   └── intereng-contract/       # @atletica-incinera/intereng-contract:
│   │                                # tipos da edição, as 32 ações e as regras
│   │                                # puras. Publicado daqui, instalado pela API
│   ├── docs/                        # ver a tabela abaixo
│   ├── package.json                 # workspaces e lockfile único
│   ├── docker-compose.yml           # Infra + app
│   ├── docker-compose.api.yml       # API a partir do código-fonte
│   ├── docker-compose.ghcr.yml      # API a partir da imagem publicada
│   ├── docker-compose.host-api.yml  # API rodando fora do Docker
│   ├── .env.example
│   └── README.md
└── intereng-api/                    # Atletica-Incinera/intereng-api, AO LADO
```

A API é um repositório separado e o checkout dela fica **ao lado** deste, nunca
dentro — o porquê está em [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Os documentos

| Documento | O que responde |
| --- | --- |
| [`ESTADO_DO_PROJETO.md`](docs/ESTADO_DO_PROJETO.md) | Onde o projeto está, o que falta e de quem depende cada pendência |
| [`BACKLOG.md`](docs/BACKLOG.md) | O backlog do MVP e os critérios de aceite |
| [`STACK.md`](docs/STACK.md) | A stack e as decisões técnicas |
| [`DEVELOPMENT.md`](docs/DEVELOPMENT.md) | Fluxo de trabalho, o pacote de contrato e por que os dois repositórios não se aninham |
| [`REGRAS_DE_NEGOCIO.md`](docs/REGRAS_DE_NEGOCIO.md) | As regras do torneio e, principalmente, os padrões escolhidos |
| [`PAPEIS_E_FLUXOS.md`](docs/PAPEIS_E_FLUXOS.md) | Os quatro papéis, o que cada um alcança e os fluxos de tela |
| [`VISUAL_IMPLEMENTATION_SPEC.md`](docs/VISUAL_IMPLEMENTATION_SPEC.md) | A especificação visual da interface |
| [`CONTRATO_API.md`](docs/CONTRATO_API.md) | O que a API precisa oferecer para o modo `http` funcionar |
| [`TASKS_API.md`](docs/TASKS_API.md) | As 12 tasks escritas para colar no repositório da API |
| [`INTEGRACAO_API.md`](docs/INTEGRACAO_API.md) | O levantamento do estado da API e o custo de cada caminho |

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
