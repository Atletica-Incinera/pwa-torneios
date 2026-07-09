# Stack oficial — PWA Torneios

Este documento registra a pilha técnica escolhida para o MVP da PWA Torneios.

## Visão geral

A arquitetura escolhida prioriza:

- consistência forte dos dados;
- operação em tempo real para placar ao vivo;
- escalabilidade simples em uma VM;
- possibilidade futura de rodar múltiplas réplicas do backend;
- logs estruturados desde o início;
- separação clara entre API, banco, cache/fila e proxy reverso.

## Pilha escolhida

### Traefik

Responsável por atuar como proxy reverso na frente da aplicação.

Principais responsabilidades:

- roteamento HTTP/HTTPS;
- gerenciamento de TLS;
- roteamento para API e WebSocket;
- suporte a múltiplas réplicas do backend em modo cluster;
- entrada única da aplicação em produção.

### NestJS

Responsável pela API principal do sistema.

Principais responsabilidades:

- API REST para CRUD de competições, edições, modalidades, equipes, atletas, torneios, fases, grupos, partidas e usuários;
- WebSocket Gateway com Socket.IO;
- emissão de eventos em tempo real para partidas ao vivo;
- autenticação e autorização;
- regras de negócio;
- integração com PostgreSQL e Redis.

### PostgreSQL

Banco principal e fonte de verdade do sistema.

Será usado para armazenar:

- usuários;
- perfis e permissões;
- competições;
- edições;
- modalidades;
- equipes;
- atletas;
- torneios;
- equipes inscritas no torneio;
- fases;
- grupos;
- partidas;
- eventos de partida;
- logs de auditoria.

O PostgreSQL foi escolhido por garantir integridade referencial e consistência forte, importantes para auditoria, reconstrução de placar e classificação.

### Redis

O Redis terá três papéis principais.

#### 1. Pub/Sub

Será usado para propagar eventos entre instâncias do backend.

Exemplo:

```txt
Staff registra gol/ponto
→ API salva o evento
→ API publica no Redis
→ Instâncias NestJS recebem o evento
→ WebSocket Gateway envia para espectadores conectados
```

Isso é importante caso o backend rode com mais de uma instância.

#### 2. Cache de estado ao vivo

Será usado para guardar estado temporário de partidas ao vivo.

Exemplos:

- placar atual;
- status da partida;
- cronômetro;
- último evento;
- snapshot da timeline.

Assim o sistema evita consultar o PostgreSQL a cada broadcast de WebSocket.

#### 3. Fila leve com BullMQ

Será usado para tarefas assíncronas.

Exemplos:

- consolidar logs;
- recalcular classificação;
- exportar relatórios;
- processar tarefas em segundo plano.

### Pino

Responsável pelos logs estruturados da aplicação.

Cada requisição, mutação de dados e conexão WebSocket deve gerar logs em JSON com informações como:

- timestamp;
- usuário;
- ação;
- entidade;
- payload relevante;
- status da operação;
- request id.

No MVP, os logs podem ir para disco com rotação. No futuro, podem ser enviados para Grafana Loki sem mudança estrutural na aplicação.

## Fluxo de tempo real

Fluxo base do placar ao vivo:

```txt
Staff opera partida
→ API NestJS valida permissão
→ PostgreSQL registra evento oficial
→ Redis atualiza cache do estado ao vivo
→ Redis publica evento no canal da partida
→ WebSocket Gateway envia evento aos espectadores
→ Tela pública atualiza placar e timeline
```

## Responsabilidades por camada

### API REST

Responsável por operações administrativas e consultas estruturadas.

Exemplos:

- criar equipe;
- adicionar atleta;
- criar torneio;
- inscrever equipe no torneio;
- criar partida;
- consultar classificação.

### WebSocket Gateway

Responsável por atualizações em tempo real.

Exemplos:

- placar alterado;
- evento registrado;
- partida iniciada;
- partida pausada;
- partida encerrada.

### PostgreSQL

Responsável pelo histórico oficial e dados permanentes.

### Redis

Responsável por estado temporário, pub/sub e filas.

### Traefik

Responsável por entrada, TLS e roteamento.

## Decisões importantes

- O PostgreSQL é a fonte oficial da verdade.
- O Redis não substitui o banco principal.
- O placar final deve poder ser reconstruído a partir dos eventos persistidos.
- O WebSocket não deve ser a única fonte de registro de evento.
- Todo evento importante precisa passar pela API e ser persistido.
- Logs estruturados devem existir desde o início.

## Observabilidade

No MVP:

- logs JSON com Pino;
- saída em console ou arquivo;
- rotação simples de logs.

Pós-MVP:

- Grafana Loki;
- dashboards;
- alertas;
- métricas de WebSocket;
- monitoramento de filas.

## Stack resumida

```txt
Traefik
NestJS + REST API + Socket.IO Gateway
PostgreSQL
Redis + Pub/Sub + Cache + BullMQ
Pino Logs
```
