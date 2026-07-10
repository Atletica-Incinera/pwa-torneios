# Especificação visual implementável — PWA Torneios

Este documento transforma a referência visual aprovada em regras objetivas de implementação. A imagem aprovada deve ser tratada como a fonte de verdade visual do produto.

## 1. Direção visual oficial

**Nome da linguagem visual:** Brutalismo esportivo assimétrico.

A interface deve transmitir competição, velocidade, operação ao vivo e identidade de campeonato.

### Regras inegociáveis

- Fundo global preto absoluto `#000000`.
- O app não deve usar dark mode cinza suave como fundo principal.
- Formas assimétricas, recortes diagonais e painéis inclinados devem aparecer nos elementos de destaque.
- A assimetria deve ser consistente e baseada em regras, não aleatória.
- O placar ao vivo deve ser a tela mais expressiva do produto.
- O app não deve parecer um dashboard SaaS genérico.
- Títulos usam Boldonse.
- Interface, formulários, placar, cronômetro e textos usam Host Grotesk.

---

## 2. Paleta oficial

```css
:root {
  --color-black: #000000;
  --color-surface-1: #080808;
  --color-surface-2: #111114;
  --color-surface-3: #191923;

  --color-off-white: #FBFEF9;
  --color-blue: #0E79B2;
  --color-magenta: #BF1363;
  --color-orange: #F39237;

  --color-text-primary: #FBFEF9;
  --color-text-secondary: rgba(251, 254, 249, 0.68);
  --color-text-muted: rgba(251, 254, 249, 0.44);

  --color-border-soft: rgba(251, 254, 249, 0.12);
  --color-border-medium: rgba(251, 254, 249, 0.24);
  --color-border-strong: rgba(251, 254, 249, 0.42);
}
```

### Uso das cores

- **Preto `#000000`:** fundo global.
- **Off-white `#FBFEF9`:** texto principal, números, ícones de alto contraste.
- **Azul `#0E79B2`:** ações primárias, Equipe A, seleção ativa, links e informação.
- **Magenta `#BF1363`:** Equipe B, competição, destaques e eventos fortes.
- **Laranja `#F39237`:** ao vivo, cronômetro, alertas, gols/pontos recentes e atenção.
- **`#191923`:** cards, modais, dropdowns e superfícies internas.

### Regra de predominância

Cada tela deve escolher uma cor de destaque predominante. Azul, magenta e laranja não devem competir igualmente em todas as áreas.

---

## 3. Tipografia

### Boldonse

Usar em:

- títulos de página;
- nome de campeonato;
- chamadas da landing;
- títulos do placar;
- nomes de seções principais;
- números promocionais.

Não usar em:

- parágrafos;
- labels;
- campos;
- tabelas;
- textos pequenos.

### Host Grotesk

Usar em:

- interface;
- formulários;
- menus;
- botões;
- placar;
- cronômetro;
- classificação;
- descrições;
- mensagens de sistema.

### Escala tipográfica

```css
:root {
  --font-display-xl: 56px;
  --font-display-lg: 40px;
  --font-title-lg: 32px;
  --font-title-md: 24px;
  --font-title-sm: 20px;
  --font-body-lg: 18px;
  --font-body-md: 16px;
  --font-body-sm: 14px;
  --font-caption: 12px;
  --font-score-xl: 96px;
  --font-score-lg: 72px;
  --font-timer-lg: 32px;
}
```

### Pesos Host Grotesk

- 400: texto comum.
- 500: apoio e metadados.
- 600: labels e botões.
- 700: títulos de card.
- 800: placar, cronômetro e números fortes.

---

## 4. Grid e responsividade

### Breakpoints

```css
--breakpoint-sm: 360px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1440px;
```

### Mobile

- largura mínima suportada: 320 px;
- padding lateral padrão: 16 px;
- gap padrão: 12 px;
- cards em uma coluna;
- tabelas viram cards;
- ações secundárias viram bottom sheet;
- bottom navigation fixa.

### Tablet

- grid de 2 colunas;
- padding lateral: 24 px;
- cards principais podem ocupar 2 colunas.

### Desktop

- largura máxima do conteúdo: 1440 px;
- grid de 12 colunas;
- padding lateral: 32 a 48 px;
- sidebar pode substituir bottom navigation.

---

## 5. Espaçamento

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-7: 32px;
  --space-8: 40px;
  --space-9: 48px;
  --space-10: 64px;
}
```

### Regras

- Card: 16 a 24 px de padding.
- Seções: 24 a 32 px de distância.
- Título e subtítulo: 8 px.
- Campo e mensagem auxiliar: 6 a 8 px.
- Botões agrupados: 8 a 12 px.

---

## 6. Famílias de formas

Todo componente irregular deve usar uma das famílias abaixo.

### Shape A — canto recortado

Uso:

- inputs;
- botões;
- cards comuns;
- filtros;
- modais.

```css
.shape-cut {
  clip-path: polygon(
    0 0,
    calc(100% - 18px) 0,
    100% 18px,
    100% 100%,
    18px 100%,
    0 calc(100% - 18px)
  );
}
```

### Shape B — painel inclinado

Uso:

- placar;
- Team A / Team B;
- hero;
- cards ao vivo;
- banners.

```css
.shape-slanted-right {
  clip-path: polygon(0 0, 88% 0, 100% 100%, 12% 100%);
}

.shape-slanted-left {
  clip-path: polygon(12% 0, 100% 0, 88% 100%, 0 100%);
}
```

### Shape C — moldura irregular

Uso:

- avatar;
- escudo;
- modalidade;
- posição de ranking;
- medalha.

```css
.shape-frame {
  clip-path: polygon(14% 0, 100% 0, 90% 78%, 68% 100%, 0 88%, 0 18%);
}
```

### Regra

Formulários longos devem manter alinhamento previsível. A irregularidade deve aparecer na borda, não na posição do conteúdo.

---

## 7. Bordas, sombras e profundidade

```css
:root {
  --border-1: 1px solid rgba(251, 254, 249, 0.12);
  --border-2: 1px solid rgba(251, 254, 249, 0.24);
  --shadow-card: 0 14px 36px rgba(0, 0, 0, 0.45);
  --shadow-accent-blue: 6px 6px 0 rgba(14, 121, 178, 0.55);
  --shadow-accent-magenta: 6px 6px 0 rgba(191, 19, 99, 0.55);
  --shadow-accent-orange: 6px 6px 0 rgba(243, 146, 55, 0.55);
}
```

Evitar glow excessivo. Usar sombra dura e deslocada para reforçar a identidade brutalista.

---

## 8. Ícones

### Biblioteca principal

Usar **Hugeicons** como base.

### Estilo

- stroke consistente;
- 20 px em inputs;
- 24 px na navegação;
- 28 a 32 px em ações esportivas;
- versão preenchida no item ativo;
- não misturar várias bibliotecas na mesma tela.

### Ícones próprios

Criar SVGs próprios para:

- futsal;
- futebol;
- basquete;
- vôlei;
- handebol;
- apito;
- cronômetro;
- placar;
- gol;
- ponto;
- falta;
- cartão;
- substituição;
- mata-mata;
- grupo;
- fase;
- troféu;
- equipe;
- atleta.

---

## 9. Componentes base

### Button

Altura mínima: 48 px.

Variantes:

- primary: azul;
- secondary: `#191923`;
- magenta;
- orange;
- danger;
- ghost;
- icon-only.

Estados:

- default;
- hover;
- pressed;
- focus-visible;
- disabled;
- loading.

### Input

- altura: 52 px;
- fundo: `#080808`;
- borda: `#191923`;
- canto recortado;
- label acima;
- foco azul;
- erro magenta;
- ícone opcional.

### Card

Variantes:

- cut-corner;
- slanted-edge;
- accent-strip;
- displaced-border;
- live;
- statistic;
- team;
- match.

### Badge

- status;
- live;
- role;
- tournament;
- discipline;
- ranking.

### Bottom Sheet

- fundo `#111114`;
- topo diagonal ou recortado;
- alça simples;
- conteúdo com padding de 24 px;
- ações fixas no rodapé quando necessário.

---

## 10. Layout privado

```txt
PrivateLayout
├── ContextHeader
├── PageContainer
│   ├── PageHeader
│   └── PageContent
└── BottomNavigation
```

### ContextHeader

Deve mostrar:

- competição;
- edição;
- modalidade ou torneio atual;
- acesso ao seletor de contexto.

### BottomNavigation

Itens:

- Início;
- Equipes;
- Torneios;
- Jogos;
- Perfil/Mais.

Item ativo:

- ícone preenchido;
- bloco irregular;
- cor predominante da seção;
- texto em Host Grotesk 600.

---

## 11. Tela de Login

### Estrutura

- fundo preto absoluto;
- marca/título no topo;
- painel de formulário recortado;
- e-mail;
- senha;
- botão primário;
- link de acesso público;
- detalhes geométricos magenta e laranja.

### Medidas mobile

- padding lateral: 20 px;
- título: 40 a 48 px;
- formulário: largura total;
- gap entre campos: 16 px;
- botão: 52 px de altura.

---

## 12. Dashboard

### Grid mobile

- 2 colunas para cards pequenos;
- 1 coluna para cards largos;
- cards com alturas diferentes;
- próximos jogos ocupam largura total.

### Cards

- Equipes: azul;
- Atletas: magenta;
- Torneios: laranja;
- Jogos ao vivo: azul ou laranja;
- alertas: magenta;
- próximos jogos: fundo preto com borda e faixa inclinada.

---

## 13. Equipes

### TeamCard

Conteúdo:

- escudo em moldura irregular;
- nome;
- quantidade de atletas;
- modalidade;
- badge;
- ação de abrir.

Medidas mobile:

- altura mínima: 88 px;
- escudo: 56 px;
- padding: 14 a 16 px;
- gap: 12 px.

### TeamDetails

- hero do time;
- escudo grande;
- nome em Boldonse;
- estatísticas;
- lista de atletas;
- próximos jogos;
- torneios inscritos.

---

## 14. Torneios

### TournamentCard

Deve parecer um cartaz esportivo.

Conteúdo:

- nome do torneio;
- modalidade;
- status;
- equipes inscritas;
- fase atual;
- progresso;
- número da edição como elemento gráfico.

Formato:

- card largo;
- fundo preto;
- bloco parcial colorido;
- recorte diagonal;
- sombra deslocada.

---

## 15. Partidas

### MatchCard

Conteúdo:

- status;
- equipes;
- escudos;
- placar;
- horário;
- local;
- fase/grupo.

### Estados

- agendada: off-white e azul;
- ao vivo: laranja e pulso discreto;
- pausada: laranja escuro;
- encerrada: superfície neutra;
- cancelada: magenta reduzido;
- W.O.: magenta com label forte.

---

## 16. Placar ao vivo

Essa é a tela mais importante do produto.

### Estrutura

```txt
Header
├── Campeonato / fase
├── Status AO VIVO
└── Conexão

Scoreboard
├── Team A panel
├── Score
├── Team B panel
└── Timer

Quick actions
├── Gol
├── Ponto
├── Falta
└── Cartão

Timeline
└── Eventos da partida
```

### Team A

- azul;
- alinhamento à esquerda;
- painel inclinado para a direita.

### Team B

- magenta;
- alinhamento à direita;
- painel inclinado para a esquerda.

### Placar

- Host Grotesk 800;
- 72 a 96 px;
- alto contraste;
- animação de escala em atualização.

### Cronômetro

- laranja;
- Host Grotesk 700;
- 28 a 36 px;
- formato irregular próprio.

### Botões rápidos

- altura mínima: 64 px;
- ícone grande;
- texto em caixa alta;
- formato irregular;
- feedback de pressão forte.

### Timeline

Cada evento deve mostrar:

- minuto;
- tipo;
- equipe;
- atleta;
- ícone;
- cor do evento.

---

## 17. Classificação

### Desktop

- tabela escura;
- linhas finas;
- posição em bloco irregular;
- pontos destacados.

### Mobile

- cards empilhados;
- posição na lateral;
- nome da equipe;
- pontos;
- resumo J/V/E/D/SG.

Destaques:

- 1º: laranja;
- 2º: azul;
- 3º: magenta.

---

## 18. Perfil

O avatar não deve ser circular por padrão.

Usar:

- moldura irregular;
- segunda borda deslocada;
- badge sobreposto;
- nome em Boldonse;
- perfil em Host Grotesk.

---

## 19. Área pública

A área pública compartilha o mesmo Design System, mas com menos densidade operacional.

Prioridades:

- jogos ao vivo;
- jogos de hoje;
- resultados;
- classificação;
- detalhe da partida.

A landing deve usar hero assimétrico com título grande em Boldonse e card flutuante de partida.

---

## 20. Estados globais

Toda tela deve prever:

- loading;
- skeleton;
- vazio;
- erro;
- sem permissão;
- offline;
- sucesso;
- confirmação.

### Offline

Mostrar banner persistente com:

- status da conexão;
- última sincronização;
- tentativa de reconexão.

---

## 21. Interações e animações

```css
:root {
  --motion-fast: 140ms;
  --motion-normal: 220ms;
  --motion-screen: 300ms;
  --motion-score: 420ms;
}
```

Usar:

- entrada lateral;
- linhas que se expandem;
- pequenos deslocamentos;
- pulso no ao vivo;
- flash rápido em gol/ponto;
- escala no placar;
- transição de cor na equipe marcada.

Evitar:

- bounce exagerado;
- rotação decorativa;
- glow permanente;
- animação que atrapalhe operação.

---

## 22. Acessibilidade

- contraste mínimo AA;
- área de toque mínima: 44 x 44 px;
- botões principais: mínimo 48 px de altura;
- foco visível;
- não depender apenas de cor;
- cronômetro e placar com leitura imediata;
- labels persistentes nos campos;
- suporte a redução de movimento.

---

## 23. Estrutura sugerida no front-end

```txt
src/
├── app/
├── components/
│   ├── base/
│   ├── feedback/
│   ├── navigation/
│   ├── forms/
│   └── layout/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── teams/
│   ├── tournaments/
│   ├── matches/
│   ├── live-score/
│   ├── standings/
│   └── public/
├── icons/
│   ├── hugeicons/
│   └── sports/
├── styles/
│   ├── tokens.css
│   ├── typography.css
│   ├── shapes.css
│   ├── motion.css
│   └── globals.css
└── assets/
```

---

## 24. Ordem de implementação visual

1. Tokens.
2. Tipografia.
3. Formas.
4. Botões, inputs, badges e cards.
5. Layout privado e navegação.
6. Login.
7. Dashboard.
8. Equipes.
9. Partidas.
10. Placar ao vivo.
11. Torneios.
12. Classificação.
13. Área pública.
14. Perfil e auditoria.

---

## 25. Checklist de fidelidade visual

Antes de aprovar uma tela, verificar:

- O fundo é preto absoluto?
- Boldonse está restrita aos títulos?
- Host Grotesk está na interface?
- A tela tem uma cor predominante?
- Os componentes de destaque usam recortes ou inclinações?
- A assimetria mantém legibilidade?
- Os botões têm área de toque adequada?
- A tela parece esportiva e não corporativa genérica?
- Os ícones seguem a mesma linguagem?
- O mobile foi tratado como versão principal?
- A tela se parece com a referência visual aprovada?

Essa especificação deve orientar Figma, implementação front-end, revisão visual e QA do produto.