# Backlog Completo — PWA InterEng

Este documento cataloga o backlog do MVP da PWA InterEng, organizado em 5 sprints. O FigJam deve ficar como visão visual do produto; este arquivo e as Issues do GitHub devem ser a fonte oficial de execução.

## Como usar

- Cada item `Sx-xx` deve existir como uma Issue no GitHub.
- Use as Issues para acompanhar descrição, critérios de aceite e progresso.
- Use um GitHub Project para organizar as colunas: Backlog, Sprint atual, Em desenvolvimento, Em revisão e Concluído.
- As labels sugeridas aparecem em cada Issue como referência: sprint, tipo e prioridade.

## Labels sugeridas

### Sprint
- `sprint-1`
- `sprint-2`
- `sprint-3`
- `sprint-4`
- `sprint-5`

### Tipo
- `tipo:tela`
- `tipo:formulario`
- `tipo:tecnica`
- `tipo:regra`
- `tipo:componente`
- `tipo:funcionalidade`
- `tipo:integracao`
- `tipo:qa`
- `tipo:publico`

### Prioridade
- `prioridade:alta`
- `prioridade:media`
- `prioridade:baixa`

---

## Sprint 1 — Fundação, acesso e contexto

Objetivo: criar a base funcional da PWA, autenticação, rotas protegidas, layout principal, contexto de competição/edição e dashboard inicial.

- S1-01 — Configurar estrutura inicial da PWA
- S1-02 — Criar tela de Login
- S1-03 — Criar controle de autenticação
- S1-04 — Identificar perfil do usuário
- S1-05 — Criar AppShell privado
- S1-06 — Criar seleção de competição
- S1-07 — Criar seleção de edição
- S1-08 — Criar Dashboard inicial
- S1-09 — Criar estados globais de tela

---

## Sprint 2 — Administração e configuração

Objetivo: permitir configurar a base da competição: Staff, competições, edições, modalidades e regras da modalidade.

- S2-01 — Criar tela de Gestão de Staff
- S2-02 — Criar formulário de Staff
- S2-03 — Criar tela de Competições
- S2-04 — Criar tela de Edições
- S2-05 — Criar tela de Modalidades da edição
- S2-06 — Criar configuração da modalidade
- S2-07 — Iniciar auditoria básica

---

## Sprint 3 — Equipes e atletas dentro da equipe

Objetivo: criar o fluxo simplificado de equipes e atletas, sem módulo separado de elenco.

- S3-01 — Criar tela de Equipes
- S3-02 — Criar formulário de equipe
- S3-03 — Criar detalhe da equipe
- S3-04 — Criar cadastro de atleta dentro da equipe
- S3-05 — Remover atleta da equipe
- S3-06 — Atualizar dashboard com dados reais de equipe

---

## Sprint 4 — Torneios e estrutura competitiva

Objetivo: permitir criar torneios, inscrever equipes, organizar fases, grupos e partidas.

- S4-01 — Criar tela de Torneios
- S4-02 — Criar formulário de torneio
- S4-03 — Criar tela de equipes inscritas no torneio
- S4-04 — Criar tela de Fases
- S4-05 — Criar tela de Grupos
- S4-06 — Criar tela de Partidas
- S4-07 — Criar formulário/detalhe de partida

---

## Sprint 5 — Placar ao vivo, público, classificação e auditoria

Objetivo: finalizar o MVP com operação de partidas, placar ao vivo, classificação, área pública e auditoria.

- S5-01 — Criar tela de Placar ao vivo
- S5-02 — Registrar eventos da partida
- S5-03 — Criar fluxo de status da partida
- S5-04 — Criar encerramento de partida
- S5-05 — Criar classificação administrativa
- S5-06 — Criar Landing pública
- S5-07 — Criar jogos públicos
- S5-08 — Criar detalhe público do jogo
- S5-09 — Criar classificação pública
- S5-10 — Criar tela de Auditoria
- S5-11 — Finalizar Configurações/Mais
- S5-12 — Revisão geral mobile-first

---

## Critério geral para considerar o MVP pronto

O MVP estará pronto quando:

- Super Admin consegue gerenciar Staff.
- Staff consegue operar a competição.
- Competições e edições funcionam.
- Modalidades são habilitadas por edição.
- Equipes são cadastradas.
- Atletas são cadastrados dentro das equipes.
- Torneios são criados.
- Equipes são inscritas nos torneios.
- Fases, grupos e partidas são criadas.
- Placar ao vivo funciona.
- Partidas encerradas alimentam classificação.
- Área pública mostra jogos e classificação.
- Ações sensíveis são auditadas.
- A PWA funciona bem no mobile.
