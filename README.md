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
