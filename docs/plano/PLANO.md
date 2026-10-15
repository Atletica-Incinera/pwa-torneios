# Plano de produto e UX — Copa Halterada

Outubro de 2026, depois da primeira edição da Copa Halterada (09 a 12/10).
Base: front `front-end` @ `23aa938` e API `main` @ `53ad276` — o código que estava no ar.

Este documento diz o que o evento mostrou, por que aconteceu, como o app deve ficar e em que ordem chegar lá.
O detalhe de cada entrega está em [INICIATIVAS.md](INICIATIVAS.md); a evidência de cada problema, com `arquivo:linha`, está em [ACHADOS.md](ACHADOS.md).

---

## 1. Como foi feito

1. **Dados reais do evento.** Os 96 jogos, os 2.689 lances, as 11 categorias e o staff de produção, lidos pelo MCP de consulta do projeto, um dia depois do fim.
2. **Todas as telas capturadas.** 85 capturas do build de produção (celular e desktop), por perfil: espectador, gestor de modalidade, admin da edição e super admin, com métricas de cada tela (alvos de toque, texto pequeno, contraste, rolagem).
3. **Varredura do código.** 23 leitores, cada um numa área — 16 de código (front e API), 5 jornadas de usuário e 2 auditorias visuais. Cada área passou por um revisor cético que tentou refutar cada achado abrindo o código. Resultado: **408 achados** (42 críticos, 184 altos), 138 ideias de feature.
4. **Desenho.** 12 trilhas transformaram os achados em **111 iniciativas**. Um crítico conferiu, por script, que todos os 226 achados críticos e altos estão cobertos por alguma iniciativa (estão) e apontou onde duas trilhas faziam a mesma coisa.
5. **Ordem.** Três roteiros com lentes diferentes (operação primeiro, precisão primeiro, fatias finas) foram julgados por três juízes (viabilidade técnica, valor no dia do evento, risco). Os três escolheram o mesmo — **precisão primeiro** — e apontaram correções, que estão aplicadas na seção 5.

**Limites que valem para tudo abaixo.**
- Os revisores não refutaram nenhum achado: corrigiram 60 em parte e acrescentaram 89. Houve leitura crítica, mas severidade, esforço e dias são **estimativas**, não medidas.
- As capturas usam os dados de demonstração do modo local, não os da Copa.
- Os dados de produção mostram *o que* aconteceu, não *por quê*. Onde a explicação é interpretação, o texto diz.
- As cinco afirmações da seção 3 que sustentam a onda 0 (tabela, relógio, login do responsável, chaveamento, placar só por lance) foram conferidas de novo no código, à parte da varredura.

---

## 2. O que o evento mostrou

| | |
|---|---|
| Jogos | 96 — **55 encerrados, 40 ainda "Agendada" com data passada, 1 "Ao vivo" desde 12/10** |
| Por modalidade | Handebol 24 de 24 encerrados · Vôlei 24 de 28 · Futsal 7 de 27 · **Basquete 0 de 17** |
| Como o placar entrou | **Cerca de 70% digitado depois do jogo, lance a lance**: jogos de vôlei com 70 a 99 pontos lançados em 2 a 5 minutos, em lotes de 5 a 7 jogos seguidos |
| W.O. | **7 jogos de handebol lançados como 10 gols clicados**; o status W.O. foi usado 0 vezes |
| Agenda | Início real a **104 min** do previsto (mediana); **89 de 96 jogos com local "A definir"**; 52 dos 94 jogos da planilha só tinham "A SEGUIR" e ganharam horário inventado pelo importador |
| Tabela | **A classificação oficial do Vôlei contou 3 dos 23 jogos de grupo encerrados**; a Inquisidores, com 5 vitórias em 5, não aparece na tabela feminina, e as semifinais foram montadas a partir dela |
| Dado inconsistente | 3 confrontos de vôlei registrados duas vezes (um com vencedores opostos); 3 jogos de vôlei com set ou parcial impossível; grupo "grupo c" ao lado de "Grupo A" |
| Elencos | **17 equipes, 0 atletas, 0 responsáveis de atlética** — artilharia, autor do lance, elegibilidade e trava de elenco não existiram |
| Ciclo de vida | Categorias com jogos encerrados ainda "Publicado"; edição ainda "Em andamento" |

**Leitura.** O app funcionou como **registro posterior**, não como mesa ao vivo — e mesmo como registro custou caro: cada set de vôlei exige um toque por ponto, na ordem certa. Onde o app falhou de vez (basquete, futsal no último dia), a explicação mais provável está no código, não nas pessoas (próxima seção).

---

## 3. Por que aconteceu

Os 408 achados se agrupam em onze causas. Cada uma aponta a iniciativa que a resolve.

| # | Causa | Evidência | Resolve |
|---|---|---|---|
| 1 | **A tabela oficial ignora jogo sem grupo.** Em fase com grupos, a API só soma jogo ligado a um grupo e com as duas equipes nele. O Vôlei rodou em formato "Liga" com grupos gravados e os jogos foram lançados sem grupo. | `api:src/edition-actions/edition-action-recalculation.service.ts:104-112` | EST-I01, SAN-I04 |
| 2 | **Virar o tempo é sempre recusado** em handebol, futsal e basquete. A mesa opera sem cronômetro, mas envia a virada sem `runningSince`, e a API, que ainda trata essas modalidades como cronometradas, recusa. Nenhum jogo saiu do 1º tempo — explicação mais provável para o basquete ter parado no 1º período. | `apps/web/app/matches/live/page.tsx:83` e `:405` | MESA-I01 |
| 3 | **Não existe lançar o resultado.** A API só aceita placar por lance com o jogo ao vivo, por W.O. ou por retificação. | `api:…/handlers/match-action.handler.ts:320-324` | MESA-I03 |
| 4 | **W.O. existe, mas escondido** num seletor de "Editar partida", com placar do regulamento diferente do usado (1×0 no handebol). | MESA-04, JDADOS-07 | MESA-I04 |
| 5 | **Vôlei aceita ponto depois do fim** e soma um set fantasma; desfazer esse toque apaga a parcial certa. | `apps/web/app/matches/live/page.tsx:217-229`; `api:…/match-action.handler.ts:710-728` | MESA-I02 |
| 6 | **A chave não é confiável.** A aba Chaveamento filtra por "semi/quart/final" no nome da fase, e a fase se chama "Mata-mata": fica vazia em todas as categorias. O mata-mata é preenchido sem conferência; um rótulo não entendido ("2º geral") troca a chave pela semeadura automática; retificar um jogo de grupo apaga a chave publicada. | `apps/web/app/components/TournamentClassification.tsx:94`; `api:…/recalculation.service.ts:462-491`; `api:…/match-action.handler.ts:1150-1158` | EST-I05, EST-I06, EST-I02, PUB-I02 |
| 7 | **A agenda só aceita horário fixo** e a organização trabalha por fila na quadra. Jogo não iniciado aparece **0 — 0**; selos "Próximo" e "Ao vivo" não envelhecem. | `api:schema.prisma:438-508`; `api:…/snapshot.mapper.ts:882` | AGD-I02, AGD-I04, AGD-I05 |
| 8 | **A estrutura trava no primeiro jogo.** Não dá para incluir nem retirar equipe, excluir jogo ou trocar o grupo de um jogo pela tela; "Montar os jogos" duplica confrontos e apaga a chave importada. A saída da Compressora foi refeita jogo a jogo. | `api:…/category-action.handler.ts:226-246`; `TournamentManager.tsx:46,206-218` | AGD-I01, AGD-I03, EST-I04, EST-I07 |
| 9 | **O responsável da atlética não fecha com a API.** O admin recebe 403 ao conceder (e a tela diz que deu certo); o login do papel devolve 401 ("senha inválida"); se entrasse, não acharia o próprio time. Elenco entra um atleta por vez. | `api:src/auth/auth.service.ts:249-292`; `api:…/edition-actions.service.ts:605-609` | ATL-I01, ATL-I02, ATL-I03 |
| 10 | **Cada toque custa a edição inteira.** O servidor reconstrói, grava e devolve ~1 MB sem compressão; o segundo toque antes da resposta é recusado e o ponto some; o SSE não entrega nada em produção (o tempo real é uma sondagem de 12 s); rede fraca manda o mesário para o login. | DADOS-02, DADOS-06, APIINFRA-R1, DADOS-04 | SYNC-I01, SYNC-I04, SYNC-I05, SYNC-I06 |
| 11 | **Nada protegia contra isso.** Nenhum teste liga o front à API real (os bugs 2, 3 e 9 são de contrato); o deploy publica sem esperar o CI e entrou com jogo em andamento; o backup do banco só roda quando há deploy. | TESTES-02, TESTES-04, APIINFRA-03 | QA-I05, QA-I02, ADM-I01 |

---

## 4. Como o app deve ficar

### Princípios

1. **Só o oficial e verdadeiro.** Placar só depois que o jogo começa. Horário previsto aparece como previsão ("~10:40 · 2º na Quadra 1"), nunca como certo. Na dúvida, mostrar a hora do último dado em vez de afirmar "ao vivo".
2. **Dois modos, um resultado.** A mesa ao vivo registra lance a lance; a súmula registra o resultado final em segundos. A súmula nunca inventa lances, e todo jogo guarda a origem do resultado (ao vivo, súmula ou W.O.).
3. **A API é a fonte.** Tabela, chave, pódio e situação da categoria vêm do servidor. O front não recalcula classificação; uma cópia da mesma função pura de validação recusa antes de enviar, com frase de quadra ("o 3º set vai a 15").
4. **Uma regra, um lugar.** Situação do jogo, fila da quadra, invariantes e pendências vivem cada uma numa função única, usada pela mesa, pela agenda, pelo painel, pela área pública e pelo verificador.
5. **A ação fica onde está o problema.** O cartão do jogo, para quem pode operar, já traz *Placar*, *Lançar resultado* e *W.O.*. Cada perfil abre o app na sua tarefa número 1, sem rolar.
6. **Corrigir é normal, e fica registrado.** Corrigir em lote é o caminho comum. Toda mudança depois do fato pede motivo, mostra "antes → depois" e grava autor.
7. **Falha nunca apaga dado bom nem some calada.** Sem rede vira faixa "Sem conexão · dados das 14:32", não tela de erro; lance que não chegou aparece como pendente.
8. **Celular, uma mão, ginásio.** Alvos de 44 px, texto de pelo menos 12 px, perigo e erro visíveis dentro das três cores da marca.
9. **Nenhum caminho exige desenvolvedor.** Redefinir senha, importar a tabela de jogos, retirar uma equipe, encerrar a edição: tudo pela tela.

### Mapa de telas por perfil

| Perfil | Entra em | Barra inferior | O que vê primeiro |
|---|---|---|---|
| Espectador | **Hoje** (`/public`) | Hoje · Jogos · Tabelas · Equipes | A atlética que segue; Ao vivo; A seguir; Últimos resultados. Antes do evento, contagem regressiva; depois, as campeãs. |
| Responsável da atlética | **Meu time** (`/teams/{id}`) | Meu time · Jogos do time · Conta | Antes: elenco a completar. Durante: próximo jogo e resultados do time. Depois: campanha e posição oficial. |
| Gestor de modalidade | **Agora** | Agora · Jogos · Tabelas · Equipes · Conta | Três blocos que somem quando vazios: *Ao vivo* (Continuar placar; "parado" depois do limite), *Sem resultado* (Lançar resultado), *A seguir* (Abrir placar). |
| Admin da edição | **Agora** | Agora · Jogos · Modalidades · Equipes · Gestão | Um bloco do momento — *Prontidão* antes, *Precisa de atenção* durante, *Fechamento* depois — e os três blocos do gestor para todas as modalidades. |
| Super admin | **Agora** | igual ao admin | Gestão acrescenta Torneios e edições e a Auditoria completa. |

Em toda tela, inclusive na mesa e na área pública: uma faixa de 32 px (emblema, "Copa Halterada 2026", conexão escrita) e uma linha "‹ pai · título · ação". Na mesa com jogo ao vivo não há barra inferior.
**Somem:** `/tournaments`, `/teams/[id]/athletes`, `/tournaments/[id]/manage`, `/staff/promote`. A tela *Mais* vira *Gestão* (com Conta e Sair no topo). Os redirecionamentos públicos antigos ficam, porque o endereço circulou.

### A mesa em dois modos

- **Ao vivo** (`/matches/live?partida=ID`): placar e etapa, sem relógio fingido; parciais; duas colunas por equipe com os botões do esporte (no basquete, +1/+2/+3 e faltas contadas); rodapé fixo com *Desfazer · Fim do tempo / Encerrar set · Encerrar partida*. Antes do início: *Iniciar · Lançar resultado · W.O.* Vôlei decidido: só *Encerrar partida 2 × 0*. Tela sempre acesa; "Quem marcou?" só aparece quando há elenco.
- **Súmula** (`/matches/[id]/resultado`): no vôlei, uma linha por set (o 3º só aparece em 1 × 1); nos esportes por tempo, o placar final, com parciais opcionais; desempate só quando o regulamento exige. *Salvar* e *Salvar e próximo*. A mesma folha, pré-preenchida e com motivo, faz a retificação.
- **Estados:** Agendada/Adiada → Ao vivo → Encerrada; qualquer uma antes do fim → W.O.; Ao vivo → Agendada só por *Anular início*; Encerrada → Cancelada só por *Anular resultado* (admin). *Editar partida* deixa de mudar o estado do jogo.

### A agenda diz o que se sabe

Três formas de agendar: **hora marcada**, **a seguir** (dia + quadra + posição na fila, com previsão que se ajusta pelo atraso da própria fila) e **sem data**. Quadras viram cadastro da edição. A situação do jogo tem nome e regra num só lugar: *Ao vivo*, *Parado*, *A seguir · Nº na fila*, *Agendado HH:MM*, *Atrasado*, *Sem resultado*, *A agendar*, *Adiado*, *Cancelado*, *W.O.*, *Encerrado*. A lista do staff agrupa por quadra, filtra por situação com contagem e seleciona vários para corrigir em lote.

### A área pública responde três perguntas

*O que está rolando hoje? Quando joga a minha atlética? Como está a disputa?* — cada uma visível sem rolar num celular de 412×915. "Minha atlética" fica guardada no aparelho, sem conta. Todo jogo abre a sua página com um toque. A chave é desenhada por rodada (Quartas, Semifinal, 3º lugar, Final), com o número de cada jogo, para que "Vencedor do Jogo 16" aponte para algum lugar. Categoria encerrada mostra o pódio no topo.

---

## 5. Roteiro

O roteiro vencedor ordena pela **origem do dado**: primeiro a produção para de mostrar dado errado, com rede de proteção montada antes de qualquer reparo; depois se fecha o que a mesa grava, em seguida o que a API calcula, e só então autonomia e conforto. Cada onda entra com o teste que a mantém fechada.

**Correções do júri aplicadas sobre o roteiro vencedor:**
- A onda 0 foi dividida em **0a** (rede + reparo sem mudar contrato) e **0b** (mudanças de contrato), porque 70 dias numa onda só era um big-bang.
- A **súmula (MESA-I03) e o W.O. (MESA-I04) sobem para a 0b**, logo depois da primeira fatia do teste contra a API real — eram a maior dor do evento e estavam previstos para perto do dia 66.
- **Compressão (SYNC-I01), sessão que não cai (SYNC-I06), tempo real (SYNC-I04), redefinir senha (ADM-I02) e a ponte público↔gestão (NAV-I05)** sobem para a onda 1.
- Na onda 2, **quadras e fila "A SEGUIR" vêm primeiro**, e a **tela Hoje (PUB-I03)** e o filtro de pendentes sobem da onda 4/5.
- **Migrações só aditivas**, e a volta automática mínima do deploy (fatia de QA-I06) entra antes da primeira migração.
- O **aviso de versão nova** entra antes de mudar o formato do lance (SYNC-I05), e a API aceita o formato antigo e o novo durante uma edição: o `sw.js` tem versão fixa e abas antigas continuam vivas.
- **Antes de EST-I01 ir ao ar:** restaurar o backup numa instância de ensaio, recalcular as 8 categorias e comparar. Só o Vôlei pode mudar.
- Ordem de merge fixada nos arquivos disputados: `match-action.handler.ts` (MESA-I04 → MESA-I03 → EST-I02) e `http-adapter.ts` (PUB-I01 → SYNC-I03 → SYNC-I05).

As somas são dias de trabalho de **uma pessoa**, com front, API, migração, teste e revisão.

### Onda 0a — Rede de proteção antes de tocar em produção

Backup fora da VM, deploy que espera o CI, scripts que não apontam para produção por padrão, um verificador que diz o que está errado e um jeito atômico de corrigir. Junto, as correções baratas que não mudam contrato: placar 0 — 0 e botões de perigo invisíveis.

**Pronto quando:** Restauração do backup ensaiada; CD só depois do CI verde; verificador rodando e listando as violações de 2026; ficha de decisões entregue à organização; público sem 0 — 0.

**Soma:** ~28 dias de trabalho de uma pessoa, em 12 entregas.

| # | Iniciativa | Trilha | Dias | Observação |
|---|---|---|---|---|
| 1 | **ADM-I01** Backup agendado e cifrado fora da VM, com ensaio de restauração | Acesso e operação | 2 |  |
| 2 | **QA-I02** Deploy só depois do CI verde e nunca sobre jogo ao vivo | Qualidade | 2 |  |
| 3 | **QA-I01** Arrumar repositórios: branch padrão, branches mortas, PRs e issues parados | Qualidade | 1.5 |  |
| 4 | **IMP-I02** Blindar scripts de importação e MCP até serem aposentados | Autonomia | 1.5 |  |
| 5 | **QA-I03** Verificador de invariantes dos dados, somente leitura, contra qualquer API | Qualidade | 3 |  |
| 6 | **IMP-I03** Ação de lote atômica batch/apply na API | Autonomia | 3 |  |
| 7 | **SAN-I01** Kit de saneamento: verificador, simulação e aplicação por lote | Saneamento | 4 |  |
| 8 | **SAN-I02** Ficha de decisões com a organização, súmula em mãos | Saneamento | 1.5 |  |
| 9 | **SAN-I03** Lote 1: parciais do vôlei e 'grupo c', sem esperar decisão | Saneamento | 1 | parciais e "grupo c" por script declarado no kit, com restauração ensaiada antes; clockMode "none" pela tela que já existe |
| 10 | **QA-I04** Ligar portões que existem e não rodam: unidade, visual, e2e da API | Qualidade | 3.5 |  |
| 11 | **DS-I01** Perigo e erro visíveis dentro das três cores da marca | Sistema visual | 2 | leva junto: esconder o formulário de acesso da atlética até ATL-I01 — hoje ele diz "já pode entrar" para um acesso que a API recusa |
| 12 | **AGD-I02** Situação única do jogo: placar só após o início, selos que envelhecem | Agenda | 3 |  |

### Onda 0b — A mesa e a tabela param de errar

Os bugs que geraram dado errado no evento, com um teste contra a API real entrando antes deles: virar tempo, ponto depois do fim no vôlei, W.O., lançar pela súmula, editar jogo com lado a definir, tabela que ignora jogos e retificação que apaga a chave. Os lotes de reparo de 2026 rodam na ordem que a API permite.

**Pronto quando:** Job e2e contra a API real verde no CI; verificador com zero violações de sets, parciais, duplicados e jogo fora da tabela; tabela do Vôlei com os 23 jogos; nenhum jogo de 2026 Ao vivo.

**Soma:** ~38 dias de trabalho de uma pessoa, em 13 entregas.

| # | Iniciativa | Trilha | Dias | Observação |
|---|---|---|---|---|
| 1 | **QA-I05** Suíte de contrato front × API real nos dois CIs | Qualidade | 3 | primeira fatia: job e2e com a API em contêiner, cobrindo recordResult, W.O., retificação e virar tempo |
| 2 | **EST-I05** Vagas do mata-mata estruturadas, com número do jogo e rodada nos dados | Estrutura | 1 | primeira fatia (EST-I05a): uma função única "é eliminatória" pelo formato da fase, no front e na API |
| 3 | **MESA-I01** Relógio único: virar tempo funciona e o público não vê cronômetro falso | Mesa | 3.5 |  |
| 4 | **MESA-I02** Vôlei decidido trava o ponto, e desfazer preserva a parcial | Mesa | 2 | leva o cálculo do desfazer para o servidor, antes de SYNC-I02 |
| 5 | **MESA-I04** W.O. em dois toques e Editar partida sem Ao vivo nem Encerrada | Mesa | 4 | entrega a tabela única de transições de estado que AGD-I06, EST-I02 e SAN consomem |
| 6 | **MESA-I03** Lançar resultado pela súmula: ação match/recordResult e folha por esporte | Mesa | 7 | vôlei e handebol primeiro; futsal e basquete numa segunda fatia |
| 7 | **AGD-I01** Destravar Editar partida: lado a definir, excluir jogo e trocar grupo | Agenda | 3 |  |
| 8 | **SAN-I04** Lote 2: duplicados, tabelas e chave do Vôlei | Saneamento | 1 | parte A: anular os duplicados, antes de EST-I01 ir ao ar |
| 9 | **EST-I01** Tabela oficial conta todo jogo encerrado e lista os que ficaram fora | Estrutura | 6 | portão: restaurar o backup numa instância de ensaio, recalcular as 8 categorias e comparar — só o Vôlei pode mudar |
| 10 | **EST-I02** Retificar, anular ou mover jogo sem apagar a chave publicada | Estrutura | 3 |  |
| 11 | **SAN-I04** Lote 2: duplicados, tabelas e chave do Vôlei | Saneamento | 1 | parte B: mover a final masculina da fase Liga e refazer as semis femininas, só depois de EST-I02 |
| 12 | **SAN-I05** Lote 3: converter os 7 W.O. do Handebol e alinhar regulamentos | Saneamento | 1 | o verificador confirma que os classificados do Handebol não mudam; se mudarem, decide a organização |
| 13 | **SAN-I06** Dar desfecho ao basquete Ao vivo e aos 40 jogos vencidos | Saneamento | 2.5 | no Basquete, os lados "2º geral" e "Melhor classificada" são definidos à mão (AGD-I01) ou esperam EST-I05 |

### Onda 1 — A mesa grava o que aconteceu e a tela diz a hora do dado

Fechar os caminhos de escrita que geram placar impossível e os que fazem o toque sumir; o espectador vê a hora do último dado; rede fraca não derruba a sessão; quem esquece a senha volta sem desenvolvedor. A rede de teste completa (contrato, replay dos 96 jogos, mesa por modalidade) entra aqui.

**Pronto quando:** Replay dos 96 jogos e contrato verdes, bloqueando merge; rajada de toques a 0,3 s chega inteira; jogo sem sinal vira "parado"; placar novo chega ao público em até 5 s com a hora do dado; admin redefine senha pela tela.

**Soma:** ~87 dias de trabalho de uma pessoa, em 23 entregas.

| # | Iniciativa | Trilha | Dias | Observação |
|---|---|---|---|---|
| 1 | **QA-I06** Deploy com volta automática, smoke pela URL pública e vigia do runner | Qualidade | 1.5 | primeira fatia: manter a imagem anterior e testar pela URL pública, antes da primeira migração; toda migração passa a ser só aditiva |
| 2 | **EST-I09** Regulamento validado ao salvar e congelado em cada jogo | Estrutura | 6.5 |  |
| 3 | **MESA-I05** Retificar pela mesma folha da súmula e anular resultado errado | Mesa | 4 |  |
| 4 | **MESA-I06** Jogo parado Ao vivo: aviso, assumir, encerrar ou anular o início | Mesa | 3 |  |
| 5 | **AGD-I06** Adiar, cancelar e remarcar como ações próprias, fora do select de estado | Agenda | 3 | leva junto a correção da API em que jogo Cancelado deixa de travar a chave |
| 6 | **SYNC-I01** Comprimir respostas, cache de uma chave e recibo só com revisão | Sincronização | 5 |  |
| 7 | **SYNC-I06** Sessão que só cai com 401: renovação tolerante e saída por aparelho | Sincronização | 4 |  |
| 8 | **ADM-I02** Redefinir senha pelo Staff e login que diz a verdade | Acesso e operação | 4 |  |
| 9 | **SYNC-I09** HTML leve, área pública sempre pública e aviso de versão nova | Sincronização | 1.5 | primeira fatia: aviso de versão nova, antes de SYNC-I05 mudar o formato do lance; a API aceita o formato antigo e o novo durante uma edição |
| 10 | **SYNC-I02** Tirar do snapshot o estado de desfazer e o regulamento repetido | Sincronização | 3 |  |
| 11 | **SYNC-I03** Tela que não some e selo de conexão com a hora do dado | Sincronização | 4 |  |
| 12 | **SYNC-I04** Tempo real que chega: sondagem condicional de 3 s e vigia do SSE | Sincronização | 4 |  |
| 13 | **NAV-I03** Faixa de conexão em toda tela e estados globais com saída certa | Navegação | 3 |  |
| 14 | **NAV-I05** Ponte entre área pública e gestão, com dados certos dos dois lados | Navegação | 2 |  |
| 15 | **DS-I05** Correções rápidas: mesa presa, iPhone, foco e fonte Aldo | Sistema visual | 2.5 |  |
| 16 | **MESA-I07** Mesa sem painel no caminho, com tela acesa e trava estável | Mesa | 4 |  |
| 17 | **SYNC-I05** Lance como incremento, em fila, com placar otimista e faixa de envio | Sincronização | 6 |  |
| 18 | **DS-I02** Placar e selo de estado únicos, sem 0 — 0 antes do jogo | Sistema visual | 3.5 |  |
| 19 | **DS-I03** Rede de captura visual no CI e auditoria automática de tela | Sistema visual | 3.5 |  |
| 20 | **PUB-I01** Corrigir placar 0×0, links quebrados e textos internos no público | Público | 4 | sem o 0 — 0, que já saiu em AGD-I02 |
| 21 | **QA-I05** Suíte de contrato front × API real nos dois CIs | Qualidade | 4 | resto da suíte de contrato |
| 22 | **QA-I08** Replay dos 96 jogos e 2.689 lances de outubro como teste | Qualidade | 6 |  |
| 23 | **QA-I07** Testes da mesa por modalidade, toque rápido e dois aparelhos | Qualidade | 5 |  |

### Onda 2 — Tabela, chave e agenda coerentes por construção

Tornar impossível a estrutura incoerente: confronto repetido, vaga em texto livre, chave preenchida sem conferência, "Montar os jogos" que apaga, horário inventado. A agenda passa a trabalhar por quadra e fila "A SEGUIR". O público vê tabela, chave e campeã oficiais, e a tela inicial vira "Hoje".

**Pronto quando:** A API recusa os casos acima e o verificador também os acusa; a chave só é preenchida depois de "Conferir"; status e pódio derivam dos jogos; 2026 encerrada com as campeãs no público.

**Soma:** ~73 dias de trabalho de uma pessoa, em 17 entregas.

| # | Iniciativa | Trilha | Dias | Observação |
|---|---|---|---|---|
| 1 | **AGD-I04** Quadras da edição como cadastro; 'A definir' vira jogo sem quadra | Agenda | 5 |  |
| 2 | **AGD-I05** Fila 'A SEGUIR' por quadra, horário previsto e jogo ainda sem data | Agenda | 7 |  |
| 3 | **AGD-I03** Bloquear confronto repetido na mesma fase em todos os caminhos | Agenda | 3 |  |
| 4 | **EST-I03** Invariantes de estrutura na API e grupos com renomeação própria | Estrutura | 4.5 |  |
| 5 | **EST-I05** Vagas do mata-mata estruturadas, com número do jogo e rodada nos dados | Estrutura | 7 | resto: vagas estruturadas, número do jogo e rodada nos dados |
| 6 | **EST-I06** Conferir a chave antes de preencher e registrar empate sem critério | Estrutura | 7 |  |
| 7 | **EST-I08** Situação derivada dos jogos, pódio confirmado e ranking por categoria | Estrutura | 6 |  |
| 8 | **EST-I04** 'Montar os jogos' só cria o que falta, com prévia e desfazer | Estrutura | 4 |  |
| 9 | **QA-I10** Cenários compartilhados de desempate e regulamento padrão nos dois repositórios | Qualidade | 3 |  |
| 10 | **SAN-I07** Encerrar categorias, limpar rascunhos e finalizar a edição 2026 | Saneamento | 1 | se o ranking geral de 2026 for oficial, espera EST-I08; senão pode fechar antes |
| 11 | **PUB-I05** Tabela da categoria fiel ao servidor, com linha de classificação | Público | 4 |  |
| 12 | **PUB-I02** Desenhar a chave do mata-mata por rodada na aba Chave | Público | 4 |  |
| 13 | **PUB-I07** Mostrar campeã, vice, terceiro e a etapa atual de cada categoria | Público | 4 |  |
| 14 | **PUB-I06** Cartão e página do jogo contam o resultado inteiro | Público | 4 |  |
| 15 | **DS-I04** Linha compacta de jogo para agenda e listas | Sistema visual | 4 | leva junto, de MESA-I08, só o "Abrir placar" no próprio cartão |
| 16 | **PUB-I03** Tela inicial Hoje: ao vivo, a seguir e últimos resultados | Público | 4 |  |
| 17 | **AGD-I07** Agenda privada para conduzir o dia: situação, quadra, busca e pendentes | Agenda | 1.5 | primeira fatia: filtro "pendentes" que atravessa os dias |

### Onda 3 — Operação vigiada

Queda e backup atrasado viram alerta; deploy ruim volta sozinho; resíduos de segurança de agosto fechados; convite com senha provisória individual.

**Pronto quando:** Smoke pela URL pública reverte deploy ruim; queda e backup atrasado geram alerta; nenhum bloqueador de agosto aberto; convite mostra como a pessoa entra.

**Soma:** ~14 dias de trabalho de uma pessoa, em 5 entregas.

| # | Iniciativa | Trilha | Dias | Observação |
|---|---|---|---|---|
| 1 | **QA-I06** Deploy com volta automática, smoke pela URL pública e vigia do runner | Qualidade | 2 | resto: volta automática e vigia do runner |
| 2 | **ADM-I07** Alerta de queda e de backup atrasado, e pendências da VM fechadas | Acesso e operação | 3 |  |
| 3 | **ADM-I06** Fechar os resíduos de segurança da auditoria de agosto | Acesso e operação | 3 |  |
| 4 | **SYNC-I09** HTML leve, área pública sempre pública e aviso de versão nova | Sincronização | 3.5 | resto: HTML leve e área pública sempre pública |
| 5 | **ADM-I03** Convite com senha provisória individual e cartão 'Acesso criado' | Acesso e operação | 2.5 |  |

### Onda 4 — A organização opera sem desenvolvedor

Cada perfil abre na sua tarefa; as atléticas recebem acesso e cadastram o elenco colando a lista; a planilha de jogos entra pela tela com prévia; equipe sai ou entra por ação auditada; a edição encerra pelo painel. O ensaio geral fecha a onda.

**Pronto quando:** O admin convida as 17 atléticas e uma delas cola o elenco em 10 minutos; os 94 jogos entram com prévia e tudo ou nada; a edição encerra pelo painel; ensaio geral (QA-I09) aprovado.

**Soma:** ~102.5 dias de trabalho de uma pessoa, em 23 entregas.

| # | Iniciativa | Trilha | Dias | Observação |
|---|---|---|---|---|
| 1 | **NAV-I01** Barra inferior por perfil, com Gestão e Conta no lugar de Mais | Navegação | 3 |  |
| 2 | **NAV-I04** Entrar uma vez e voltar ao lugar certo depois do login | Navegação | 2 |  |
| 3 | **NAV-I02** Início 'Agora' com jogos ao vivo, sem resultado e a seguir | Navegação | 4 |  |
| 4 | **MESA-I08** Do cartão à mesa em um toque, próximo jogo e quem lançou | Mesa | 4.5 | o resto: próximo jogo e quem lançou |
| 5 | **ATL-I01** Fechar o ciclo do responsável da atlética: conceder, entrar, achar o time | Atléticas | 5 |  |
| 6 | **ATL-N01** Time B ligado à atlética-mãe: escudo, responsável e agrupamento | Atléticas | 3.5 |  |
| 7 | **PUB-I04** Minha atlética: seguir, ver jogos e posição oficial da equipe | Público | 5 |  |
| 8 | **ATL-I02** Elenco por categoria e cadastro em lote na API | Atléticas | 7 |  |
| 9 | **ATL-I03** Tela Montar elenco: colar a lista por categoria no celular | Atléticas | 5 |  |
| 10 | **ATL-I04** Reorganizar a tela da equipe: elenco por categoria primeiro, classificação oficial | Atléticas | 5 |  |
| 11 | **ATL-I05** Tela Acessos das atléticas: convidar as 17 com mensagem pronta | Atléticas | 4.5 |  |
| 12 | **ATL-I06** Liberar o elenco ao gestor de modalidade sem apagar as outras modalidades | Atléticas | 3.5 |  |
| 13 | **ATL-I07** Validar trava e limites de elenco no servidor, por categoria | Atléticas | 4 |  |
| 14 | **ADM-I04** Staff por pessoa: papéis, estado de acesso e ações visíveis | Acesso e operação | 4 |  |
| 15 | **ADM-I05** Perfil honesto: meus acessos, sem alerta falso, sair só daqui | Acesso e operação | 1.5 |  |
| 16 | **IMP-I01** Motor único de pendências e prontidão, no app e no MCP | Autonomia | 5 |  |
| 17 | **IMP-I04** Novo jogo com lado a definir e vaga na chave | Autonomia | 4 |  |
| 18 | **IMP-I05** Importar jogos da planilha: colar, prévia, corrigir e gravar | Autonomia | 9 |  |
| 19 | **AGD-I09** Novo jogo em contexto e alertas de agenda que fazem sentido | Agenda | 4 |  |
| 20 | **EST-I07** Incluir e retirar equipe com a categoria em andamento | Estrutura | 6 |  |
| 21 | **ADM-I08** Encerrar e reabrir a edição pelo admin, com pendências e trava | Acesso e operação | 4 |  |
| 22 | **NAV-I06** Painel do admin em três tempos: prontidão, pendências e fechamento | Navegação | 3 |  |
| 23 | **QA-I09** Ensaio geral com instância de ensaio e documentação de operação | Qualidade | 6 | roda no D-14 do próximo evento em qualquer onda, com CONGELAR_DEPLOY ligado |

### Onda 5 — Fila de acabamento, sem prazo

Leitura e toque sem erro em qualquer tela, agenda em lote, mesa desenhada por esporte, relatório e próxima edição aberta a partir da anterior. Entra por ordem de valor conforme houver gente.

**Pronto quando:** Sem alvo abaixo de 44 px nem texto abaixo de 12 px; 47 jogos em até 4 telas; edição seguinte nasce da anterior.

**Soma:** ~80.5 dias de trabalho de uma pessoa, em 17 entregas.

| # | Iniciativa | Trilha | Dias | Observação |
|---|---|---|---|---|
| 1 | **AGD-I08** Edição em lote: quadra, dia, horário, ordem, adiar e cancelar | Agenda | 7 |  |
| 2 | **AGD-I07** Agenda privada para conduzir o dia: situação, quadra, busca e pendentes | Agenda | 3.5 | resto: agenda privada por quadra, busca e situação |
| 3 | **MESA-I09** Mesa por esporte: colunas por equipe, cestas +1/+2/+3 e faltas contadas | Mesa | 6 |  |
| 4 | **DS-I06** Tokens semânticos e piso de toque, texto e contorno | Sistema visual | 6 |  |
| 5 | **DS-I07** Formulário base: campo, seção recolhível e barra de salvar fixa | Sistema visual | 4 |  |
| 6 | **NAV-I07** Topo enxuto: um voltar com pai declarado e migalha só no desktop | Navegação | 4.5 | absorve DS-I08 |
| 7 | **PUB-I08** Agenda pública do dia em blocos, linhas compactas e filtros | Público | 4 |  |
| 8 | **PUB-I09** Navegação pública Hoje, Jogos, Tabelas, Equipes e vocabulário fechado | Público | 3 |  |
| 9 | **PUB-I10** Compartilhar jogo com prévia de imagem e endereço canônico certo | Público | 4 |  |
| 10 | **SYNC-I07** Telemetria mínima: erros, tempo de cada lance, tempo real e visitas | Sincronização | 5 |  |
| 11 | **ADM-I09** Auditoria legível para o admin: sem lances, paginada e filtrável | Acesso e operação | 6 |  |
| 12 | **ADM-I10** Abrir a próxima edição a partir da anterior e ativar sem surpresa | Acesso e operação | 4 | precisa de um dono para o arquivo público da edição anterior |
| 13 | **IMP-I06** Exportar jogos, tabelas e ranking em CSV no modelo da importação | Autonomia | 3 |  |
| 14 | **IMP-I08** Relatório da edição para imprimir no encerramento | Autonomia | 4 |  |
| 15 | **EST-I10** Assistente de montagem da categoria com rascunho local e modelos | Estrutura | 8 |  |
| 16 | **ATL-I08** Lista de equipes compacta, catálogo sem conflito e escudo sem deploy | Atléticas | 4.5 |  |
| 17 | **ATL-I09** Trazer o elenco da edição anterior ao vincular a equipe | Atléticas | 4 |  |

### Só com dado de uso

Ficam fora da fila até haver medição que as justifique.

- **DS-I09** Fatiar globals.css em arquivos e camadas sem mudar a tela — fatiar o CSS só depois da rede de captura e de um motivo concreto.
- **SYNC-I08** Lances de jogo encerrado sob demanda; snapshot só com lances ao vivo — só se a medição de SYNC-I07 mostrar o snapshot pesando.
- **SYNC-I10** Fila de lances guardada no aparelho e mesa que reabre sem rede — fila offline só se a telemetria mostrar lance perdido por falta de rede.
- **NAV-I08** Casca de desktop: trilho lateral e conteúdo até 1200 px — só se a organização confirmar uso de notebook.

### Cortadas

- **DS-I08** Cabeçalho de página compacto em uma linha — repete NAV-I07, que já entrega o cabeçalho de uma linha.
- **DS-I10** Grade e tabelas no desktop a partir de 1024px — sem dado de uso no desktop; NAV-I08 já alarga a casca.
- **IMP-I07** Reimportar mostrando só a diferença, e desfazer a importação — AGD-I08 corrige o dia em lote e IMP-I05 grava tudo ou nada; reimportar com diferença duplica o caminho.

---

## 6. Se o próximo evento for em 6 semanas

A onda 0 inteira não cabe (66 dias). Entra o piso, nesta ordem:

1. **Onda 0a inteira** (28 dias): backup, deploy que espera o CI, scripts seguros, verificador, lote atômico, kit e ficha de saneamento, portões de teste, perigo visível e fim do 0 — 0.
2. **Da 0b:** a primeira fatia de QA-I05 (3), EST-I05a (1), MESA-I01 (3,5), MESA-I02 (2), MESA-I04 (4), MESA-I03 só vôlei e handebol (~4,5) e EST-I01 com o portão de comparação (6).
3. **Se sobrar gente:** MESA-I06 (jogo parado), SYNC-I06 (sessão), AGD-I01 (editar jogo com lado a definir).

São cerca de **52 dias de uma pessoa** — duas pessoas em tempo quase integral, ou três em meio período. Com menos que isso, o corte seguinte é EST-I01, e a tabela do Vôlei passa a ser conferida pelo verificador antes de cada publicação.
**Regras do calendário:** nenhuma migração depois do D-14; ensaio geral no D-14 (QA-I09 enxuto, com os mesários, na tela real); `CONGELAR_DEPLOY` ligado a partir do D-7.
**Ficam para depois:** quadras e "A SEGUIR" (a organização volta a mandar a ordem dos jogos, e o horário vira estimativa declarada), elencos, importador (os scripts blindados de IMP-I02 continuam), acessos das atléticas, painéis por perfil e sistema visual. "Montar os jogos" fica oculto depois do primeiro jogo da categoria.

---

## 7. Os primeiros 10 PRs

| # | PR | Por que agora |
|---|---|---|
| 1 | **ADM-I01** Backup diário cifrado fora da VM, com restauração ensaiada | 98% dos lances de outubro entraram depois do último dump, que fica no disco da própria VM — e o saneamento vai escrever em produção. |
| 2 | **QA-I02** CD só depois do CI verde, e chave `CONGELAR_DEPLOY` nos dois repositórios | Todo PR seguinte vai à produção; em 10/10 três merges entraram com jogo em quadra. |
| 3 | **QA-I01** Branch padrão do front vira `front-end`; PRs e branches parados ganham destino | `main` está 179 commits atrás da produção: quem abre PR hoje parte do código errado. |
| 4 | **IMP-I02** Scripts de importação e MCP sem alvo padrão e em simulação por padrão | O saneamento roda scripts contra produção, e hoje eles apontam para lá sem perguntar. |
| 5 | **QA-I03** Verificador de invariantes, somente leitura | Gera a lista de reparos e prova o zero depois; sem ele não se sabe se o reparo funcionou. |
| 6 | **IMP-I03** Ação `batch/apply`: várias ações numa transação, com simulação | Os lotes de reparo precisam de tudo ou nada; o importador já deixou metade gravada quando falhou. |
| 7 | **SAN-I01** Kit de saneamento por lote, com relatório antes e depois | Destrava a ficha de decisões para a organização e o primeiro lote. |
| 8 | **DS-I01** Perigo e erro visíveis dentro das três cores | Botões de revogar e excluir e mensagens de erro estão invisíveis hoje; custa 2 dias. |
| 9 | **AGD-I02** Placar nulo antes do início e situação única do jogo | 40 jogos vencidos aparecem "0 — 0 · Próximo", também no público: o dado errado mais visível. |
| 10 | **QA-I04** Ligar os portões que existem e não rodam | O `test:unit` lista arquivos à mão e esquece alguns; o CI pula a regressão visual. Os consertos seguintes precisam de teste que rode. |

---

## 8. Saneamento de 2026

Nenhum reparo escreve em produção antes de haver backup restaurável e verificador. Depois disso, quatro lotes revisados por PR, cada um aplicado por um workflow manual com modos *verificar*, *simular* e *aplicar*, numa transação com a mesma trava das ações da mesa, e conferido pelo verificador antes e depois:

1. **Lote 1 — não depende de decisão:** corrigir as parciais dos 3 jogos de vôlei; renomear "grupo c"; gravar "Sem cronômetro" nas modalidades por tempo; limpar a nota automática de atraso de 21 jogos.
2. **Lote 2 — Vôlei:** cancelar o jogo descartado de cada par duplicado; tirar os grupos das fases Liga (a API passa a contar todos os jogos numa tabela única); corrigir a final masculina e as semis femininas. Depois dele, a tabela do Vôlei conta os 23 jogos.
3. **Lote 3 — W.O.:** converter os 7 jogos 10×0 de handebol em W.O., mantendo o placar (a tabela e os campeões não mudam), e alinhar o placar de W.O. de cada modalidade no regulamento.
4. **Lote 4 — jogos sem desfecho:** aplicar a decisão da organização para cada um dos 41 jogos (40 "Agendada" vencidos e o basquete "Ao vivo"): resultado da súmula, W.O. ou cancelado.

Por fim, encerrar as categorias e a edição (SAN-I07). Se o ranking geral de 2026 for oficial, isso espera a correção do ranking por categoria (EST-I08); senão, registra-se que 2026 não terá ranking.
**Nada de resultado sai do time técnico:** os lotes 2 a 4 dependem da ficha de decisões (SAN-I02), preenchida pela organização com a súmula em mãos.

---

## 9. Decisões da organização

Estas respostas mudam o que se constrói. As que travam o saneamento vêm primeiro.

**Para fechar 2026**
1. Os 41 jogos sem desfecho (Futsal Masculino 20, Basquete 16 + o "Ao vivo", mata-mata do Vôlei Feminino 4) aconteceram? Com que placar? Quem responde e até quando? Sem resposta, o padrão é cancelar com motivo "sem resultado informado".
2. Nos 3 confrontos duplicados do Vôlei, qual jogo vale? O Vôlei Feminino foi turno único de 5? Teve mata-mata?
3. Os 7 jogos 10×0 do handebol foram W.O.? Qual o placar oficial de W.O. de cada modalidade (o regulamento diz 1×0 no handebol e 3×0 no vôlei, que é melhor de 3)?
4. O ranking geral de 2026 será oficial e público? Masculino e feminino pontuam pódios separados?

**Para o próximo evento**

5. **Quando é o próximo evento?** Dele saem o D-14, o D-7 e o tamanho do recorte.
6. **Quantas pessoas vão implementar, e com quantas horas por semana?** O plano soma ~423 dias de uma pessoa; a resposta decide em que onda o evento cai.
7. Quem opera a mesa: só os gestores de modalidade, ou voluntários sem poder de gestão? (Se forem voluntários, nasce o papel *Mesário*, que só opera o placar.) O resultado lançado pela súmula precisa de conferência do admin?
8. A súmula de papel de futsal, handebol e basquete traz o placar de cada tempo?
9. O elenco será exigido na próxima edição? Até quando, e quem cobra a atlética? A organização tem um responsável por atlética, com nome e e-mail?
10. Quais quadras a Copa usa, e a fila "A SEGUIR" é por quadra ou por categoria?
11. Equipe que desiste no meio: os jogos que faltam viram W.O. ou são cancelados?
12. Empate que nenhum critério separa: sorteio registrado no app, ou outro critério?
13. Quantos minutos sem lance tornam um jogo "parado" (proposta: 20), e quanto tempo depois do fim previsto um jogo sem início vira "sem resultado" (proposta: 60 min, por causa do atraso mediano de 104)?
14. Pode-se ligar telemetria anônima (erros, tempo de cada lance, visitas por tela, sem cookie nem nome)?
15. Aceita-se uma cor só para erro e perigo, fora da paleta? O plano assume que não: perigo fica em branco, com ícone e verbo escrito.
16. Quem são as duas pessoas com SSH na VM, quem recebe os alertas e quem liga e desliga o congelamento de deploy?

As perguntas completas, por trilha, estão no fim de cada trilha em [INICIATIVAS.md](INICIATIVAS.md).

---

## 10. Como usar este plano

- **Cada iniciativa vira uma issue**, com o id no título (ex.: `MESA-I03 · Lançar resultado pela súmula`). Problema, solução, tela alvo, critérios de aceite em checklist, arquivos e dependências estão prontos em [INICIATIVAS.md](INICIATIVAS.md).
- **Um PR por iniciativa**, ou uma sequência curta quando a iniciativa diz que tem fatias. O PR cita os ids dos achados que fecha.
- **Antes de começar uma iniciativa**, confira se o código mudou desde `23aa938` / `53ad276`: os números de linha dos achados envelhecem.
- **Ao terminar uma onda**, rode o verificador e confira o critério "pronto quando" antes de abrir a seguinte.
- Este plano substitui o `docs/BACKLOG.md` (que ainda descreve as sprints do InterEng) como fonte de próximo passo; QA-I01 trata de atualizar ou arquivar os documentos antigos.
