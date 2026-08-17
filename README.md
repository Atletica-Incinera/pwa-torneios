# PWA Torneios — InterEng

Sistema PWA para gestão de torneios independentes, cadastro de equipes e atletas, organização de partidas, operação de placar ao vivo e visualização pública de jogos e classificações.

## Status do projeto

Todos os critérios de MVP estão atendidos **em modo `local`**, com o estado no
navegador. O que falta é rede: o front já lê e escreve na API REST, e a
integração ponta a ponta está bloqueada pela ausência de banco. Onde exatamente,
e de quem depende cada pendência, está em
[`docs/ESTADO_DO_PROJETO.md`](docs/ESTADO_DO_PROJETO.md) — é lá que os números
vivem, e não aqui, para não haver duas contagens discordando.

Backlog oficial:

- [`docs/BACKLOG.md`](docs/BACKLOG.md)

Branch de trabalho: `integracao-modulos`.

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

O resto da documentação está na tabela mais abaixo.

## Estrutura do repositório

Este repositório é um **workspace npm**: um `package.json` e um lockfile na
raiz, dois membros declarados em `workspaces`, e `npm install` na raiz
resolvendo os dois de uma vez. O `packages/` não é uma pasta de conveniência —
é onde vivem as regras do torneio, publicadas como artefato versionado e
testadas contra o `dist`, e essa é a razão de o repositório ser um workspace em
vez de só uma aplicação.

```txt
pwa_torneios/
├── pwa-torneios/                    # este repositório, o workspace
│   ├── apps/
│   │   └── web/                     # a PWA em Next.js
│   ├── packages/
│   │   └── intereng-contract/       # @atletica-incinera/intereng-contract:
│   │                                # tipos da edição, as 32 ações e as regras
│   │                                # puras. Publicado daqui, consumido pelo front
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
| [`CONTRATO_API.md`](docs/CONTRATO_API.md) | O que a API REST oferece e como o modo `http` a consome |
| [`TASKS_API.md`](docs/TASKS_API.md) | O que ainda se pede à API, e o que morreu com a virada de arquitetura |
| [`INTEGRACAO_API.md`](docs/INTEGRACAO_API.md) | O levantamento do estado da API e o custo de cada caminho |

## Fluxo de desenvolvimento

Cada tarefa do backlog deve seguir este padrão:

```txt
feature/s1-01-estrutura-inicial
feature/s1-02-login
feature/s1-03-authguard
```

Ao finalizar uma tarefa, abrir um Pull Request vinculando a Issue correspondente.
