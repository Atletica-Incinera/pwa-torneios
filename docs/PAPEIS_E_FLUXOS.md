# Papéis e fluxos — InterEng

Como o app funciona, camada por camada, do ponto de vista de quem usa. Cada
afirmação aqui corresponde a uma checagem existente no código; o ponto de
aplicação está indicado ao lado.

Vocabulário: **Modalidade** é o esporte (Futsal). **Categoria** é a disputa
dentro dele (Futsal Masculino). Ver [REGRAS_DE_NEGOCIO.md](REGRAS_DE_NEGOCIO.md).

---

## 1. Os quatro perfis

| Perfil | Quem é | Papel no código | Alcance |
| --- | --- | --- | --- |
| Espectador | Público do evento | sem sessão | Só a área pública |
| Gestor de modalidade | Responsável por um esporte | `DISCIPLINE_MANAGER` | A modalidade do seu escopo |
| Admin da edição | Organização do evento | `EDITION_ADMIN` | A edição inteira |
| Super admin | Quem desenvolve o app | `SUPER_ADMIN` | Tudo, mais staff e auditoria |

Os predicados vivem em `app/lib/frontend-session.ts`:

```ts
isSuperAdmin(session)                  // só o desenvolvedor
canManageEdition(session)              // super admin ou organizador
canManageDiscipline(session, esporte)  // o acima, ou gestor cujo escopo é esse esporte
canGrantRole(session, papel)           // conceder "Admin da edição" exige super admin
canReadAudit(session)                  // auditoria: só super admin
```

**A linha que separa os três:** o gestor cria e edita **dentro da sua
modalidade**; o organizador cuida da edição inteira, mas **não distribui poder
de admin nem lê a auditoria**; o super admin é o desenvolvedor e responde por
esses dois últimos.

Não existe papel "somente leitura" autenticado: quem não administra nada usa a
área pública, que não pede login.

---

## 2. Como se entra

**Espectador.** Abre `/public` direto. Nenhuma rota pública passa pelo guarda de
acesso — o app é instalável e funciona offline pelo service worker.

**Staff.** Entra em `/` com e-mail e senha.

- Os três acessos de demonstração estão em `demoUsers`, no subcaminho `/seed` do
  pacote — é a mesma lista que o adaptador local confere e que a API de mentira
  serve. A tela de login mostra dois deles.
- Quem é convidado pelo admin entra com a senha padrão `intereng2026`. O convite
  vive em `state.staff[email]`, criado em *Mais → Staff e permissões → Convidar*.
- O convite exige **um único papel**. Gestor de modalidade obriga escolher a
  modalidade; admin da edição recebe o escopo da edição ativa automaticamente.

**Sem sessão.** `AdminRouteGuard` manda para `/?redirect=<rota>` e devolve à rota
pedida depois do login.

**Acesso revogado.** O admin revoga em *Staff*. Na próxima navegação o guarda
apaga a sessão e leva a `/?access=revoked`, com a mensagem explicando. A
revogação vale imediatamente, inclusive para quem já estava dentro.

---

## 3. Matriz de permissões

| Ação | Espectador | Gestor de modalidade | Admin / Super admin | Onde é aplicado |
| --- | :---: | :---: | :---: | --- |
| Ver placar, tabela, fases e resultados | ✅ | ✅ | ✅ | área pública, sem guarda |
| Operar o placar ao vivo | ❌ | só a sua modalidade | ✅ | `matches/live/page.tsx` |
| Agendar e editar partida | ❌ | só a sua modalidade | ✅ | `MatchCreationForm`, `MatchManager` |
| Configurar categoria (participantes, fases, confrontos) | ❌ | só a sua modalidade | ✅ | `TournamentManager` |
| Consultar regras da modalidade | ❌ | ✅ (a sua) | ✅ | `DisciplineManager` |
| Editar regras da modalidade | ❌ | só a sua modalidade | ✅ | `DisciplineManager` |
| Habilitar ou remover modalidade da edição | ❌ | ❌ | ✅ | `DisciplineManager` |
| Criar categoria | ❌ | só na sua modalidade | ✅ | `CategoryCreationForm` |
| Alocar atleta já cadastrado à modalidade | ❌ | só a sua modalidade | ✅ | `TeamRosterManager` |
| Criar equipe ou atleta | ❌ | ❌ | ✅ | `AdminRouteGuard` |
| Editar equipe, arquivar, renomear atleta | ❌ | ❌ | ✅ | `TeamManager`, `AthleteManager` |
| Lançar e estornar pontos do ranking geral | ❌ | ❌ (só vê) | ✅ | `OverallStandings` |
| Fechar o ranking geral | ❌ | ❌ | ✅ | `OverallStandings` |
| Competições, edições, staff, consulta global de atletas | ❌ | ❌ | ✅ | `AdminRouteGuard` |
| Convidar **gestor de modalidade** | ❌ | ❌ | ✅ | `canGrantRole` |
| Convidar ou promover **Admin da edição** | ❌ | ❌ | só super admin | `canGrantRole` |
| Ver a auditoria | ❌ | ❌ | só super admin | `canReadAudit` |

**Rotas bloqueadas para gestor de modalidade** (`AdminRouteGuard`):
`/competitions`, `/disciplines/new`, `/staff`, `/audit`, `/athletes`,
`/teams/new`, `/tournaments/new` e `/teams/{id}/athletes/new`. Ele recebe a tela
*Acesso restrito* com um botão que leva à sua modalidade.

O **hub de Modalidades** (`/disciplines`) é aberto aos dois papéis, mas filtrado:
o gestor vê apenas a modalidade do seu escopo, sem o botão de adicionar.

---

## 4. Fluxos por perfil

### 4.1 Espectador

```
Ao vivo · Modalidades · Equipes
```

1. **Ao vivo** (`/public`) — o que está acontecendo agora, em todas as
   modalidades. Não filtra por esporte de propósito.
2. **Modalidades** (`/public/tournaments`) — categorias publicadas, com atalho
   para a classificação geral. Rascunho e arquivado não aparecem.
3. **Categoria** — abas *Agenda · Tabela · Resultados · Fases*.
4. **Equipes** (`/public/teams`) — elenco e desempenho por modalidade.

Só vê disputa publicada e resultado oficial (`Encerrada` ou `W.O.`). Nenhum
controle administrativo é renderizado, nem escondido por CSS.

### 4.2 Gestor de modalidade

Entra e cai no dashboard. A barra inferior é a mesma, mas *Mais* mostra apenas
um atalho: **operar minha modalidade**.

**Rotina de dia de jogo:**

1. **Jogos** → seleciona a modalidade (a dele já vem escolhida).
2. Abre a partida → **Abrir placar**.
3. **Confirma o início.** Abrir a tela não inicia o jogo. Fora da janela
   prevista, o app avisa do desvio e grava sozinho na auditoria.
4. Registra pontos e eventos declarados no regulamento da modalidade.
5. **Encerra.** Se for eliminatória empatada, precisa registrar o desempate
   antes — critério, placar, equipe classificada e motivo.

**Trava de operador.** Quem abre o placar assume a operação por 2 minutos,
renovada automaticamente. Outro dispositivo vê quem está operando e pode
**assumir** com confirmação, ou o titular pode **liberar**.

**Também pode:** pela aba **Modalidades** chega à sua modalidade, às categorias
dela e à aba *Regras*. Agenda jogo, edita partida, configura participantes,
fases e confrontos, ajusta o regulamento da modalidade e associa atletas às
modalidades do seu escopo.

**Sobre atletas:** ele **aloca** na sua modalidade os atletas **já cadastrados
na equipe** pelo organizador. Não cadastra atleta novo nem edita o cadastro base.

**Não pode:** criar equipe, cadastrar atleta, criar modalidade, habilitar ou
remover modalidade da edição, mexer no ranking geral, ver auditoria nem staff.

### 4.3 Admin da edição

Tudo do gestor, sem restrição de modalidade, mais a montagem da competição.

**Ordem de montagem:**

1. **Competições** — cria a edição, define o período e ativa. O período é o que
   valida a agenda depois.
2. **Modalidades** — habilita o esporte e ajusta o regulamento: pontuação por
   ação, condição de encerramento, elenco, tabela, desempate e W.O.
3. **Categoria** — cria dentro da modalidade; nasce em **rascunho**.
4. **Aba Regras da categoria** — inscreve participantes, define seeds, fases e
   grupos, escolhe o critério de avanço e **gera os confrontos**.
5. **Publica** — a categoria passa a aparecer para o espectador.
6. **Equipes e atletas** — cadastra, associa às modalidades, remove quem saiu.
7. Durante a competição, opera ou acompanha.
8. **Ranking geral** — lança pontos automáticos do pódio das disputas
   encerradas, complementa manualmente, e **fecha** quando estiver homologado.

**Publicação da categoria:** `Rascunho → Publicado → Em andamento → Encerrado →
Arquivado`. Não volta para trás. Começar bloqueia participantes, seeds e fases.

### 4.4 Super admin — quem desenvolve o app

Tudo do organizador, mais as duas responsabilidades que não são dele:

1. **Conceder acesso de Admin da edição.** No convite, o papel *Admin da edição*
   só aparece para o super admin; o organizador vê apenas *Gestor de modalidade*.
   Promover alguém a admin depois, na tela de staff, segue a mesma trava — e o
   cartão de um admin fica sem botões para quem não pode mexer nele.
2. **Ler a auditoria.** `/audit` é exclusiva. É onde se confere quem mudou
   resultado, quem estornou ponto e com que motivo.

Criar torneio e edição continua sendo do organizador: é operação do evento, não
do app.

---

## 5. Onde a permissão é aplicada

Três camadas, com propósitos diferentes:

1. **Rota** — `AdminRouteGuard` decide se a tela abre. Cobre sessão ausente,
   acesso revogado e rota de admin acessada por gestor.
2. **Tela** — o componente decide o que renderizar. Ex.: `OverallStandings`
   mostra a classificação para todos e os formulários só para o admin.
3. **Ação** — a função verifica de novo antes de gravar. Ex.: `MatchManager`
   confere `canManageDiscipline` antes de salvar, mesmo com o formulário na tela.

A terceira camada existe porque as duas primeiras são de interface. Enquanto o
backend não entra, **nenhuma delas é garantia de segurança** — quem manipular o
`localStorage` contorna todas. É validação de fluxo, não de servidor.

---

## 6. O que fica registrado

Toda ação sensível grava em `state.audit`: quem fez, o quê, o valor anterior, o
posterior e o motivo nas exceções. A tela `/audit` (só admin) mostra isso e
**nunca exibe registro de exemplo** — vazia significa vazia.

Exigem motivo digitado: retificação de resultado, anulação de confrontos com
resultado, estorno de bonificação e alteração no ranking já fechado. O resto o
app deduz e registra sozinho.

---

## 7. Pontos em aberto

- **As regras rodam no cliente.** Conflito de agenda, permissão e consistência
  entre dispositivos só ficam garantidos quando o backend assumir as mesmas
  validações. Foi para isso que os módulos de regra saíram do front, sem
  dependência de React, e viraram
  `@atletica-incinera/intereng-contract`: assumir, para a API, é importar
  aquele pacote — não reescrever o que ele já faz. Os predicados de papel
  citados lá em cima continuam em `app/lib/frontend-session.ts`, e continuam
  certos onde estão, porque são guarda de navegação e não segurança; quem
  revalida é o servidor.
- **Notificações push** dependem de serviço conectado. A preferência já é
  coletada em `/profile`, mas nada dispara envio.
