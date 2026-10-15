# Iniciativas do plano

As 111 iniciativas de [PLANO.md](PLANO.md), por trilha, na ordem recomendada dentro de cada trilha. A ordem entre trilhas está no roteiro do plano (seção 5).

Cada iniciativa traz a onda que a trilha **sugeriu**; a onda em que ela de fato entra é a do roteiro, que corrige algumas. Os ids em "Achados" apontam para [ACHADOS.md](ACHADOS.md). "Onde mexer" cita o código de produção de outubro de 2026 (front `23aa938`, API `53ad276`): confira antes de começar.

Trilhas: SAN (saneamento) · MESA · EST (estrutura) · AGD (agenda) · ATL (atléticas) · PUB (público) · NAV (navegação) · SYNC (sincronização) · ADM (acesso e operação) · DS (sistema visual) · QA (qualidade) · IMP (autonomia da organização).

## SAN — Saneamento dos dados de produção

**Objetivo.** A produção da Copa Halterada 2026 passa a refletir o que aconteceu em quadra: parciais e W.O. certos, tabelas do Vôlei contando os 20 jogos hoje ignorados, nenhum duplicado ativo, cada jogo com o desfecho que a organização decidiu, categorias e edição encerradas, e um verificador mostrando zero violações. Nada de feature nova.

**Princípios**

- A organização decide e o script executa. O time técnico não escolhe vencedor, placar nem W.O.; cada mudança gravada cita no motivo o número da decisão (D-nn).
- Usar a tela existente quando ela já faz o certo: W.O. e Cancelada em Editar partida, regras da modalidade, situação da categoria, exclusão de rascunho, edição. Usar o lote só onde a API recusa ou onde a tela estragaria dado (renomear grupo, retificar com mata-mata publicado, Encerrada para W.O.).
- Nada some. Jogo errado vira Cancelado com motivo, lance errado vira desfeito, e cada aplicação começa com um pg_dump verificado.
- Simular sempre antes de aplicar e ler o relatório antes → depois, que inclui a tabela recalculada de cada categoria tocada.
- Cada operação declara o estado que espera encontrar. Se o banco divergir, o lote inteiro aborta; repetir um lote já aplicado não muda nada.
- Todo lote termina do mesmo jeito: verificador sem a violação tratada e página pública conferida no celular.

**Desenho alvo**

Um fluxo único serve para todo reparo, sem migração.
1) Lote: arquivo JSON em intereng-api/ops/saneamento/2026-10-lote-N.json, revisado por PR. Formato: { edicao, lote, decisoes: ['D-03'], operacoes: [{ id, tipo, alvo, antes, depois, motivo }] }. Os tipos formam uma lista fechada: definirParcial, desfazerLances, ajustarPartida (etapa, periodScore, startNote, participantes, trava e relógio), cancelarJogo, converterEmWO, resultadoDaSumula, renomearGrupo, removerGruposDaFase, mudarTipoDaFase, renomearPartida e ajustarCategoria (nome, situação, formato).
2) Disparo: workflow manual saneamento-producao.yml no runner da VM, o único que alcança o Postgres. Modos verificar, simular e aplicar. Aplicar exige digitar SANEAR e faz antes um pg_dump -Fc verificado por pg_restore --list, igual ao cd.yml.
3) Execução: docker exec -i intereng-api node dist/ops/saneamento.js --modo X < lote.json. O script usa PrismaClient e instancia direto EditionActionRecalculationService, que não tem dependências. Tudo roda numa transação Serializable de até 60 s, com pg_advisory_xact_lock('edition-action:edition:<id>'), a mesma trava das ações, para não concorrer com a mesa. Para cada operação o script confere antes e depois, aplica e grava em audit_logs (action 'Saneamento', antes e depois, motivo com D-nn). No fim, chama recomputeTournament nas categorias tocadas e soma 1 em competition_editions.revision: o cache público ganha chave nova e os aparelhos rebaixam o snapshot pela sondagem, sem deploy. No modo simular, imprime o diff e desfaz tudo.
4) Verificador (src/ops/verificador.ts, somente leitura), rodado antes e depois. Regras:
- Ao vivo sem batimento há 30 min.
- Agendada ou Adiada com data vencida.
- Par repetido na mesma fase.
- Jogo oficial fora da tabela (soma de played diferente de 2 × jogos contados).
- Fase Liga com grupos.
- Inscrito sem grupo em fase com grupos.
- Vôlei com sets acima de setsToWin, parciais em número diferente dos sets ou parcial impossível.
- Placar de W.O. do regulamento acima de setsToWin.
- 10×0 com 10 lances em menos de 60 s.
- Grupo fora do padrão 'Grupo X'.
- Categoria com situação incoerente.
- Edição Em andamento depois da data final.
O verificador também exporta a ficha para a organização.
5) Ensaio: restaurar o dump numa base local e rodar simular e aplicar ali antes de produção.
Ordem de execução: I01 kit, I02 ficha, I03 lote sem decisão, I04 Vôlei, I05 W.O., I06 desfechos, I07 fechamento.

### SAN-I01 · Kit de saneamento: verificador, simulação e aplicação por lote

Onda 0 sugerida · infra · esforço M · ~4 dia(s) · cobre 2 achado(s), 2 crítico(s)/alto(s)

**Problema.** A API recusa as correções de que a produção precisa: Encerrada não vira W.O. nem Cancelada, parcial não se edita e renomear grupo pela tela desvincula jogos. Também não existe verificador: hoje 20 de 23 jogos de grupo do vôlei estão fora da tabela sem aviso nenhum.

**Solução.** Script src/ops/saneamento.ts na API, executado dentro do container por workflow manual no runner da VM. Ele lê um lote JSON versionado com operações de uma lista fechada, e cada operação traz antes e depois: se o banco já está no depois, pula; se está no antes, aplica; outro valor aborta tudo. Tudo numa transação Serializable com a mesma trava por edição das ações. Ao final recalcula as categorias tocadas com EditionActionRecalculationService (instanciado direto), grava audit_log 'Saneamento' e soma 1 na revisão. Modos: verificar (só invariantes), simular (aplica, imprime antes → depois e desfaz) e aplicar (exige pg_dump verificado). Ensaio primeiro numa cópia restaurada do dump.

**Tela alvo.** GitHub Actions, workflow 'Saneamento de produção', Run workflow. Três campos: modo (verificar, simular ou aplicar), lote (caminho do arquivo) e confirmo (digitar SANEAR, exigido só para aplicar). Ao terminar, o artefato relatorio-saneamento.txt lista as violações por regra com ids, cada operação com antes → depois e, por categoria tocada, a tabela antiga e a nova lado a lado. Ação principal: simular e ler o relatório antes de aplicar.

**Critérios de aceite**

- [ ] O modo verificar em produção lista, com ids: 1 jogo Ao vivo parado, 40 Agendada vencidos, 3 pares duplicados, 4 jogos de vôlei com parcial inválida ou faltando, 7 jogos 10×0 com 10 lances em menos de 60 s, 1 grupo fora do padrão, 2 fases Liga com grupos e 20 jogos encerrados fora da tabela.
- [ ] O modo simular termina com a revisão da edição e as contagens de matches, match_period_results, match_events ativos e phase_standings iguais às do início.
- [ ] Aplicar o mesmo lote duas vezes: a segunda execução registra 0 operações aplicadas.
- [ ] Uma operação cujo antes não confere aborta o lote inteiro e não grava nada.
- [ ] Aplicar sem dump válido (pg_restore --list) é recusado; o dump fica em $HOME/intereng-backups.
- [ ] Depois de aplicar, o snapshot público traz revisão nova em até 15 s, sem deploy nem reinício.

**Onde mexer.** API: `src/ops/saneamento.ts (novo): modos verificar, simular e aplicar; $transaction Serializable, timeout 60 s, pg_advisory_xact_lock('edition-action:edition:<id>') como em edition-actions.service.ts`, `src/ops/operacoes.ts (novo): definirParcial, desfazerLances, ajustarPartida, cancelarJogo, converterEmWO, resultadoDaSumula, renomearGrupo, removerGruposDaFase, mudarTipoDaFase, renomearPartida, ajustarCategoria`, `src/ops/verificador.ts (novo): invariantes somente leitura via Prisma, com saída em texto e em CSV`, `EditionActionRecalculationService.recomputeTournament: reaproveitado sem mudança`, `audit_logs (action 'Saneamento', beforeData e afterData, reason com D-nn) e competition_editions.revision + 1`, `.github/workflows/saneamento-producao.yml (novo): self-hosted, entradas modo, lote e confirmo, pg_dump -Fc e pg_restore --list como no cd.yml`, `src/ops/operacoes.spec.ts: guarda antes e depois, idempotência e aborto`, `Sem migração; exige um deploy da API para dist/ops existir`.

**Depende de:** nada. **Risco:** Escrever fora das ações pula validações. Mitigação: lista fechada de operações, guarda antes e depois, dump e ensaio em cópia. Exige um deploy da API fora de dia de jogo.

<sub>Achados: JDADOS-03, JDADOS-11</sub>

### SAN-I02 · Ficha de decisões com a organização, súmula em mãos

Onda 0 sugerida · saneamento · esforço P · ~1.5 dia(s) · cobre 2 achado(s), 2 crítico(s)/alto(s)

**Problema.** Metade das correções depende de um fato que só a organização tem: qual jogo de cada par duplicado vale, se os 40 jogos vencidos e o basquete Ao vivo aconteceram, se os 10×0 foram W.O. e qual o placar de W.O. Sem esses fatos, o script não pode escolher vencedor.

**Solução.** O verificador exporta a ficha em CSV por categoria, e ela vira uma planilha compartilhada com uma linha por fato pendente: id, confronto, data, o que o app mostra e as opções. Com a súmula em mãos, a organização marca: qual jogo de cada par vale; se cada um dos 41 jogos aconteceu (placar e parciais, W.O. com quem faltou, ou não realizado); se os 7 jogos 10×0 foram W.O.; o placar de W.O. por modalidade; o 3º set 16-14 de Halterada × Halterada 2; e se o Vôlei Feminino foi turno único de 5 e teve mata-mata. Cada resposta vira decisão numerada (D-01…) em ops/saneamento/DECISOES.md e é citada no motivo gravado.

**Tela alvo.** Planilha 'Saneamento Copa 2026', com uma aba por categoria e uma aba 'Placar de W.O.'. Cada linha traz: decisão D-nn, id do jogo, confronto, data e hora, como o app mostra hoje, e colunas de resposta (aconteceu?, placar e parciais, quem faltou, observação). A linha respondida fica verde. Ação principal: preencher a resposta com a súmula ao lado.

**Critérios de aceite**

- [ ] A ficha cobre todas as pendências que dependem de fato: 3 pares duplicados, 41 jogos sem desfecho (40 Agendada e 1 Ao vivo), 7 jogos 10×0, o placar de W.O. de 4 modalidades, o 3º set de category-7213ebd17f31-generated-1 e o mata-mata do Vôlei Feminino.
- [ ] Cada decisão tem número, quem respondeu pela organização e a data; nenhuma decisão de resultado sai do time técnico.
- [ ] O DECISOES.md está versionado no repositório da API antes do lote que usa as decisões.
- [ ] Item sem resposta até o prazo recebe o padrão definido pelo dono e fica marcado assim.

**Onde mexer.** API: `src/ops/verificador.ts: exportar a ficha em CSV por categoria`, `ops/saneamento/DECISOES.md (novo)`.

**Depende de:** SAN-I01. **Risco:** A organização pode não ter súmula de parte dos jogos. Por isso o padrão para item sem resposta precisa ser decidido antes, não caso a caso.

<sub>Achados: APIDOM-R3, JDADOS-03</sub>

### SAN-I03 · Lote 1: parciais do vôlei e 'grupo c', sem esperar decisão

Onda 0 sugerida · saneamento · esforço P · ~1 dia(s) · cobre 7 achado(s), 7 crítico(s)/alto(s)

**Problema.** Três jogos de vôlei têm parcial impossível ou faltando: Inquisidores × Furiosa com set 10-26, e Halterada 2 × Incinera e Mafiosa × Inquisidores com 2 sets e 1 parcial. No Handebol Masculino há 'grupo c' ao lado de 'Grupo A'. 'Vôlei masculino' está grafado diferente das outras categorias, e 21 jogos guardam nota automática.

**Solução.** Lote ops/saneamento/2026-10-lote-1.json, com valores tirados dos próprios lances. Em category-7213ebd17f31-generated-8, desfazer o último lance (o que levou a 0×3) e gravar o set 2 como 10-25. Em category-7213ebd17f31-generated-7, criar o set 2 = 25-1, e em match-bf73216534b5 o set 2 = 14-25, ambos a partir do periodScore. Renomear 'grupo c' de category-9acae3d36bcb para 'Grupo C' no próprio registro: pela tela a API recusa com 409, e recriar o grupo desvincularia j3, j6 e j9. Gravar o nome 'Vôlei Masculino' em category-7213ebd17f31. Limpar a nota 'Registre a justificativa' dos 21 jogos. Recalcular as categorias tocadas.

**Tela alvo.** Não há tela nova. Conferência no celular: a página pública de Mafiosa × Inquisidores mostra as parciais 18-25 · 14-25; Inquisidores × Furiosa (generated-8) mostra 12-25 · 10-25 e nenhum lance depois do fim; a tabela do Handebol Masculino traz a aba 'Grupo C' com Compressora 6, Incinera 3 e Aguerrida 0.

**Critérios de aceite**

- [ ] generated-8 com parciais 12-25 e 10-25; o lance extra fica desfeito e some da página pública.
- [ ] generated-7 e match-bf73216534b5 com 2 parciais para 2 sets. O verificador acusa 0 jogos de vôlei com número de parciais diferente dos sets (generated-1 fica para o lote 2).
- [ ] Handebol Masculino com grupos 'Grupo A', 'Grupo B' e 'Grupo C'; j3, j6 e j9 continuam contando e a tabela fica igual à de antes.
- [ ] 0 jogos com a nota 'Registre a justificativa' (eram 21) e categoria 'Vôlei Masculino' com a grafia nova.
- [ ] Uma segunda execução do lote aplica 0 operações.

**Onde mexer.** API: `ops/saneamento/2026-10-lote-1.json (novo)`, `match_period_results: set 2 em generated-7, generated-8 e match-bf73216534b5`, `match_events.undoneAt: último lance de category-7213ebd17f31-generated-8`, `groups.name: 'grupo c' para 'Grupo C', mantendo o id`, `tournaments.name de category-7213ebd17f31 e matches.startNote dos 21 jogos`, `recomputeTournament de category-7213ebd17f31, category-a15edc3a59ed e category-9acae3d36bcb`.

**Depende de:** SAN-I01. **Risco:** Baixo: todo valor vem dos lances gravados. generated-7 ou generated-8 podem virar Cancelados no lote 2; a parcial fica certa de qualquer jeito.

<sub>Achados: MESA-03, REGRAS-01, APIDOM-03, JMESA-03, DADOS-R1, REGRAS-R2, JDADOS-03</sub>

### SAN-I04 · Lote 2: duplicados, tabelas e chave do Vôlei

Onda 0 sugerida · saneamento · esforço M · ~2 dia(s) · cobre 8 achado(s), 8 crítico(s)/alto(s)

**Problema.** A tabela do Vôlei conta 3 dos 23 jogos de grupo: o masculino fica vazio e o feminino não mostra Inquisidores, invicta. Há 3 confrontos repetidos, um com vencedores opostos. A final masculina está numa fase 'Liga', as semis femininas saíram de uma tabela errada e o 3º set de Halterada × Halterada 2 ganhou 9 pontos.

**Solução.** Lote 2, conforme as decisões. Cancelar o jogo descartado de cada par, com motivo citando a decisão. Nas fases Liga das duas categorias, apagar os grupos: o FK zera groupId e a API passa a contar todos os jogos da fase numa tabela única, como já faz em fase sem grupo. No masculino, a fase 'Mata-mata' vira KNOCKOUT e match-1acd9089e543 vira category-7213ebd17f31-advanced-r1-1 (round 1, vaga 1, FK em cascata); com isso o recálculo encerra a categoria e o pódio aparece. Em generated-1, desfazer os 9 pontos dados em 4 s e gravar 16-14, etapa 3. Desfazer as 15 'Falta' do vôlei, se confirmado. Semis femininas: corrigir para os confrontos reais ou mandar para cancelamento.

**Tela alvo.** Não há tela nova. Na área pública, Modalidades → Vôlei Masculino abre uma tabela única de 5 equipes: Halterada 12, Halterada 2 9, Inquisidores ou Furiosa com 6 conforme a decisão, a outra com 3, Incinera 0. A final aparece como jogo de mata-mata, com Halterada 2 campeã. Vôlei Feminino: Inquisidores 12, Halterada 9, Mafiosa 6, Engenhosa 3, Furiosa 0.

**Critérios de aceite**

- [ ] Verificador: 0 jogos de vôlei encerrados fora da tabela (eram 20), 0 pares duplicados ativos (eram 3) e 0 fases Liga com grupos (eram 2).
- [ ] Vôlei Masculino com 10 jogos contados e pontos 12/9/6/3/0, com 3º e 4º conforme a decisão D-nn. Vôlei Feminino com 10 jogos: Inquisidores 12, Halterada 9, Mafiosa 6, Engenhosa 3, Furiosa 0. Conferido também pelo MCP de consulta.
- [ ] Vôlei Masculino com situação Encerrado e pódio Halterada 2 campeã, Halterada vice, sem nenhum jogo novo criado pelo recálculo.
- [ ] generated-1 com parciais 25-19, 25-27 e 16-14, etapa 3 e 126 lances ativos (eram 135).
- [ ] Semis do Vôlei Feminino com os confrontos da decisão, ou marcadas para cancelamento em SAN-I06.
- [ ] A tabela da tela interna e a da pública são iguais a phase_standings.

**Onde mexer.** API: `ops/saneamento/2026-10-lote-2.json (novo)`, `cancelarJogo: matches.status CANCELLED e reason nos 3 jogos descartados`, `removerGruposDaFase: groups das fases Liga de category-7213ebd17f31 e category-a15edc3a59ed (group_entries em cascata, matches.groupId SET NULL)`, `mudarTipoDaFase: phases.type de LEAGUE para KNOCKOUT na 'Mata-mata' do masculino e tournaments.format LEAGUE_KNOCKOUT`, `renomearPartida: matches.id com ON UPDATE CASCADE em match_events, match_period_results e match_corrections; round 1, bracketSlot 1`, `desfazerLances e definirParcial: 9 pontos e set 3 de generated-1; 15 'Falta' do vôlei, se confirmado`, `recomputeTournament nas duas categorias (o masculino vai a FINISHED por progressKnockout)`.

**Depende de:** SAN-I01; SAN-I02; SAN-I03. **Risco:** Renomear a final quebra links já compartilhados de /public/matches/match-1acd9089e543. Se EST mudar depois o cálculo da Liga, é preciso rodar o verificador de novo.

<sub>Achados: JDADOS-01, CHAVE-01, APIDOM-01, PUBLICO-R1, JESP-R1, VPUB-R1, APIDOM-R3, JDADOS-08</sub>

### SAN-I05 · Lote 3: converter os 7 W.O. do Handebol e alinhar regulamentos

Onda 0 sugerida · saneamento · esforço P · ~1 dia(s) · cobre 6 achado(s), 5 crítico(s)/alto(s)

**Problema.** Sete jogos de Handebol foram lançados como 10 gols em 15 a 40 s e aparecem como goleada 'Encerrada'; o status W.O. foi usado 0 vezes em 96 jogos. O regulamento diz W.O. 1×0 no Handebol e 3×0 no Vôlei, que é melhor de 3: placar impossível.

**Solução.** Primeiro, pela tela (Modalidades → Editar regras → W.O.), gravar o placar confirmado: Handebol 10×0, Vôlei 2×0, Futsal e Basquete conforme a decisão. Depois, o lote 3, porque a API não converte Encerrada em W.O. Em category-88353f80717f-j3, -j5, -j8 e -j10 e em category-9acae3d36bcb-j3, -j8 e -j9: status WALKOVER, walkoverWinnerEntryId e winnerEntryId do vencedor, placar 10×0 mantido, os 10 lances desfeitos e motivo 'W.O. lançado como gols (D-nn)'. Recalcular Handebol Masculino e Feminino. Como o placar não muda, tabela, chave e campeões ficam iguais.

**Tela alvo.** Modalidades → Handebol → Editar regras, bloco W.O.: campos 'placar do vencedor' e 'placar do perdedor', depois Salvar. O mesmo em Vôlei, Futsal e Basquete. Na agenda do Handebol, os 7 jogos passam a aparecer como W.O., com 10 × 0 e sem lista de gols.

**Critérios de aceite**

- [ ] 7 jogos com status W.O., vencedor gravado e 0 lances ativos (70 gols desfeitos).
- [ ] Tabelas iguais antes e depois: Handebol Feminino com Compressora 12, Halterada 9, Leões do Norte 6, Furiosa 3, Engenhosa 0; chave e campeões sem mudança.
- [ ] Vôlei com W.O. 2×0; o verificador acusa 0 modalidades por sets com W.O. acima de setsToWin; Handebol com o placar da decisão.
- [ ] Verificador: 0 jogos 'Encerrada' em 10×0 com 10 lances em menos de 60 s.

**Onde mexer.** API: `discipline/update pela tela (ação existente): rules.walkover de Handebol, Vôlei, Futsal e Basquete`, `ops/saneamento/2026-10-lote-3.json (novo)`, `converterEmWO: matches.status WALKOVER, walkoverWinnerEntryId, winnerEntryId e reason`, `match_events.undoneAt nos 70 gols`, `recomputeTournament de category-88353f80717f e category-9acae3d36bcb`.

**Depende de:** SAN-I01; SAN-I02. **Risco:** Se a organização disser que algum 10×0 foi jogo de verdade, ele sai do lote. Mudar o W.O. na regra não afeta outros jogos, porque o placar já está gravado.

<sub>Achados: MESA-04, REGRAS-02, JMESA-05, JDADOS-07, VADM-R4, APIDOM-09</sub>

### SAN-I06 · Dar desfecho ao basquete Ao vivo e aos 40 jogos vencidos

Onda 0 sugerida · saneamento · esforço M · ~2.5 dia(s) · cobre 2 achado(s), 2 crítico(s)/alto(s)

**Problema.** Desde 12/10, Mafiosa 23×10 Furiosa (category-5423d6f2cb7e-j3) segue Ao vivo com o relógio correndo. Outros 40 jogos seguem Agendada com data passada: Futsal Masculino 20, Basquete Masculino 12, Basquete Feminino 4 e Vôlei Feminino 4 (mata-mata). O público vê 'Próximo' e 0 — 0.

**Solução.** Aplicar a resposta de cada linha da ficha. W.O. com os dois lados definidos: Editar partida → W.O., com o placar já corrigido em SAN-I05. Não realizado: Cancelada pela tela, ou em lote quando forem muitos ou o lado for rótulo (a tela falha até AGD corrigir). Jogado: 'Lançar resultado' de MESA; se ainda não estiver em produção, a operação resultadoDaSumula do lote, validada por resolveActionRegulation. Por categoria: primeiro os grupos, depois o recálculo, a conferência dos confrontos que a API preencheu contra a súmula e só então o mata-mata. Basquete Ao vivo: placar da súmula pelo lote, ou W.O. ou Cancelada, limpando trava e relógio. Grupo com jogo cancelado leva ao cancelamento do mata-mata.

**Tela alvo.** Agenda interna, dia 12/10, filtrada pela modalidade: cada cartão vencido abre a partida. Em 'Editar partida', campo Estado (W.O. ou Cancelada) e motivo com o número da decisão; com MESA, botão 'Lançar resultado' com um campo por set ou o placar final. Para o basquete Ao vivo, há alternativa sem lote: Assumir o placar, completar e Encerrar. Ação principal: registrar o desfecho e voltar à lista.

**Critérios de aceite**

- [ ] 0 jogos Agendada com data até 12/10 (eram 40) e 0 Ao vivo (era 1), conferido no verificador e no resumo_dados.
- [ ] Todo jogo Cancelado ou W.O. tem motivo com o número da decisão, e todo resultado de vôlei tem parciais válidas pelo regulamento.
- [ ] Os confrontos de mata-mata preenchidos pela API conferem com a súmula em todos os casos; divergência é corrigida antes de lançar o resultado.
- [ ] Nenhum jogo de mata-mata recebe resultado antes de todos os jogos de grupo da categoria terem desfecho.
- [ ] Com MESA em produção, lançar o resultado de um jogo de futsal ou basquete leva no máximo 8 toques.

**Onde mexer.** API: `match/update (ação existente): W.O. e Cancelada pela tela Editar partida`, `match/recordResult (de MESA, quando estiver em produção)`, `ops/saneamento/2026-10-lote-4.json: resultadoDaSumula, cancelarJogo e ajustarPartida (operatorId, operatorHeartbeat, runningSince, paused)`, `recomputeTournament de category-4feee40a0955, category-5423d6f2cb7e, category-9ca6e7c7151c e category-a15edc3a59ed`.

**Depende de:** SAN-I02; SAN-I05; MESA: lançar resultado final direto por set (match/recordResult); AGD: editar e cancelar jogo com lado a definir (AGENDA-02). **Risco:** Até PUB e AGD trocarem o selo, Cancelado aparece no público como 'Encerrado' 0 — 0. E um jogo de grupo cancelado impede a API de semear o mata-mata.

<sub>Achados: JDADOS-05, JDADOS-03</sub>

### SAN-I07 · Encerrar categorias, limpar rascunhos e finalizar a edição 2026

Onda 0 sugerida · saneamento · esforço P · ~1 dia(s) · cobre 1 achado(s), 1 crítico(s)/alto(s)

**Problema.** Com o evento encerrado, Futsal Masculino e as duas categorias de Basquete seguem 'Publicado' e o Vôlei Feminino 'Em andamento'. Há 3 categorias de Futevôlei em Rascunho sem participante, a Kinesis sem categoria, texto de teste no responsável de uma equipe, e a edição continua 'Em andamento'.

**Solução.** Com os lotes 2 a 4 aplicados e o verificador sem pendência de jogo: na tela Gestão da categoria, Situação = Encerrado (ou Arquivado, se nada foi disputado) em category-4feee40a0955, category-5423d6f2cb7e, category-9ca6e7c7151c e category-a15edc3a59ed. Se a API recusar com 409, a situação entra no lote. Excluir as 3 de Futevôlei (category/delete já aceita rascunho vazio). Na equipe, apagar o texto de teste do responsável e arquivar a Kinesis, se confirmado. Ranking geral: fechar só depois de EST pontuar por categoria, ou registrar que 2026 não terá. Por último, o super admin marca a edição como Finalizada em Competições.

**Tela alvo.** Gestão da categoria: seletor Situação no topo; trocar para Encerrado e confirmar. Equipes → equipe → Dados: campo Responsável e botão Arquivar. Competições (super admin): cartão da edição 2026, Situação = Finalizada e Salvar. Ação principal: encerrar cada categoria e, por último, a edição.

**Critérios de aceite**

- [ ] 0 categorias Publicado ou Em andamento na edição (eram 5) e 0 em Rascunho (eram 3), salvo decisão registrada.
- [ ] O resumo_dados mostra a edição 2026 como 'Finalizada'.
- [ ] O verificador final não acusa nenhuma violação.
- [ ] Nenhuma equipe com texto de teste no campo responsável.
- [ ] Ranking geral fechado com os pontos por categoria conferidos contra os pódios, ou decisão registrada de que 2026 não terá ranking.

**Onde mexer.** API: `category/update (situação; ação existente), ou ajustarCategoria no lote se a tela receber 409`, `category/delete (existente) em category-e52270238f85, category-5dd574024429 e category-d2cfa80bcbc7`, `team/update (responsible e archived; existente)`, `ranking/close (existente), só depois de EST`, `edition/update com status 'Finalizada' (ação global do super admin)`.

**Depende de:** SAN-I04; SAN-I06; EST: pódio e ranking geral por categoria (JORG-02). **Risco:** Na API, Finalizada não bloqueia ações. Até ADM entregar 'Encerrar edição', qualquer admin ainda consegue alterar jogos depois do fechamento.

<sub>Achados: JDADOS-03</sub>

**Fora de escopo, de propósito**

- Expurgo de edition_action_receipts e de lances e batimentos na auditoria: é desempenho e rotina diária (SYNC, e ADM no caso da auditoria) e não muda placar nem tabela.
- Local 'A definir' em 89 jogos e horários inventados pelo importador: o evento passou e isso não altera resultado. A correção de fundo é de AGD, para o próximo evento.
- Quem iniciou cada jogo: startedById já está gravado nos 56 jogos e o erro está só no mapper do snapshot (MESA). Não há dado a reparar.
- Retificação inócua 0×2 → 0×2 de generated-8 e o JSON cru exibido: fica como histórico. Formatar e esconder é de PUB.
- Cadastro retroativo de atletas e do autor dos lances: não existe dado de origem (0 atletas). Fica com ATL, para o próximo evento.
- Ações novas como 'Anular partida encerrada' (match/annul), congelar o regulamento no jogo e trocar os rótulos do Basquete por estruturados: são features de EST e MESA. O saneamento usa o lote e não espera por elas.

**Perguntas para a organização**

- Para os 41 jogos sem desfecho (Futsal Masculino 20, Basquete Masculino 12 mais o Ao vivo, Basquete Feminino 4, mata-mata do Vôlei Feminino 4): quem responde pela organização e até quando? Sem resposta, qual o padrão: Cancelado com motivo 'sem resultado informado' e categoria Encerrada sem campeão, ou categoria Arquivada?
- Duplicados do Vôlei: qual jogo vale em Inquisidores × Furiosa (2×0, das 11:15, ou 0×2, das 15:00, de 10/10, com vencedores opostos), em Halterada 2 × Incinera (25-9 25-16 ou 25-1 25-1) e em Halterada × Inquisidores do feminino (10:30 ou 18:30 de 12/10)? O feminino foi turno único de 5? Teve mata-mata, com quais confrontos e placares?
- Os 7 jogos 10×0 do Handebol foram W.O.? Qual o placar oficial de W.O. de Handebol, Futsal, Vôlei e Basquete para gravar no regulamento?
- A classificação geral de 2026 será oficial e publicada (o que exige EST pontuar por categoria) ou a edição fecha sem ela? Futevôlei (3 rascunhos) e Kinesis: apagar, arquivar ou manter?


## MESA — Mesa de jogo e lançamento de resultado

**Objetivo.** Qualquer resultado entra e se corrige em segundos, ao vivo ou pela súmula, com placar, parciais e W.O. validados pelo regulamento. Nenhum jogo fica preso Ao vivo. A mesa ao vivo funciona nas quatro modalidades sem perder toques para painéis, relógio falso ou trava vencida.

**Princípios**

- Dois modos, um resultado oficial: a mesa ao vivo registra lance a lance e a súmula registra o resultado final. A súmula nunca gera lances fictícios, e todo jogo guarda a origem do resultado (ao vivo, súmula ou W.O.).
- O servidor valida pelo regulamento e o front usa uma cópia da mesma função pura para recusar antes de enviar, com frase de quadra ('o 3º set vai a 15', 'mata-mata não termina empatado').
- Nada cobre os controles da mesa: Desfazer, Fim do tempo e Encerrar ficam sempre visíveis acima da barra. Um painel só abre quando há o que escolher: sem elenco, nada de 'Quem marcou?'.
- A ação principal fica no cartão: do cartão da agenda privada ao placar, à súmula ou ao W.O. é um toque. Editar partida vira ação secundária e não muda mais o estado do jogo.
- Sem relógio fingido: enquanto a mesa não tiver cronômetro, nenhuma tela (mesa, detalhe, público) mostra relógio ou minuto do lance. Bastam a etapa e a hora real.
- Toda mudança de resultado depois do fato (retificação, W.O. de jogo encerrado, anular resultado, anular início) pede motivo, mostra 'antes → depois' e fica registrada com autor.

**Desenho alvo**

ESTADOS. Agendada/Adiada → Ao vivo → Encerrada. Agendada/Adiada/Ao vivo → W.O. Ao vivo → Agendada só por 'Anular início'. Encerrada/W.O. → Cancelada só por 'Anular resultado' (admin). Encerrada → W.O. só por conversão do admin. Editar partida deixa de levar a Ao vivo, Encerrada ou W.O.

ENTRADAS (um toque, no cartão da agenda privada e no detalhe): Placar | Resultado | W.O. | Continuar placar.

MODO AO VIVO, /matches/live?partida=ID, de cima para baixo: faixa da partida; placar e etapa, sem relógio; parciais; faixa reservada para avisos (jogo parado, autor do lance quando há elenco); duas colunas por equipe com os botões do esporte; rodapé fixo com Desfazer · Fim do tempo/Encerrar set · Encerrar partida. Antes do início: Iniciar · Lançar resultado · W.O. Vôlei decidido: só 'Encerrar partida 2 × 0'. A tela fica acesa e a trava é por aparelho, renovada a cada lance.

MODO SÚMULA, /matches/[id]/resultado (FolhaDeResultado). Vôlei: uma linha por set, e o Set 3 só aparece em 1 × 1. Modalidades por tempo: placar final, com 'por tempo' opcional. Desempate só quando o regulamento exige. Botões 'Salvar' e 'Salvar e próximo'. A mesma folha, pré-preenchida e com motivo, faz a retificação.

SAÍDA: 'Próximo jogo' da modalidade. O detalhe interno mostra a origem do resultado, quem iniciou e quem encerrou.

API. Ações novas: match/recordResult, match/reset, match/annul. Ações alteradas:
- registerEvent: recusa ponto com jogo decidido, aceita 'Set encerrado', renova a trava e grava o autor;
- undoEvent: apaga só a parcial criada pelo lance desfeito;
- updateClock: vira etapa sem runningSince;
- update: recusa Ao vivo e Encerrada; W.O. por sets vale setsToWin × 0; o admin converte Encerrada em W.O.;
- correctResult: aceita parciais e desempate e recusa retificação sem mudança;
- finish: grava a origem e quem encerrou.
Validador puro em src/edition-actions/match-result.ts, com cópia em lib/match-result.ts e a mesma tabela de casos.

MODELO. Uma migração: enum ResultSource (LIVE, SCORESHEET, WALKOVER); Match.resultSource, finishedAt, finishedById; MatchEvent.createdById. O snapshot passa a levar startedBy (lido de startedById), finishedBy, resultSource, lastActivityAt nos jogos ao vivo (também no público) e a retificação em texto ('0 × 3 (12-25 · 10-26)').

RELÓGIO. clockMode 'none' em todas as modalidades e como única opção da tela de regras. Uma só função, mesaTemRelogio(), decide para a mesa, o detalhe e a página pública.

### MESA-I01 · Relógio único: virar tempo funciona e o público não vê cronômetro falso

Onda 0 sugerida · correção · esforço M · ~3.5 dia(s) · cobre 14 achado(s), 12 crítico(s)/alto(s)

**Problema.** A mesa não tem relógio (hasClock fixo em false), mas Futsal, Handebol e Basquete estão com clockMode 'countdown'. A API recusa 'Avançar tempo' com 409, os 31 jogos encerrados ficaram no 1º tempo e o público vê cronômetro e todo gol em 12:00. 'Avançar set' do vôlei é botão morto.

**Solução.** Passo 0, hoje e sem deploy: gravar 'Sem cronômetro' em Futsal, Handebol e Basquete na tela de regras (DisciplineManager). Isso já destrava a virada de tempo e tira o relógio da página pública. No código, uma função única mesaTemRelogio(regulation) em lib/match-lifecycle.ts, lida pela mesa (no lugar do hasClock fixo), pelo MatchDetailClient e pela página pública, que passam a mostrar etapa e hora real do lance. O padrão de clockMode vira 'none' no front e na API, e a tela de regras oferece só 'Sem cronômetro'. updateClock passa a virar a etapa sem runningSince. No vôlei, 'Avançar set' sai e entra 'Encerrar set com este placar': lance 'Set encerrado' (SET_WON), com motivo, que credita o set ao líder e volta com Desfazer.

**Tela alvo.** Placar de handebol: abaixo do placar, '1º TEMPO DE 2', sem relógio. Rodapé: Desfazer · Fim do 1º tempo · Encerrar partida. Tocar 'Fim do 1º tempo' passa ao 2º sem diálogo. No vôlei não há 'Avançar set'; com o set parado fora do alvo, 'Encerrar set 21 × 19' pede confirmação e motivo. Na página da partida, cada lance mostra a etapa e a hora real (14:32), nunca minuto ou contagem regressiva.

**Critérios de aceite**

- [ ] Depois do passo 0, o snapshot público não traz runningSince em nenhuma partida de Futsal, Handebol ou Basquete, e a página dos 31 jogos encerrados não mostra relógio nem '12:00' (hoje mostra em todos)
- [ ] Spec da API: virar do 1º para o 2º tempo responde 200 em Futsal, Handebol e Basquete, com clockMode 'none' e com clockMode 'countdown', e grava a parcial do 1º tempo
- [ ] Encerrar no 2º tempo não pede 'Encerrar antes do previsto?' (no evento, os 31 encerramentos pediram)
- [ ] No vôlei não existe botão 'Avançar set'; 'Encerrar set com este placar' credita o set ao líder, grava a parcial e é desfeito por Desfazer
- [ ] Uma só função decide se há relógio: buscar 'hasClock = false' em apps/web/app não retorna nada

**Onde mexer.** Front: `apps/web/app/matches/live/page.tsx`, `apps/web/app/lib/match-lifecycle.ts`, `apps/web/app/lib/regulation.ts`, `apps/web/app/components/DisciplineManager.tsx`, `apps/web/app/components/MatchDetailClient.tsx`, `tests/e2e/sem-cronometro.spec.ts`, `tests/unit/match-lifecycle.test.ts`. API: `match-action.handler.ts updateClock: avançar etapa sem runningSince não exige relógio`, `match-action.handler.ts registerEvent: aceita 'Set encerrado' (EventType.SET_WON) em modalidade por sets, com motivo`, `action-regulation.ts: clockMode 'none' como padrão de Futsal, Handebol, Basquete, Queimado e genérico`, `spec nova handlers/virada-de-etapa.spec.ts`, `sem migração`.

**Depende de:** SAN: gravar 'Sem cronômetro' nas três modalidades em produção (passo 0). **Risco:** Mudar clockMode muda também a exibição dos jogos já encerrados, o que é desejado. Modalidade futura que precise de relógio fica sem ele até a mesa ter cronômetro.

<sub>Achados: MESA-02, MESA-09, REGRAS-03, REGRAS-R1, DADOS-01, TESTES-01, TESTES-R1, JMESA-01, JMESA-11, JMESA-R3, JDADOS-12, VPUB-08, NAV-R1, JDADOS-08</sub>

### MESA-I02 · Vôlei decidido trava o ponto, e desfazer preserva a parcial

Onda 0 sugerida · correção · esforço P · ~2 dia(s) · cobre 9 achado(s), 8 crítico(s)/alto(s)

**Problema.** Decidido o jogo, o botão Ponto segue ativo: um toque a mais fecha outro set (0×3 em melhor de 3, parcial 10-26), e desfazer apaga a parcial do último set. Aconteceu em 3 dos 24 jogos de vôlei. Com sets empatados, a API exige um desempate que a mesa nunca pede.

**Solução.** API: registerEvent recusa lance de pontuação em modalidade por sets quando um lado já tem setsToWin ('Partida decidida: 2 × 0. Encerre a partida'). undoEvent só apaga MatchPeriodResult do período previous.currentPeriod, e só se o lance desfeito mudou a contagem de sets; reducer.ts aplica a mesma regra no modo local. Com sets iguais, finish responde 'Informe o desempate para encerrar' em vez de 'O desempate deve ser um objeto'. Mesa: ao atingir setsToWin, os botões de ponto somem e fica um botão largo 'Encerrar partida 2 × 0'; em sets, evaluateFinish abre o desempate quando os sets estão iguais. O reparo dos 3 jogos fica com SAN.

**Tela alvo.** Vôlei, último ponto do 2º set: placar 2 × 0 e, logo abaixo, as parciais 25-18 · 25-20. No lugar das duas colunas de 'Ponto', um único botão verde de largura total, 'ENCERRAR PARTIDA 2 × 0', com Desfazer visível ao lado. Num 1 × 1 interrompido, Encerrar abre o desempate na mesma tela.

**Critérios de aceite**

- [ ] Spec da API: com 2 × 0 em melhor de 3, match/registerEvent 'Ponto' responde 409, e 'Set encerrado' também
- [ ] Spec: fechar o set decisivo, lançar 'Falta' e desfazer a falta mantém as 2 parciais (hoje a 2ª some)
- [ ] Desfazer o ponto que fechou o 2º set de um melhor de 5 remove só a parcial do 2º set e volta a 24-20 no set 2
- [ ] Verificador sobre o snapshot: 0 jogos de vôlei com sets acima de setsToWin ou com número de parciais diferente da soma dos sets (hoje 3)
- [ ] Encerrar vôlei em 1 × 1 com desempate administrativo grava a partida sem erro técnico

**Onde mexer.** Front: `apps/web/app/matches/live/page.tsx`, `apps/web/app/lib/match-lifecycle.ts`, `apps/web/app/lib/repositories/reducer.ts`, `tests/unit/match-lifecycle.test.ts`, `tests/unit/reducer.test.ts`. API: `match-action.handler.ts registerEvent: recusa pontuação com partida por sets já decidida`, `match-action.handler.ts undoEvent: apaga só a parcial criada pelo lance desfeito`, `match-action.handler.ts finish: mensagem clara quando falta o desempate em sets`, `spec nova handlers/volei-decidido.spec.ts`, `sem migração`.

**Depende de:** QA: verificador de invariantes de sets e parciais; EST: regulamento do vôlei conferido antes do jogo (melhor de 3, decisivo a 15). **Risco:** Se o regulamento do jogo estiver errado (por exemplo, melhor de 5), a trava segura o 3º set. Por isso depende de o regulamento ser conferido antes do jogo (EST).

<sub>Achados: MESA-03, REGRAS-01, REGRAS-R2, DADOS-R1, APIDOM-03, TESTES-03, JMESA-03, JDADOS-02, MESA-R3</sub>

### MESA-I03 · Lançar resultado pela súmula: ação match/recordResult e folha por esporte

Onda 0 sugerida · feature · esforço G · ~7 dia(s) · cobre 5 achado(s), 4 crítico(s)/alto(s)

**Problema.** 71% dos jogos foram digitados depois, toque a toque: 40 de 56 em rajada, 2.127 dos 2.689 lances, cerca de 88 toques por jogo de vôlei e parciais inventadas (25-1). O resultado chegou ao público com mediana de 206 min após o horário. 40 jogos seguem sem desfecho.

**Solução.** API: ação nova match/recordResult {id, periods?, scoreA?, scoreB?, tiebreak?} para partida Agendada, Adiada ou Ao vivo sem lance. Um validador puro (match-result.ts) aplica o regulamento: sets com alvo, decisivo e vantagem, parando em setsToWin; tempos somando o placar final; empate só quando a fase e a modalidade admitem, senão desempate obrigatório. A ação grava parciais, vencedor e status Encerrada e recalcula a tabela na mesma transação, sem eventos e sem startedAt. Migração: resultSource, finishedAt e finishedById em Match; createdById em MatchEvent. Front: rota /matches/[id]/resultado com FolhaDeResultado, cópia do validador em lib/match-result.ts e 'Salvar e próximo' pelos pendentes da modalidade. O bloco Desempate (dois números, vencedor deduzido, motivo opcional) substitui o da mesa.

**Tela alvo.** Topo: 'Halterada × Furiosa · Vôlei Fem. · Grupo A · 10/10 14:00'. No vôlei, linhas Set 1 e Set 2 com dois campos cada; o teclado numérico já abre e o cursor pula sozinho após 2 dígitos. O Set 3 só aparece em 1 × 1, avisando 'vai a 15'. Em futsal, handebol e basquete: placar final A e B, com 'informar por tempo' recolhido. Empate em mata-mata abre o Desempate. Rodapé fixo: 'Salvar' e 'Salvar e próximo (3 pendentes)'. No topo, o link 'Não houve jogo? W.O.'.

**Critérios de aceite**

- [ ] Lançar 25×18 25×20 a partir do detalhe custa 1 toque + 8 dígitos + 1 toque em Salvar, sem tocar em outro campo (hoje ~92 toques entre iniciar, 88 pontos e encerrar)
- [ ] Spec da API recusa set 25-24, set 30-20, 3º set depois de 2 × 0, futsal empatado em mata-mata sem desempate e partida com lado a definir; aceita 26-24 e 15-13 no set decisivo
- [ ] Partida lançada pela súmula aparece no snapshot como Encerrada, com parciais, resultSource SCORESHEET, sem eventos e sem startedAt, e a tabela da categoria recalcula na mesma revisão
- [ ] No ensaio com dados de produção, os 20 jogos de Futsal de 12/10 sem resultado são lançados em sequência por 'Salvar e próximo' em menos de 10 minutos
- [ ] O validador do front e o da API passam pela mesma tabela de casos (tests/unit/match-result.test.ts e spec da API)

**Onde mexer.** Front: `apps/web/app/matches/[id]/resultado/page.tsx (nova)`, `apps/web/app/components/FolhaDeResultado.tsx (novo)`, `apps/web/app/components/DesempateCampos.tsx (novo, usado também pela mesa)`, `apps/web/app/lib/match-result.ts (novo)`, `apps/web/app/lib/repositories/actions.ts e reducer.ts`, `tests/mock-api/server.ts`, `apps/web/app/matches/live/page.tsx (botão no pré-jogo e desempate novo)`, `apps/web/app/components/MatchDetailClient.tsx`. API: `ação nova match/recordResult em match-action.handler.ts`, `validador novo src/edition-actions/match-result.ts, usado também por finish e correctResult`, `edition-actions.types.ts e edition-actions.service.ts: registrar a ação em EDITION_ACTION_TYPES, MANAGER_ACTIONS e registry`, `migração 202610xx_resultado_da_partida: enum ResultSource, Match.resultSource, finishedAt, finishedById, MatchEvent.createdById`, `finish grava resultSource LIVE, finishedAt e finishedById; motivo do desempate opcional (o rótulo 'Pênaltis 3 × 2' vira o registro)`, `snapshot.mapper.ts: resultSource na partida`, `spec nova handlers/lancar-resultado.spec.ts`.

**Depende de:** EST: função única de fase eliminatória pelo formato da fase (REGRAS-R4). **Risco:** O validador existe em duas cópias (front e API) e pode divergir; a tabela de casos compartilhada reduz o risco. Jogo lançado pela súmula não alimenta artilharia nem fair play.

<sub>Achados: MESA-01, APIDOM-02, JMESA-02, JDADOS-04, JMESA-14</sub>

### MESA-I04 · W.O. em dois toques e Editar partida sem Ao vivo nem Encerrada

Onda 1 sugerida · feature · esforço M · ~4 dia(s) · cobre 12 achado(s), 11 crítico(s)/alto(s)

**Problema.** W.O. só existe num select de Editar partida (~8 toques, com motivo digitado) e aplicaria um placar diferente do praticado (handebol 1×0; vôlei 3×0 em melhor de 3). Resultado: 7 jogos de handebol viraram 10 gols clicados, com status Encerrada. O mesmo select encerra jogo ao vivo sem vencedor nem recálculo.

**Solução.** Front: FolhaDeWO, com dois botões grandes com escudo para escolher quem compareceu, o placar que será aplicado e o motivo pré-preenchido 'Ausência de X', editável. Abre pela mesa antes do início, pelo detalhe e pela folha de resultado, e usa o match/update com status W.O. que já existe. Editar partida: o select perde Ao vivo, Encerrada e W.O. e fica com Agendada, Adiada e Cancelada até AGD trocá-los por botões. API: match/update recusa Ao vivo e Encerrada ('inicie e encerre pelo placar'); em modalidade por sets, o W.O. vale setsToWin × 0. O admin da edição pode converter Encerrada em W.O. com motivo: os lances ficam marcados como desfeitos e uma MatchCorrection registra a mudança. É o caminho do SAN para os 7 jogos.

**Tela alvo.** Folha W.O. com o título 'Quem compareceu?' e dois botões altos lado a lado, cada um com escudo e nome. Ao tocar, aparece 'Placar aplicado: Halterada 10 × 0 Engenhosa (regulamento do Handebol)' e o motivo 'Ausência da Engenhosa', editável; 'Registrar W.O.' fica fixo no rodapé. Na mesa, antes do início: INICIAR PARTIDA e, abaixo, 'Lançar resultado' e 'W.O.' lado a lado.

**Critérios de aceite**

- [ ] Registrar W.O. pela mesa custa 3 toques (W.O., equipe presente, Registrar), sem digitar nada (hoje ~8 toques e motivo digitado)
- [ ] W.O. no vôlei em melhor de 3 grava 2 × 0, nunca 3 × 0, e a partida aparece com status W.O. no snapshot
- [ ] Spec: match/update com status 'Ao vivo' ou 'Encerrada' responde 409, e o select de Editar partida não oferece essas opções
- [ ] O admin converte um dos 7 jogos 10×0 em W.O.: status W.O., 10 lances marcados como desfeitos, retificação registrada com motivo e tabela recalculada; gestor de modalidade recebe 403

**Onde mexer.** Front: `apps/web/app/components/FolhaDeWO.tsx (novo)`, `apps/web/app/matches/live/page.tsx`, `apps/web/app/components/MatchDetailClient.tsx`, `apps/web/app/components/FolhaDeResultado.tsx`, `apps/web/app/components/MatchManager.tsx`, `apps/web/app/lib/match-lifecycle.ts (lista de transições só para o formulário)`, `tests/e2e/wo-pela-mesa.spec.ts`. API: `match-action.handler.ts canTransition: match/update sem LIVE e FINISHED como destino`, `match-action.handler.ts walkoverScore: em modalidade por sets, setsToWin × 0`, `match-action.handler.ts update: FINISHED → WALKOVER só com scope full, motivo, MatchCorrection e lances com undoneAt`, `spec nova handlers/walkover.spec.ts`, `sem migração`.

**Depende de:** EST: placar de W.O. de cada modalidade confirmado no regulamento; AGD: Adiar e Cancelar como botões no lugar do select. **Risco:** Se a organização não confirmar o placar de W.O. do handebol, converter os 7 jogos muda a tabela e o saldo de gols (de 10×0 para 1×0).

<sub>Achados: MESA-04, REGRAS-02, JMESA-05, JDADOS-07, VPUB-05, VADM-02, VADM-R4, AGENDA-10, APIDOM-09, MESA-07, AGENDA-03, DADOS-R2</sub>

### MESA-I05 · Retificar pela mesma folha da súmula e anular resultado errado

Onda 1 sugerida · feature · esforço M · ~4 dia(s) · cobre 7 achado(s), 1 crítico(s)/alto(s)

**Problema.** Retificar troca só o total: no vôlei a parcial 10-26 ficou errada, a página pública mostra JSON cru, a API aceitou 0×2 → 0×2 por envio duplo e qualquer número passa. Jogo encerrado errado ou duplicado não pode ser anulado pelo app.

**Solução.** API: correctResult aceita periods e tiebreak, passa pelo mesmo validador de match/recordResult e recusa retificação sem mudança. Regrava MatchPeriodResult e guarda antes e depois com as parciais. O mapper formata como '0 × 3 (12-25 · 10-26) → 0 × 2 (12-25 · 10-25)', inclusive os registros antigos em JSON. Ação nova match/annul {id, reason}, só para o admin da edição: Encerrada ou W.O. passa a Cancelada, sai da tabela, gera uma MatchCorrection e recalcula. Front: a retificação do MatchManager vira FolhaDeResultado em modo 'Retificar', pré-preenchida, com motivo obrigatório e botão travado durante o envio. Para o admin, 'Anular resultado' no fim da folha.

**Tela alvo.** Jogo encerrado, aba Editar: bloco 'Resultado oficial 0 × 3 · 12-25 · 10-26'. 'Corrigir resultado' abre a mesma folha da súmula já preenchida. Ao editar o set errado, aparece embaixo 'Fica: 0 × 2'. Motivo numa lista curta (Erro de digitação, Conferido na súmula, Decisão da organização) mais texto livre. Durante o envio, 'Retificar' vira 'Enviando…'. Para o admin, o link 'Anular este resultado' fica no rodapé.

**Critérios de aceite**

- [ ] Retificar Inquisidores × Furiosa para 12-25 · 10-25 grava sets 0 × 2 e as duas parciais certas numa única ação
- [ ] Spec: retificação igual ao placar atual responde 409, e set impossível (25-24) também
- [ ] Nenhuma tela mostra '{' numa retificação: o snapshot público traz antes e depois como texto '0 × 3', inclusive nas 2 retificações de outubro
- [ ] match/annul num jogo encerrado tira o jogo da tabela na mesma revisão; gestor de modalidade recebe 403

**Onde mexer.** Front: `apps/web/app/components/MatchManager.tsx`, `apps/web/app/components/FolhaDeResultado.tsx`, `apps/web/app/components/MatchDetailClient.tsx`, `apps/web/app/lib/repositories/actions.ts`, `apps/web/app/lib/repositories/reducer.ts`, `tests/mock-api/server.ts`. API: `match-action.handler.ts correctResult: aceita periods e tiebreak, passa pelo validador comum e recusa retificação sem mudança`, `ação nova match/annul (só scope full) em match-action.handler.ts`, `snapshot.mapper.ts mapCorrection: texto formatado com parciais, também para os registros antigos`, `edition-actions.types.ts e service.ts: registrar match/annul fora de MANAGER_ACTIONS`, `spec nova handlers/retificacao-por-parciais.spec.ts`, `sem migração (antes e depois já são Json)`.

**Depende de:** MESA-I03; EST: retificação de jogo de grupo não apaga a chave publicada (MESA-R1, APIDOM-04). **Risco:** Enquanto EST não corrigir, retificar jogo de grupo ainda apaga o mata-mata agendado. A folha deve listar esse impacto pelo nome do confronto antes de confirmar.

<sub>Achados: MESA-12, REGRAS-09, DADOS-10, TESTES-R4, VADM-R3, JMESA-08, APIDOM-R4</sub>

### MESA-I06 · Jogo parado Ao vivo: aviso, assumir, encerrar ou anular o início

Onda 1 sugerida · feature · esforço M · ~3 dia(s) · cobre 3 achado(s), 2 crítico(s)/alto(s)

**Problema.** Basquete Mafiosa × Furiosa ficou Ao vivo de 12/10 14:31 até o dia seguinte: último lance 14:52, último sinal 15:58. Nada avisa, e de Ao vivo só se sai encerrando com o placar parcial, adiando (mantém os lances) ou dando W.O.; não existe voltar a Agendada.

**Solução.** API: o snapshot, privado e público, passa a trazer lastActivityAt nas partidas Ao vivo, o mais recente entre último lance, último batimento e início. Ação nova match/reset {id, reason} para gestor da modalidade e admin: Ao vivo volta a Agendada, os lances ficam desfeitos e as parciais são apagadas; placar, etapa, início e trava são zerados. Recusa se outra mesa estiver com a trava ativa. Front: depois de 20 min sem atividade, uma faixa no placar e no detalhe interno oferece 'Assumir o placar', 'Encerrar com 23 × 10' e 'Anular início'. O motivo do anular é escolhido entre aberto por engano, não aconteceu e vou lançar pela súmula; esta última abre a folha de resultado. Os selos da agenda (AGD) e da área pública (PUB) leem o mesmo campo.

**Tela alvo.** Detalhe de uma partida ao vivo parada: faixa âmbar no topo, 'Sem lance desde 14:52 (há 1 h 06) · mesa: Evellyn'. Abaixo, três botões empilhados de 48 px: 'Assumir e continuar', 'Encerrar com 23 × 10' e 'Anular início'. 'Anular início' abre uma folha curta com os três motivos em botões e a confirmação 'Os 14 lances serão descartados'.

**Critérios de aceite**

- [ ] O snapshot público e o privado trazem lastActivityAt nas partidas Ao vivo; o basquete de 12/10 apareceria com 15:58
- [ ] Spec: match/reset leva Ao vivo para Agendada com placar 0 × 0, sem parciais, lances com undoneAt e startedAt nulo; exige motivo e recusa quando outro aparelho tem a trava ativa
- [ ] Depois do reset, match/start e match/recordResult funcionam na mesma partida
- [ ] Em teste com relógio simulado, a faixa aparece aos 20 min sem atividade e nunca antes

**Onde mexer.** Front: `apps/web/app/components/JogoParado.tsx (novo)`, `apps/web/app/matches/live/page.tsx`, `apps/web/app/components/MatchDetailClient.tsx`, `apps/web/app/lib/status.ts`, `apps/web/app/lib/repositories/actions.ts`, `apps/web/app/lib/repositories/reducer.ts`, `tests/mock-api/server.ts`. API: `snapshot.mapper.ts: lastActivityAt nas partidas LIVE, no snapshot público e no privado`, `ação nova match/reset em match-action.handler.ts`, `edition-actions.types.ts e service.ts: registrar match/reset em MANAGER_ACTIONS`, `spec nova handlers/anular-inicio.spec.ts`, `sem migração`.

**Depende de:** MESA-I03. **Risco:** Anular início descarta lances. Com motivo obrigatório e lances apenas marcados como desfeitos, o histórico continua consultável.

<sub>Achados: MESA-06, APIDOM-10, DADOS-R4</sub>

### MESA-I07 · Mesa sem painel no caminho, com tela acesa e trava estável

Onda 1 sugerida · reorganização de UX · esforço M · ~4 dia(s) · cobre 10 achado(s), 3 crítico(s)/alto(s)

**Problema.** 'Quem marcou?' abriu 2.670 vezes sem nenhum atleta cadastrado, inclusive no vôlei, cobrindo Desfazer e Encerrar. O overflow da tela anula o rodapé fixo. Sem Wake Lock a tela apaga, a trava de 2 min vence e reabrir o app faz o mesário virar 'outro operador'. Os sons dão 404.

**Solução.** 'Quem marcou?' só abre fora de modalidade por sets e quando o lado tem atleta inscrito. Vira uma faixa num espaço reservado entre placar e botões, nunca por cima, que fecha em 5 s e tem alvos de 44 px. .app-screen troca overflow: hidden por overflow-x: clip, e o rodapé da mesa volta a ficar fixo acima da barra. Wake Lock enquanto o jogo está ao vivo, pedido de novo ao voltar o foco. O operador passa a ser identificado por aparelho (localStorage), e a API renova a trava a cada lance aceito. Ao voltar o foco, a mesa reassume sem diálogo quando a trava é dela ou venceu. 'Passar o placar' para o batimento e mostra 'Mesa liberada'. Sons pelo appPath; vibração curta no lance confirmado.

**Tela alvo.** Futsal ao vivo sem elenco: tocar Gol soma e vibra, e nada mais aparece. Com elenco, uma faixa de nomes surge entre o placar e os botões, sem cobrir nada, e some em 5 s. O rodapé fica sempre visível acima da barra: Desfazer · Fim do tempo · Encerrar. Voltar do bloqueio de tela não mostra 'outro operador'. Quem passou a mesa vê 'Mesa liberada — Abrir de novo'.

**Critérios de aceite**

- [ ] Nenhum 'Quem marcou?' no vôlei nem para equipe sem atleta (no evento foram 2.670 aberturas em 2.670 lances)
- [ ] e2e a 360×640: .match-controls visível acima da barra inferior sem rolar, com e sem a faixa de autor
- [ ] Fechar e reabrir o PWA com a partida ao vivo: o mesmo usuário segue operando sem tocar em 'Assumir'
- [ ] Spec: lance aceito renova operatorHeartbeat; depois de 5 min de tela bloqueada, o primeiro toque após desbloquear é aceito
- [ ] O teste de caminhos de asset cobre /sounds com basePath, sem nenhum 404

**Onde mexer.** Front: `apps/web/app/matches/live/page.tsx`, `apps/web/app/lib/repositories/operator-device.ts`, `apps/web/app/lib/sound-effects.ts`, `apps/web/app/globals.css (.app-screen e .autor-do-lance)`, `apps/web/app/lib/edition-catalog.ts (eligibleAthletes para decidir se abre)`, `tests/e2e/mesa-controles-visiveis.spec.ts`, `tests/unit/caminhos-de-asset.test.ts`. API: `match-action.handler.ts: registerEvent, undoEvent e updateClock renovam operatorHeartbeat do próprio aparelho`, `spec nova handlers/trava-renovada.spec.ts`, `sem migração`.

**Depende de:** SYNC: lance enviado como incremento e estado 'enviando' visível; ATL: número de camisa no snapshot, para a faixa por número (opcional); QA: regressão visual no CI antes de mexer em .app-screen. **Risco:** Trocar o overflow de .app-screen afeta todas as telas; só entra com a regressão visual rodando no CI.

<sub>Achados: MESA-08, JMESA-13, JDADOS-R4, VPUB-04, JATL-13, MESA-11, DADOS-12, JMESA-12, CSS-R1, PWA-13</sub>

### MESA-I08 · Do cartão à mesa em um toque, próximo jogo e quem lançou

Onda 2 sugerida · reorganização de UX · esforço M · ~4.5 dia(s) · cobre 11 achado(s), 3 crítico(s)/alto(s)

**Problema.** Chegar ao placar custa 5 toques, 3 telas e rolagem; 'Editar partida' vem antes de 'Abrir placar'. Ao encerrar, não há próximo jogo. Iniciar fora da janela gravou 'Registre a justificativa' como justificativa em 21 de 56 jogos. Quem iniciou some (só 3 de 56) e ninguém sabe quem lançou.

**Solução.** Na agenda privada, quem opera a modalidade vê ações sob o cartão, fora do link: Placar, Resultado e W.O. em jogo agendado ou adiado; Continuar placar em jogo ao vivo. No detalhe, a ação principal vai para o topo e Editar partida para o fim. Ao encerrar, pela mesa ou pela súmula, aparece 'Próximo: A × B' da mesma modalidade, de preferência na mesma quadra. Início fora da janela: sem nota automática; o diálogo 'Começando agora?' traz marcado 'Atualizar horário da agenda para 14:31'. Jogo adiado pode ser iniciado. /matches/live sem partida mostra a lista dos jogos operáveis. O snapshot interno passa a ter startedBy (lido de startedById), finishedBy e resultSource, e cada lance grava createdById. O detalhe mostra 'Iniciada por X 14:31 · encerrada por Y 15:10 · ao vivo'.

**Tela alvo.** Agenda do gestor: sob cada cartão agendado, três botões de 44 px, Placar · Resultado · W.O.; no jogo ao vivo, só 'Continuar placar'. Detalhe: primeiro o botão verde largo da ação, depois as parciais; no rodapé, 'Editar partida' e a linha 'Iniciada por Evellyn 14:31 · lançada ao vivo'. Depois de encerrar, o cartão 'Próximo jogo: Furiosa × Voraz · Quadra 1' com 'Abrir placar' e 'Lançar resultado'.

**Critérios de aceite**

- [ ] Da agenda ao placar de um jogo agendado: 1 toque (hoje 5 toques e rolagem)
- [ ] Nenhum jogo iniciado depois do merge grava startNote automático (hoje 21 de 56)
- [ ] O snapshot interno traz startedBy de quem iniciou mesmo depois de liberar a trava (hoje só 3 de 56)
- [ ] Encerrar pela mesa ou salvar a súmula oferece o próximo jogo pendente da mesma modalidade a 1 toque
- [ ] /matches/live sem ?partida nunca abre um jogo sozinho: mostra a lista

**Onde mexer.** Front: `apps/web/app/components/MatchCard.tsx`, `apps/web/app/components/MatchSchedule.tsx`, `apps/web/app/components/MatchDetailClient.tsx`, `apps/web/app/matches/live/page.tsx`, `apps/web/app/components/ProximoJogo.tsx (novo)`, `apps/web/app/lib/match-lifecycle.ts (evaluateStart sem justificativa; Adiada pode iniciar)`, `apps/web/app/components/FolhaDeResultado.tsx`. API: `snapshot.mapper.ts: startedBy pela relação startedById; finishedBy e resultSource no snapshot interno`, `match-action.handler.ts start: deixa de gravar startNote vindo de audit.reason`, `match-action.handler.ts registerEvent: grava createdById (coluna da migração de MESA-I03)`, `spec de ida e volta: iniciar, liberar a trava, encerrar e conferir startedBy e finishedBy`.

**Depende de:** MESA-I03; MESA-I04; DS: cartão de jogo compacto. **Risco:** Botões sob o cartão aumentam a altura da agenda privada; é preciso combinar com a linha compacta de AGD e DS para não piorar a rolagem.

<sub>Achados: NAV-03, JMESA-06, VPUB-06, MESA-13, JMESA-10, MESA-14, DADOS-11, TESTES-14, JDADOS-13, ADMIN-R3, AGENDA-R3</sub>

### MESA-I09 · Mesa por esporte: colunas por equipe, cestas +1/+2/+3 e faltas contadas

Onda 2 sugerida · reorganização de UX · esforço G · ~6 dia(s) · cobre 4 achado(s), 0 crítico(s)/alto(s)

**Problema.** A mesa é igual para todo esporte: botões iguais nas duas colunas, nome da equipe em 9 px e falta sem contagem por período. No basquete, foram 6 'Cesta de 3' em 60 s para alcançar o placar, e o jogo foi largado no 1º período. No vôlei, 15 faltas foram tocadas por engano.

**Solução.** Duas colunas, uma por equipe, cada uma encabeçada por escudo de 28 px e nome de 14 px; a coluna A é preenchida e a B em contorno. Botões de pontuação grandes; secundários menores numa linha 'Mais'. Vôlei: cada metade da tela é o botão 'Ponto' de uma equipe, sem secundários. Futsal e handebol: Gol grande, Falta com contador por equipe e tempo ('Faltas 4', alerta na 5ª) e cartões separados quando o regulamento os tiver. Basquete: +2, +3 e +1 por equipe e faltas coletivas por período. Os contadores saem dos eventos, no front, sem mudar a API. 'Encerrar partida' fica isolado em largura total, 'Passar o placar' vai para o menu e a barra inferior some na mesa ao vivo.

**Tela alvo.** Basquete ao vivo: no topo, placar 58 × 41 e '2º TEMPO'. Duas colunas com escudo e nome; botões +2 e +3 grandes e +1 menor; 'Faltas 3' sob cada coluna, em âmbar no limite. Rodapé: Desfazer · Fim do tempo · Encerrar partida, sem barra de navegação. No vôlei, a tela se divide em duas metades tocáveis, 'Ponto Halterada' e 'Ponto Furiosa'.

**Critérios de aceite**

- [ ] Captura a 412 px das quatro mesas: nome da equipe com pelo menos 14 px e cada botão de pontuação com pelo menos 64 px de altura
- [ ] Basquete: registrar 2 + 3 + 1 para a mesma equipe custa 3 toques e soma 6 no placar
- [ ] O contador de faltas zera ao virar o tempo e bate com os eventos 'Falta' do período
- [ ] O vôlei não mostra botão de Falta nem outro secundário (no evento, 15 faltas foram tocadas por engano)
- [ ] A regressão visual da mesa de futsal e de vôlei roda no CI antes do merge

**Onde mexer.** Front: `apps/web/app/matches/live/page.tsx`, `apps/web/app/components/MesaColunaEquipe.tsx (novo)`, `apps/web/app/lib/mesa-por-esporte.ts (novo: botões e contadores por modalidade)`, `apps/web/app/globals.css (.event-btn, .event-actions, .match-controls)`, `apps/web/app/components/BottomNav.tsx`, `tests/e2e/mesa-por-esporte.spec.ts`. API: `nenhuma mudança: contadores derivados dos eventos já gravados`.

**Depende de:** MESA-I07; DS: tokens e botão base; SYNC: lance enviado como incremento e fila de envio; QA: regressão visual no CI. **Risco:** Mudar o layout às vésperas do evento confunde mesários já treinados; exige ensaio com voluntários e capturas de referência.

<sub>Achados: MESA-10, JMESA-07, VPUB-07, CSS-02</sub>

**Fora de escopo, de propósito**

- Cronômetro operado pela mesa (pausar, retomar, regressivo): nenhuma mesa usou relógio no evento e o ginásio tem placar próprio. Volta quando houver demanda e teste com o relógio do aparelho.
- Remover ou trocar um lance antigo no meio do jogo com reprocessamento de todos os eventos (a parte G de JMESA-08 e MESA-12): a retificação pela folha da súmula, depois do apito, resolve com uma fração do custo.
- W.O. duplo (as duas equipes ausentes) e pontuação própria do ausente na tabela: depende de regra da organização e de mudança no cálculo da tabela, que é de EST.
- Mesário sem conta (por QR ou código) e segundo aparelho como anotador: são questões de acesso (ADM), e um anotador não tem o que anotar sem atletas cadastrados (0 no evento).
- Foto da súmula anexada ao resultado: depende do storage, cuja rota no gateway ainda não existe, e não melhora a precisão do placar.
- Pênaltis acompanhados cobrança a cobrança e rotina automática que pausa ou encerra jogo parado: houve 1 desempate no evento, e com o relógio desligado o aviso de jogo parado (MESA-I06) basta.

**Perguntas para a organização**

- Qual o placar de W.O. de cada modalidade? Handebol fica 10 × 0, como a mesa lançou, ou 1 × 0, como está gravado no regulamento? E futsal e basquete? A resposta decide se converter os 7 jogos em W.O. mantém a tabela atual.
- Quem pode lançar resultado pela súmula: só gestor da modalidade e admin, como na mesa, ou também um mesário voluntário sem papel de gestão? O resultado da súmula precisa de conferência do admin antes de valer?
- A súmula de papel de futsal, handebol e basquete traz o placar de cada tempo? Se não traz, a folha pede só o placar final e o público verá esses jogos sem parciais.
- Depois de quantos minutos sem lance um jogo Ao vivo deve ser tratado como parado (proposta: 20)? E quem deve agir: o gestor da modalidade ou só o admin da edição?


## EST — Estrutura da competição: categoria, tabela, chave, pódio e ranking

**Objetivo.** Tabela, chave, pódio e ranking calculados só pela API, com invariantes que impedem jogo fora da tabela, chave apagada ou preenchida sem conferência. A organização monta a categoria num assistente e, com a categoria em andamento, ajusta equipes e grupos por ações auditadas, sem desenvolvedor.

**Princípios**

- A API é a única dona de tabela, chave e pódio. No modo API a tela mostra o snapshot e explica o porquê (critério, origem da vaga), e nunca recalcula.
- Nada some em silêncio. Todo jogo oficial conta em exatamente uma tabela ou aparece em 'fora da tabela' com o conserto ao lado, e toda recusa diz o que corrigir, com o nome da equipe e do grupo.
- Nada com data publicada ou com resultado é apagado por efeito colateral. Mudança de estrutura mostra antes, pelo nome, o que será criado, mantido e apagado.
- Passar de fase é decisão conferida. O app propõe vagas e pódio e uma pessoa confirma com um toque. O que é determinístico, como o vencedor de um jogo, segue sozinho.
- Controles fechados no lugar de texto livre (grupos gerados, vagas estruturadas, modelos) e rascunho local com um 'Salvar' por etapa, nunca gravação a cada tecla.
- Depois do primeiro jogo, os campos travados dão lugar às ações que ainda valem (incluir, retirar, renomear, mover, anular), com motivo e auditoria e pela mesma regra de trava da API.

**Desenho alvo**

Modelo (migrações, nesta ordem): Match.gameNumber, sourceA e sourceB (I05); PhaseStanding.criterion e tiePending (I06); TournamentEntry.withdrawnAt e withdrawReason (I07); OverallAward.tournamentId (I08); Match.rules (I09). O pódio e a chave confirmada ficam em Tournament.config, os sorteios em Phase.config. A vaga estruturada é uma de quatro formas: {grupo, posição}, {melhor Nº colocado, ordem}, {Nº geral da fase} ou {vencedor ou perdedor do jogo X}. O placeholder passa a ser só o texto gerado a partir dela. scheduledAt nulo continua permitido.

Invariantes que a API passa a garantir:
1. Todo jogo Encerrada ou W.O. de fase classificatória conta em exatamente uma tabela ou sai em foraDaTabela.
2. Liga não tem grupos, e jogo de Grupos tem grupo com as duas equipes nele.
3. category/update não apaga inscrição, fase ou grupo que tenha jogo. Retirar, renomear e mover são ações próprias.
4. Nenhuma ação apaga, por efeito colateral, jogo operado ou de mata-mata.
5. A vaga é uma estrutura que a API interpreta, nunca texto solto.
6. Vaga que vem da tabela só é preenchida por bracket/confirm. Vencedor ou perdedor de jogo entra sozinho.
7. Empate que os critérios não separam fica pendente até standings/resolveTie.
8. A situação da categoria deriva dos jogos, e Encerrado exige pódio confirmado.
9. Regulamento inválido não é salvo, e jogo iniciado usa a própria cópia da regra.

Ações novas: match/annul, category/assignGroup, category/recalculate, group/rename, bracket/confirm, standings/resolveTie, category/addEntry, category/withdrawEntry, category/close, category/reopen. Ações alteradas: match/schedule, match/update, match/correctResult, match/start, category/update, category/generateMatches, discipline/update, ranking/addAwards. Anular jogo, retirar equipe, reabrir categoria e registrar sorteio ficam só com o admin da edição. Tudo passa pelo pipeline atual: POST da ação e resposta com o snapshot.

O snapshot ganha: linhas da tabela com grupo, critério e empate pendente; foraDaTabela; round, roundLabel, gameNumber, phaseFormat e origem de cada jogo; integridade, propostas de vaga e pódio por categoria; marca de inscrição desistente.

Fluxo: assistente (Formato, Equipes, Grupos, Quem avança, Jogos, Publicar) → a MESA joga → recálculo a cada desfecho → o grupo fecha → Conferir chave → vencedores avançam sozinhos → Encerrar categoria (Pódio) → lançar no ranking, por categoria.

Telas da categoria (/tournaments/[id]): Tabela (com 'fora da tabela' para o staff), Jogos, Mata-mata (por rodada, com a origem de cada lado e Conferir chave), Gestão (assistente antes do 1º jogo; depois, faixa de situação e Ajustar categoria) e Pódio.

Quem consome: PUB (desenho da chave e campeões), NAV e IMP (pendências), AGD e IMP (seletor de vaga ao criar ou editar jogo), ATL (posição da equipe pelo grupo da linha oficial) e SAN (consertos do Vôlei com I01 e I02).

### EST-I01 · Tabela oficial conta todo jogo encerrado e lista os que ficaram fora

Onda 0 sugerida · correção · esforço M · ~6 dia(s) · cobre 15 achado(s), 14 crítico(s)/alto(s)

**Problema.** Em fase com grupos, a API só soma jogo com groupId e com as duas equipes no grupo, e Liga com grupos herdados sofre o mesmo. O Vôlei contou 3 de 23 jogos (Feminino 2 de 11, Masculino 1 de 12). Inquisidores, com 5 vitórias, ficou fora, e a chave saiu dessa tabela.

**Solução.** Recálculo: fase Liga vira tabela única com todos os jogos oficiais da fase, ignorando grupos. Fase Grupos conta jogo sem grupo pelo grupo comum às duas equipes. Jogo Cancelado deixa de travar o avanço. O que sobrar (equipe sem grupo, equipes de grupos diferentes) vai ao snapshot em phases[].foraDaTabela, com o motivo, e a linha da tabela passa a trazer o grupo. Consertos, todos com motivo e recálculo: mover jogo encerrado de grupo (match/update com phase), pôr equipe sem grupo num grupo (nova category/assignGroup, aceita com jogo operado), anular jogo encerrado (nova match/annul: vira Cancelada e guarda o placar) e category/recalculate. A aba Tabela desenha pelo formato da fase e nunca calcula localmente no modo API.

**Tela alvo.** Aba Tabela da categoria, vista por gestor e admin. No topo, faixa âmbar '3 jogos encerrados fora da tabela'. Tocar abre a lista, com linhas como 'Halterada × Inquisidores · 12/10 · 2×0 — Inquisidores sem grupo', cada uma com o botão do conserto sugerido ('Pôr Inquisidores no Grupo A', 'Mover para o Grupo B' ou 'Anular jogo'), motivo obrigatório e prévia da tabela. Abaixo vem a classificação: tabela única em Liga, uma aba por grupo em Grupos.

**Critérios de aceite**

- [ ] Recalcular o Vôlei Feminino conta os 11 jogos de grupo encerrados (hoje 2) e mostra Inquisidores com 5 vitórias. O Vôlei masculino conta os 12 (hoje 1).
- [ ] Em toda fase classificatória, jogos contados + foraDaTabela = jogos Encerrada ou W.O. da fase. O teste usa os dados de 13/10.
- [ ] Liga com grupos gravados mostra uma única tabela nas duas categorias de Vôlei, sem o texto 'Distribua equipes em...'.
- [ ] Anular, mover de grupo e pôr equipe em grupo exigem motivo, entram na auditoria e recalculam a tabela na mesma ação. Anular é só do admin da edição.
- [ ] No modo API a aba Tabela nunca chama calculateStandings. Sem linhas oficiais, mostra 'Tabela em preparação'.

**Onde mexer.** Front: `apps/web/app/components/TournamentClassification.tsx (abas pelo formato, sem cálculo local no modo API)`, `apps/web/app/components/ForaDaTabela.tsx (novo: faixa, lista e consertos)`, `apps/web/app/components/CategoryDetailView.tsx`, `apps/web/app/lib/frontend-state.ts (PhaseStandingState.group, TournamentPhase.foraDaTabela)`, `apps/web/app/lib/repositories/actions.ts (match/annul, category/assignGroup, category/recalculate)`, `apps/web/app/lib/repositories/reducer.ts (ramos do modo demonstração)`. API: `src/edition-actions/edition-action-recalculation.service.ts: recomputeTournament com Liga única, Grupos pelo grupo comum das equipes, Cancelada fora da trava de createFirstRound e função pura partidasContadas`, `src/edition-snapshots/snapshot.mapper.ts e dto/frontend-snapshot.dto.ts: phases[].foraDaTabela e standings[].group`, `src/edition-actions/handlers/match-action.handler.ts: match/update aceita phase em jogo oficial com motivo e recalcula; nova match/annul (Encerrada ou W.O. → Cancelada, com MatchCorrection)`, `src/edition-actions/handlers/category-action.handler.ts: novas category/assignGroup e category/recalculate`, `src/edition-actions/edition-actions.types.ts e edition-actions.service.ts: registrar as ações; match/annul fora de MANAGER_ACTIONS`, `spec nova com o fixture das duas categorias de Vôlei de outubro`, `Sem migração`.

**Depende de:** nada. **Risco:** O recálculo muda na hora a tabela pública do Vôlei, então é preciso combinar com a organização. Os confrontos duplicados contam em dobro até o SAN anulá-los.

<sub>Achados: CHAVE-01, AGENDA-R1, APIDOM-01, APIDOM-R1, APIDOM-R4, PUBLICO-R1, JESP-R1, JDADOS-01, JDADOS-R1, VPUB-R1, SCRIPTS-R1, JORG-R1, CHAVE-11, VADM-R1, CHAVE-05</sub>

### EST-I02 · Retificar, anular ou mover jogo sem apagar a chave publicada

Onda 0 sugerida · correção · esforço M · ~3 dia(s) · cobre 3 achado(s), 3 crítico(s)/alto(s)

**Problema.** Quando a origem é jogo de grupo, correctResult apaga todo jogo '-advanced' agendado. Somem dia, hora, local e rótulos, e a chave volta por semeadura no dia seguinte às 18:00. Com o mata-mata operado, a API recusa e manda 'anular', ação que não existe. No Futsal Masculino, 8 jogos de chave publicados estão expostos a isso.

**Solução.** Nenhuma ação apaga jogo da chave. preencherParticipantes deixa de zerar placeholderA/B, e o rótulo fica guardado. Em correctResult, match/annul e troca de grupo, a API recalcula e compara quem ocupa cada vaga antes e depois. Vaga que mudou em jogo Agendado volta ao rótulo e é preenchida de novo pela regra vigente, com o mesmo dia, hora e local. Se o jogo afetado já começou, a API recusa e nomeia o jogo ('Semifinal 1: Furiosa sairia'). Se nenhuma vaga muda, a retificação é aceita mesmo com o mata-mata iniciado. O registro de auditoria leva o que mudou na chave.

**Tela alvo.** No diálogo de retificar (tela da MESA) e nos consertos de EST-I01, bloco 'Mata-mata desta categoria' antes do botão de confirmar. Ele lista os jogos agendados que dependem da tabela, com dia e hora, e diz: 'Se a classificação mudar, só as equipes trocam; data, hora e local ficam'. Depois de confirmar, um aviso diz o que mudou ('Semifinal 1: sai Furiosa, entra Inquisidores'). Se o jogo já começou, a recusa nomeia o jogo.

**Critérios de aceite**

- [ ] Retificar um jogo de grupo do Futsal Masculino mantém os 8 jogos de mata-mata agendados com o mesmo id, data, hora e local.
- [ ] Retificação que muda o 2º do Grupo A troca só esse lado na 1ª rodada e registra na auditoria 'Quartas 2: sai X, entra Y'.
- [ ] Retificação que não muda nenhuma vaga é aceita com o mata-mata já iniciado (hoje é recusada).
- [ ] Retificação que trocaria equipe de jogo Ao vivo ou Encerrado é recusada com o nome do jogo, e nada é gravado.
- [ ] Nenhum caminho de correctResult, match/annul ou troca de grupo chama match.deleteMany (teste).

**Onde mexer.** Front: `apps/web/app/components/MatchManager.tsx (texto do aviso de retificação e lista de dependentes, coordenado com a MESA)`, `apps/web/app/lib/tournament-progression.ts (CorrectionImpact passa a listar dependentes em vez de 'refazer')`. API: `src/edition-actions/handlers/match-action.handler.ts: correctResult e dependentMatches sem deleteMany, com comparação de vagas antes e depois`, `src/edition-actions/edition-action-recalculation.service.ts: preencherParticipantes mantém o placeholder; nova reabrirVagas preserva dia, hora e local`, `src/edition-actions/chave-publicada.spec.ts atualizado e nova retificacao-preserva-chave.spec.ts`, `Sem migração`.

**Depende de:** EST-I01; MESA: retificação de placar e parciais (diálogo e validação do placar). **Risco:** Chave criada pela semeadura, sem rótulo guardado, volta pela semeadura. As vagas só ficam explícitas com EST-I05.

<sub>Achados: CHAVE-R1, APIDOM-04, MESA-R1</sub>

### EST-I03 · Invariantes de estrutura na API e grupos com renomeação própria

Onda 1 sugerida · correção · esforço M · ~4.5 dia(s) · cobre 5 achado(s), 4 crítico(s)/alto(s)

**Problema.** A API aceita jogo de grupo com equipe de outro grupo, jogo agendado direto na fase, Liga com grupos e 'grupo c' ao lado de 'Grupo A'. category/update apaga inscrição, fase ou grupo com jogos ligados (SetNull/Cascade) sem avisar: os jogos ficam com lado 'Equipe A' ou saem da tabela.

**Solução.** Validação na escrita, com uma frase que diz o que corrigir. match/schedule, match/update e generateMatches exigem, em fase Grupos, grupo definido e as duas equipes nele; trocar o adversário reatribui o grupo quando as duas são do mesmo. category/update força Liga sem grupos, compara nomes de grupo sem diferenciar caixa nem acento e recusa retirar inscrição, fase ou grupo com jogo ligado, devolvendo a lista desses jogos. A nova group/rename preserva os vínculos. Um verificador puro, o mesmo do recálculo, publica tournaments[id].integridade no snapshot: equipe sem grupo, confronto repetido na fase, vaga não interpretável e situação desatualizada. NAV e IMP consomem esse resultado.

**Tela alvo.** Sem tela nova. Em Novo jogo e Editar partida, a recusa aparece junto ao campo: 'Mafiosa é do Grupo B; escolha outra equipe ou mova Mafiosa'. Na Gestão, cada grupo ganha 'Renomear' na própria linha. Desmarcar equipe com jogos abre um diálogo que lista os jogos dela e oferece só 'Retirar equipe' (EST-I07) ou desistir.

**Critérios de aceite**

- [ ] match/schedule com equipe fora do grupo é recusado com 409, e a mensagem nomeia a equipe e o grupo. A spec cobre schedule, update e generateMatches.
- [ ] Renomear 'grupo c' para 'Grupo C' no Handebol Masculino mantém os 3 jogos e as 3 equipes no grupo, mesmo com jogos operados.
- [ ] Criar 'grupo a' ao lado de 'Grupo A' é recusado.
- [ ] category/update que retire equipe com jogo ligado é recusado e devolve a lista. Nenhum jogo fica com lado nulo.
- [ ] O verificador rodado nos dados de 13/10 aponta os 3 confrontos repetidos do Vôlei e os rótulos '2º geral' e 'Melhor classificada' do Basquete.

**Onde mexer.** Front: `apps/web/app/components/TournamentManager.tsx (renomear grupo e confirmação ao desmarcar equipe com jogos)`, `apps/web/app/components/MatchCreationForm.tsx e MatchManager.tsx (recusa exibida no campo, coordenado com AGD)`, `apps/web/app/lib/repositories/actions.ts (group/rename)`, `apps/web/app/lib/frontend-state.ts (tournaments[id].integridade)`. API: `src/edition-actions/handlers/match-action.handler.ts: phaseContext e participanteDefinido checam o grupo das equipes`, `src/edition-actions/handlers/category-action.handler.ts: parseSetup, reconcileSetup e reconcileEntries recusam remoção com jogo ligado e forçam Liga sem grupos; createMatch com a mesma checagem`, `nova group/rename no handler de categoria, por fase e nome, com unicidade sem caixa nem acento`, `src/edition-actions/integridade-da-categoria.ts (novo, verificador puro)`, `src/edition-snapshots/snapshot.mapper.ts: integridade por categoria no snapshot privado`, `Sem migração`.

**Depende de:** EST-I01; AGD: detecção de confronto duplicado no agendamento. **Risco:** O importador e os scripts que agendam jogo pelo nome da fase passam a ser recusados. Ajustar o importar-copa.mjs (IMP) no mesmo ciclo.

<sub>Achados: CHAVE-13, CHAVE-R2, APIDOM-R2, SCRIPTS-11, JDADOS-11</sub>

### EST-I04 · 'Montar os jogos' só cria o que falta, com prévia e desfazer

Onda 1 sugerida · correção · esforço M · ~4 dia(s) · cobre 7 achado(s), 7 crítico(s)/alto(s)

**Problema.** O botão só enxerga ids '-generated-' e só pede confirmação se generated=true. A API apaga todo '-generated-' e '-advanced' antes de recriar o turno inteiro, com data inventada (início da edição, 08:00 + índice, 'A definir'). No Vôlei masculino ficaram 10 gerados sobre os importados, 2 confrontos repetidos e a chave perdida.

**Solução.** generateMatches passa a ser aditivo. A API compara por par de equipes e fase, em qualquer id e exceto Cancelada, e pula o que já existe. Nunca apaga jogo operado nem de mata-mata; só apaga ids listados explicitamente em 'substituir', e só se estiverem Agendados e nunca iniciados. O front calcula a prévia a partir do snapshot: já existem, serão criados, serão apagados (vazio por padrão). Data, horário do 1º jogo, intervalo e quadra são pedidos, nunca inventados; montar sem horário depende do modo sem horário da AGD. Cada montagem grava um lote no prefixo do id, e 'Desfazer esta montagem' exclui o lote enquanto nenhum jogo dele começou. EST-I07 reusa isto para incluir equipe.

**Tela alvo.** Gestão, etapa 'Montar os jogos'. Um cartão de prévia com três blocos contados: 'Já existem (10)', 'Serão criados (2)', com os confrontos pelo nome, e 'Nada será apagado'. Abaixo, campos Dia, Horário do 1º jogo, Intervalo e Quadra. Botão principal 'Criar 2 jogos'. Depois de criar, faixa 'Montagem de 14/10 · 2 jogos · Desfazer' enquanto nenhum deles começou.

**Critérios de aceite**

- [ ] No Vôlei masculino de produção, a prévia mostra 0 a criar e 0 a apagar, e o botão fica desativado com 'nada a montar'.
- [ ] Em categoria com chave importada (Futsal Masculino), montar não toca nos 8 jogos de mata-mata nem nos 15 de grupo.
- [ ] A API recusa generateMatches que apagaria jogo operado ou de mata-mata, mesmo com motivo.
- [ ] Os jogos criados recebem a data e o horário escolhidos (horário + n × intervalo). Nenhum recebe o início da edição por padrão.
- [ ] Desfazer remove só os jogos do último lote e fica indisponível quando um deles começa.

**Onde mexer.** Front: `apps/web/app/components/TournamentManager.tsx (generateConfrontations)`, `apps/web/app/components/MontarJogos.tsx (novo: prévia, campos e desfazer)`, `apps/web/app/lib/tournament-engine.ts (generateRoundRobin com pares já existentes)`, `apps/web/app/lib/repositories/actions.ts (payload com 'substituir' e lote)`. API: `src/edition-actions/handlers/category-action.handler.ts: generateMatches aditivo, sem deleteMany implícito, campo 'substituir' restrito a jogos agendados e nunca iniciados`, `reuso das checagens de grupo de EST-I03 em createMatch`, `spec montar-os-jogos.spec.ts com o Vôlei masculino de outubro`, `Sem migração (lote no id: <categoria>-generated-<lote>-<n>)`.

**Depende de:** EST-I03; AGD: jogo sem horário (modo A SEGUIR). **Risco:** Categorias com o contrato antigo (generated=true) mudam de comportamento. O importador (IMP) precisa usar a mesma regra de par existente.

<sub>Achados: CHAVE-06, AGENDA-R2, SCRIPTS-R2, JORG-R2, APIDOM-R3, SCRIPTS-03, DOCS-R2</sub>

### EST-I05 · Vagas do mata-mata estruturadas, com número do jogo e rodada nos dados

Onda 1 sugerida · feature · esforço G · ~8 dia(s) · cobre 9 achado(s), 5 crítico(s)/alto(s)

**Problema.** A vaga é texto livre de até 180 caracteres. '2º geral', 'Melhor classificada' e 'Melhor 2º colocado' (5 de 8 categorias) não são lidos, e a chave cai na semeadura automática. Rodadas seguintes sempre cruzam vaga 1 × vaga 2. O snapshot não envia rodada nem número, e os 24 jogos eliminatórios aparecem como 'Mata-mata'.

**Solução.** Migração com Match.gameNumber, sourceA e sourceB (JSON: grupo e posição, melhor Nº colocado e ordem, Nº geral da fase, vencedor ou perdedor do jogo X). O placeholder passa a ser texto gerado da vaga. A progressão resolve cada lado pela sua vaga, em qualquer rodada, sem a aritmética de vagas nem o id '-advanced-'. Vencedor ou perdedor preenche sozinho; vaga que vem da tabela espera EST-I06; rodada nova sem jogo agendado nasce sem horário, nunca com data inventada. match/schedule e match/update aceitam a vaga e recusam rótulo que não interpretam. O snapshot ganha round, roundLabel, gameNumber, phaseFormat e a origem de cada lado. Um script idempotente converte os rótulos e numera os jogos.

**Tela alvo.** Gestão → Mata-mata: lista por rodada (Quartas, Semifinal, 3º lugar, Final). Cada jogo aparece como 'J16 · Semifinal 1 · 14/10 16:00', com os dois lados e a origem de cada um ('Vencedor de J13', '1º do Grupo A'). Tocar num lado abre o seletor de vaga, com o tipo em botões e o alvo em lista. Lado com rótulo antigo que a API não interpreta aparece em vermelho, 'Defina de onde vem', e bloqueia a conferência.

**Critérios de aceite**

- [ ] Os 24 jogos de mata-mata de produção saem no snapshot com roundLabel e gameNumber, e nenhum depende do nome da fase para ser tratado como eliminatório.
- [ ] O script em simulação converte os 15 rótulos de 13/10 e lista os que não interpreta ('2º geral', 'Melhor classificada'). A 2ª execução não altera nada.
- [ ] match/schedule com rótulo fora da gramática é recusado com 'escolha a vaga'.
- [ ] A semifinal do Futsal Masculino 'Vencedor QF1 × Vencedor QF3' é preenchida pelos jogos certos, sem reordenar as quartas.
- [ ] Mesa, aba Chaveamento e trava de elenco usam isKnockout pelo formato da fase. O teste inclui uma fase chamada 'Playoffs'.

**Onde mexer.** Front: `apps/web/app/lib/bracket-source.ts (novo: tipos de vaga, rótulo legível, isKnockout)`, `apps/web/app/components/BracketSlotPicker.tsx (novo seletor de vaga, reaproveitado por AGD e IMP)`, `apps/web/app/components/MataMataGestao.tsx (novo: lista por rodada na Gestão)`, `apps/web/app/lib/match-lifecycle.ts:43 e apps/web/app/lib/eligibility.ts:55 (regex pelo nome trocada por isKnockout)`, `apps/web/app/components/TournamentClassification.tsx:94 (filtro pelo formato da fase)`, `apps/web/app/lib/tournament-progression.ts (rodada lida do snapshot, não do id)`, `apps/web/app/lib/frontend-state.ts (round, roundLabel, gameNumber, phaseFormat, sourceA/B)`. API: `migração match_bracket_source: Match.gameNumber Int?, sourceA Json?, sourceB Json?`, `src/edition-actions/colocacao-do-chaveamento.ts vira vaga-do-chaveamento.ts (rótulo legado → vaga; recusa o que não interpreta)`, `src/edition-actions/edition-action-recalculation.service.ts: progressKnockout e createRound por vaga, sem sequentialPairs nem nextDate`, `src/edition-actions/handlers/match-action.handler.ts: schedule e update aceitam sourceA/sourceB`, `src/edition-snapshots/snapshot.mapper.ts e dto: round, bracketSlot, roundLabel, gameNumber, phaseFormat e origem`, `script converter-vagas.ts (idempotente, com --simular), que usa planejarCopa para numerar os jogos`, `specs chave-publicada e chave-preenchida reescritas para vagas`.

**Depende de:** EST-I02. **Risco:** Mexe na progressão que funcionou no evento, então o replay dos jogos reais (QA) deve rodar antes do merge. Rótulos ambíguos dependem de decisão da organização.

<sub>Achados: CHAVE-04, SCRIPTS-06, SCRIPTS-12, SCRIPTS-13, AGENDA-13, JDADOS-10, REGRAS-R4, JORG-03, CHAVE-R4</sub>

### EST-I06 · Conferir a chave antes de preencher e registrar empate sem critério

Onda 1 sugerida · feature · esforço G · ~7 dia(s) · cobre 8 achado(s), 6 crítico(s)/alto(s)

**Problema.** Ao encerrar o último jogo de grupo, a API preenche a chave na mesma transação, sem prévia, e um jogo Cancelado trava tudo para sempre. O 'sorteio' é a ordem do id interno, e a tabela não diz qual critério decidiu. No Vôlei Feminino, as semifinais saíram de uma tabela errada.

**Solução.** Vagas que vêm da tabela deixam de ser preenchidas no finish. O recálculo só gera a proposta de cada vaga quando o grupo dela fecha (Encerrada ou W.O.; Cancelada não bloqueia). PhaseStanding ganha criterion, o critério que separou a linha, e tiePending, para empate esgotado ou 'sorteio'. A nova standings/resolveTie grava a ordem sorteada, com motivo e autor, em Phase.config. A nova bracket/confirm grava os lados confirmados (pode trocar, com motivo) e mantém dia, hora e local. Melhores Nº colocados são comparados por aproveitamento e pela ordem de critérios do regulamento. Os cenários de desempate ficam num arquivo único de casos.

**Tela alvo.** Aviso na categoria e no painel: 'Grupo A encerrado: confira 2 vagas'. A tela Conferir chave mostra a tabela final de cada grupo fechado, com linha de corte e critério ('saldo'). Abaixo, cada confronto da 1ª rodada com a equipe proposta e a origem ('1º A · 9 pts'). Pendências aparecem em vermelho: 'Faltam 2 jogos do Grupo C', 'Empate Furiosa × Halterada: registrar sorteio'. Botão fixo: 'Confirmar 4 vagas'.

**Critérios de aceite**

- [ ] Encerrar o último jogo de grupo não altera nenhum jogo de mata-mata, e a categoria passa a mostrar 'Chave pronta para conferir'.
- [ ] A vaga do Grupo A pode ser confirmada com o Grupo C ainda em andamento.
- [ ] Empate sem critério aparece como 'empate: aguardando sorteio' e impede confirmar as vagas afetadas até standings/resolveTie.
- [ ] Cada linha oficial traz o critério que a separou. No Futsal Feminino, a vaga na final mostra 'saldo'.
- [ ] O arquivo de cenários cobre os 7 critérios, empate triplo e confronto direto, e roda no CI da API.

**Onde mexer.** Front: `apps/web/app/components/ConferirChave.tsx (novo)`, `apps/web/app/components/TournamentClassification.tsx (critério e 'aguardando sorteio' por linha)`, `apps/web/app/components/CategoryDetailView.tsx (aviso e entrada na aba Mata-mata)`, `apps/web/app/lib/repositories/actions.ts (bracket/confirm, standings/resolveTie)`, `apps/web/app/lib/frontend-state.ts (criterion, tiePending, propostas)`. API: `migração phase_standing_tiebreak: PhaseStanding.criterion String?, tiePending Boolean @default(false)`, `src/edition-actions/edition-action-recalculation.service.ts: rankBlock devolve o critério; collectQualifiers por aproveitamento; createFirstRound vira geração de propostas`, `novas bracket/confirm e standings/resolveTie no handler de categoria (sorteio só do admin)`, `src/edition-snapshots/snapshot.mapper.ts: criterion, tiePending, propostas e pendências por categoria`, `src/edition-actions/desempate-cenarios.spec.ts (casos compartilhados)`.

**Depende de:** EST-I05. **Risco:** Acrescenta um passo humano no dia de jogo: sem ninguém para conferir, a semifinal não abre. O gestor da modalidade também deve poder confirmar.

<sub>Achados: CHAVE-02, CHAVE-10, REGRAS-05, DOCS-02, JORG-07, VPUB-11, AGENDA-07, TESTES-05</sub>

### EST-I07 · Incluir e retirar equipe com a categoria em andamento

Onda 1 sugerida · feature · esforço G · ~6 dia(s) · cobre 10 achado(s), 8 crítico(s)/alto(s)

**Problema.** Depois do primeiro jogo operado, a API congela participantes e grupos. A tela trava pela situação e mostra campos editáveis que respondem 409. A Compressora saiu do Vôlei Feminino com 4 jogos reescritos à mão, e 3 equipes não entraram no masculino porque o PR 41 não foi mergeado.

**Solução.** Duas ações auditadas. category/addEntry {equipe, grupo, motivo}, feita revisando e adaptando o PR 41, inscreve a equipe sem mexer no resto; em seguida 'Montar os jogos' (EST-I04) cria só os confrontos que faltam. category/withdrawEntry {equipe, modo, motivo}, com migração em TournamentEntry: numa só transação, os jogos Agendados ou Adiados da equipe viram W.O., com o placar do regulamento, ou Cancelada; os encerrados seguem valendo; vaga de mata-mata já ocupada por ela vira W.O. do adversário. A linha da tabela mostra 'Desistente'. A tela calcula a trava pela mesma regra da API (jogo operado), não pela situação.

**Tela alvo.** Gestão com jogo operado: resumo da estrutura só para leitura e o painel 'Ajustar categoria', com três botões: Incluir equipe, Retirar equipe, Renomear grupo. Em Retirar: escolher a equipe, ver '4 jogos pendentes' e '3 já disputados (continuam valendo)', escolher 'W.O. para o adversário (2×0)' ou 'Cancelar jogos', dar um motivo único e tocar 'Aplicar a 4 jogos'. Em Incluir: equipe e grupo, com prévia dos jogos a criar.

**Critérios de aceite**

- [ ] Retirar a Compressora do Vôlei Feminino aplica W.O. aos jogos pendentes dela com 1 ação e 1 motivo (no evento foram 4 edições à mão).
- [ ] Incluir Devoradora, Kinesis e Compressora no Vôlei masculino em andamento preserva os 13 jogos e cria só os confrontos novos do grupo.
- [ ] A tabela marca a equipe como 'Desistente', e os jogos encerrados dela continuam contados.
- [ ] Com jogo operado, a Gestão não mostra campo editável que a API recusaria. O teste usa o Futsal Masculino 'Publicado' com 3 encerrados.
- [ ] A desistência fica na auditoria com autor, motivo e a lista de jogos alterados.

**Onde mexer.** Front: `apps/web/app/components/AjustarCategoria.tsx (novo)`, `apps/web/app/components/TournamentManager.tsx (trava por jogo operado)`, `apps/web/app/lib/status.ts (estruturaTravada derivada dos jogos)`, `apps/web/app/components/TournamentClassification.tsx (selo 'Desistente')`, `apps/web/app/lib/repositories/actions.ts (category/addEntry, category/withdrawEntry)`. API: `migração entry_withdrawal: TournamentEntry.withdrawnAt, withdrawReason, withdrawnById`, `src/edition-actions/handlers/category-action.handler.ts: category/addEntry (a partir do PR api#41) e category/withdrawEntry (só admin)`, `src/edition-actions/handlers/match-action.handler.ts: walkoverScore reaproveitado no lote`, `src/edition-actions/edition-action-recalculation.service.ts: inscrição desistente na tabela e na vaga`, `src/edition-snapshots/snapshot.mapper.ts: entradas desistentes`, `specs de inclusão e de desistência com jogos encerrados e pendentes`.

**Depende de:** EST-I03; EST-I04. **Risco:** W.O. em lote muda a tabela de uma vez. A regra (W.O. ou cancelar) precisa de decisão da organização antes do uso.

<sub>Achados: CHAVE-03, APIDOM-11, DOCS-04, SCRIPTS-02, JORG-01, AGENDA-14, EQUIPES-06, VADM-03, JDADOS-06, DOCS-R4</sub>

### EST-I08 · Situação derivada dos jogos, pódio confirmado e ranking por categoria

Onda 1 sugerida · feature · esforço G · ~6 dia(s) · cobre 6 achado(s), 2 crítico(s)/alto(s)

**Problema.** A situação só muda pela progressão do mata-mata ou pelo seletor do cliente: Futsal e Basquete Masculino ficaram 'Publicado' com jogos operados. O pódio só existe para final com id '-advanced-'. O ranking é único por equipe+modalidade+métrica: campeã no masculino e no feminino pontua uma vez, e o lote leva 409.

**Solução.** A API deriva a situação: primeiro jogo iniciado, W.O. ou resultado põe a categoria Em andamento, e category/update deixa de gravar situação vinda do cliente, salvo para publicar. Novas category/close {pódio, motivo?} e category/reopen {motivo}: a API sugere campeão, vice e 3º (final e disputa de 3º pela rodada; em Liga, os 3 primeiros da tabela) e o admin confirma ou troca. O pódio fica em Tournament.config.podio e vai no snapshot, para a PUB exibir. Migração: OverallAward.tournamentId, com unicidade equipe+categoria+métrica. As sugestões automáticas passam a ler o pódio confirmado. O ranking geral é dividido em abas Ranking, Lançamentos e Regras.

**Tela alvo.** No topo da Gestão, faixa 'Em andamento · 11 de 15 jogos com resultado' e um único botão do próximo passo ('Encerrar categoria' quando não falta jogo). Encerrar abre 'Pódio': campeã, vice e 3º sugeridos, com escudo e origem ('venceu a final 2×1'), cada um trocável. 'Confirmar pódio' encerra e oferece 'Lançar 3 pontuações no ranking geral'. O ranking geral tem as abas Ranking, Lançamentos por categoria e Regras.

**Critérios de aceite**

- [ ] Iniciar o primeiro jogo do Futsal Masculino muda a categoria para 'Em andamento' (em produção ficou 'Publicado').
- [ ] O Vôlei masculino, com final agendada à mão (match-1acd9089e543), recebe pódio sugerido e confirmado pela tela.
- [ ] Atlética no pódio das duas categorias de Handebol recebe os pontos nas duas. Hoje a segunda é recusada com 409.
- [ ] Encerrar com jogo pendente exige motivo e lista os jogos. Reabrir exige motivo e fica na auditoria.
- [ ] O snapshot público traz o pódio de cada categoria encerrada.

**Onde mexer.** Front: `apps/web/app/components/SituacaoCategoria.tsx (novo: faixa e próximo passo)`, `apps/web/app/components/PodioCategoria.tsx (novo)`, `apps/web/app/components/TournamentManager.tsx (sai o seletor de cinco situações)`, `apps/web/app/components/OverallStandings.tsx (abas e categoria no lançamento)`, `apps/web/app/lib/overall-ranking.ts (hasAward por categoria; sugestões a partir do pódio)`, `apps/web/app/lib/tournament-progression.ts (tournamentPodium lê o pódio do snapshot)`, `apps/web/app/lib/repositories/actions.ts (category/close, category/reopen)`. API: `migração overall_award_tournament: OverallAward.tournamentId String? com índice; backfill quando a modalidade tem só uma categoria`, `src/edition-actions/handlers/category-action.handler.ts: category/close e category/reopen; status ignorado em update, salvo publicar`, `src/edition-actions/handlers/match-action.handler.ts: match/start marca a categoria Em andamento`, `src/edition-actions/edition-action-recalculation.service.ts: sugestão de pódio; fim do FINISHED automático`, `src/edition-actions/handlers/ranking-action.handler.ts: unicidade por equipe+categoria+métrica`, `src/edition-snapshots/snapshot.mapper.ts: podio por categoria`.

**Depende de:** EST-I05. **Risco:** Pontuações antigas sem categoria ficam com tournamentId nulo e seguem a regra antiga. As de 2026 precisam ser revistas pela organização.

<sub>Achados: CHAVE-07, JORG-10, APIDOM-06, CHAVE-R3, JORG-02, VADM-12</sub>

### EST-I09 · Regulamento validado ao salvar e congelado em cada jogo

Onda 1 sugerida · correção · esforço G · ~6.5 dia(s) · cobre 11 achado(s), 6 crítico(s)/alto(s)

**Problema.** discipline/update grava qualquer objeto, e regra inválida só estoura em 409 na mesa. O jogo não guarda a regra: o 1º jogo de Vôlei (melhor de 5) aparece como '4º set de 3', e mudar pontos não recalcula as tabelas. O W.O. não acompanha o formato: vôlei 3×0 em melhor de 3, handebol 1×0.

**Solução.** discipline/update roda resolveActionRegulation e recusa apontando o campo errado. Em modalidade por sets, o placar de W.O. do vencedor precisa ser igual a setsToWin. Migração Match.rules: a cópia do regulamento é gravada em match/start, no W.O. e no lançamento direto da MESA, e é lida por todas as ações e pelo snapshot daquele jogo. Mudar pontos ou desempate com jogo oficial exige motivo e recalcula todas as categorias da modalidade na mesma ação. Mudar regra de placar com jogo Ao vivo é recusado. No front, salvar espera a resposta e mantém o rascunho no erro, há aviso de impacto antes de confirmar e um cartão de resumo com 'Confirmar regulamento', que a prontidão (IMP) lê.

**Tela alvo.** Tela da modalidade, com um cartão no topo: 'Melhor de 3 sets de 25, decisivo de 15 · W.O. 2×0 · Vitória 3 pts · Desempate: confronto direto, saldo', e o botão 'Confirmar regulamento', que some depois de confirmado. Em Editar regras, 'Salvar' vira 'Salvando…' e só fecha com sucesso; o erro aparece no bloco do campo. Com jogos disputados, antes de salvar: '12 jogos encerrados mantêm a regra antiga; 2 tabelas serão recalculadas'.

**Critérios de aceite**

- [ ] Salvar regra sem critério de desempate ou com rótulo vazio é recusado com a mensagem do campo. A spec garante que a mesa nunca recebe 409 por regra inválida.
- [ ] Vôlei com setsToWin 2 e W.O. 3×0 é recusado ao salvar.
- [ ] Mudar setsToWin de 3 para 2 depois de um jogo encerrado não altera a exibição nem o resultado desse jogo.
- [ ] Mudar pontos por vitória com jogos encerrados recalcula as tabelas de todas as categorias da modalidade na mesma ação.
- [ ] Falha de rede ao salvar mantém o formulário aberto com o que foi digitado.

**Onde mexer.** Front: `apps/web/app/components/DisciplineManager.tsx (salvar aguardando a resposta, aviso de impacto, cartão de resumo e confirmação)`, `apps/web/app/components/RegulationFields.tsx (W.O. derivado dos sets; lixeira desativada no último critério)`, `apps/web/app/lib/regulation.ts (descrição em linguagem de quadra)`, `apps/web/app/components/MatchDetailClient.tsx (exibe pela regra do próprio jogo)`. API: `migração match_rules: Match.rules Json?`, `src/edition-actions/handlers/catalog-action.handler.ts: discipline/update com validação, coerência do W.O., motivo e recálculo da modalidade`, `src/edition-actions/handlers/match-action.handler.ts: start, registerEvent, updateClock, finish, correctResult e W.O. leem match.rules`, `src/edition-snapshots/snapshot.mapper.ts:865 e 897: rules do jogo quando houver`, `specs regra-congelada e regra-invalida`.

**Depende de:** nada. **Risco:** Jogos já disputados ficam com rules nulo e seguem a regra atual. O 1º jogo de Vôlei precisa de cópia manual (SAN), e o match/recordResult da MESA deve gravar a mesma cópia.

<sub>Achados: REGRAS-06, REGRAS-04, MESA-R2, TESTES-R2, JMESA-R2, APIDOM-12, VADM-R4, REGRAS-02, REGRAS-R3, REGRAS-08, JDADOS-08</sub>

### EST-I10 · Assistente de montagem da categoria com rascunho local e modelos

Onda 2 sugerida · reorganização de UX · esforço G · ~8 dia(s) · cobre 6 achado(s), 4 crítico(s)/alto(s)

**Problema.** A Gestão é uma página de 5,1 telas e 65 controles. Cada checkbox, seed ou letra dispara um POST com a categoria inteira e devolve 1,7 MB, e teclas se perdem. Os grupos são texto separado por vírgula, a publicação fica no topo e 'Sequencial (A1 × B2)' gera A1 × B1.

**Solução.** Assistente com um passo por tela na aba Gestão, enquanto não há jogo operado. Formato: modelos que preenchem fases, grupos e vagas (Grupos + mata-mata, Liga, Liga + final, Mata-mata direto). Equipes. Grupos: a quantidade gera Grupo A a D, a distribuição é por toque, há 'sortear pelos seeds' e o alerta 'N sem grupo'. Quem avança: um só campo de classificados, 'melhores 2º' com o rótulo certo e cruzamento virando vagas explícitas (Sequencial = A1×B2, B1×A2). Jogos: EST-I04. Revisar e publicar. O estado é local, com um category/update por etapa e expectedUpdatedAt, além de aviso ao sair com mudança pendente. Depois do 1º jogo, a aba vira resumo + EST-I07.

**Tela alvo.** Barra de passos no topo, de '1 Formato' a '6 Publicar'. Formato: 4 cartões com mini-desenho ('2 grupos → semifinal → final'). Equipes: busca, 'Marcar todas' e contador. Grupos: seletor '2 grupos' e cada equipe com chips A e B de 44 px. Quem avança: prévia '1ºA × 2ºB · 1ºB × 2ºA'. Rodapé fixo com 'Voltar' e 'Salvar e continuar', mais o indicador 'salvo às 14:32'.

**Critérios de aceite**

- [ ] Montar uma categoria de 8 equipes em 2 grupos + semifinal + final leva até 6 telas e 40 toques, com 1 requisição por etapa. Hoje é 1 requisição por tecla em 5,1 telas de rolagem.
- [ ] Nenhum campo grava a cada tecla, e sair com mudança pendente pede confirmação.
- [ ] Gravar sobre versão mais nova (outro aparelho) é recusado com 'outra pessoa alterou; recarregue'.
- [ ] O modelo Sequencial gera A1×B2 e B1×A2 na prévia e nas vagas gravadas (teste em bracket-rules).
- [ ] Todos os alvos do assistente têm pelo menos 44 px (teste e2e a 360 px).

**Onde mexer.** Front: `apps/web/app/components/CategoryWizard.tsx (novo, 6 passos)`, `apps/web/app/components/wizard/ (Formato, Equipes, Grupos, Avanco, Jogos, Revisar)`, `apps/web/app/lib/category-templates.ts (novo: modelos com fases e vagas)`, `apps/web/app/components/TournamentManager.tsx (vira resumo + Ajustar categoria)`, `apps/web/app/components/CategoryCreationForm.tsx (abre o assistente)`, `apps/web/app/lib/bracket-rules.ts (Sequencial A1×B2; rótulo 'melhores Nº colocados')`, `apps/web/app/lib/use-unsaved-changes.ts`. API: `src/edition-actions/handlers/category-action.handler.ts: update com expectedUpdatedAt (409 sobre versão antiga)`, `cruzamento passa a chegar como vagas explícitas de EST-I05; seedPairs e sequentialPairs ficam só para categorias antigas`, `Sem migração`.

**Depende de:** EST-I03; EST-I04; EST-I05; EST-I08; DS: componentes base (botão, campo, alvos de 44 px). **Risco:** É a maior mudança de tela da trilha. Manter a gestão antiga atrás de um interruptor por uma edição.

<sub>Achados: CHAVE-09, CHAVE-12, VADM-07, VADM-09, JORG-11, CHAVE-08</sub>

**Fora de escopo, de propósito**

- Regulamento por categoria ou por fase (final com mais sets, grupos em set único): esforço G e nenhum caso no evento. Congelar a regra por jogo (EST-I09) já resolve a troca no meio do torneio.
- Critérios de desempate por parciais (saldo de pontos, average): exigem parciais confiáveis, que dependem das correções da MESA no vôlei.
- Redesenho completo do formulário de regras em cinco blocos (REGRAS-10) e modalidade de nome livre (REGRAS-11): o cartão de resumo, a validação e o salvar que espera a resposta cobrem o risco visto no evento.
- Padrões de Queimado e Futevôlei na API e regulamento resolvido único no snapshot (REGRAS-07, TESTES-06): essas modalidades não tiveram jogo. Entram quando forem disputadas.
- Sorteio de grupos com potes e arrastar pela tela: o seed atual e o 'sortear pelos seeds' do assistente bastam para a Copa.
- Segunda equipe da mesma atlética (ATL) e remoção do motor legado de standings da API (QA): fora da fronteira desta trilha.

**Perguntas para a organização**

- Equipe que desiste no meio: os jogos que faltam viram W.O. para o adversário ou são cancelados? Os jogos que ela já disputou continuam valendo?
- Empate que nenhum critério separa: vale sorteio físico registrado no app (e quem registra) ou existe outro critério no regulamento da Copa?
- Ranking geral: masculino e feminino da mesma modalidade pontuam pódios separados? E 'participação' conta uma vez por categoria ou uma vez por modalidade?
- Quem confirma a chave do mata-mata e o pódio: o gestor da modalidade ou só o admin da edição?


## AGD — Agenda real do evento

**Objetivo.** A agenda do app passa a funcionar como a Copa roda. Cada quadra tem sua fila "A SEGUIR", e a previsão de horário se ajusta sozinha. As quadras são cadastradas, o jogo pode ficar sem data, e o estado de cada jogo é dito com a palavra certa. Duplicados são barrados, e a organização corrige o dia inteiro em lote, em poucos toques.

**Princípios**

- A agenda mostra o que se sabe e o quanto se sabe. Hora marcada aparece seca. Previsão aparece com '~' e 'previsto'. Jogo em fila aparece como 'A seguir · 2º na Quadra 1'. Horário inventado nunca aparece como certo.
- Cada estado tem um nome e uma regra, em um só lugar: lib/situacao-do-jogo.ts e lib/fila.ts. Lista, detalhe, mesa, painel e área pública usam essas funções. O placar só aparece depois que o jogo começa.
- Corrigir a agenda em lote é o caminho normal, e jogo a jogo é a exceção. Toda ação sobre vários jogos mostra a prévia linha a linha e grava um só registro de auditoria, com um só motivo.
- A ação fica onde está o problema. O jogo vencido oferece na própria linha Lançar resultado, Adiar, Cancelar e W.O.; nenhum estado fica escondido em select de formulário.
- Celular primeiro, com uma mão. Linhas de 64 px, alvos de 44 px e filtros em chips com contagem. Dia, filtro e busca ficam na URL e voltam quando a pessoa retorna.
- Bloqueia só o que é erro certo: confronto repetido na mesma fase e quadra inexistente. O resto é aviso curto, e aviso nunca vira texto de motivo na auditoria.

**Desenho alvo**

MODELO (API, migrações em api/migrations): nova tabela Venue {id, editionId, name, shortName, sortOrder}, com nome único por edição. Match ganha venueId (nulo = sem quadra), queueOrder (posição no dia e na quadra) e timeIsEstimate. Há três formas de agendar:
- hora marcada: scheduledAt firme;
- a seguir: dia + quadra + queueOrder; scheduledAt guarda só a previsão planejada, com timeIsEstimate = true;
- sem data: scheduledAt nulo.
A coluna venue (texto) deixa de ser escrita e sai numa limpeza posterior.

AÇÕES: são novas venue/upsert, venue/delete e match/bulkUpdate. match/schedule e match/update passam a aceitar venueId, queueOrder, timeEstimate, allowRematch e data opcional. Todo caminho de criação chama confrontoExistente(). O snapshot ganha venues (Record) e, por jogo, venueId, queueOrder e timeEstimate. São campos opcionais, então o front antigo continua lendo.

FRONT: duas funções puras são a única fonte de verdade.
1. lib/fila.ts. A fila é dia + quadra, ou dia + categoria quando o jogo não tem quadra. A função calcula a posição e a previsão: horário planejado + atraso acumulado da fila (início real do jogo em andamento menos o previsto dele). Sem horário planejado, usa a duração estimada da modalidade.
2. lib/situacao-do-jogo.ts. Estados:
- ao_vivo (MESA acrescenta "parado");
- a_seguir / "Nº na fila";
- agendado (HH:MM);
- atrasado (passou da hora marcada, ainda dentro da duração);
- sem_resultado (passou da duração + 30 min, é de dia anterior, ou um jogo posterior da mesma fila já começou);
- a_agendar;
- adiado, cancelado, wo e encerrado.
O placar aparece só em ao_vivo, encerrado e wo.

TELAS:
- Jogos (staff): dia, chips de situação com contagem, busca por atlética, grupos por quadra, grupo "A agendar", botão "Selecionar" para o lote.
- Detalhe do jogo: situação; Placar e Lançar resultado (MESA); "Não vai acontecer agora" com Adiar, Cancelar e W.O.; Editar com quando, onde, grupo, adversários e Excluir.
- Novo jogo: categoria → grupo → equipes → quando → quadra, com "Agendar e criar outro".
- Gestão > Quadras.

REGRAS: bloqueia confronto repetido na fase e quadra inexistente. Avisa equipe ocupada só na mesma categoria e quadra ocupada só entre jogos de hora marcada. Rótulo e jogo sem quadra não entram em conflito.

CONSUMIDORES: PUB, NAV e IMP usam as duas funções. IMP grava fila e previsão em vez de inventar horário. EST reutiliza confrontoExistente em "Montar os jogos".

### AGD-I01 · Destravar Editar partida: lado a definir, excluir jogo e trocar grupo

Onda 0 sugerida · correção · esforço M · ~3 dia(s) · cobre 4 achado(s), 4 crítico(s)/alto(s)

**Problema.** Salvar qualquer mudança em jogo com lado 'Vencedor do Jogo 16' falha: o front reenvia o rótulo como equipe e a API responde 404. Os 15 jogos de mata-mata com rótulo não aceitam horário nem local. Excluir jogo e trocar grupo existem na API desde 10/10, sem tela.

**Solução.** Front: MatchManager passa a enviar entryA/entryB só do lado que a pessoa trocou. API: participanteDefinido ignora nome igual ao rótulo atual (matchOrThrow passa a ler placeholderA/B). Levar match/delete ao front (tipo em actions.ts, caso no reducer e no mock-api). Pôr 'Excluir jogo' em Editar partida, só para jogo Agendada sem lance nem início, com confirmação que cita confronto, dia e hora. Criar o campo 'Grupo ou fase' na partida agendada, com as opções do Novo jogo e aviso quando as duas equipes não estão no grupo escolhido. Grava por patch.phase, que a API já aceita.

**Tela alvo.** Editar partida de jogo agendado: Data, Horário, Local e 'Grupo ou fase', com 'Salvar alterações' fixo no rodapé. No fim, separado, 'Excluir jogo' em branco com ícone. O toque abre 'Excluir Halterada × Furiosa de 12/10 14:00? O jogo sai da agenda e da tabela', com 'Excluir' e 'Voltar'. Jogo com rótulo nos lados salva horário e local como qualquer outro.

**Critérios de aceite**

- [ ] Mudar só o horário de 'Vencedor do Jogo 16 × Vencedor do Jogo 18' grava na API real (spec do handler e e2e-http).
- [ ] Excluir um jogo agendado e nunca iniciado custa 3 toques a partir do detalhe. Jogo iniciado não mostra o botão, e a API segue recusando.
- [ ] Trocar o grupo de um jogo agendado pela tela muda phaseId e groupId na API. Escolher um grupo sem as duas equipes mostra aviso antes de salvar.
- [ ] Nenhum salvamento de Editar partida envia entryA/entryB sem a pessoa ter trocado o adversário (teste de componente).

**Onde mexer.** Front: `apps/web/app/components/MatchManager.tsx`, `apps/web/app/lib/repositories/actions.ts (match/delete)`, `apps/web/app/lib/repositories/reducer.ts`, `apps/web/tests/mock-api/server.ts`, `apps/web/tests/e2e/mesa-partida-a-definir.spec.ts`, `apps/web/tests/e2e-http/api-mode.spec.ts`. API: `src/edition-actions/handlers/match-action.handler.ts: participanteDefinido compara com placeholderA/B; matchOrThrow seleciona os placeholders`, `match/delete e patch.phase já existem (PR api#40); passam a ser chamados pelo front`, `spec em handlers/partida-a-definir.spec.ts: update de data e local com rótulo nos dois lados`, `docs/CONTRATO_API.md do front: incluir match/delete`.

**Depende de:** nada. **Risco:** Sem a recusa de jogo fora do grupo (trilha EST), trocar o grupo pode tirar o jogo da tabela. O aviso na tela segura até a API bloquear.

<sub>Achados: AGENDA-02, DOCS-R1, CHAVE-05, AGENDA-08</sub>

### AGD-I02 · Situação única do jogo: placar só após o início, selos que envelhecem

Onda 0 sugerida · correção · esforço M · ~3 dia(s) · cobre 6 achado(s), 6 crítico(s)/alto(s)

**Problema.** A API manda 0×0 para todo jogo não iniciado, e o cartão só esconde null: 40 jogos vencidos aparecem '0 — 0' com selo 'Próximo', inclusive na área pública. status.ts reduz seis estados a três: Cancelada e W.O. viram 'Encerrado', e Adiada vira 'Próximo'.

**Solução.** Criar lib/situacao-do-jogo.ts. situacaoDoJogo(jogo, agora, fila?) devolve código, rótulo, tom e mostraPlacar. Estados: Ao vivo, A seguir, Agendado (hora), Atrasado (passou da hora, dentro da duração prevista), Sem resultado (passou da duração + 30 min, ou é de outro dia), Adiado, Cancelado, W.O., Encerrado e A agendar. matchView devolve placar nulo fora de Ao vivo, Encerrada e W.O. MatchCard, MatchScoreCard e MatchSummary usam a função e mostram a hora no lugar do placar. getMatchStatusLabel passa a delegar a ela. A descrição do link público deixa de dizer 'Placar: 0 a 0'.

**Tela alvo.** Cartão de jogo na lista, no detalhe e na área pública: jogo que não começou mostra a hora grande no lugar do placar, e o selo à direita traz um dos dez rótulos. Jogo de 12/10 nunca aberto mostra 'Sem resultado' em vez de 'Próximo'. Cancelado mostra 'Cancelado' e o motivo curto. W.O. mostra o placar regulamentar com 'W.O.'. Não há ação nova: é leitura correta.

**Critérios de aceite**

- [ ] Com os dados de 13/10, nenhum dos 40 jogos Agendada exibe '0 — 0' nem 'Próximo' (teste com fixture de jogos-producao.json).
- [ ] Cancelada, Adiada e W.O. têm selo próprio na lista, no detalhe e na área pública. 'Encerrado' só aparece para jogo Encerrada.
- [ ] Empate real 0×0 encerrado continua mostrando '0 — 0'.
- [ ] Os componentes de cartão não decidem rótulo por conta própria: grep por comparações de status para rótulo encontra só a nova função.
- [ ] tests/unit/situacao-do-jogo.test.ts entra na lista do test:unit e roda no CI.

**Onde mexer.** Front: `apps/web/app/lib/situacao-do-jogo.ts (novo)`, `apps/web/app/lib/status.ts`, `apps/web/app/lib/edition-catalog.ts (matchView)`, `apps/web/app/components/MatchCard.tsx`, `apps/web/app/components/MatchScoreCard.tsx`, `apps/web/app/components/MatchSummary.tsx`, `apps/web/app/public/matches/[id]/page.tsx (descrição do link)`, `apps/web/tests/unit/situacao-do-jogo.test.ts e package.json (test:unit)`. API: `Nenhuma: snapshot.mapper.ts:882 continua enviando 0, e o front decide pelo status`.

**Depende de:** nada. **Risco:** Testes e capturas que leem 'Próximo' e 'Encerrado' mudam. PUB e DS precisam usar a função em vez de recriar a regra.

<sub>Achados: AGENDA-09, PUBLICO-02, JESP-02, VPUB-R2, JESP-03, VPUB-03</sub>

### AGD-I03 · Bloquear confronto repetido na mesma fase em todos os caminhos

Onda 1 sugerida · correção · esforço M · ~3 dia(s) · cobre 4 achado(s), 4 crítico(s)/alto(s)

**Problema.** Nada compara confrontos. O formulário só avisa com data e hora idênticas, e API, gerador e importador não olham. O Vôlei masculino tem 12 jogos para 10 confrontos; Inquisidores × Furiosa terminou 2×0 e 0×2. Quando a tabela contar todos os jogos, os duplicados entram em dobro.

**Solução.** API: a função confrontoExistente(tx, phaseId, entryAId, entryBId) acha jogo não cancelado com o mesmo par, em qualquer ordem, na mesma fase. match/schedule e match/update (troca de adversário ou de fase) recusam com 409, citando dia, hora e situação do jogo existente. A exceção é allowRematch com motivo (returno). A função é exportada para category/generateMatches (EST) e para o importador (IMP). Front: scheduling-rules compara par e fase em qualquer horário e bloqueia o botão, oferecendo 'Abrir jogo existente'. A agenda privada mostra o chip 'Repetidos (N)' quando o snapshot já tem pares duplicados.

**Tela alvo.** Novo jogo: ao escolher Halterada 2 e Incinera no Grupo A, surge a faixa 'Este confronto já existe: sáb 10/10 10:00 · Encerrado 2×0', com 'Abrir jogo existente' e 'É returno' (pede motivo). 'Agendar jogo' fica desativado até a escolha. Na agenda privada, o chip 'Repetidos 2' lista os pares. Cada par mostra as duas partidas lado a lado, com 'Excluir' na que está agendada.

**Critérios de aceite**

- [ ] Na API real, agendar um par que já existe na fase devolve 409 com a data do jogo existente. Com allowRematch e motivo, grava (spec do handler).
- [ ] O verificador rodado sobre jogos-producao.json lista exatamente os 2 pares repetidos do Vôlei masculino (teste unitário com fixture).
- [ ] O formulário Novo jogo não deixa salvar par repetido sem 'É returno'.
- [ ] Jogo Cancelada não conta como confronto existente.

**Onde mexer.** Front: `apps/web/app/lib/scheduling-rules.ts`, `apps/web/app/components/MatchCreationForm.tsx`, `apps/web/app/components/MatchesHub.tsx (chip Repetidos)`, `apps/web/tests/unit/scheduling-rules.test.ts`. API: `src/edition-actions/handlers/match-action.handler.ts: confrontoExistente() e checagem em schedule e update`, `payload aceita allowRematch (boolean), com audit.reason obrigatório`, `exportar a função para category-action.handler.ts (EST chama em generateMatches)`, `spec novo handlers/confronto-repetido.spec.ts`.

**Depende de:** AGD-I01. **Risco:** Categoria com turno e returno exige 'É returno' a cada jogo. Se isso for comum, a regra deve ficar guardada na fase (EST).

<sub>Achados: SCRIPTS-03, APIDOM-R3, VADM-R1, AGENDA-08</sub>

### AGD-I04 · Quadras da edição como cadastro; 'A definir' vira jogo sem quadra

Onda 1 sugerida · feature · esforço M · ~5 dia(s) · cobre 1 achado(s), 0 crítico(s)/alto(s)

**Problema.** Local é texto digitado jogo a jogo: 89 de 96 jogos terminaram com 'A definir', que quatro trechos de código gravam como se fosse ginásio. A checagem de conflito acusa 396 falsos 'A definir está ocupado', e não há como agrupar nem filtrar a agenda por quadra.

**Solução.** Migração: tabela venues (id, editionId, name, shortName, sortOrder; nome único por edição) e Match.venueId opcional. A própria migração cria as quadras a partir dos textos existentes e zera 'A definir'. Ações venue/upsert e venue/delete, só para o admin da edição; excluir só quadra sem jogo. match/schedule, match/update e generateMatches aceitam venueId, ou um nome resolvido contra a lista. 'A definir' e vazio viram nulo, para os scripts antigos não quebrarem. O snapshot ganha venues e venueId, e venue segue com o nome. Front: tela Quadras e seletor 'Quadra' nos formulários, com 'Sem quadra' e, para o admin, '+ Nova quadra'.

**Tela alvo.** Quadras (atalho no menu da agenda e em Gestão): uma linha por quadra com nome curto, ginásio e 'N jogos'. '+ Quadra' no topo abre um campo só. Nos formulários, 'Local' vira seletor com as quadras da edição, 'Sem quadra' e '+ Nova quadra'. Cartão de jogo sem quadra não mostra local. Na agenda do staff, esses jogos ficam no grupo 'Sem quadra'.

**Critérios de aceite**

- [ ] Depois da migração numa cópia do banco de produção: 0 jogos com 'A definir', 2 quadras criadas (Ginásio UFPE e Ginásio B) e 7 jogos ligados a elas.
- [ ] Nenhum código grava 'A definir' como local (grep em api/src e apps/web/app).
- [ ] O gestor escolhe uma quadra existente; criar ou excluir quadra devolve 403 para ele.
- [ ] Excluir quadra com jogo devolve 409 dizendo quantos jogos a usam.
- [ ] O importador atual, que ainda manda local 'A definir', continua gravando, agora com quadra nula.

**Onde mexer.** Front: `apps/web/app/venues/page.tsx e components/VenueManager.tsx (novos)`, `apps/web/app/components/MatchManager.tsx e MatchCreationForm.tsx (seletor Quadra)`, `apps/web/app/lib/frontend-state.ts (venues, venueId)`, `apps/web/app/lib/edition-catalog.ts (venue sem padrão 'A definir')`, `apps/web/app/lib/repositories/actions.ts, reducer.ts e tests/mock-api/server.ts`, `apps/web/app/components/TournamentManager.tsx:233 e lib/tournament-progression.ts:145 (param de gravar 'A definir')`. API: `migração <data>_quadras: tabela venues, matches.venueId com FK SetNull e conversão dos textos existentes`, `handlers/venue-action.handler.ts (novo): venue/upsert e venue/delete, registrados em edition-actions.service.ts e edition-actions.types.ts`, `match-action.handler.ts e category-action.handler.ts: resolverQuadra() aceita id ou nome e trata 'A definir' como nulo`, `edition-action-recalculation.service.ts:826: jogo criado pela progressão sem quadra`, `snapshot.mapper.ts e dto/frontend-snapshot.dto.ts: venues e venueId`, `spec handlers/quadras.spec.ts`.

**Depende de:** nada. **Risco:** A migração de dados roda em produção. Ensaiar antes numa cópia do banco e manter a coluna venue para permitir voltar atrás.

<sub>Achados: AGENDA-06</sub>

### AGD-I05 · Fila 'A SEGUIR' por quadra, horário previsto e jogo ainda sem data

Onda 1 sugerida · feature · esforço G · ~7 dia(s) · cobre 7 achado(s), 5 crítico(s)/alto(s)

**Problema.** A organização publica a ordem na quadra; a API exige hora fixa. O importador inventou 51 horários e a progressão marca mata-mata para o dia seguinte às 18:00. O público leu estimativa como compromisso: atraso mediano de 104 min, e 21 de 56 inícios gravaram 'Registre a justificativa'.

**Solução.** Migração: Match.queueOrder e Match.timeIsEstimate. match/schedule e match/update aceitam três formas: hora marcada; 'a seguir' (dia, quadra, posição e previsão opcional, marcada como estimada); e sem data. A progressão do mata-mata passa a criar jogo sem data em vez de inventar. O snapshot envia queueOrder e timeEstimate. Front: lib/fila.ts monta as filas (dia + quadra; sem quadra, dia + categoria). A previsão é o horário planejado mais o atraso real da fila. O cartão mostra 'A seguir · 2º na Quadra 1 · previsto ~15:40'. evaluateStart não pede justificativa a jogo de fila; fora da janela só informa, sem gravar startNote.

**Tela alvo.** Cartão de jogo em fila: no lugar da hora, 'A SEGUIR' em Aldo e, embaixo, '2º na Quadra 1 · previsto ~15:40' em texto menor. O primeiro da fila diz 'Próximo da quadra', e hora marcada aparece sem '~'. Nos formulários, 'Quando' tem três botões: 'Hora marcada', 'A seguir na quadra' (dia e quadra; entra no fim da fila) e 'Ainda sem data'. Jogo sem data vai para o grupo 'A agendar'.

**Critérios de aceite**

- [ ] Na API real, um jogo criado como 'A seguir' sem horário é aceito e aparece em 3º na fila certa (spec e e2e-http).
- [ ] Se o 1º jogo da fila começa 100 min depois do previsto, a previsão do 2º e do 3º anda 100 min sem ninguém editar (teste de lib/fila.ts com os dados de 12/10).
- [ ] Iniciar jogo de fila não abre 'Iniciar fora do horário previsto?' e não grava startNote (teste de evaluateStart).
- [ ] Jogo de mata-mata criado pela progressão nasce sem data e aparece em 'A agendar', nunca num dia inventado.
- [ ] Snapshot sem os campos novos continua sendo lido: jogo sem queueOrder é ordenado pela hora.

**Onde mexer.** Front: `apps/web/app/lib/fila.ts e tests/unit/fila.test.ts (novos)`, `apps/web/app/lib/match-lifecycle.ts (evaluateStart)`, `apps/web/app/matches/live/page.tsx:328-354 e :624 (para de gravar e exibir a nota automática)`, `apps/web/app/lib/frontend-state.ts e lib/edition-catalog.ts (data e hora opcionais, queueOrder, timeEstimate)`, `apps/web/app/components/MatchScoreCard.tsx e MatchCard.tsx (exibição da fila)`, `apps/web/app/components/MatchManager.tsx e MatchCreationForm.tsx (campo Quando)`, `apps/web/app/lib/tournament-progression.ts:145 (modo local sem data inventada)`. API: `migração <data>_fila: matches.queueOrder Int? e matches.timeIsEstimate Boolean default false`, `match-action.handler.ts: schedule e update com date/time opcionais, queueOrder e timeEstimate`, `edition-action-recalculation.service.ts: nextDate() deixa de inventar dia e 18:00; matchCreateData com scheduledAt nulo`, `snapshot.mapper.ts e dto/frontend-snapshot.dto.ts: queueOrder e timeEstimate`, `spec handlers/agenda-em-fila.spec.ts`.

**Depende de:** AGD-I04. **Risco:** A mudança toca live/page.tsx (trilha MESA) e a progressão (trilha EST): é preciso combinar a ordem dos PRs. Sem o grupo 'A agendar', jogos sem data somem da agenda por dia.

<sub>Achados: AGENDA-01, APIDOM-07, SCRIPTS-04, DOCS-01, DOCS-R2, MESA-13, JMESA-10</sub>

### AGD-I06 · Adiar, cancelar e remarcar como ações próprias, fora do select de estado

Onda 1 sugerida · reorganização de UX · esforço M · ~3 dia(s) · cobre 3 achado(s), 2 crítico(s)/alto(s)

**Problema.** Adiar, cancelar e W.O. são opções escondidas no último campo de Editar partida. Adiar exige já saber a nova data, e o jogo adiado não pode ser iniciado pelo placar, embora a API aceite. Em 96 jogos, Adiada e Cancelada foram usadas 0 vezes; 40 jogos vencidos seguiram 'Agendada'.

**Solução.** No detalhe de jogo agendado ou adiado, o botão 'Não vai acontecer agora' abre uma folha com três escolhas. Adiar: nova data opcional; sem data o jogo fica Adiado, com data volta a Agendada. Cancelar: motivo em chips (não realizado, equipe desistiu, duplicado, outro). W.O.: fluxo da MESA. Editar partida perde o campo Estado e fica com quando, onde, grupo e adversários. match-lifecycle passa a deixar iniciar jogo Adiada. API: o admin da edição pode desfazer um cancelamento (Cancelada → Agendada), com motivo e recálculo da categoria.

**Tela alvo.** Detalhe do jogo agendado: hora e equipes no topo, botões 'Abrir placar' e 'Lançar resultado' (MESA) e, abaixo, 'Não vai acontecer agora'. A folha sobe com três botões grandes: Adiar, Cancelar, W.O. Adiar mostra 'Nova data (opcional)' e motivo com sugestões. Cancelar mostra quatro motivos em chips e 'Confirmar cancelamento'. Para o admin, jogo cancelado mostra 'Desfazer cancelamento'.

**Critérios de aceite**

- [ ] Cancelar um jogo vencido como 'não realizado' custa 4 toques a partir da agenda, e o jogo sai da contagem 'Sem resultado'.
- [ ] Adiar sem nova data grava Adiada. Informar a data depois devolve o jogo a Agendada sem pedir outra justificativa.
- [ ] Jogo Adiada é iniciado pelo placar contra a API real.
- [ ] O admin desfaz um cancelamento com motivo; o gestor recebe 403.
- [ ] Editar partida não exibe mais o campo 'Estado da partida'.

**Onde mexer.** Front: `apps/web/app/components/NaoVaiAcontecer.tsx (novo, folha com Adiar, Cancelar e W.O.)`, `apps/web/app/components/MatchDetailClient.tsx`, `apps/web/app/components/MatchManager.tsx (sai o select de estado)`, `apps/web/app/lib/match-lifecycle.ts (Adiada → Ao vivo)`, `apps/web/tests/unit/match-lifecycle.test.ts`, `apps/web/tests/e2e/adiar-e-cancelar.spec.ts (novo)`. API: `match-action.handler.ts canTransition: CANCELLED → SCHEDULED só com escopo full e motivo, seguido de recomputeTournament`, `spec handlers/adiar-e-cancelar.spec.ts`.

**Depende de:** AGD-I02; MESA: W.O. como ação própria (terceiro botão da folha); MESA: match/update recusa Ao vivo e Encerrada. **Risco:** Se o W.O. da MESA atrasar, a folha mantém o W.O. atual: vencedor mais placar do regulamento, que hoje é 1×0 no handebol.

<sub>Achados: AGENDA-10, VADM-02, AGENDA-R3</sub>

### AGD-I07 · Agenda privada para conduzir o dia: situação, quadra, busca e pendentes

Onda 1 sugerida · reorganização de UX · esforço M · ~5 dia(s) · cobre 7 achado(s), 6 crítico(s)/alto(s)

**Problema.** A agenda do staff só filtra por modalidade e dia, ordena por hora e usa o cartão público de ~199 px: os 47 jogos de 12/10 ocupam cerca de 11 telas. Jogo vencido de outro dia some; 40 ficaram 'Agendada' sem ninguém ver. O dia escolhido se perde ao voltar.

**Solução.** Reescrever a agenda do staff, separada da pública. Cada jogo vira uma linha compacta de 64 px (componente da DS): hora ou posição na fila, escudos de 24 px e siglas, placar ou previsão, selo da situação e um botão de ação. Chips com contagem: Agora, A seguir, Sem resultado (de todos os dias), Encerrados e Todos. Os jogos são agrupados por quadra quando houver; senão, por faixa de hora. Busca por atlética com busca.ts e grupo 'A agendar (N)'. Dia, modalidade, situação, quadra e busca ficam na URL. Hoje abre rolado até o primeiro jogo não encerrado, com os encerrados do dia recolhidos em 'Resultados (N)'.

**Tela alvo.** Jogos: faixa ‹ Seg 12/10 › e chips 'Agora 2 · A seguir 6 · Sem resultado 40 · Encerrados 31', com o campo 'Buscar atlética'. Lista por quadra: cabeçalho 'Quadra 1 — agora: Halterada × Furiosa' e, abaixo, as linhas da fila. Tocar a linha abre o detalhe; para quem opera, o botão à direita é 'Placar'. Quando houver, o topo mostra a faixa 'Sem resultado de dias anteriores: 8', que aplica o filtro.

**Critérios de aceite**

- [ ] Os 47 jogos de 12/10 cabem em no máximo 4 telas de 840 px com tudo aberto, e em 2 com 'Encerrados' recolhido.
- [ ] O filtro 'Sem resultado' mostra numa lista só, agrupada por dia, os 40 jogos vencidos de 09 a 12/10.
- [ ] Voltar do detalhe devolve o mesmo dia, filtro e posição (estado na URL).
- [ ] Buscar 'halt' acha Halterada 1 e Halterada 2 em todas as modalidades do dia.
- [ ] O gestor vê só a própria modalidade e as contagens dela, e trocar de filtro não faz nova requisição.

**Onde mexer.** Front: `apps/web/app/components/MatchSchedule.tsx (versão do staff; a pública fica com a trilha PUB)`, `apps/web/app/components/MatchesHub.tsx`, `apps/web/app/lib/situacao-do-jogo.ts e lib/fila.ts (consumo)`, `apps/web/app/lib/busca.ts (reuso)`, `componente de linha compacta da DS`, `apps/web/tests/e2e/agenda-staff.spec.ts (novo)`. API: `nenhuma`.

**Depende de:** AGD-I02; AGD-I04; AGD-I05; DS: cartão de jogo compacto (linha de 64 px) e selo. **Risco:** MatchSchedule é compartilhado com a agenda pública. Separar a versão do staff evita quebrar a área pública antes da trilha PUB.

<sub>Achados: VADM-05, AGENDA-05, JORG-06, AGENDA-12, VPUB-R4, NAV-03, JDADOS-05</sub>

### AGD-I08 · Edição em lote: quadra, dia, horário, ordem, adiar e cancelar

Onda 1 sugerida · feature · esforço G · ~7 dia(s) · cobre 3 achado(s), 3 crítico(s)/alto(s)

**Problema.** Toda mudança de agenda é jogo a jogo: agenda, cartão, Editar partida, três campos, salvar. Preencher o local dos 94 jogos importados pedia 94 passagens. Dos 79 importados, só 2 horas e 7 datas foram corrigidas, e nenhum ganhou local. Atrasar o resto do dia de uma quadra é impossível.

**Solução.** Na agenda do staff, 'Selecionar' põe caixas nas linhas e atalhos 'Todos do dia', 'Desta quadra', 'Desta categoria' e 'Sem resultado'. Uma barra fixa traz as ações:
- Quadra;
- Dia;
- Horário ±N min (só hora marcada, 'deste jogo em diante');
- Ordem na fila (↑↓);
- Adiar e Cancelar;
- Excluir (só agendado nunca iniciado).
Cada ação mostra a prévia por linha ('J5 10:30 → 12:10') e pede um motivo quando muda a situação. API: match/bulkUpdate {items:[{id, patch}], reason} grava até 200 jogos numa transação, com as validações de match/update, um registro de auditoria e checagem de modalidade em cada id.

**Tela alvo.** Agenda com 'Selecionar' ativo: cada linha ganha uma caixa à esquerda, e o topo mostra '12 selecionados' e os atalhos em chips. A barra fica fixa acima da navegação: Quadra · Dia · Horário · Ordem · Mais (Adiar, Cancelar, Excluir). Tocar 'Quadra' abre uma folha com o seletor e a prévia '12 jogos → Quadra 1'. 'Aplicar' grava tudo de uma vez, e a lista volta ao normal com o aviso '12 jogos atualizados'.

**Critérios de aceite**

- [ ] Pôr os 23 jogos de Futsal de 12/10 na Quadra 1 custa no máximo 6 toques e uma requisição.
- [ ] Deslocar +60 min 'deste jogo em diante' na Quadra 1 muda só os jogos de hora marcada daquela quadra e daquele dia, com prévia antes de gravar.
- [ ] Cancelar 20 jogos vencidos de uma vez grava um único registro de auditoria, com o motivo e os 20 ids.
- [ ] Gestor de Futsal que inclui um jogo de Vôlei na seleção recebe 403, e nada é gravado.
- [ ] Lote com um jogo inválido falha inteiro e cita o jogo.

**Onde mexer.** Front: `apps/web/app/components/AgendaSelecao.tsx (novo: barra, folhas e prévia)`, `apps/web/app/components/MatchSchedule.tsx (modo seleção)`, `apps/web/app/lib/repositories/actions.ts (match/bulkUpdate)`, `apps/web/app/lib/repositories/reducer.ts`, `apps/web/tests/mock-api/server.ts`, `apps/web/tests/e2e/agenda-lote.spec.ts (novo)`. API: `match-action.handler.ts: ação bulkUpdate, que reaproveita a validação de update (extrair aplicarPatchDeAgenda)`, `edition-actions.service.ts: match/bulkUpdate em MANAGER_ACTIONS; targetDisciplineId lê a lista de ids e recusa quando há mais de uma modalidade`, `edition-actions.types.ts: novo tipo`, `spec handlers/agenda-em-lote.spec.ts`, `docs/CONTRATO_API.md do front`.

**Depende de:** AGD-I04; AGD-I05; AGD-I07. **Risco:** Um lote de 200 jogos roda numa transação sob a trava da edição. É preciso medir o tempo antes do evento e baixar o teto se passar de 2 s.

<sub>Achados: AGENDA-04, JORG-05, SCRIPTS-09</sub>

### AGD-I09 · Novo jogo em contexto e alertas de agenda que fazem sentido

Onda 2 sugerida · reorganização de UX · esforço M · ~4 dia(s) · cobre 4 achado(s), 1 crítico(s)/alto(s)

**Problema.** Novo jogo exige modalidade, categoria, equipes, data, hora e local digitado, e ao salvar volta à agenda: 20 jogos de uma rodada são 20 formulários do zero. Os alertas comparam atléticas entre modalidades e tratam 'A definir' como quadra: 92 de 96 jogos acenderiam alerta.

**Solução.** O formulário segue a ordem de decisão: categoria (vem no link '+ Jogo' da categoria e do grupo), grupo ou fase, equipes já filtradas pelo grupo, Quando (de AGD-I05) e Quadra (de AGD-I04). O grupo se preenche sozinho quando as duas equipes são do mesmo. 'Agendar e criar outro' mantém categoria, grupo, dia e quadra. As regras de agenda são reescritas:
- equipe ocupada e descanso só dentro da mesma categoria;
- quadra ocupada só entre jogos de hora marcada na mesma quadra;
- rótulo e jogo sem quadra não contam.
Só confronto repetido bloqueia (AGD-I03). O resto é aviso, e à auditoria vão só os códigos. Atualizar REGRAS_DE_NEGOCIO.md.

**Tela alvo.** Novo jogo aberto a partir de Futsal Masculino > Grupo B: categoria e grupo aparecem preenchidos no topo, como texto com 'Trocar'. Equipe A e Equipe B listam só as do Grupo B. 'Quando' tem três botões e 'Quadra' traz a lista. Avisos aparecem em faixa curta abaixo. O rodapé fixo tem 'Agendar' e 'Agendar e criar outro'; o segundo limpa só as equipes e mostra 'Jogo 4 agendado'.

**Critérios de aceite**

- [ ] Agendar 6 jogos seguidos do mesmo grupo e da mesma quadra, em fila, custa até 5 toques por jogo depois do primeiro.
- [ ] Aplicadas à agenda de produção, as regras novas acendem alerta em menos de 10 dos 96 jogos (eram 92), e nenhum por atlética de outra modalidade.
- [ ] O motivo gravado na auditoria nunca passa de 200 caracteres por causa de alertas.
- [ ] Escolher duas equipes de grupos diferentes avisa antes de salvar.

**Onde mexer.** Front: `apps/web/app/components/MatchCreationForm.tsx`, `apps/web/app/lib/scheduling-rules.ts`, `apps/web/app/components/CategoryDetailView.tsx:71 (link com categoria e grupo)`, `apps/web/app/matches/new/page.tsx (aceita categoria e grupo na URL)`, `apps/web/tests/unit/scheduling-rules.test.ts`, `docs/REGRAS_DE_NEGOCIO.md (seção Conflito de agenda)`. API: `nenhuma além do que entra em AGD-I03, AGD-I04 e AGD-I05`.

**Depende de:** AGD-I03; AGD-I04; AGD-I05. **Risco:** A trilha IMP vai acrescentar o lado 'a definir' a este formulário. Combinar a estrutura de campos antes evita refazer.

<sub>Achados: VADM-06, AGENDA-11, DOCS-06, DOCS-R3</sub>

**Fora de escopo, de propósito**

- Distribuidor automático de jogos em quadras e horários: a fila manual mais a edição em lote resolve a Copa com muito menos código.
- Arrastar e soltar para reordenar a fila: botões ↑↓ de 44 px fazem o mesmo, funcionam com leitor de tela e não exigem biblioteca.
- Tela de importar planilha e modelo oficial de planilha: são da trilha IMP. AGD só define o que o importador grava (quadra, fila, previsão, sem data).
- Agenda pública, telão por quadra, 'minha atlética' e compartilhar a programação do dia: são da trilha PUB, que consome lib/fila.ts e lib/situacao-do-jogo.ts.
- Bloquear 'equipe ocupada' entre modalidades: a Copa teve 25 sobreposições legítimas da mesma atlética em esportes diferentes.
- Gravar o início real como novo horário do jogo: startedAt já existe e alimenta a fila; reescrever scheduledAt apagaria o planejado e a medida de atraso.

**Perguntas para a organização**

- Como o público deve ver um jogo vencido sem resultado: 'Aguardando resultado' na agenda pública, ou o jogo some dela até ser lançado?
- Quais quadras a Copa usa e com que nome curto? A fila 'A SEGUIR' da planilha é por quadra (Futsal masculino e feminino dividem a mesma?) ou por categoria?
- Quem pode mexer na agenda no dia do evento: só o admin da edição, ou também o gestor da modalidade (reordenar a fila, cancelar, aplicar em lote)?
- Alguma categoria joga turno e returno, com o mesmo confronto duas vezes na mesma fase? Se sim, a regra fica guardada na fase em vez de pedir 'É returno' jogo a jogo.


## ATL — Atléticas e elencos

**Objetivo.** Cada atlética recebe o acesso pelo WhatsApp, entra direto no próprio time e cadastra o elenco de cada categoria colando a lista, em até 10 minutos pelo celular. Gestor e admin usam a mesma tela. A API garante escopo, categoria e trava, e a página da equipe mostra a classificação oficial.

**Princípios**

- O responsável vê só o próprio time: entra direto nele, tem três destinos na barra e nenhum caminho leva a 'Acesso restrito'.
- O elenco é por categoria em toda tela e em toda regra. A categoria é escolhida uma vez por lote, nunca uma vez por atleta.
- Lote antes de unidade: colar a lista é a ação principal, e '+ Atleta' abre a mesma tela com uma linha só.
- Antes de gravar, a pessoa vê a prévia. O erro aparece na linha que o causou, nada é gravado pela metade, e o sucesso só aparece quando a API confirma (saved.ok).
- A regra fica no servidor (escopo, trava, limites). A tela antecipa com a mesma mensagem do servidor e nunca cria regra própria.
- Toda ação destrutiva tem texto escrito e alvo de 44 px, e remover pode ser desfeito: os removidos ficam num bloco 'Removidos' com o botão Restaurar.

**Desenho alvo**

PAPÉIS (a API decide, a tela antecipa)
- Responsável da atlética (TEAM_MANAGER, uma equipe): cadastra atletas da própria equipe, inscreve em categoria, numera, renomeia, remove e restaura. Lê jogos e tabela pela área pública.
- Gestor de modalidade: faz o mesmo, só nas categorias da modalidade dele, e não pode tirar o atleta da equipe.
- Admin da edição: pode tudo. Concede e revoga responsáveis e altera elenco travado informando o motivo.

MAPA DE TELAS
- Responsável: login → troca de senha → /teams/{id} ("Meu time"). Barra inferior: Meu time · Jogos (/public/teams/{id}) · Conta.
- /teams/{id}: abas Elenco (aberta por padrão) · Desempenho · Dados e acesso (só admin).
- /teams/{id}/elenco?categoria=X ("Montar elenco"): abas Colar lista · Já cadastrados · Da edição anterior; prévia; botão "Salvar N".
- Admin: Gestão → /teams/acessos (Acessos das atléticas); /teams em lista compacta; /teams/new com busca no catálogo.

DADOS
- edition_rosters ganha tournamentId (categoria, FK com SET NULL). jerseyNumber e status já existem e passam a ser usados. O índice único (modalidade, atleta) continua: o atleta joga uma categoria por modalidade.
- edition_staff_roles.teamId (já existe) passa a ser lido no login e no snapshot.
- Snapshot: athlete.categories[] e athlete.numbers{categoria: nº}. No staff, o papel aparece como 'Responsável da atlética', com scope = nome da equipe, teamId e firstAccessPending.

AÇÕES
- athlete/bulkUpsert {teamId, tournamentId, athletes[{id?, name?, jerseyNumber?}]}: cria, inscreve, move, restaura e numera em uma transação, com erro por linha e um único registro de auditoria.
- athlete/update: renomear, remover e restaurar. Para o gestor, mexe só na modalidade dele e recusa removed e teamId.
- staff/upsert: o admin concede 'Responsável da atlética'. Mandar initialPassword para conta que já existe devolve 409 ACCOUNT_EXISTS.
- roster-lock.ts: valida a trava nas três ações de atleta, por categoria e pelo tipo da fase.

FLUXO DE 10 MINUTOS
- Admin: Acessos das atléticas → Convidar (nome e e-mail) → WhatsApp com endereço, e-mail e senha temporária.
- Responsável: entra → troca a senha → Meu time → Colar lista (Futsal Masculino) → Ver prévia → Salvar 12 → Próxima categoria.
- Meta: 3 categorias em até 10 min no 4G, com até 4 toques por categoria depois do login.

### ATL-I01 · Fechar o ciclo do responsável da atlética: conceder, entrar, achar o time

Onda 1 sugerida · correção · esforço M · ~5 dia(s) · cobre 8 achado(s), 8 crítico(s)/alto(s)

**Problema.** Produção: 17 equipes, 0 responsáveis, 0 atletas. O admin da edição leva 403 ao conceder o papel e a tela anuncia sucesso. O login do papel dá 401 ('senha inválida'). Se entrasse, o front perderia a equipe da sessão, e 4 das 5 abas mostram 'Acesso restrito'.

**Solução.** API: resolveIdentity ganha o ramo TEAM_MANAGER (papel, scope com o nome da equipe, edição ativa). authorizeEditionAdminStaff aceita 'Responsável da atlética' para equipe da edição, nunca sobre admin ou super admin. loadStaff devolve esse rótulo, scope = equipe e teamId, e a chave de deduplicação passa a incluir teamId. Front: normalizeSessionUser grava scope e selectedTeamId; o guard compara teamId. Sem redirect, o login leva o responsável a /teams/{teamId}. Barra própria: Meu time · Jogos (página pública da equipe) · Conta. A faixa de contexto e o Voltar deixam de apontar para rotas bloqueadas. O perfil passa a dizer 'Responsável da Halterada'. TeamAccessManager só limpa o formulário e confirma quando saved.ok.

**Tela alvo.** O responsável entra com e-mail e senha, troca a senha e cai em 'HALTERADA · Meu time': escudo, nome e o bloco Elenco. Vazio, o bloco diz 'Cadastre o elenco' e mostra o botão Colar lista. A barra inferior tem três itens: Meu time, Jogos e Conta (com Sair). Nenhum toque leva a 'Acesso restrito'. Ação principal: Colar lista.

**Critérios de aceite**

- [ ] Quando o admin da edição concede 'Responsável da atlética' à Halterada, a API responde 200 (hoje 403) e o Staff mostra 'Responsável da atlética · Halterada' (hoje 'Gestor de modalidade · Modalidade não definida').
- [ ] O login do responsável devolve 200 com role TEAM_MANAGER, teamId e teamName; refresh e /auth/me também (hoje 401).
- [ ] Depois de trocar a senha, a tela do próprio time abre sem toque extra. Nenhum dos 3 itens da barra leva a 'Acesso restrito' e Sair fica a 1 toque.
- [ ] Convite recusado pela API mantém o formulário preenchido e mostra a mensagem do servidor, sem toast de sucesso.
- [ ] Revogar o responsável pela tela da equipe funciona (hoje 404) e a sessão dele cai na próxima renovação.
- [ ] Uma spec da API via execute() cobre login, refresh, concessão pelo admin e recusa sobre outro admin. Um e2e-http cobre convidar, entrar, trocar senha, cadastrar 1 atleta e sair.

**Onde mexer.** Front: `lib/repositories/auth-adapter.ts (normalizeSessionUser: scope e selectedTeamId para TEAM_MANAGER)`, `lib/frontend-session.ts (teamManagerTeamId; canManageRoster por teamId)`, `components/AdminRouteGuard.tsx (equipe pelo teamId, não pelo nome)`, `components/BottomNav.tsx (itens do responsável: Meu time, Jogos, Conta)`, `components/AppShell.tsx (faixa de contexto e Voltar sem rotas bloqueadas)`, `login/page.tsx e dashboard/page.tsx (destino padrão do responsável)`, `profile/page.tsx (rótulo 'Responsável da {equipe}')`, `components/TeamAccessManager.tsx (checar saved.ok)`. API: `src/auth/auth.service.ts: ramo TEAM_MANAGER em resolveIdentity (login, refresh, me)`, `src/edition-actions/edition-actions.service.ts: authorizeEditionAdminStaff aceita 'Responsável da atlética' com equipe da edição`, `src/edition-snapshots/snapshot.mapper.ts loadStaff: rótulo, scope = nome da equipe, teamId e chave com teamId`, `spec em auth.service e em responsavel-de-atletica.spec.ts passando por execute()`, `Sem migração: edition_staff_roles.teamId já existe (20260828120000_gestor_de_atletica)`.

**Depende de:** QA: job e2e com a API real (TESTES-02) para o e2e-http rodar no CI; PUB: lista de jogos na página pública da equipe (VPUB-09), destino de 'Jogos' do responsável. **Risco:** Quem é gestor e responsável ao mesmo tempo: sem cabeçalho, a API resolve escopo de equipe. O seletor de papel precisa oferecer os dois, com teste.

<sub>Achados: NAV-01, EQUIPES-02, EQUIPES-03, JATL-01, JATL-02, JATL-03, ADMIN-01, APIINFRA-01</sub>

### ATL-I02 · Elenco por categoria e cadastro em lote na API

Onda 1 sugerida · feature · esforço G · ~7 dia(s) · cobre 4 achado(s), 4 crítico(s)/alto(s)

**Problema.** Elenco é por modalidade (EditionRoster único por modalidade e atleta). Halterada, Furiosa e Compressora jogam masculino e feminino de Futsal e Handebol e ficariam com uma lista só. Cada atleta custa uma ação com o snapshot inteiro de volta, e o mínimo da edição era 298 atletas em 52 inscrições.

**Solução.** Migração elenco_por_categoria: edition_rosters ganha tournamentId (FK com SET NULL) e índice; o único (modalidade, atleta) continua. O backfill preenche a categoria quando a equipe tem uma só inscrição na modalidade. Nova ação athlete/bulkUpsert {teamId, tournamentId, athletes[{id?, name?, jerseyNumber?}]}, com até 60 linhas numa transação: cria atleta, inscreve existente, restaura removido, muda de categoria e grava número. Se uma linha falha, recusa o lote todo com erro por linha (equipe não inscrita, nome curto, nome ou número repetido). Devolve editionDisciplineId e grava uma auditoria. O snapshot ganha categories e numbers. No front: tipo, reducer local, mock e eligibleAthletes por categoria.

**Critérios de aceite**

- [ ] bulkUpsert com 15 nomes grava 15 atletas e 15 inscrições na categoria em uma transação e uma revisão (hoje são 15 ações e 15 snapshots de cerca de 1 MB).
- [ ] Uma linha inválida devolve 409 com o número da linha e o motivo, e nada é gravado.
- [ ] Responsável de outra equipe e gestor de outra modalidade recebem 403; o gestor da modalidade recebe 200.
- [ ] A migração roda em produção com a mesma contagem de edition_rosters antes e depois; inscrições de equipe com uma só categoria na modalidade recebem tournamentId.
- [ ] O snapshot devolve categories e numbers do atleta, e a mesa de Futsal Feminino lista só atletas de Futsal Feminino.

**Onde mexer.** Front: `lib/repositories/actions.ts (tipo athlete/bulkUpsert)`, `lib/repositories/reducer.ts (modo local)`, `lib/frontend-state.ts (AthleteState.categories e numbers)`, `lib/edition-catalog.ts (athletesOfTeam e eligibleAthletes com tournamentId)`, `matches/live/page.tsx:263 (passar o tournamentId do jogo, uma linha)`, `mock HTTP dos testes e2e`. API: `migrations/20261020120000_elenco_por_categoria: edition_rosters.tournamentId com FK, índice e backfill`, `schema.prisma: EditionRoster.tournamentId e relação com Tournament`, `edition-actions.types.ts e registry: athlete/bulkUpsert`, `handlers/catalog-action.handler.ts: athleteBulkUpsert; syncRosters preserva tournamentId`, `edition-actions.service.ts: bulkUpsert em MANAGER_ACTIONS e em authorizeTeamManager`, `snapshot.mapper.ts mapAthletes e dto AthleteSnapshotDto: categories e numbers`, `spec athlete-bulk-upsert.spec.ts (lote, erro por linha, escopos)`.

**Depende de:** nada. **Risco:** Se algum atleta joga duas categorias da mesma modalidade (por exemplo, Futevôlei Misto), o índice único precisa incluir tournamentId. Confirmar antes de rodar a migração.

<sub>Achados: APIDOM-08, EQUIPES-05, JATL-07, EQUIPES-R3</sub>

### ATL-I03 · Tela Montar elenco: colar a lista por categoria no celular

Onda 1 sugerida · feature · esforço M · ~5 dia(s) · cobre 4 achado(s), 3 crítico(s)/alto(s)

**Problema.** Cada atleta custa 5 toques e 2 trocas de tela: 15 atletas são 75 toques. O formulário oferece as 6 modalidades a qualquer equipe e esquece a escolhida. Inscrever atleta já cadastrado é um por vez (no InterEng, 428 de 429 ficaram sem modalidade).

**Solução.** Rota /teams/[id]/elenco?categoria=. Chips das categorias em que a equipe está inscrita, cada um com 'N de mín–máx'. Caixa 'Cole a lista, um por linha' que entende '10 João Silva', 'João Silva 10', '10 - João' e '1.'. 'Ver prévia' marca cada linha (novo, já no elenco, repetido, removido → restaurar, em outra categoria → mover), com nome e número editáveis. O botão fixo 'Salvar N atletas' chama athlete/bulkUpsert e só confirma com saved.ok. A aba 'Já cadastrados' lista atletas da equipe fora da categoria, com caixas de seleção. '+ Atleta' abre esta mesma tela. Depois de salvar, oferece 'Próxima categoria'.

**Tela alvo.** No topo, escudo e 'HALTERADA · FUTSAL MASCULINO', com os chips das categorias da equipe ('0 de 5–12'). Abas Colar lista | Já cadastrados. Caixa grande com o exemplo '10 João Silva'. Ver prévia → linhas com número, nome e selo (Novo, Repetido, Restaurar). Rodapé fixo: 'Salvar 12 atletas'. Depois: '12 atletas em Futsal Masculino' e o botão 'Próxima: Handebol Masculino'.

**Critérios de aceite**

- [ ] Colar 15 nomes e salvar uma categoria em até 4 toques depois de abrir a tela (hoje são 75 toques e 30 trocas de tela).
- [ ] Ensaio com 2 atléticas reais no celular: do link recebido ao elenco de 3 categorias salvo em até 10 minutos.
- [ ] Só aparecem as categorias em que a equipe está inscrita (a Devoradora vê só Futsal).
- [ ] A prévia acusa nome repetido na lista, já no elenco e removido. Salvar não cria duplicado e restaura o removido.
- [ ] Falha de rede ou 409 mantém a lista colada e aponta a linha com problema.
- [ ] Em 'Já cadastrados', inscrever 10 atletas existentes em outra categoria em uma única ação.

**Onde mexer.** Front: `app/teams/[id]/elenco/page.tsx (nova rota)`, `components/RosterPasteForm.tsx (novo: colar, prévia, salvar)`, `lib/roster-paste.ts (parser puro de linhas e números)`, `tests/unit/roster-paste.test.ts (listas reais de WhatsApp)`, `components/TeamAthleteForm.tsx (vira atalho de uma linha para a mesma tela)`, `components/TeamRosterManager.tsx (botões Colar lista e Já cadastrados por categoria)`, `tests/e2e/montar-elenco.spec.ts`. API: `Nenhuma mudança nova: usa athlete/bulkUpsert de ATL-I02`.

**Depende de:** ATL-I01; ATL-I02; SYNC: compressão do snapshot (PWA-01) para cumprir os 10 minutos no 4G. **Risco:** Lista colada do WhatsApp traz emoji, numeração e apelido. Fechar as regras do parser só depois de testar com listas reais de 3 atléticas.

<sub>Achados: EQUIPES-01, JATL-06, JATL-R2, EQUIPES-R4</sub>

### ATL-I04 · Reorganizar a tela da equipe: elenco por categoria primeiro, classificação oficial

Onda 1 sugerida · reorganização de UX · esforço M · ~5 dia(s) · cobre 10 achado(s), 5 crítico(s)/alto(s)

**Problema.** Os elencos começam na 2ª de 2,7 telas, depois de Arquivar, Editar e Classificações. O botão de remover aparece como caixa vazia e o atleta removido não volta. O bloco Desempenho recalcula a tabela: a Compressora é 1ª do 'grupo c' no Handebol e aparece 4ª de 9 na página da equipe.

**Solução.** TeamDetailView ganha as abas Elenco (padrão), Desempenho e Dados e acesso (só admin: editar, arquivar, responsáveis). Em Elenco, um cartão por categoria inscrita com 'N de mín–máx', ações Colar lista e Já cadastrados, e linhas com número, nome, lápis e 'Remover' escrito. 'Removidos (n)' fica recolhido, com Restaurar, que pergunta a categoria de novo. Responsável e gestor veem as ações por canManageRoster. Desempenho: TeamPerformance lê phase.standings do grupo da equipe e mostra 'Grupo C · 1º' ou 'Semifinal: eliminada'; o componente também atende a página pública. O cartão de categoria na página do atleta passa a ter duas linhas.

**Tela alvo.** Escudo e nome no topo. Abas Elenco · Desempenho · Dados e acesso. Em Elenco: 'Futsal Masculino · 12 de 5–12', com Colar lista e Já cadastrados, e linhas '10 João Silva' com lápis e 'Remover'. No fim, 'Removidos (2)'. Em Desempenho: 'Handebol Masculino · Grupo C · 1º · 2J 2V 6 pts', com link para a tabela.

**Critérios de aceite**

- [ ] A 412 px, o primeiro cartão de elenco aparece na primeira tela (hoje só na segunda).
- [ ] Desempenho mostra a mesma posição, J, V e PTS da aba Tabela. No teste com os dados de outubro, a Compressora aparece 1ª do grupo c no Handebol.
- [ ] A mesma correção aparece na página pública da equipe (/public/teams/[id]).
- [ ] Atleta removido aparece em 'Removidos' e volta ao elenco com Restaurar em até 2 toques.
- [ ] O responsável renomeia e remove atleta da própria equipe. Ações destrutivas têm texto e alvo de 44 px.

**Onde mexer.** Front: `components/TeamDetailView.tsx (abas e ordem)`, `components/TeamRosterManager.tsx (cartões por categoria, número, removidos)`, `components/TeamPerformance.tsx (ler phase.standings por grupo)`, `components/PublicTeamDetailView.tsx (só reaproveita o componente corrigido)`, `components/AthleteDetailView.tsx (cartão de categoria em duas linhas)`, `globals.css (blocos da tela da equipe)`, `tests/e2e/equipe-elenco.spec.ts e teste de componente do Desempenho`. API: `Nenhuma: usa athlete/update (name, removed), athlete/bulkUpsert e phase.standings, que já vêm no snapshot`.

**Depende de:** ATL-I02; ATL-I03; DS: token de perigo e botão destrutivo com texto (CSS-01, VADM-04); EST: tabela oficial sem jogos fora do grupo (CHAVE-01). **Risco:** Enquanto EST não corrigir fase Liga com grupos, phase.standings segue errada no Vôlei, e a página da equipe herda esse erro.

<sub>Achados: EQUIPES-10, EQUIPES-11, JATL-14, EQUIPES-R1, VADM-01, JDADOS-09, TESTES-R3, JESP-07, EQUIPES-14, JATL-12</sub>

### ATL-I05 · Tela Acessos das atléticas: convidar as 17 com mensagem pronta

Onda 1 sugerida · feature · esforço M · ~4.5 dia(s) · cobre 3 achado(s), 1 crítico(s)/alto(s)

**Problema.** Para dar acesso, o admin abre cada equipe, rola 2,7 telas, inventa uma senha e escreve à mão no WhatsApp. Não dá para ver quem recebeu, entrou ou cadastrou. Para e-mail que já tem conta, a senha digitada é ignorada e a tela manda enviar uma senha que não funciona.

**Solução.** Rota /teams/acessos (Gestão > Acessos das atléticas), com uma linha por equipe: situação (sem acesso, convidado · ainda não entrou, entrou) e elenco por categoria contra o mínimo. 'Convidar' abre uma folha com nome e e-mail. O app gera senha temporária legível, envia em initialPassword e mostra 'Enviar por WhatsApp' (wa.me com endereço, e-mail e senha) e 'Copiar'. Para conta existente, a API recusa initialPassword com ACCOUNT_EXISTS; a tela reenvia sem senha e avisa 'entra com a senha que já usa'. 'Cobrar elenco' copia uma mensagem com o que falta. A checagem de e-mail repetido passa a comparar member.email.

**Tela alvo.** Título 'Acessos das atléticas · 9 de 17 entraram'. Chips Sem acesso, Não entrou, Sem elenco. Cada linha tem escudo, nome, selo de situação e 'Futsal M 12/5 · Handebol F 0/7'. O botão da linha muda para Convidar, Reenviar ou Cobrar. A folha de convite tem 2 campos e 'Criar e enviar por WhatsApp'.

**Critérios de aceite**

- [ ] Convidar uma atlética em até 5 toques, sem digitar senha; os 17 convites em menos de 15 minutos.
- [ ] A mensagem sai com endereço de login, e-mail e senha temporária, e a senha some da tela ao fechar a folha.
- [ ] A situação passa a 'entrou' quando o responsável troca a senha inicial.
- [ ] Convite para e-mail com conta existente não promete senha nova e diz como a pessoa entra (hoje anuncia sucesso).
- [ ] Ensaio antes do evento: 2 atléticas convidadas por esta tela cadastram o elenco sem ajuda, o que responde à dúvida de JATL-05 sobre o zero de atletas.

**Onde mexer.** Front: `app/teams/acessos/page.tsx (nova rota)`, `components/AthleticAccessList.tsx (novo: lista, filtros, folha de convite)`, `components/TeamAccessManager.tsx (passa a usar a mesma folha)`, `lib/temp-password.ts (senha legível com crypto.getRandomValues)`, `lib/whatsapp-message.ts (convite e cobrança)`, `more/page.tsx (atalho em Gestão)`. API: `handlers/context-action.handler.ts staff/upsert: initialPassword em conta existente devolve 409 com code ACCOUNT_EXISTS`, `snapshot.mapper.ts loadStaff: firstAccessPending a partir de mustChangePassword, se ADM ainda não tiver entregue`.

**Depende de:** ATL-I01; ADM: selo 'ainda não entrou' no staff (ADMIN-04, APIINFRA-R3); ADM: redefinir senha pela tela (ADMIN-02), para o botão Redefinir acesso; NAV: entrada 'Gestão' que reúne esta tela (NAV-09). **Risco:** A senha temporária passa pelo WhatsApp; a troca obrigatória no primeiro acesso reduz o risco. O convite por link de uso único (ADM) substitui o texto depois.

<sub>Achados: JATL-09, JATL-R4, JATL-05</sub>

### ATL-I06 · Liberar o elenco ao gestor de modalidade sem apagar as outras modalidades

Onda 2 sugerida · correção · esforço M · ~3.5 dia(s) · cobre 4 achado(s), 4 crítico(s)/alto(s)

**Problema.** A API põe athlete/create e update na lista do gestor, mas a checagem depois do handler responde 403 sempre, porque o handler não devolve modalidade. A tela esconde '+ Atleta' do gestor, e o nome do atleta leva a 'Acesso restrito'. Sem o 403, salvar pelo gestor tiraria o atleta das outras modalidades.

**Solução.** API: athleteCreate, athleteUpdate e athleteBulkUpsert devolvem editionDisciplineId no escopo de modalidade. Para o gestor, modalities em athlete/update vira inclusão ou retirada só da modalidade dele, preservando as outras. removed e teamId vindos do gestor são recusados; name é aceito. O snapshot do gestor passa a trazer os atletas das equipes da modalidade dele, para inscrever quem já existe em vez de recadastrar. Front: TeamDetailView e TeamRosterManager usam canManageRoster, e o gestor vê só as categorias da sua modalidade. O nome do atleta só vira link para quem acessa /athletes. Atualizar PAPEIS_E_FLUXOS.md.

**Tela alvo.** O gestor de Futsal abre a Alcateia. Na aba Elenco aparecem só Futsal Masculino e Feminino, cada uma com Colar lista e Já cadastrados. Atletas da equipe em outras modalidades aparecem em 'Já cadastrados' para inscrever. Não há botão de remover da equipe.

**Critérios de aceite**

- [ ] O gestor de Futsal cadastra atleta na Alcateia e recebe 200 (hoje 403, com a transação desfeita).
- [ ] Quando o gestor de Futsal ajusta um atleta inscrito em Futsal e Basquete, o Basquete continua ativo.
- [ ] Gestor que tenta remover atleta da equipe ou trocá-lo de equipe recebe 403 com mensagem clara.
- [ ] Uma spec via execute() cobre o gestor na própria modalidade (200) e em outra (403).

**Onde mexer.** Front: `components/TeamDetailView.tsx`, `components/TeamRosterManager.tsx (ações por canManageRoster; link só com acesso)`, `components/AppShell.tsx (permissão de ação 'roster')`, `lib/frontend-session.ts (canManageRoster considerando a modalidade)`, `docs/PAPEIS_E_FLUXOS.md (gestor e responsável)`. API: `handlers/catalog-action.handler.ts: as três ações de atleta devolvem editionDisciplineId`, `handlers/catalog-action.handler.ts syncRosters: mesclagem que preserva outras modalidades no escopo do gestor`, `edition-actions.service.ts authorizeManagerAthlete: recusar removed e teamId`, `snapshot.mapper.ts: atletas das equipes do escopo do gestor`, `gestor-atleta-escopo.spec.ts passando por execute()`.

**Depende de:** ATL-I02. **Risco:** Se a mesclagem de modalidades no servidor errar, inscrições somem sem aviso. Testar com atleta de três modalidades e uma delas travada.

<sub>Achados: EQUIPES-04, JATL-04, JATL-R1, EQUIPES-R2</sub>

### ATL-I07 · Validar trava e limites de elenco no servidor, por categoria

Onda 2 sugerida · correção · esforço M · ~4 dia(s) · cobre 2 achado(s), 0 crítico(s)/alto(s)

**Problema.** A trava 'elenco fecha no mata-mata' só existe na tela de elenco, decidida pelo nome da fase e por modalidade. A final do Futsal de 3 equipes (11/10) trancou o Futsal inteiro com 20 jogos da outra categoria por fazer. O cadastro novo e a API ignoram a trava, e o admin não tem como abrir exceção.

**Solução.** Uma função da API, rosterLock(categoria), lê roster.lock do regulamento: 'discipline-start' fecha na estreia da categoria; 'knockout' fecha quando começa uma partida de fase KNOCKOUT da categoria (pelo tipo da fase, não pelo nome). athlete/create, update e bulkUpsert recusam incluir, mover ou remover atleta em categoria travada, com a mensagem do regulamento. O admin da edição envia lockOverride {reason}, que vai para a auditoria e aparece como 'alterado após a trava'. Mínimo e máximo continuam só avisando. No front, checkRosterLock passa a ser por categoria e pelo formato da fase.

**Tela alvo.** O cartão da categoria travada mostra a faixa 'Elenco fechado desde 11/10 14:30 (mata-mata)'. O responsável não vê ações. O admin vê 'Alterar mesmo assim', que pede o motivo antes de abrir Colar lista ou Remover.

**Critérios de aceite**

- [ ] Iniciar a final do Futsal Masculino não trava o Futsal Feminino.
- [ ] Responsável e gestor recebem 409 com a mensagem do regulamento ao incluir atleta em categoria travada, tanto pela tela quanto direto na API (hoje passa).
- [ ] O admin altera elenco travado informando o motivo, e a auditoria registra quem, quando e por quê.
- [ ] Uma fase eliminatória chamada 'Playoffs' trava igual a uma chamada 'Mata-mata'.

**Onde mexer.** Front: `lib/eligibility.ts (trava por categoria)`, `lib/match-lifecycle.ts (eliminatória pelo formato da fase)`, `components/TeamRosterManager.tsx (faixa e 'Alterar mesmo assim')`, `components/RosterPasteForm.tsx (consultar a trava antes de salvar)`. API: `src/edition-actions/roster-lock.ts (novo, usa action-regulation.ts)`, `handlers/catalog-action.handler.ts: chamar a trava nas três ações de atleta`, `edition-actions.service.ts: lockOverride aceito só no escopo full, com motivo na auditoria`, `spec roster-lock.spec.ts`.

**Depende de:** ATL-I02; EST: 'é eliminatória' pelo formato da fase numa função única (REGRAS-R4). **Risco:** Uma trava mal configurada no regulamento bloqueia inscrição em pleno evento. O override do admin tem de chegar no mesmo PR.

<sub>Achados: EQUIPES-07, JATL-08</sub>

### ATL-I08 · Lista de equipes compacta, catálogo sem conflito e escudo sem deploy

Onda 2 sugerida · reorganização de UX · esforço M · ~4.5 dia(s) · cobre 5 achado(s), 0 crítico(s)/alto(s)

**Problema.** 16 equipes ocupam 4,1 telas (cartões de 202 px, barra sem significado, '1 atletas'). Criar equipe com nome que já está no catálogo dá erro de ID, e o catálogo vincula uma por vez. Escudo novo só entra por deploy (3 entraram em 10/10, no meio do evento), porque o upload dá 404 em /intereng-storage.

**Solução.** Lista em linhas de 64 px: escudo de 40 px, nome, sigla, 'N atletas · 3 categorias' e selos 'Sem elenco' e 'Sem responsável', em ordem alfabética. Chips Sem elenco e Arquivadas (n); 'Nova equipe' e 'Do catálogo' no topo. Em Nova equipe, o app busca no catálogo enquanto o nome é digitado e oferece 'Já existe: adicionar à edição'. O catálogo ganha seleção múltipla ('Adicionar N equipes') e busca no servidor (GET /teams?search). Renomear ou trocar escudo avisa 'vale para todas as edições'. escudos.ts passa a ser gerado no build a partir de public/teams. O upload volta em produção quando o gateway tiver a rota.

**Tela alvo.** 'Equipes · 17 nesta edição', com busca e chips (Sem elenco 5, Sem responsável 8, Arquivadas 1). Cerca de 10 linhas por tela. No topo, os botões Nova equipe e Do catálogo. Em Nova equipe, o campo de nome sugere 'Halterada já existe no catálogo — Adicionar à edição'.

**Critérios de aceite**

- [ ] A 412 px, as 17 equipes cabem em até 1,5 tela (hoje 4,1).
- [ ] Digitar o nome de uma equipe do catálogo oferece adicioná-la à edição, sem o erro 'Já existe uma equipe com o ID informado'.
- [ ] Vincular 5 equipes do catálogo de uma vez.
- [ ] Escudo enviado pela tela aparece em produção sem deploy do front (hoje 404 em /intereng-storage).
- [ ] As 31 imagens de public/teams aparecem no seletor (hoje 24).

**Onde mexer.** Front: `app/teams/page.tsx (chips e ações no topo)`, `components/TeamCard.tsx (linha compacta)`, `components/AttachCatalogTeam.tsx (seleção múltipla e busca)`, `components/TeamCreationForm.tsx (sugestão do catálogo; upload religado)`, `components/TeamManager.tsx (aviso de alteração global)`, `scripts/gerar-escudos.mjs e lib/escudos.ts gerado no build`, `globals.css (.team-card)`. API: `Nenhuma ação nova: GET /teams?search e logo-upload-url já existem`.

**Depende de:** ADM: location /intereng-storage no gateway (api#11, APIINFRA-11); DS: linha compacta e selo base (CSS-10). **Risco:** GET /teams é rota legada que APIDOM-14 quer remover. Mantê-la até existir uma busca de catálogo por ação.

<sub>Achados: EQUIPES-09, VADM-11, EQUIPES-12, EQUIPES-13, SCRIPTS-14</sub>

### ATL-I09 · Trazer o elenco da edição anterior ao vincular a equipe

Onda 3 sugerida · feature · esforço M · ~4 dia(s) · cobre 1 achado(s), 0 crítico(s)/alto(s)

**Problema.** team/attach cria só o vínculo, e athlete/create sempre cria uma pessoa nova. A Copa vinculou equipes do InterEng, que tinha 429 atletas, e começou com 0. A próxima edição também recomeçaria do zero ou duplicaria pessoas.

**Solução.** athlete/bulkUpsert passa a aceitar o id de um atleta global que esteve na equipe numa edição anterior: cria EditionAthlete e a inscrição na categoria, sem duplicar a pessoa. Nova rota de leitura GET /editions/:id/teams/:teamId/previous-roster, liberada para responsável, gestor e admin da equipe, lista os atletas da última edição da equipe com o número anterior. Em Montar elenco, a aba 'Da edição anterior' mostra essa lista com caixas marcadas, para confirmar quem continua em cada categoria.

**Tela alvo.** Em Montar elenco, a terceira aba 'De 2026' mostra os nomes com caixas marcadas e o número anterior ao lado. Rodapé fixo: 'Trazer 11 atletas para Futsal Masculino'.

**Critérios de aceite**

- [ ] Trazer 11 atletas da edição anterior em até 3 toques, sem criar registro novo na tabela athletes.
- [ ] O responsável só vê atletas da própria equipe; outra equipe recebe 403.
- [ ] Atleta trazido mantém o número da edição anterior, que pode ser editado na prévia.

**Onde mexer.** Front: `components/RosterPasteForm.tsx (aba Da edição anterior)`, `lib/repositories/http-adapter.ts (leitura da rota previous-roster)`. API: `catalog-action.handler.ts athleteBulkUpsert: aceitar atleta global sem vínculo na edição`, `nova rota GET /editions/:id/teams/:teamId/previous-roster com autorização por escopo`, `spec cobrindo reaproveitamento sem duplicar a pessoa`.

**Depende de:** ATL-I02; ATL-I03. **Risco:** Atleta que mudou de atlética entre edições aparece na lista antiga. Ele precisa vir desmarcado quando já estiver em outra equipe da edição atual.

<sub>Achados: JATL-R3</sub>

### ATL-N01 · Time B ligado à atlética-mãe: escudo, responsável e agrupamento _(acrescentada na conferência de cobertura)_

Onda 2 sugerida · feature · esforço M · ~3.5 dia(s) · cobre 2 achado(s), 0 crítico(s)/alto(s)

**Problema.** Halterada 2 é equipe avulsa: nos 3 jogos Halterada × Halterada 2 os dois lados mostram o mesmo escudo, o responsável alcança só a primeira equipe atribuída e o guarda de rota casa 'halterada' com 'halterada-2'. PUB-I04 depende de 'time B ligado à atlética-mãe', que nenhuma iniciativa de ATL entrega.

**Solução.** Campo opcional parentTeamId em Team, um nível só. O time B segue equipe própria: inscrição, elenco, tabela, chave e pontos no ranking continuam dele, sem mexer em TournamentEntry. team/update aceita o vínculo com validação. O snapshot leva parentTeamId. acharEscudo do time B devolve o escudo da mãe com selo '2' no cartão, no placar e na mesa. O escopo do responsável na API passa de um teamId a 'mãe + filhos', e o guarda de rota compara o id inteiro contra essa lista. A lista de equipes mostra o filho recuado sob a mãe. PUB-I04 segue a mãe e inclui os filhos; até esta entrega, segue cada equipe.

**Tela alvo.** Equipes: 'Halterada' e, recuada logo abaixo, 'Halterada 2' com o mesmo escudo e o selo '2'. No cartão de jogo, no placar e na mesa, o lado do time B mostra o selo no canto do escudo. Na edição da equipe, campo 'Time B de' com as equipes da edição. Ação principal: escolher a atlética-mãe e salvar.

**Critérios de aceite**

- [ ] Com Halterada 2 ligada à Halterada, o responsável da Halterada abre e edita o elenco das duas; o responsável de outra atlética recebe 403 da API.
- [ ] Nos 3 jogos Halterada × Halterada 2 de produção, cartão, placar e mesa distinguem os lados pelo selo, sem depender do nome.
- [ ] team/update recusa vínculo com a própria equipe, com um time que já é filho ou com equipe fora da edição.
- [ ] Sem vínculo, o guarda de rota não deixa o responsável de 'halterada' abrir /teams/halterada-2.
- [ ] Replay dos jogos reais: tabela, chave e ranking iguais antes e depois do vínculo.

**Onde mexer.** Front: `app/lib/escudos.ts: escudo da mãe com selo para o time B`, `app/components/AdminRouteGuard.tsx: comparar id inteiro contra a lista mãe + filhos (linha 54)`, `app/teams/page.tsx: filho recuado sob a mãe`, `app/components/TeamManager.tsx: campo 'Time B de'`, `app/components/MatchCard.tsx e app/matches/live/page.tsx: selo no escudo`, `app/lib/frontend-state.ts: parentTeamId no tipo da equipe`. API: `migração: teams.parentTeamId opcional, FK para teams, onDelete SetNull`, `team/update: aceita parentTeamId; valida um nível, sem ciclo e com as duas equipes na edição`, `edition-snapshots.service.ts:224-229: escopo do responsável vira mãe + filhos`, `snapshot.mapper.ts: parentTeamId na equipe`.

**Depende de:** ATL-I01. **Risco:** Escopo por lista mexe na autorização da API: um erro abre equipe alheia. Exige teste e2e-http do escopo antes do merge.

<sub>Achados: EQUIPES-08, JATL-11</sub>

**Fora de escopo, de propósito**

- Segundo time da mesma atlética (EQUIPES-08, JATL-11): exige inscrição múltipla e uma regra de ranking. Hoje funciona como equipe avulsa com o mesmo escudo. Retomar se a organização pedir.
- Autoinscrição do atleta por link público com aprovação: é G e cria rota pública com dado pessoal. Colar a lista já cumpre a meta de 10 minutos.
- Convite por link de uso único e redefinição de senha: são de ADM. ATL usa senha temporária gerada pelo app e troca obrigatória no primeiro acesso até lá.
- Responsável editar escudo e contato da equipe ou convidar co-responsável (parte de JATL-12): exige permissões novas na API. O admin convida um segundo responsável pela tela de acessos.
- Documento, data de nascimento e LGPD do atleta (APIINFRA-13): ATL grava só nome, equipe, categoria e número; a política de dados é de ADM.
- Autor do lance pelo número, painel 'Quem marcou?', artilharia e página pública do atleta: são de MESA e PUB, que consomem eligibleAthletes por categoria e os números do snapshot.

**Perguntas para a organização**

- Na próxima edição o elenco será exigido? Se sim, até que data e quem cobra a atlética que não cadastrar?
- Algum atleta joga duas categorias da mesma modalidade (por exemplo, Futevôlei Masculino e Misto)? Se sim, a migração muda o índice único antes de rodar.
- A organização tem nome e e-mail de um responsável de cada uma das 17 atléticas? Pode haver dois por atlética?
- Quando o elenco fecha: na estreia da categoria ou no início do mata-mata? O admin pode abrir exceção (lesão, erro de digitação) informando o motivo?


## PUB — Área pública (espectador)

**Objetivo.** O espectador abre o app no celular e, sem login e sem rolar, vê o que acontece hoje, quando joga a sua atlética e como está a disputa. Placar só aparece em jogo que começou, tabela e chave são iguais às oficiais, a campeã é anunciada e todo jogo abre com um toque.

**Princípios**

- Três perguntas na primeira tela: toda tela pública responde a 'o que rola hoje', 'quando joga minha atlética' ou 'como está a disputa', com a resposta visível sem rolar em 412×915.
- Só o oficial e verdadeiro: placar só depois de o jogo começar. Nada de nota interna, JSON, instrução de gestão ou falha da mesa. Na dúvida, mostrar a hora do último dado em vez de afirmar 'ao vivo' ou 'agora'.
- Um jogo, um desenho: cartão e linha dizem sempre a etapa, as equipes, o placar ou o horário e o desfecho (vencedora, pênaltis, W.O., parciais). Todo jogo abre a sua página com um toque.
- O servidor é a fonte: tabela, pódio, rodada e estado vêm do snapshot. No modo API o front não recalcula classificação; sem dado, diz 'em preparação' em vez de inventar ordem ou 'sorteio'.
- Lembrar sem conta: a atlética seguida fica guardada no aparelho; dia, modalidade, grupo e aba ficam na URL, para voltar e compartilhar sem refazer o caminho. Nenhum link de conteúdo leva a rota privada.
- Legível na arquibancada: Aldo the Apache em placar, nomes e títulos sobre o azul #0A105A; verde #8CE303 só para destaque e vencedora. Alvos de 44 px e texto com pelo menos 12 px, pelos tokens de DS.

**Desenho alvo**

Mapa de telas (sem login, sob /copahalterada/public). Barra inferior: Hoje · Jogos · Tabelas · Equipes; Artilharia entra só quando houver lance com autor.
- Hoje (/public): atlética seguida; Ao vivo; A seguir; aviso de jogos de hoje sem resultado; Últimos resultados. Antes do evento, contagem regressiva e primeiro dia; depois, Campeãs.
- Jogos (/public/matches?dia=&modalidade=&equipe=): o dia em blocos Ao vivo, A seguir e Resultados, em linhas compactas.
- Jogo (/public/matches/[id]): etapa, placar com desfecho, parciais, links para a tabela e as atléticas, lances recolhidos e Compartilhar.
- Tabelas (/public/tournaments): modalidade como cabeçalho; cada categoria é uma linha com a etapa ou a campeã.
- Categoria (/public/tournaments/[id]?aba=tabela|chave|jogos&grupo=): pódio no topo quando encerrada; só as abas que se aplicam.
- Equipes (/public/teams, com busca) e Atlética (/public/teams/[id]): Seguir, próximo jogo, jogos, campanha oficial e elenco, se houver.
- /public/standings/general: redirecionamento temporário; mostra o ranking geral se o dono aprovar.

Dados: um só GET /editions/active/public-snapshot, sem token mesmo com sessão. No modo API o front não calcula classificação: tabela, status, pódio e rodada vêm do servidor. Enquanto EST não envia rodada, número do jogo e pódio, o que o snapshot já traz (ids '-advanced-', tiebreak, periodResults, startedAt, events[].at) é lido por funções puras, cada uma testada sobre a semente de produção:
- edition-catalog.ts (matchView): placar só se o jogo começou, desfecho, vencedora, etapa;
- public-today.ts: blocos de Hoje e da agenda, pela hora do aparelho;
- bracket-view.ts: rodadas, vagas, 3º lugar;
- standings-view.ts: grupos e linha de corte;
- team-view.ts: jogos e campanha da equipe;
- category-headline.ts: etapa atual e pódio.

Estado do aparelho: followedTeams na chave intereng:preferences:v1 do localStorage, sem conta. Dia, filtros, grupo e aba ficam na URL.

Componentes novos: PublicTodayView, PublicDaySchedule, KnockoutBracket, StandingsTable, PodiumBlock, FollowTeamButton, ShareButton. Cartão, linha compacta, selo e placar vêm de DS; os selos de estado e a fila vêm de AGD; o relógio, de MESA; o selo de conexão, de SYNC.

### PUB-I01 · Corrigir placar 0×0, links quebrados e textos internos no público

Onda 0 sugerida · correção · esforço M · ~4 dia(s) · cobre 13 achado(s), 9 crítico(s)/alto(s)

**Problema.** Em produção, os 40 jogos não disputados aparecem '0 — 0'. Na aba Jogos nenhum dos 47 cartões de 12/10 abre a partida, e 'Tabela de Futsal' leva ao login. O público lê o JSON da retificação e a nota interna sobre a Compressora; gestor logado vê só a própria modalidade.

**Solução.** matchView devolve placar nulo enquanto o jogo não começou (hasStarted); cartão, página e descrição do link mostram o horário. Os cartões da agenda pública viram links para /public/matches/<id>. 'Tabela de X' abre a categoria pública (direto se houver uma, lista filtrada se houver várias). A migalha da partida diz 'Jogos' e ativa essa aba. A retificação é formatada a partir do JSON já gravado ('0 × 3 → 0 × 2') e omitida quando antes e depois são iguais. 'Motivo' aparece só em Adiada, Cancelada e W.O., com filtro também no snapshot público. As rotas /public sempre pedem /public-snapshot, mesmo com sessão. O aria-label do cartão traz placar ou horário. Na categoria, encerrados do mais recente ao mais antigo.

**Tela alvo.** Nada muda de lugar. No jogo agendado, o centro do cartão mostra '15:30' grande no lugar de '0 — 0'. Tocar em qualquer cartão da aba Jogos abre a página do jogo. Com a agenda filtrada, o botão no fim diz 'Tabela de Futsal Masculino' e abre a categoria pública. No jogo retificado aparece uma linha: 'Placar corrigido pela organização: 0 × 3 → 0 × 2'.

**Critérios de aceite**

- [ ] Com o snapshot de produção, nenhum dos 40 jogos 'Agendada' mostra '0 — 0' em cartão, página ou prévia de link; todos mostram o horário.
- [ ] Um e2e novo, sem sessão, percorre todos os links de Hoje, Jogos (12/10), categoria, equipe e jogo e falha se alguma URL cair em /login. Hoje 'TABELA DE FUTSAL' cai.
- [ ] Na aba Jogos de 12/10, os 47 cartões são links para /public/matches/<id> (hoje nenhum).
- [ ] O jogo retificado do Vôlei mostra '0 × 3 → 0 × 2' uma única vez; os 4 jogos com 'Ajuste de jogos... COMPRESSORA' não exibem o motivo ao público.
- [ ] Gestor de Vôlei logado vê em /public/matches as 4 modalidades, como o visitante (teste e2e-http).
- [ ] O leitor de tela anuncia 'Halterada contra Furiosa, 2 a 0, encerrado' ou 'Halterada contra Furiosa, hoje às 15:30'.

**Onde mexer.** Front: `apps/web/app/lib/edition-catalog.ts (matchView: placar nulo antes de começar) e lib/repositories/edition-seed.ts (seed com 0/0, como a API)`, `apps/web/app/components/MatchScoreCard.tsx e MatchSummary.tsx (horário no centro, aria-label com placar ou horário)`, `apps/web/app/components/MatchSchedule.tsx (href também em publicView)`, `apps/web/app/components/PublicMatchesHub.tsx, PublicTournamentsPage.tsx e PublicTournamentDetailView.tsx (link 'Tabela de X' público, filtro ?modalidade, encerrados do mais recente)`, `apps/web/app/components/MatchDetailClient.tsx (retificação formatada; Motivo só em Adiada, Cancelada e W.O.)`, `apps/web/app/components/AppShell.tsx (publicRouteLabels: matches → Jogos) e MatchRouteView.tsx (aba ativa Jogos)`, `apps/web/app/lib/repositories/http-adapter.ts (rotas /public usam public-snapshot sem token e recarregam ao trocar de área)`, `apps/web/tests/e2e/links-publicos.spec.ts (novo) e app/public/matches/[id]/page.tsx (descrição sem 'Placar: 0 a 0')`. API: `snapshot.mapper.ts:881: no snapshot público, enviar reason só para POSTPONED, CANCELLED e WALKOVER; sem migração`, `snapshot.mapper.spec.ts: partida Encerrada com reason não leva o campo ao público`.

**Depende de:** SYNC: combinar a ordem de merge em http-adapter.ts (fila e timeout); QA: test:unit e e2e-http rodando no CI. **Risco:** SYNC também altera http-adapter.ts. Os snapshots visuais do e2e precisam ser regerados. A mudança na API vai direto para produção ao entrar na main.

<sub>Achados: PUBLICO-02, JESP-02, VPUB-R2, AGENDA-09, PUBLICO-04, NAV-06, AGENDA-R4, JESP-05, VPUB-10, PUBLICO-13, DADOS-10, NAV-R2, PUBLICO-R4</sub>

### PUB-I02 · Desenhar a chave do mata-mata por rodada na aba Chave

Onda 1 sugerida · feature · esforço M · ~4 dia(s) · cobre 6 achado(s), 6 crítico(s)/alto(s)

**Problema.** A aba Chaveamento filtra jogos por /semi|quart|final/ no nome da fase, mas os 24 jogos eliminatórios de produção estão na fase 'Mata-mata'. Nas 8 categorias a aba diz que a chave 'será exibida quando os confrontos forem gerados', mesmo com finais disputadas. 'Vencedor do Jogo 16' não aponta para nenhum jogo.

**Solução.** Novo lib/bracket-view.ts: um jogo é eliminatório se a fase tem formato 'Mata-mata' ou se o id segue o padrão '-advanced-'. Rodada e posição vêm de round/bracketSlot quando EST os enviar; até lá, do id (knockoutRound e bracketOrder, que passam a ser exportados). As rodadas recebem nome a partir da última: Final, Semifinal, Quartas, Oitavas; '-advanced-third' é o 3º lugar. KnockoutBracket desenha uma coluna por rodada, com rolagem lateral: escudos, placar, pênaltis, vencedora destacada, vaga aberta esmaecida e link para o jogo. A categoria (pública e interna) ganha a aba 'Chave'. isKnockoutMatch substitui a leitura pelo nome da fase também em eligibility.ts e na mesa.

**Tela alvo.** Na categoria, aba 'Chave'. Colunas QUARTAS · 12 OUT, SEMIFINAL e FINAL, com o 3º LUGAR abaixo da final. No celular a coluna atual cabe inteira e as outras aparecem com deslize lateral. Cada confronto tem duas linhas (escudo, nome e placar): vencedora em verde, '15:30' antes de começar e '1º Grupo A' esmaecido quando a vaga ainda está aberta. Tocar abre o jogo.

**Critérios de aceite**

- [ ] Com a semente de produção, a aba Chave mostra os 23 jogos com id de chave, em rodadas nomeadas, nas 7 categorias com mata-mata. Hoje mostra 0 jogos e a frase 'será exibido'.
- [ ] Futsal Masculino: Quartas (4), Semifinal (2), Final (1) e 3º lugar. Os jogos r1-1 e r1-2 ficam alinhados ao r2-1, que os cita como 'Vencedor do Jogo 16 x Vencedor do Jogo 18'.
- [ ] A final do Futsal Feminino mostra '3 × 3 (3×2 pên.)' com Compressora destacada; a final do Handebol mostra Halterada 24 × 14 Tormenta.
- [ ] Todo confronto abre /public/matches/<id> com um toque; a 412 px a página não ganha rolagem horizontal.
- [ ] Aba Chave, mesa e trava de elenco usam a mesma função para saber se o jogo é de mata-mata, sem regex de nome; teste com fases chamadas 'Mata-mata' e 'Playoffs'.

**Onde mexer.** Front: `apps/web/app/lib/bracket-view.ts (novo: bracketRounds, roundLabel, isKnockoutMatch)`, `apps/web/app/lib/tournament-progression.ts (exportar knockoutRound e bracketOrder)`, `apps/web/app/components/KnockoutBracket.tsx (novo)`, `apps/web/app/components/TournamentClassification.tsx (sai o regex da linha 94 e o chip Chaveamento)`, `apps/web/app/components/PublicTournamentDetailView.tsx e CategoryDetailView.tsx (aba Chave)`, `apps/web/app/lib/eligibility.ts e lib/match-lifecycle.ts (isKnockoutMatch no lugar do nome da fase)`, `apps/web/app/globals.css (bloco .bracket: colunas com scroll-snap)`, `apps/web/tests/unit/bracket-view.test.ts (novo, com os 23 jogos de chave de produção)`. API: `Nenhuma obrigatória: os ids '-advanced-rN-M' e '-advanced-third' já trazem a rodada e a posição`, `Quando EST expuser Match.round e Match.bracketSlot (schema.prisma:445-446) no snapshot público, bracket-view passa a preferi-los ao id`.

**Depende de:** PUB-I01; EST: rodada, vaga e número do jogo no snapshot; MESA: revisar a troca de isEliminationPhase na mesa; QA: semente com os jogos reais para os testes. **Risco:** Jogo de chave criado à mão (id 'match-…') fica numa coluna 'Outros jogos' até EST enviar a rodada. A troca na mesa precisa de revisão da trilha MESA.

<sub>Achados: CHAVE-04, PUBLICO-01, JESP-01, VPUB-01, JORG-03, REGRAS-R4</sub>

### PUB-I03 · Tela inicial Hoje: ao vivo, a seguir e últimos resultados

Onda 1 sugerida · reorganização de UX · esforço M · ~4 dia(s) · cobre 4 achado(s), 4 crítico(s)/alto(s)

**Problema.** A home só lista jogos com status 'Ao vivo'. No evento, só cerca de 1/3 dos jogos foi operado ao vivo, então ela mostrava '0 partidas ao vivo' e um botão. Hoje exibe como 'AGORA' um jogo de basquete abandonado em 12/10 às 14:52. O modo 'upcoming' já existe, mas nenhuma tela o usa.

**Solução.** PublicTodayView substitui PublicLiveView; lib/public-today.ts monta os blocos a partir do snapshot e da hora do aparelho. Durante o evento: Ao vivo (some se vazio; mostra 'último lance às HH:MM'; jogo parado desde o dia anterior não entra); A seguir (até 5 jogos pendentes de hoje, a partir de uma hora antes de agora, na fila de AGD quando ela existir); aviso 'N jogos de hoje sem resultado' com link para a agenda; Últimos resultados (os 5 mais recentes). Antes do evento: contagem regressiva e primeiro dia. Dia sem jogos: o próximo dia. Depois do evento: Campeãs (PUB-I07). No topo, a atlética seguida (PUB-I04). A aba 'Ao vivo' passa a se chamar 'Hoje'.

**Tela alvo.** Faixa da edição. Se a pessoa segue uma atlética, vem o cartão dela com o próximo jogo ou o placar ao vivo. AO VIVO (2): cartões com 'último lance às 15:42'. A SEGUIR: 5 linhas com hora, confronto e categoria, e 'Agenda do dia (47) ›'. Aviso '21 jogos de hoje sem resultado ›'. ÚLTIMOS RESULTADOS: 5 linhas com a vencedora em verde. Ação principal: tocar num jogo.

**Critérios de aceite**

- [ ] Replay da semente de produção com relógio em 12/10 às 16:00 (412×915): A seguir mostra 5 dos 11 jogos pendentes a partir das 15:00, o aviso '21 jogos de hoje sem resultado' e 5 últimos resultados; nenhum '0 — 0'.
- [ ] Com relógio em 13/10, o basquete Mafiosa × Furiosa (último lance em 12/10 às 14:52) não aparece como ao vivo nem como 'AGORA'.
- [ ] Sem nenhum jogo ao vivo, a primeira tela tem sempre ao menos um bloco com jogos (A seguir, Últimos resultados ou próximo dia de jogos).
- [ ] Teste unitário de public-today nos quatro momentos: antes, durante, entre dias e depois do evento.

**Onde mexer.** Front: `apps/web/app/components/PublicTodayView.tsx (novo, substitui PublicLiveView.tsx)`, `apps/web/app/lib/public-today.ts (novo: blocos por momento do evento e hora do aparelho)`, `apps/web/app/components/PublicAppShell.tsx (aba 'Hoje')`, `apps/web/app/public/page.tsx (metadata de Hoje)`, `apps/web/app/components/PublicMatchCollection.tsx (removido; a lógica vai para public-today.ts)`, `apps/web/tests/unit/public-today.test.ts (novo, replay em 4 horários)`, `apps/web/tests/e2e/navigation.spec.ts (snapshots da home)`. API: `Nenhuma: usa startedAt, events[].at e as datas da edição, que já vêm no snapshot público`, `Quando MESA gravar finishedAt e a marca de jogo parado, public-today passa a usá-los`.

**Depende de:** PUB-I01; AGD: selos que envelhecem e fila 'A SEGUIR' por quadra; MESA: jogo abandonado Ao vivo e hora de encerramento; SYNC: hora da última atualização no selo de conexão. **Risco:** Relógio do aparelho errado desloca os blocos. Sem finishedAt (MESA), 'Últimos resultados' ordena pelo último lance, que não existe em resultado lançado sem lances.

<sub>Achados: PUBLICO-06, JESP-04, VPUB-02, NAV-04</sub>

### PUB-I04 · Minha atlética: seguir, ver jogos e posição oficial da equipe

Onda 1 sugerida · feature · esforço M · ~5 dia(s) · cobre 14 achado(s), 10 crítico(s)/alto(s)

**Problema.** Não há como achar os jogos de uma atlética: a página dela diz '2 jogos na agenda' sem listá-los, e a agenda só filtra por modalidade e dia (a Halterada tem 29 jogos em 8 categorias). A posição é recalculada no navegador e diverge da tabela: Halterada 2 aparece em 3º com 4 jogos e 6 pts; na tabela oficial, é 2ª do Grupo B.

**Solução.** Botão 'Seguir' na página da equipe, guardado no aparelho (followedTeams em device-preferences; aceita várias equipes; sem login). A página abre com Próximo jogo e a lista Jogos de todas as categorias, primeiro os próximos e depois os resultados (lib/team-view.ts). TeamPerformance deixa de calcular: lê phase.standings da fase classificatória, filtrado pelo grupo da equipe ('2º do Grupo B · 2J · 3 pts'), e mostra o caminho no mata-mata ('Semifinal: venceu Halterada 2 por 20×9'). O cálculo local fica só no modo demonstração. A lista de Equipes ganha busca, as seguidas no topo e as modalidades disputadas no lugar de '0 atletas' e da barra. O bloco Elencos some quando não há atleta.

**Tela alvo.** Página da atlética: escudo, nome e botão '☆ Seguir'. PRÓXIMO JOGO num cartão (categoria, hora, adversário). JOGOS: lista por data, primeiro os próximos e depois os resultados, com placar e vencedora. CAMPANHA: uma linha por categoria, por exemplo '2º do Grupo B · 2J 1V 1D · 3 pts', e o mata-mata. Elenco só se houver atleta. Ação principal: Seguir; depois, tocar num jogo.

**Critérios de aceite**

- [ ] Halterada: a página lista os 29 jogos das 8 categorias, com o próximo visível sem rolar em 412×915.
- [ ] Campanha igual à aba Tabela: Halterada 2 no Handebol aparece '2º do Grupo B · 2J · 3 pts' (hoje 3º, 4J, 6 pts); Compressora no Futsal Feminino aparece com 6 pts (hoje 7).
- [ ] Seguir custa um toque e continua valendo ao fechar e reabrir o app instalado, sem login.
- [ ] Achar o próximo jogo da atlética: 0 toques com ela seguida (está em Hoje) e até 3 sem seguir (Equipes › busca › atlética); hoje é preciso abrir até 8 categorias.
- [ ] Nenhum cartão público de equipe mostra '0 atletas' nem barra; o bloco Elencos some quando não há atleta.

**Onde mexer.** Front: `apps/web/app/lib/team-view.ts (novo: teamMatches, officialStanding, knockoutPath)`, `apps/web/app/components/TeamPerformance.tsx (lê phase.standings; também usado em /teams/[id])`, `apps/web/app/components/PublicTeamDetailView.tsx (Próximo jogo, Jogos, Campanha, Elenco condicional)`, `apps/web/app/components/FollowTeamButton.tsx (novo)`, `apps/web/app/lib/repositories/device-preferences.ts e lib/frontend-state.ts (followedTeams)`, `apps/web/app/components/PublicTeamsPage.tsx e TeamCard.tsx (busca, seguidas no topo, modalidades no lugar de '0 atletas')`, `apps/web/tests/unit/team-view.test.ts (novo, compara a campanha com phase.standings)`. API: `Nenhuma: a preferência fica no aparelho; standings, assignments e jogos já vêm no snapshot público`.

**Depende de:** PUB-I01; EST: tabela oficial correta em fase Liga com grupos; ATL: time B ligado à atlética-mãe. **Risco:** O jogo se liga à equipe pelo nome: renomear quebra o vínculo até o snapshot trazer o id da equipe. 'Halterada 2' segue como outra equipe até ATL ligar os times B.

<sub>Achados: PUBLICO-03, JESP-06, JESP-07, VPUB-09, JATL-10, NAV-04, EQUIPES-R1, TESTES-R3, JDADOS-09, VADM-01, CHAVE-11, PUBLICO-12, JESP-14, PUBLICO-11</sub>

### PUB-I05 · Tabela da categoria fiel ao servidor, com linha de classificação

Onda 1 sugerida · correção · esforço M · ~4 dia(s) · cobre 5 achado(s), 2 crítico(s)/alto(s)

**Problema.** Fase Liga com grupos quebra a aba: no Vôlei Masculino o público lê 'Distribua equipes em Fase de grupos', e no Feminino há duas equipes em 1º. Sem jogos, o Basquete exibe 'desempate por sorteio' em ordem alfabética. Nada marca quem se classifica, e só cabem duas linhas por tela.

**Solução.** StandingsTable substitui a tabela de TournamentClassification, na área pública e na interna. As abas são os grupos da fase classificatória, em qualquer formato; Liga sem grupos é uma tabela única. No modo API, lê só phase.standings, filtrado por assignments. Sem linhas, lista as equipes sem posição, com 'A tabela começa no primeiro resultado', e nunca mostra instrução de gestão. Linha de corte 'classificam' depois de qualifiers, e selo de vaga por índice quando bestThirds > 0. O critério de desempate só aparece quando o servidor o enviar; 'sorteio' sai do modo API. Linhas de 48 px (J V E D SG PTS), grupo ativo em ?grupo= e regra de avanço resumida numa linha.

**Tela alvo.** Aba Tabela: chips Grupo A, B, C e D de 44 px. Linha-resumo '2 por grupo avançam · vitória 3 · empate 1'. Tabela densa: posição, escudo e nome, J V E D SG PTS; faixa verde nas posições que classificam e a linha 'classificam' depois da última vaga. Antes do primeiro jogo, equipes com '–' e a frase 'A tabela começa no primeiro resultado'.

**Critérios de aceite**

- [ ] Com o snapshot de produção, nenhuma tela pública exibe 'Distribua equipes' nem 'desempate por sorteio' sem sorteio registrado. Hoje isso acontece no Vôlei Masculino e no Basquete.
- [ ] Futsal Masculino (4 grupos, 2 vagas): linha 'classificam' depois do 2º de cada grupo.
- [ ] Posição, J e PTS exibidos são iguais a phase.standings para todas as equipes das 8 categorias (teste unitário com a semente de produção).
- [ ] Um grupo de 5 equipes ocupa até 300 px, e o link com ?grupo=B abre direto no Grupo B.
- [ ] Depois do recálculo de EST, o Vôlei Feminino mostra Inquisidores em 1º com 5 jogos (hoje ausente).

**Onde mexer.** Front: `apps/web/app/components/StandingsTable.tsx (novo, extraído de TournamentClassification.tsx)`, `apps/web/app/lib/standings-view.ts (novo: grupos da fase, linhas oficiais, linha de corte)`, `apps/web/app/components/TournamentClassification.tsx (sem cálculo local no modo API, sem texto de gestão)`, `apps/web/app/lib/tournament-engine.ts (rótulo 'Sorteio' só no modo demonstração)`, `apps/web/app/components/PublicTournamentDetailView.tsx (?grupo= na URL)`, `apps/web/app/globals.css (linha de 48 px e faixa 'classificam'; hoje globals.css:691-697)`, `apps/web/tests/unit/standings-view.test.ts (novo)`. API: `Nenhuma nesta iniciativa: a tabela única da Liga e o critério de desempate por linha vêm de EST`.

**Depende de:** EST: tabela única em fase Liga e grupos estruturados; EST: critério de desempate gravado em cada linha da tabela; SAN: recálculo das duas categorias de Vôlei; QA: semente com os jogos reais para os testes. **Risco:** Mostrar fielmente a tabela antes do recálculo de EST e SAN deixa o erro do Vôlei mais visível; publicar junto com o recálculo.

<sub>Achados: JDADOS-R1, PUBLICO-12, JESP-11, VPUB-11, CHAVE-11</sub>

### PUB-I06 · Cartão e página do jogo contam o resultado inteiro

Onda 1 sugerida · reorganização de UX · esforço M · ~4 dia(s) · cobre 6 achado(s), 2 crítico(s)/alto(s)

**Problema.** A final do Futsal Feminino, decidida nos pênaltis, aparece como '3 — 3 · Encerrado', sem vencedora. O cartão não diz grupo nem rodada e repete 'A definir' como local em 89 de 96 jogos. No vôlei, as parciais ficam abaixo de até 135 linhas 'Ponto'; o título é 'PARTIDA' e a data vem como '2026-10-12'.

**Solução.** matchView passa a trazer o desfecho (vencedora, tiebreak, walkoverWinner, periodResults) e a etiqueta de etapa ('Grupo A', 'Semifinal'; 'Jogo 16' quando EST enviar). No cartão: linha de contexto 'Futsal M · Grupo A' (omitida dentro da própria categoria), vencedora destacada, '(3×2 pên.)', 'W.O.' ou as parciais '25-19 · 25-27 · 25-14' sob o placar, e local só se definido. Na página do jogo: título com as equipes, placar horizontal (componente de DS), quadro de parciais logo abaixo, data 'seg, 12 out · 19:00', links para a tabela e as duas atléticas, e lances recolhidos em 'Ver lances (135)' com o placar de cada momento. O relógio segue a regra de MESA.

**Tela alvo.** Página do jogo: 'Futsal Feminino · Final'. Placar em linha: escudo e nome, 3 × 3, escudo e nome, com Compressora em verde e '(3×2 pên.)' logo abaixo. Quadro de parciais por set ou tempo. 'dom, 11 out · 14:30'. Botões 'Tabela de Futsal Feminino' e das duas atléticas. 'Ver lances (14)' recolhido. Nas listas, o cartão traz as mesmas informações em três linhas.

**Critérios de aceite**

- [ ] A final do Futsal Feminino aparece no cartão e na página como '3 × 3 (3×2 pên.)', com Compressora destacada (hoje '3 — 3 · Encerrado', sem vencedora).
- [ ] Nos 24 jogos com parciais, o quadro de parciais fica visível sem rolar em 412×915 (hoje fica abaixo de 52 a 135 lances).
- [ ] Nenhum cartão ou página pública imprime 'A definir' como local, e a data do detalhe sai por extenso.
- [ ] Teste unitário de matchView: vencedora e desfecho corretos para Encerrada, W.O., empate com desempate e jogo por sets.

**Onde mexer.** Front: `apps/web/app/lib/edition-catalog.ts (MatchView com desfecho, vencedora, parciais e etapa)`, `apps/web/app/components/MatchScoreCard.tsx e MatchCard.tsx (linha de contexto, desfecho, local só se definido)`, `apps/web/app/components/MatchSummary.tsx (data por extenso; placar pelo componente de DS)`, `apps/web/app/components/MatchDetailClient.tsx (parciais no topo, lances recolhidos com placar corrente, links)`, `apps/web/app/components/MatchRouteView.tsx (título com categoria e etapa no lugar de 'PARTIDA')`, `apps/web/app/lib/date-utils.ts (formatMatchLongDate)`, `apps/web/tests/unit/match-view.test.ts (novo)`. API: `Nenhuma: tiebreak, walkoverWinner, periodResults e o placar de cada lance (events[].scoreA/B) já vêm no snapshot público`.

**Depende de:** PUB-I01; DS: componente Placar horizontal e cartão de jogo; MESA: relógio e minuto escondidos na página pública; EST: número do jogo e rodada nos dados; SYNC: contrato dos lances se o snapshot público emagrecer. **Risco:** Se SYNC tirar os lances do snapshot público, 'Ver lances' vai precisar de GET próprio; acertar o contrato antes. O cartão é compartilhado com as telas internas.

<sub>Achados: JESP-10, VPUB-12, PUBLICO-10, JESP-09, PUBLICO-05, VPUB-10</sub>

### PUB-I07 · Mostrar campeã, vice, terceiro e a etapa atual de cada categoria

Onda 1 sugerida · feature · esforço M · ~4 dia(s) · cobre 3 achado(s), 3 crítico(s)/alto(s)

**Problema.** Nenhuma tela anuncia a campeã. As 3 categorias encerradas seguem com o selo da primeira fase (phases[0]), e o pódio, que tournamentPodium já calcula, só alimenta o ranking interno. Três dias depois do evento, o público não sabe quem ganhou o Handebol nem o Futsal Feminino.

**Solução.** lib/category-headline.ts devolve a etapa atual (Grupos, Quartas, Semifinal, Final, Encerrada), derivada dos jogos, e o pódio: o campo da API quando EST o entregar; até lá, tournamentPodium, que já lê os ids da chave. Categoria com status 'Encerrado' abre com PodiumBlock: campeã, vice e 3º, com escudos e o placar da final. Na lista de categorias, o selo de phases[0] dá lugar a 'Semifinal' ou 'Encerrada · Campeã X'. Depois do evento, Hoje mostra 'Campeãs 2026'. /public/standings/general passa a redirecionamento temporário; se o dono aprovar, mostra o ranking geral fechado.

**Tela alvo.** Categoria encerrada: no topo, PÓDIO com a campeã em destaque (escudo grande, nome em verde, 'CAMPEÃ'), vice e 3º menores, e 'Final: Halterada 24 × 14 Tormenta ›'. Abaixo, as abas de sempre. Na lista de categorias, cada linha mostra a etapa ('Quartas de final') ou 'Encerrada · Campeã Halterada' com o escudo. Ação principal: abrir a final.

**Critérios de aceite**

- [ ] Com o snapshot de produção, as 3 categorias encerradas abrem com pódio. Handebol com chave de 4: Halterada, Tormenta e Halterada 2. Handebol com final única: Compressora e Halterada. Futsal Feminino: Compressora campeã nos pênaltis. Hoje nenhuma tela mostra campeã.
- [ ] Nenhuma categoria com jogo de mata-mata iniciado exibe 'Fase de grupos' na lista pública (hoje as 8 exibem phases[0]).
- [ ] Categoria encerrada sem pódio calculável (por exemplo, a final do Vôlei Masculino, criada fora da chave) mostra 'Encerrada', sem campeã inventada.
- [ ] /public/standings/general responde 307, não 308.
- [ ] Com relógio em 13/10, Hoje mostra o bloco 'Campeãs 2026' com as categorias encerradas.

**Onde mexer.** Front: `apps/web/app/lib/category-headline.ts (novo: etapa atual e pódio)`, `apps/web/app/components/PodiumBlock.tsx (novo)`, `apps/web/app/components/PublicTournamentDetailView.tsx (pódio no topo da categoria encerrada)`, `apps/web/app/components/TournamentCard.tsx (etapa ou 'Encerrada · Campeã X' na área pública)`, `apps/web/app/components/PublicTodayView.tsx (bloco Campeãs depois do evento)`, `apps/web/app/public/standings/general/page.tsx (redirecionamento temporário; ranking se aprovado)`, `apps/web/tests/unit/category-headline.test.ts (novo)`. API: `Nenhuma obrigatória: tournamentPodium lê os ids '-advanced-' já publicados`, `Consumir o pódio do snapshot quando EST publicá-lo (CHAVE-R3)`, `Se o dono aprovar: snapshot.mapper.ts:498 passa a enviar ao público awards e closures depois de ranking/close, sem revokedBy, note e actor; atualizar ranking-restrito.spec.ts`.

**Depende de:** PUB-I02; EST: pódio e campeão no servidor; EST: status da categoria derivado dos jogos; SAN: status das categorias de 2026. **Risco:** O pódio só aparece quando o admin encerra a categoria. Futsal Masculino e Basquete seguem 'Publicado' e dependem de EST e SAN.

<sub>Achados: JESP-08, VPUB-R3, PUBLICO-05</sub>

### PUB-I08 · Agenda pública do dia em blocos, linhas compactas e filtros

Onda 2 sugerida · reorganização de UX · esforço M · ~4 dia(s) · cobre 3 achado(s), 2 crítico(s)/alto(s)

**Problema.** Em 12/10 a aba Jogos listava 47 cartões de cerca de 200 px (cerca de 9.400 px de rolagem), na ordem do horário planejado, que atrasou 104 min na mediana. Ao vivo, encerrado e não iniciado ficavam misturados; o único filtro é por modalidade, e o dia escolhido se perde ao voltar.

**Solução.** PublicDaySchedule substitui MatchSchedule só na área pública; a agenda interna é de AGD. O dia vem em três blocos com contador: Ao vivo, A seguir (na ordem da agenda ou na fila de AGD) e Resultados (recolhido, do mais recente ao mais antigo). Cada jogo é uma linha compacta de cerca de 64 px (componente de DS): hora, escudos de 24 px, nomes, placar ou horário e selo. Chips de 44 px: 'Minha atlética', modalidade e categoria. Dia, modalidade e equipe vão na URL. Ao abrir o dia de hoje, a lista rola até o primeiro jogo não encerrado. Trocar de chip não recarrega o snapshot.

**Tela alvo.** Seletor '‹ HOJE · 12 OUT ›'. Chips: Minha atlética, Futsal, Vôlei, Basquete e Handebol; ao escolher um, aparecem Masculino e Feminino. Blocos: AO VIVO (1), A SEGUIR (32) em linhas de 64 px e RESULTADOS (14), recolhido, com 'Mostrar'. Cada linha abre o jogo. No fim, 'Tabela de Futsal Masculino ›' quando há uma categoria escolhida.

**Critérios de aceite**

- [ ] Em 12/10 (47 jogos), o primeiro jogo não encerrado aparece na primeira tela sem rolar, e a lista, com os resultados recolhidos, ocupa no máximo 3 telas de 412×915 (hoje cerca de 10).
- [ ] Com a Halterada seguida, o chip 'Minha atlética' mostra com um toque só os jogos dela no dia.
- [ ] Voltar do jogo para a agenda mantém o dia e os filtros, que ficam na URL.
- [ ] Trocar de chip na área pública não dispara novo GET do snapshot (verificado no e2e).

**Onde mexer.** Front: `apps/web/app/components/PublicDaySchedule.tsx (novo; o MatchSchedule interno fica com AGD)`, `apps/web/app/components/PublicMatchesHub.tsx (dia, modalidade e equipe na URL; sem refresh ao trocar de chip)`, `apps/web/app/lib/public-today.ts (agrupamento por situação, compartilhado com Hoje)`, `apps/web/app/components/DisciplineSelector.tsx (chips de 44 px e 'Minha atlética')`, `apps/web/tests/e2e/agenda-publica.spec.ts (novo)`. API: `Nenhuma`.

**Depende de:** PUB-I03; PUB-I04; DS: cartão de jogo compacto (linha de 64 px); AGD: selos que envelhecem e fila 'A SEGUIR'. **Risco:** Depende do componente compacto de DS. Sem ele, a agenda usa o cartão atual já agrupado e recolhido, com metade do ganho.

<sub>Achados: PUBLICO-09, JESP-R2, VPUB-R4</sub>

### PUB-I09 · Navegação pública Hoje, Jogos, Tabelas, Equipes e vocabulário fechado

Onda 2 sugerida · reorganização de UX · esforço M · ~3 dia(s) · cobre 8 achado(s), 0 crítico(s)/alto(s)

**Problema.** A aba 'Modalidades' lista 8 categorias soltas, a migalha diz 'Categorias' e o link de volta diz 'Modalidades' (a issue 51 segue aberta). 'Artilharia' ocupa 1/5 da barra e só exibiria 2.094 pontos de vôlei 'sem o nome de quem marcou'. Na categoria, a tabela começa a cerca de 600 px, depois de três formas de voltar.

**Solução.** Barra: Hoje · Jogos · Tabelas · Equipes. Artilharia entra como 5º item só quando houver lance com autor em modalidade de gol ou cesta, sem a contagem de 'sem autor' (a issue 54 continua atendida). 'Tabelas' resolve a issue 51 pela opção B: modalidades como cabeçalho (Futsal) e categorias como linhas (Masculino, Feminino), com a etapa de PUB-I07. Na categoria, abas Tabela · Chave · Jogos, só as que se aplicam; a aba Fases vira a linha 'Grupos › Quartas › Semifinal › Final'. Cabeçalho público compacto: faixa de 40 px, título numa linha, sem sobretítulo repetido; migalha só no desktop. Fechar as issues 51 e 55.

**Tela alvo.** Barra inferior: Hoje, Jogos, Tabelas, Equipes. Em Tabelas, o cabeçalho FUTSAL e, abaixo, linhas de 56 px: 'Masculino · Quartas de final ›' e 'Feminino · Encerrada · Campeã Compressora ›'; o mesmo para Vôlei, Handebol e Basquete. Na categoria: 'FUTSAL MASCULINO', a linha 'Grupos › Quartas › Semifinal › Final', as abas Tabela · Chave · Jogos e o conteúdo já na primeira metade da tela.

**Critérios de aceite**

- [ ] Tabelas mostra as 8 categorias públicas, agrupadas nas 4 modalidades, numa única tela de 412×915 (hoje cerca de 2).
- [ ] Na categoria, a primeira linha da tabela começa acima de 400 px (hoje cerca de 600 px).
- [ ] Com 0 lances com autor, a barra tem 4 itens. Com um gol com autor, Artilharia volta e lista só artilheiros, sem 'lances sem o nome'.
- [ ] Nenhum rótulo público usa 'Modalidades' ou 'Categorias' para coisas diferentes. e2e-http e snapshots visuais atualizados; issues 51 e 55 fechadas.

**Onde mexer.** Front: `apps/web/app/components/PublicAppShell.tsx (barra Hoje · Jogos · Tabelas · Equipes, Artilharia condicional, cabeçalho compacto)`, `apps/web/app/components/PublicTournamentsPage.tsx (lista agrupada por modalidade)`, `apps/web/app/components/PublicTournamentDetailView.tsx (abas Tabela · Chave · Jogos; Fases vira linha; sai '‹ Modalidades')`, `apps/web/app/components/AppShell.tsx (publicRouteLabels: tournaments → Tabelas)`, `apps/web/app/public/scorers/page.tsx e lib/artilharia.ts (sem a contagem 'sem autor')`, `apps/web/tests/e2e-http/api-mode.spec.ts e tests/e2e/navigation.spec.ts (heading e snapshots)`, `docs/PAPEIS_E_FLUXOS.md (seção da área pública)`. API: `Nenhuma`.

**Depende de:** PUB-I02; PUB-I07; NAV: entrada do staff na barra de contexto pública. **Risco:** Muda a navegação de quem já instalou o app e os snapshots visuais. O botão de entrada do staff (NAV) precisa caber no mesmo cabeçalho.

<sub>Achados: NAV-11, PUBLICO-R3, VPUB-14, NAV-R4, PUBLICO-11, JESP-14, VPUB-13, DOCS-08</sub>

### PUB-I10 · Compartilhar jogo com prévia de imagem e endereço canônico certo

Onda 2 sugerida · feature · esforço M · ~4 dia(s) · cobre 3 achado(s), 0 crítico(s)/alto(s)

**Problema.** Sete páginas públicas declaram canonical e og:url em /intereng, mas o app e o sitemap estão em /copahalterada. Não há og:image, então o link do jogo chega ao WhatsApp sem imagem. Não existe botão de compartilhar, e o app instalado (standalone) nem tem o menu do navegador.

**Solução.** lib/base-path.ts ganha siteUrl(path), com origem e basePath, usado em canonical, og:url, JSON-LD e sitemap; os '/intereng' fixos somem. Cada jogo ganha um opengraph-image.tsx feito com next/og: fundo azul, nomes em Aldo, placar ou horário, categoria e etapa, sem o escudo .webp, que o gerador não lê. As demais páginas usam uma imagem padrão da marca. ShareButton no jogo, na categoria e na atlética: navigator.share com texto pronto ('Compressora 3 × 3 Furiosa (3×2 pên.) · Futsal Feminino · Final') e o link; sem suporte, copia o link e oferece o WhatsApp. /public/matches ganha metadata própria.

**Tela alvo.** Na página do jogo, botão 'Compartilhar' ao lado do título; também na categoria e na atlética. O toque abre a folha do celular com o texto pronto e o link. No WhatsApp, o link chega com um cartão azul: 'COMPRESSORA 3 × 3 FURIOSA', '(3×2 pên.) · Futsal Feminino · Final' e a marca da Copa.

**Critérios de aceite**

- [ ] Todas as páginas públicas e o sitemap usam https://incinera.cin.ufpe.br/copahalterada/… em canonical, og:url e JSON-LD (teste unitário; hoje 7 páginas usam /intereng).
- [ ] Um link de jogo colado no WhatsApp mostra imagem de 1200×630 com equipes e placar (conferido na URL de produção).
- [ ] Da página do jogo à folha de compartilhamento: um toque, também no app instalado.
- [ ] A prévia de jogo não iniciado mostra o horário, nunca 'Placar: 0 a 0'.

**Onde mexer.** Front: `apps/web/app/lib/base-path.ts (siteUrl)`, `apps/web/app/public/**/page.tsx e public/scorers/layout.tsx (canonical, og:url e JSON-LD pelo helper)`, `apps/web/app/sitemap.ts (helper no lugar da constante)`, `apps/web/app/public/matches/[id]/opengraph-image.tsx (novo, next/og com app/fonts/aldo-the-apache.ttf)`, `apps/web/app/opengraph-image.png (novo, imagem padrão da marca)`, `apps/web/app/components/ShareButton.tsx (novo)`, `apps/web/app/public/matches/page.tsx (metadata própria)`, `apps/web/tests/unit/seo-urls.test.ts (novo)`. API: `Nenhuma`.

**Depende de:** PUB-I06. **Risco:** A imagem gerada sob basePath, atrás do proxy, precisa ser conferida em produção. Gerar uma por jogo custa CPU; usar revalidate.

<sub>Achados: PUBLICO-14, JESP-13, DOCS-08</sub>

**Fora de escopo, de propósito**

- Modo telão para a TV do ginásio: aparece em 6 áreas, mas depende de tempo real confiável (SYNC) e de local ou quadra preenchidos (89 de 96 jogos com 'A definir'). Até lá, Hoje numa tela larga cobre o uso.
- Notificações push da atlética seguida: exigem Web Push, inscrições guardadas na API e disparo a partir das ações de partida (esforço G). O 'Seguir' guardado no aparelho (PUB-I04) já é a base para isso depois.
- Mural de avisos da organização na área pública: pede entidade nova na API e tela de gestão. A causa (agenda que não reflete a quadra) é tratada por AGD com a fila 'A SEGUIR'; reavaliar se AGD não entrar antes do próximo evento.
- Achados públicos cujo conserto é de outra trilha, que PUB só consome: tabela do Vôlei que ignora 20 de 23 jogos (PUBLICO-R1, JESP-R1, VPUB-R1) fica com EST; selos que envelhecem e 'Ao vivo' sem prova de vida (JESP-03, VPUB-03, PUBLICO-07) com AGD e MESA; peso do snapshot, selo de conexão e medição de audiência (PUBLICO-08, PUBLICO-R2, JESP-12, JESP-R3) com SYNC; mesa e relógio (VPUB-04 a VPUB-08) com MESA.
- Página pública do atleta e artilharia ampliada (issue 54): em 2026 houve 0 atletas e 0 de 2.689 lances com autor. A aba Artilharia passa a aparecer sozinha quando houver dado (PUB-I09); reabrir quando ATL entregar o cadastro de elenco.
- Arquivo público de edições anteriores: depende do ciclo de vida da edição (ADM) e de decisão do dono. Enquanto 2026 for a edição ativa, os resultados continuam no ar.

**Perguntas para a organização**

- O ranking geral deve ficar público depois que o admin usa 'Fechar ranking'? Hoje ele é restrito por decisão, e o snapshot público o envia vazio.
- A campeã deve aparecer para o público assim que a final termina, ou só quando o admin encerra a categoria? A proposta é só ao encerrar.
- Quando a edição 2027 for ativada, as campeãs e os resultados de 2026 precisam continuar num endereço público?
- Seguir 'Halterada' deve incluir 'Halterada 2' e os outros times B da mesma atlética?


## NAV — Navegação e painéis por perfil

**Objetivo.** Cada perfil abre o app na tarefa número 1 e chega a ela sem rolar: gestor no jogo a operar, admin no que está pendente, responsável no próprio time, espectador no Hoje. Barra, topo, voltar e estados de erro iguais em toda tela, inclusive na mesa, sem 'Acesso restrito'.

**Princípios**

- Cada perfil abre na tarefa número 1 com zero toques depois do login: gestor no jogo a operar, admin no que falta resolver, responsável no próprio time, espectador no Hoje.
- A barra mostra só o que o perfil consegue abrir: no máximo 5 itens, nenhum termina em 'Acesso restrito'. Rótulos de tarefa (Agora, Jogos, Tabelas) e o vocabulário da issue 51: modalidade é o esporte, categoria é 'Futsal Masculino'.
- Onde um jogo aparece para quem pode operá-lo, a ação está no próprio cartão (Continuar placar, Lançar resultado). Blocos do Início mostram no máximo 5 itens e 'Ver todos (N)'; bloco vazio some.
- Topo mínimo e igual em toda tela, inclusive na mesa e na área pública: faixa de 32 px com a conexão escrita e uma linha '‹ pai · título · ação'. O conteúdo começa antes de 200 px num celular de 915 px.
- Falha de rede nunca apaga dado bom: vira a faixa 'Sem conexão · dados das HH:MM' com 'Tentar de novo'. Erro em tela cheia só quando nunca houve dado.
- Toda saída tem destino certo para quem está: voltar respeita formulário não salvo e vai ao pai declarado; 404, offline, bloqueio e área pública devolvem ao início do perfil.

**Desenho alvo**

MAPA DE TELAS (entrada · barra · Início antes, durante e depois)

Espectador, sem sessão: entra em /public 'Hoje'; a barra pública é de PUB (Hoje, Jogos, Tabelas, Equipes). NAV só acrescenta 'Entrar' na faixa do topo e os atalhos Hoje, Jogos e Gestão do app instalado.

Responsável da atlética: entra em /teams/{teamId}. Barra: Meu time · Jogos do time · Conta. Antes: elenco a completar (ATL). Durante: próximo jogo e resultados do time no topo. Depois: campanha e posição oficial.

Gestor de modalidade: entra em /dashboard 'Agora'. Barra: Agora · Jogos (agenda da modalidade) · Tabelas (/disciplines/{sua}) · Equipes · Conta. Agora tem três blocos que somem quando vazios: Ao vivo (Continuar placar; 'sem sinal' passado o limite), Sem resultado (Lançar resultado) e A seguir (Abrir placar). Antes do evento só aparece A seguir; depois, Sem resultado até zerar.

Admin da edição: entra em Agora. Barra: Agora · Jogos (lembra 'Todas') · Modalidades · Equipes · Gestão. O Agora traz um bloco do momento e, abaixo, os três blocos do gestor com todas as modalidades. Antes: Prontidão. Durante: Precisa de atenção. Depois: Fechamento (jogos sem desfecho, categorias a encerrar, pódios, ranking, encerrar edição, relatório). Gestão (/more): Conta e Sair no topo; Staff, Classificação geral, Atletas e Edição; Importar jogos, Relatório e Auditoria quando IMP e ADM entregarem; Ver área pública.

Super admin: igual ao admin. A Gestão acrescenta Torneios e edições e a Auditoria completa, e só ele vê a seta de troca na faixa.

CASCA: faixa de 32 px (emblema, Copa Halterada 2026, conexão) em toda tela, inclusive mesa e área pública; linha '‹ pai', título e ação; na mesa com jogo ao vivo não há barra inferior. A partir de 1024 px a barra vira trilho lateral; migalha só a partir de 900 px. Estados globais num componente só, com saída conforme o perfil.

ROTAS QUE SOMEM: /tournaments, /teams/[id]/athletes, /tournaments/[id]/manage e /staff/promote. /matches/live sem ?partida passa a levar ao Agora. /more mantém o endereço com o nome Gestão. Os redirecionamentos públicos antigos ficam, porque o endereço circulou (decisão de PUB).

### NAV-I01 · Barra inferior por perfil, com Gestão e Conta no lugar de Mais

Onda 1 sugerida · reorganização de UX · esforço M · ~3 dia(s) · cobre 4 achado(s), 3 crítico(s)/alto(s)

**Problema.** A barra é a mesma para todos: o gestor recebe 'Modalidades' com um cartão e 'Mais' repetindo Jogos; o responsável da atlética toca 4 de 5 itens e leva 'Acesso restrito', sem caminho para o time nem para sair; 'Sair' fica a 3 toques e rolagem.

**Solução.** Criar lib/navegacao.ts com itensDaBarra(sessão) e inicioDoPerfil(sessão), lidos pela BottomNav, pelo login e pela tela de bloqueio. Admin e super: Agora, Jogos, Modalidades, Equipes, Gestão. Gestor: Agora, Jogos, Tabelas (abre a própria modalidade), Equipes, Conta. Responsável: Meu time, Jogos do time, Conta, com a equipe tirada do teamId do papel selecionado (editionRoles). 'Mais' vira Gestão, só de admin e super: Conta e Sair no topo, depois Staff, Classificação geral, Atletas, Edição e Ver área pública. Jogos lembra 'Todas as modalidades'. Regra: item que o perfil não abre não aparece.

**Tela alvo.** Gestor no celular: rodapé com cinco ícones e rótulos, Agora, Jogos, Tabelas, Equipes e Conta. Conta mostra nome e papel, 'Sair' visível sem rolar e 'Ver área pública'. Admin: Agora, Jogos, Modalidades, Equipes e Gestão; Gestão começa pela faixa da conta com 'Sair' e lista os módulos da edição. Responsável: três itens, com Meu time aberto ao entrar.

**Critérios de aceite**

- [ ] Teste e2e 'barra por perfil' (super, admin, gestor e responsável): tocar cada item da barra nunca mostra 'ACESSO RESTRITO' (hoje 4 de 5 itens do responsável).
- [ ] Sair da conta em no máximo 2 toques, sem rolar, a partir de qualquer tela e para todos os perfis (hoje gestor: 3 toques e rolagem; responsável: impossível).
- [ ] Login sem destino guardado: admin e gestor caem em Agora; responsável em /teams/{teamId}, com 0 toques até o elenco.
- [ ] 'Tabelas' do gestor abre direto a modalidade dele (hoje uma lista com um único cartão).
- [ ] Admin que escolheu 'Todas as modalidades' reabre Jogos em 'Todas' (hoje sempre na última modalidade, padrão Futsal).

**Onde mexer.** Front: `app/lib/navegacao.ts (novo): itensDaBarra(sessão) e inicioDoPerfil(sessão)`, `app/components/BottomNav.tsx: itens por perfil; Jogos sem ?modalidade quando a escolha foi 'Todas' (linha 27)`, `app/components/AppShell.tsx: NavKey com agora, tabelas, meu-time, conta e gestao`, `app/more/page.tsx: vira Gestão (Conta e Sair no topo, módulos da edição)`, `app/profile/page.tsx: Conta com 'Sair' acima da dobra e 'Ver área pública'`, `app/components/AdminRouteGuard.tsx: equipe do responsável pelo teamId do papel; /more só admin; botão do bloqueio usa inicioDoPerfil`, `app/login/page.tsx: destino padrão por inicioDoPerfil (linha 42)`, `tests/e2e/barra-por-perfil.spec.ts (novo) e ajuste de navigation.spec.ts`. API: `Nenhuma mudança: papel e teamId já chegam em editionRoles (auth-adapter.ts:8-18); o login do TEAM_MANAGER na API é entrega de ATL`.

**Depende de:** ATL: login e sessão do responsável da atlética na API (JATL-01, ADMIN-01, EQUIPES-02); ATL: página privada da equipe com bloco Jogos do time; ADM: conteúdo da Conta (rótulo do papel, retirar 'Alertas do app'). **Risco:** Pessoa com dois papéis (admin e gestor) pode ver a barra trocar ao tocar um chip de modalidade; NAV-I03 impede o chip de trocar o papel do admin.

<sub>Achados: NAV-09, NAV-01, JATL-03, EQUIPES-03</sub>

### NAV-I02 · Início 'Agora' com jogos ao vivo, sem resultado e a seguir

Onda 1 sugerida · feature · esforço M · ~4 dia(s) · cobre 10 achado(s), 9 crítico(s)/alto(s)

**Problema.** O Início mostra contadores e um 'próximo confronto' que é a primeira Agendada da lista: em produção, Basquete de 09/10, nunca aberto. Não mostra o jogo ao vivo abandonado desde 12/10 nem os 40 vencidos sem resultado. Chegar ao placar custa 4 a 5 toques, troca de dia e rolagem.

**Solução.** Trocar dashboard/page.tsx por PainelAgora, com três blocos calculados do snapshot privado (já recortado à modalidade do gestor). Ao vivo: 'último sinal há N min', pelo maior entre o último lance e o batimento do operador, e destaque 'sem sinal' passado o limite. Sem resultado: Agendada de dia anterior ou vencida além do limite, mais antigas primeiro, cinco e 'Ver todos (N)'. A seguir: próximos cinco de hoje, por horário ou fila. Cada cartão leva a ação de MESA: Continuar placar, Abrir placar, Lançar resultado. Bloco vazio some. /matches/live sem ?partida redireciona para cá. Guia de montagem só em edição sem jogos.

**Tela alvo.** Faixa do topo e título 'Agora'. Bloco AO VIVO: cartão compacto com escudos, placar, 'último lance há 3 min' e botão verde 'Continuar placar'; jogo parado fica âmbar, 'Sem sinal desde 15:58', com 'Assumir'. Bloco SEM RESULTADO (16): linhas com data, confronto e 'Lançar resultado'. Bloco A SEGUIR: cinco jogos com horário e 'Abrir placar'. Um toque leva do cartão ao placar.

**Critérios de aceite**

- [ ] Com o snapshot de produção de 13/10 como fixture, o gestor de Basquete vê sem rolar 'Mafiosa × Furiosa · sem sinal desde 15:58' e 'Sem resultado (16)'; o admin vê 'Sem resultado (40)': Futsal 20, Basquete 16, Vôlei 4.
- [ ] Do app aberto ao placar de um jogo listado: 1 toque (hoje 4 a 5 toques, troca de dia e rolagem).
- [ ] Nenhum cartão do Início chama de 'Próximo' um jogo com data passada (hoje o 'próximo confronto' é Halterada × Furiosa de 09/10).
- [ ] /matches/live sem ?partida abre o Agora em vez de escolher sozinho uma partida para operar.
- [ ] Guia 'Montagem da edição' não aparece em edição que já tem jogos, mesmo com 0 atletas.
- [ ] Teste unitário da montagem dos blocos (ao vivo, parado, sem resultado, a seguir) incluído no test:unit.

**Onde mexer.** Front: `app/dashboard/page.tsx: troca contadores e 'próximo confronto' (linhas 32-41) por PainelAgora`, `app/components/PainelAgora.tsx (novo): blocos Ao vivo, Sem resultado e A seguir`, `app/lib/agora.ts (novo): função pura que monta os blocos a partir do snapshot e da hora atual`, `app/components/MatchCard.tsx: espaço para a ação no cartão (botões entregues por MESA)`, `app/components/EditionProgress.tsx: só em edição sem jogos; Atletas deixa de ser passo obrigatório (linhas 39 e 50)`, `app/matches/live/page.tsx: sem ?partida, redirecionar para /dashboard (linhas 44-49)`, `tests/unit/agora.test.ts com fixture recortada de dados/jogos-producao.json`. API: `Nenhuma: usa status, date/time, events[].at e operatorHeartbeat do GET /editions/:id/snapshot privado, já recortado por modalidade (snapshot.mapper.ts:70)`.

**Depende de:** NAV-I01; MESA: ações no cartão (Continuar placar, Lançar resultado, W.O., Assumir e encerrar jogo abandonado); AGD: situação derivada do jogo e selos que envelhecem (Atrasado, Sem resultado) e ordem da fila 'A seguir'. **Risco:** Com atraso mediano de 104 min, marcar 'sem resultado' cedo demais enche o painel de falso alarme; o limite depende do dono e de AGD.

<sub>Achados: NAV-02, JMESA-06, VPUB-06, VADM-08, NAV-03, JMESA-09, AGENDA-05, JDADOS-05, JORG-04, DADOS-R4</sub>

### NAV-I03 · Faixa de conexão em toda tela e estados globais com saída certa

Onda 1 sugerida · correção · esforço M · ~3 dia(s) · cobre 5 achado(s), 1 crítico(s)/alto(s)

**Problema.** 'Sem conexão' sai verde como 'Ao vivo' e, até 430 px, vira só ícone; na mesa a faixa nem existe. Uma recarga que falha troca a tela inteira por 'Dados indisponíveis', sem navegação. A seta da faixa finge seletor. 404, offline e bloqueio mandam o staff para a área pública.

**Solução.** Criar ContextStrip, faixa de uma linha (emblema, 'Copa Halterada 2026', conexão escrita) usada por AppShell, PublicAppShell e pela mesa, onde a barra inferior some com jogo ao vivo. Seta só para o super admin. Conexão nos estados vindos de SYNC; sem rede, 'Sem conexão · dados das 14:32 · Tentar de novo' em cor de perigo, largura total. AdminRouteGuard e PublicAppShell só mostram erro de tela cheia sem nenhum dado. StateScreen único para carregando, erro, 404, offline e bloqueio, com frase clara e botão pelo perfil (Agora, Meu time ou Hoje). Chip de modalidade só recarrega quando o papel muda. Export viewport com safe-area.

**Tela alvo.** Topo de 32 px: emblema, 'COPA HALTERADA 2026' e, à direita, 'Ao vivo' em verde. Sem rede, a faixa inteira fica na cor de perigo: 'Sem conexão · dados das 14:32' e 'Tentar de novo', e a tela abaixo continua com os dados. Na mesa a mesma faixa fica acima do placar. Em 404 ou bloqueio: ícone, frase do motivo e botão 'Voltar para Agora'.

**Critérios de aceite**

- [ ] Sem rede, a faixa diz 'Sem conexão' em texto e cor de perigo a 360 px nas telas internas, públicas e na mesa (hoje verde, só ícone até 430 px e ausente na mesa).
- [ ] Com dados na tela, falhar a recarga mantém o conteúdo e mostra a faixa com 'Tentar de novo'; 'Dados indisponíveis' só aparece sem nenhum dado (e2e que derruba o snapshot depois da primeira carga).
- [ ] Tocar o chip de modalidade como admin ou como gestor de uma modalidade faz 0 requisições ao snapshot (hoje 1 download de até 1,7 MB por toque).
- [ ] 404, offline e acesso restrito: com sessão o botão leva ao início do perfil, sem sessão ao Hoje; a tela offline tem 'Tentar novamente'.
- [ ] Só o super admin vê seta de troca na faixa do topo.
- [ ] Num iPhone com o app instalado, a faixa fica abaixo do relógio do sistema (conferido em aparelho).

**Onde mexer.** Front: `app/components/ContextStrip.tsx (novo): faixa de uma linha usada pelas duas cascas e pela mesa`, `app/components/ConnectionBadge.tsx: estados em texto, sem o font-size 0 de globals.css:3890`, `app/components/StateScreen.tsx (novo): substitui ErrorScreen, LoadingScreen e o bloqueio de AdminRouteGuard.tsx:76`, `app/components/AdminRouteGuard.tsx (linha 74) e PublicAppShell.tsx (linha 50): erro de tela cheia só sem dado`, `app/not-found.tsx e app/offline/page.tsx: botão conforme a sessão e 'Tentar novamente'`, `app/components/DisciplineSelector.tsx: refresh só quando selectEditionRole troca o papel; admin não troca papel pelo chip (linhas 58-66)`, `app/matches/live/page.tsx: monta a faixa e esconde BottomNav com jogo ao vivo`, `app/layout.tsx (export viewport com viewportFit cover e themeColor) e app/globals.css (.sync-state, .context-bar, safe-area)`. API: `Nenhuma de NAV; a hora do último dado novo (meta.generatedAt) e a marca de resposta de cache são entrega de SYNC`.

**Depende de:** SYNC: estado da conexão com hora do último dado novo e recarga que não marca erro com dado carregado (DADOS-05, PWA-04, DADOS-R3); DS: token de cor de perigo (CSS-01). **Risco:** Muda o topo de toda tela: as 8 capturas de regressão visual precisam ser regeradas. Sem a entrega de SYNC, a faixa mostra só online e offline.

<sub>Achados: NAV-12, CSS-04, NAV-08, CSS-13, VADM-14</sub>

### NAV-I04 · Entrar uma vez e voltar ao lugar certo depois do login

Onda 1 sugerida · correção · esforço P · ~2 dia(s) · cobre 2 achado(s), 0 crítico(s)/alto(s)

**Problema.** 'Manter acesso' nasce desmarcado: fechar o app instalado desloga, embora a renovação valha 7 dias. Na expiração o login perde o destino; quando guarda, perde ?partida e o placar abre outro jogo ao vivo. /login com sessão válida mostra o formulário de novo.

**Solução.** Sessão em localStorage por padrão; a caixa vira 'Aparelho compartilhado' (marcada, a sessão fica só nesta aba). requestSessionRefresh passa a tentar /auth/refresh uma vez pelo cookie quando não há sessão local, e restore() usa isso antes de mandar ao login. AdminRouteGuard grava pathname e query no redirect, inclusive em access=expired. /login com sessão válida vai direto ao destino ou ao início do perfil (NAV-I01). O tratamento de falha de rede dentro de restore() é de SYNC; aqui fica só o caminho de volta.

**Tela alvo.** Login: e-mail, senha, caixa 'Aparelho compartilhado (sair ao fechar)' desmarcada e botão ENTRAR. O mesário que reabre o app no dia seguinte cai direto no Agora. Quem teve a sessão vencida no placar entra e volta ao mesmo placar, da mesma partida.

**Critérios de aceite**

- [ ] Fechar e reabrir o app instalado não pede senha por até 7 dias (hoje pede, porque 'Manter acesso' nasce desmarcado).
- [ ] Sessão vencida em /matches/live?partida=X: depois do login a pessoa volta a /matches/live?partida=X (hoje cai no painel ou no placar de outra partida).
- [ ] /login com sessão válida redireciona sem mostrar o formulário.
- [ ] Com 'Aparelho compartilhado' marcado, fechar a aba encerra a sessão, coberto em e2e.

**Onde mexer.** Front: `app/login/page.tsx: caixa 'Aparelho compartilhado'; com sessão válida, redireciona (linhas 18, 40-42, 97-99)`, `app/lib/repositories/session-storage.ts: remembered verdadeiro por padrão`, `app/lib/repositories/api-client.ts: requestSessionRefresh tenta o cookie sem sessão local`, `app/lib/repositories/http-auth-adapter.ts: restore() tenta a renovação antes de devolver null (linhas 51-52)`, `app/components/AdminRouteGuard.tsx: redirect com pathname e query, inclusive em access=expired (linhas 64-65)`, `tests/e2e/voltar-ao-lugar.spec.ts (novo)`. API: `POST /auth/refresh existente, cookie de 7 dias (auth-cookie.service.ts:12-14); sem mudança`.

**Depende de:** NAV-I01; SYNC: restore() que não desloga por falha de rede e logout que revoga só o aparelho (DADOS-04). **Risco:** Sessão que persiste num celular emprestado; mitigado pela caixa 'Aparelho compartilhado' e por 'Sair' a 2 toques.

<sub>Achados: NAV-05, NAV-R3</sub>

### NAV-I05 · Ponte entre área pública e gestão, com dados certos dos dois lados

Onda 1 sugerida · correção · esforço P · ~2 dia(s) · cobre 3 achado(s), 1 crítico(s)/alto(s)

**Problema.** A área pública não tem caminho para a gestão: no app instalado o mesário não chega ao login nem ao placar. O atalho 'Agenda' abre a lista de categorias. Gestor logado vê a área pública recortada à própria modalidade: o de Vôlei não acha Futsal.

**Solução.** Na faixa pública (ContextStrip), 'Gestão ›' quando há sessão, levando à última tela privada guardada no aparelho, e 'Entrar' discreto sem sessão, com volta à tela pública de origem. Manifesto com atalhos Hoje (/public), Jogos (/public/matches) e Gestão (/dashboard). O http-adapter ganha audiência: nas rotas /public pede /public-snapshot sem token nem cabeçalhos de papel e, ao cruzar de área, recarrega o snapshot certo. Convite de instalação dispensado por 30 dias em localStorage e nunca nas rotas privadas. 'Ver área pública' passa a mostrar exatamente o que o visitante vê.

**Tela alvo.** Em /public com sessão, canto direito da faixa: 'Gestão ›' em verde; o toque devolve à tela de onde a pessoa saiu. Sem sessão: 'Entrar' em texto pequeno. Segurar o ícone do app no celular mostra Hoje, Jogos e Gestão.

**Critérios de aceite**

- [ ] Em /public com sessão de staff, 'Gestão' leva à última tela privada em 1 toque; sem sessão, 'Entrar' leva ao login e depois de volta à tela pública de origem.
- [ ] Gestor logado vê em /public/matches as mesmas modalidades que o visitante (teste no projeto http; hoje só a dele).
- [ ] Atalhos do app instalado: Hoje, Jogos (/public/matches) e Gestão; pwa.spec.ts atualizado.
- [ ] Ao voltar da área pública, a gestão mostra de novo rascunhos e staff (snapshot privado recarregado).
- [ ] O convite de instalação não aparece na mesa nem nos 30 dias seguintes à dispensa.

**Onde mexer.** Front: `app/components/ContextStrip.tsx: 'Gestão ›' ou 'Entrar' na área pública`, `app/lib/navegacao.ts: guardar a última tela privada no aparelho`, `app/lib/repositories/http-adapter.ts: audiência pública nas rotas /public (loadSnapshot, linhas 163-181)`, `app/components/PublicAppShell.tsx e AppShell.tsx: declaram a audiência e recarregam ao cruzar`, `app/manifest.ts: atalhos Hoje, Jogos e Gestão (linhas 48-52)`, `app/components/PwaRegistration.tsx: dispensa em localStorage por 30 dias e fora das rotas privadas`, `tests/e2e/pwa.spec.ts e teste http do gestor na área pública`. API: `GET /editions/:id/public-snapshot existente; sem mudança`.

**Depende de:** NAV-I03; PUB: tela Hoje e barra pública. **Risco:** Cada cruzamento entre áreas baixa o snapshot inteiro (cerca de 1 MB) até SYNC comprimir e emagrecer o snapshot.

<sub>Achados: NAV-07, NAV-R2, PWA-14</sub>

### NAV-I06 · Painel do admin em três tempos: prontidão, pendências e fechamento

Onda 2 sugerida · feature · esforço M · ~3 dia(s) · cobre 4 achado(s), 4 crítico(s)/alto(s)

**Problema.** O admin não tem lista do que falta: a prontidão vive no MCP do desenvolvedor e o guia de montagem ficou o evento todo em 'Continuar em Atletas'. Em 13/10 havia 41 jogos sem desfecho, categorias com jogos encerrados ainda 'Publicado' e a edição aberta; nada disso aparecia.

**Solução.** Função momentoDaEdicao(edição, jogos, agora) escolhe Antes, Durante ou Depois pelas datas da edição e por haver jogo ao vivo. Acima dos blocos de NAV-I02, o painel do admin ganha o bloco do momento, que só desenha a lista de pendências calculada por IMP. Antes, 'Prontidão': rascunhos, jogos sem local, horário provisório, lado em rótulo, regulamento não conferido. Durante, 'Precisa de atenção': chave a conferir, categoria com situação atrasada. Depois, 'Fechamento': jogos sem desfecho, categorias a encerrar, pódios, ranking, encerrar edição, relatório. Cada linha traz contagem, frase e link para a correção. NAV não escreve regra de pendência.

**Tela alvo.** Admin abre o app em 13/10: título 'Agora' e bloco FECHAMENTO no topo, com linhas tocáveis: '41 jogos sem desfecho', '2 categorias com jogos encerrados ainda Publicado', 'Ranking geral não fechado', 'Encerrar edição'. Cada linha abre a tela que resolve. Abaixo seguem Ao vivo, Sem resultado e A seguir, de NAV-I02.

**Critérios de aceite**

- [ ] Com os dados de 13/10, o admin vê no topo 'Fechamento' com '41 jogos sem desfecho' (40 vencidos e 1 ao vivo), categorias com jogos encerrados ainda 'Publicado', ranking não fechado e edição aberta.
- [ ] Cada linha leva em 1 toque à tela que resolve e some quando a pendência acaba, sem recarregar a página.
- [ ] Antes do evento, 'Prontidão' conta jogos sem local (89 de 96 em 2026), horários provisórios e lados em rótulo.
- [ ] momentoDaEdicao testada com datas antes, durante e depois, e com jogo ao vivo fora das datas.
- [ ] Nenhuma regra de pendência fica em componente de NAV: todas vêm da função de IMP.

**Onde mexer.** Front: `app/lib/momento-da-edicao.ts (novo): Antes, Durante ou Depois`, `app/components/PainelAgora.tsx: bloco do momento acima dos blocos de NAV-I02`, `app/components/BlocoPendencias.tsx (novo): linha com contagem, frase e link`, `app/components/EditionProgress.tsx: absorvido pela Prontidão e removido`, `tests/unit/momento-da-edicao.test.ts`. API: `Nenhuma de NAV; situação da categoria, pódio e encerramento vêm das ações de EST e de ADM (edition/close)`.

**Depende de:** NAV-I02; IMP: regras e cálculo das pendências e da prontidão; EST: situação da categoria e pódio; ADM: ação Encerrar edição. **Risco:** Se IMP atrasar, a tentação é escrever as regras no painel e duplicá-las; o bloco deve esperar a função de IMP.

<sub>Achados: JORG-04, SCRIPTS-07, JDADOS-05, VADM-08</sub>

### NAV-I07 · Topo enxuto: um voltar com pai declarado e migalha só no desktop

Onda 2 sugerida · reorganização de UX · esforço M · ~4.5 dia(s) · cobre 4 achado(s), 0 crítico(s)/alto(s)

**Problema.** Cada tela empilha faixa, Voltar, migalha, sobretítulo, título de 49 px e subtítulo: o conteúdo começa a 447-607 px de 915. A categoria tem três voltas com destinos diferentes; 'Voltar' descarta formulário sem avisar e cai em rotas que só redirecionam ('Categorias', 'Detalhes').

**Solução.** Criar lib/rotas.ts com o pai e o rótulo de cada rota: categoria volta à sua modalidade, placar à partida, partida à agenda do dia dela, atleta novo à equipe. PageNavigation vira BackLink, um <Link> '‹ nome do pai' de 44 px (o hook de alterações não salvas já intercepta links), que volta à tela anterior do app quando ela não é filha da atual. Cabeçalho em uma linha: voltar, título Aldo de 28 px e ação; eyebrow e subtitle deixam de aparecer. Migalha só a partir de 900 px, com nomes reais. Remover '‹ Futsal' da categoria e as quatro rotas que só redirecionam. .app-screen com overflow-x: clip.

**Tela alvo.** Categoria no celular: faixa de 32 px; abaixo, '‹ Futsal' à esquerda, 'FUTSAL MASCULINO' em 28 px e '+ Jogo' à direita; logo depois as abas e a tabela, antes de 200 px. Partida: '‹ Jogos de 12/10' e o confronto como título. Formulário: barra fixa com Salvar acima da barra inferior.

**Critérios de aceite**

- [ ] Um único controle de volta por tela, '‹ nome do pai', com 44 px de altura; da categoria volta à modalidade dela (hoje cai na lista de modalidades) e do placar volta à partida.
- [ ] 'Voltar' com formulário alterado pede confirmação (e2e em Nova equipe; hoje descarta em silêncio).
- [ ] A 412×915 o conteúdo começa até 200 px do topo em Jogos, categoria e partida (hoje 447 e 598-607 px).
- [ ] Migalha só a partir de 900 px, sem 'Dashboard', 'Detalhes' ou rota que redireciona.
- [ ] /tournaments, /teams/[id]/athletes, /tournaments/[id]/manage e /staff/promote removidas, com todas-as-telas.spec.ts atualizado.
- [ ] A 360×640, controles da mesa e barra de salvar ficam visíveis acima da barra inferior sem rolar.

**Onde mexer.** Front: `app/lib/rotas.ts (novo): pai e rótulo declarados por rota`, `app/components/AppShell.tsx: PageNavigation vira BackLink (<Link>); eyebrow e subtitle não renderizam; migalha só a partir de 900 px`, `app/components/CategoryDetailView.tsx: remover '‹ {modalidade}' (linha 77)`, `app/components/MatchRouteView.tsx e app/matches/live/page.tsx: título com o confronto; voltar à partida`, `app/globals.css: cabeçalho de uma linha, .app-screen com overflow-x: clip (linha 340), barra de ação fixa`, `Remover app/tournaments/page.tsx, app/teams/[id]/athletes/page.tsx, app/tournaments/[id]/manage/page.tsx e app/staff/promote/page.tsx`, `tests/e2e/navigation.spec.ts, todas-as-telas.spec.ts e capturas de referência`. API: `Nenhuma`.

**Depende de:** NAV-I03; AGD: dia e modalidade da agenda guardados na URL; PUB: títulos e voltar das telas públicas. **Risco:** Toca cerca de 30 telas e quebra seletores de e2e que procuram 'Voltar' e a migalha; fazer em 2 PRs (casca, depois telas).

<sub>Achados: NAV-10, VADM-10, VPUB-13, CSS-R1</sub>

### NAV-I08 · Casca de desktop: trilho lateral e conteúdo até 1200 px

Onda 3 sugerida · reorganização de UX · esforço M · ~4 dia(s) · cobre 4 achado(s), 0 crítico(s)/alto(s)

**Problema.** Em 1280 px o app é a coluna de 760 px do celular com barra inferior: dois jogos por tela, 40% do monitor vazio, gestão da categoria com 3,8 telas de rolagem. Não há dado de uso em desktop; o lançamento em lotes sugere notebook.

**Solução.** A partir de 1024 px, a mesma lista de itensDaBarra(sessão) vira trilho lateral fixo de 220 px, com ícone e rótulo; a barra inferior some, .management-screen vai a até 1200 px e o Início do admin usa duas colunas (pendências à esquerda, ao vivo e a seguir à direita). A migalha aparece. Telas em tabela e agenda densa são de DS e AGD e entram quando prontas. Abaixo de 1024 px nada muda.

**Tela alvo.** Notebook do admin: trilho à esquerda com Agora, Jogos, Modalidades, Equipes e Gestão; ao lado, migalha e título; conteúdo em até 1200 px. Início em duas colunas: Fechamento ou Pendências à esquerda, Ao vivo e A seguir à direita.

**Critérios de aceite**

- [ ] A partir de 1024 px, trilho lateral com os itens do perfil e conteúdo até 1200 px, sem barra inferior.
- [ ] Abaixo de 1024 px, a regressão visual do celular não muda.
- [ ] Em 1280×900, o Início do admin mostra pendências e ao vivo lado a lado, com o primeiro item de cada bloco sem rolar.

**Onde mexer.** Front: `app/components/BottomNav.tsx: modo trilho com a mesma lista`, `app/components/AppShell.tsx: grade trilho e conteúdo`, `app/components/PainelAgora.tsx: duas colunas a partir de 1024 px`, `app/globals.css: @media (min-width: 1024px) para .management-screen e .bottom-nav (linhas 829-832)`, `tests/e2e: capturas desktop de Agora, Jogos e Gestão`. API: `Nenhuma`.

**Depende de:** NAV-I07; DS: tabelas e grade no desktop; AGD: agenda em linhas densas. **Risco:** Sem dado de uso em notebook, pode ser esforço sem retorno; confirmar com o dono antes de começar.

<sub>Achados: NAV-14, CSS-08, JORG-12, VADM-13</sub>

**Fora de escopo, de propósito**

- Papel de mesário ou código de mesa por QR (ADMIN-R2 e ideias): é decisão de ADM. Se existir, herda a barra do gestor sem Tabelas e Equipes.
- Barra e telas públicas (Hoje, Minha atlética, vocabulário da issue 51, aba Artilharia): são de PUB. NAV só põe 'Entrar' ou 'Gestão' na faixa do topo.
- Notificações push e o interruptor 'Alertas do app': sem envio no servidor não há destino a navegar; ficam com ADM e PUB.
- Tabelas densas, agenda em linhas e categoria em duas colunas no desktop: são de DS, AGD e EST. NAV entrega só o trilho lateral e a largura.
- Seletor de edição e edições anteriores navegáveis: depende do ciclo de vida da edição (ADM). Hoje só o super admin troca de edição.
- Guia 'Como fazer' por perfil dentro do app: útil, mas é texto e não casca; entra depois como item de Conta e Gestão.

**Perguntas para a organização**

- Haverá responsável da atlética no próximo evento? Em 2026 foram 0 responsáveis e 0 atletas. Se não houver, a barra dele espera e NAV-I01 encolhe.
- Quando um jogo não iniciado passa a 'Sem resultado' no painel: no dia seguinte ou N horas depois do horário? Com atraso mediano de 104 min, 1 hora vira ruído. E quantos minutos sem lance nem sinal tornam um jogo ao vivo 'parado' (as propostas vão de 10 a 30)?
- A organização monta a edição e lança súmulas no notebook? Sem esse uso, a casca de desktop (NAV-I08) sai do plano.
- Quem opera a mesa: só os 4 gestores ou voluntários sem papel de gestão? Isso decide se o Agora do gestor basta ou se é preciso um perfil Mesário.


## SYNC — Sincronização, tempo real e desempenho

**Objetivo.** Cada toque da mesa vale na hora e nunca some calado; quem assiste vê o placar novo em até 5 s, com a hora do dado; rede fraca não derruba sessão nem tela; cada atualização pesa menos de 10 KB comprimida, mantendo snapshot + ações.

**Princípios**

- O toque nunca espera a rede: o placar muda no toque e enviar o lance é tarefa do app, não do mesário.
- Nada some calado: lance não confirmado fica visível, com contagem, até ser salvo ou descartado por escolha explícita. Toast só confirma; erro de lance nunca vira toast de 3 s.
- Dado velho sempre mostra a idade: toda tela com placar, inclusive a mesa, mostra 'Atualizado às HH:MM' e nunca chama cache de 'ao vivo'.
- Tela com dado nunca vira tela de erro: falha ao atualizar vira faixa no topo; erro em tela cheia só aparece quando nunca houve dado.
- Rede fraca não tira ninguém da sessão: só um 401 confirmado leva ao login.
- Mesma arquitetura com menos bytes: continuam snapshot + ações; primeiro sai o que ninguém lê, antes de qualquer protocolo novo.

**Desenho alvo**

A arquitetura continua snapshot + POST de ações. Mudam o que trafega e como cada lado reage.

ESCRITA (mesa): toque → lib/match-projection.ts calcula o placar na hora → match-event-queue.ts guarda o lance (em memória; em IndexedDB na I10) com Idempotency-Key fixa → um POST por vez, timeout de 8 s, levando só id, tipo, lado e pontos → API: transação com a trava da edição, recibo só com revisão e autor, snapshot enxuto como resposta → a fila absorve a resposta e reprojeta os pendentes sobre ela. Falha de rede: reenvio com a mesma chave. Trava vencida: claimOperator automático. Recusa: a fila para e pergunta.

LEITURA (todos): SSE quando a borda deixar. Sempre que o stream ficar 45 s mudo, GET condicional a cada 3 s com If-None-Match. A API responde 304 com a revisão em memória (1 s), sem consultar banco nem Redis. Se a revisão mudou: snapshot com gzip, numa chave única do Redis, montado em single-flight. O público baixa no máximo uma vez a cada 3 s.

PESO (outubro, 96 jogos): hoje 1.011.515 B (89 KB gzip) → I02 ≈ 590 KB (62 KB) → I08 ≈ 60 KB (5 KB). Os lances de jogo encerrado vêm sob demanda por GET /editions/:id/matches/:matchId/events. No snapshot ficam só os que sustentam artilharia e fair play.

FRESCOR: um modelo único no estado (fonte: sse, sondagem, cache ou sem conexão; lastFreshAt vindo de meta.generatedAt) alimenta o selo de todas as telas, inclusive a mesa. Falha de atualização com dado na tela vira faixa, nunca troca de tela.

SESSÃO: o token de acesso é renovado aos 12 min. O refresh tem janela de 60 s para resposta perdida. Sair vale por aparelho, e só um 401 encerra a sessão.

CASCA: o snapshot só vai no layout de /public; as rotas logadas são casca estática. O SW pré-carrega só o mínimo, usa cache-first em /_next/static e network-first de 4 s no snapshot público, com a marca X-SW-Cache. A versão é o SHA do build, conferida a cada 5 min.

MEDIÇÃO: a API registra no log a duração de cada ação. O cliente manda telemetria em lote (sendBeacon) para POST /telemetry, com expurgo de 30 dias; a tela 'Saúde do evento' lê esses dados.

### SYNC-I01 · Comprimir respostas, cache de uma chave e recibo só com revisão

Onda 1 sugerida · infra · esforço M · ~5 dia(s) · cobre 11 achado(s), 6 crítico(s)/alto(s)

**Problema.** O snapshot público de 1.032.090 bytes sai sem gzip (seriam 91 KB). Cada toque grava o snapshot inteiro num recibo que nunca é apagado: 0,9 a 1,5 GB de JSON em 3 dias. O Redis guarda 1 MB por revisão durante 1 h, sem maxmemory, num contêiner de 512 MB.

**Solução.** Dois PRs na API. 1) Middleware compression no main.ts para JSON acima de 1 KB, pulando text/event-stream; snapshot público numa chave fixa por edição, com a revisão dentro do valor, validade de 10 min e montagem single-flight; ETag conferido antes de ler o Redis ou montar o snapshot, também no privado. 2) O recibo grava só autor e rota (resultRevision já existe); reenviar a mesma chave devolve o snapshot atual sem reexecutar a ação. Uma migração esvazia responseData e apaga recibos com mais de 24 h; uma rotina horária mantém o expurgo. Renovação de trava pelo mesmo aparelho deixa de gravar auditoria. Log com a duração de cada ação; Redis com maxmemory 256 MB e volatile-lru.

**Critérios de aceite**

- [ ] Pela URL pública, GET public-snapshot com Accept-Encoding gzip volta com Content-Encoding gzip e no máximo 100 KB transferidos nos dados de outubro (hoje 1.032.090 B); o CD falha se a resposta vier sem compressão.
- [ ] O /stream segue sem compressão e entrega o primeiro evento (teste com supertest).
- [ ] Reenvio com a mesma Idempotency-Key devolve 200 com a revisão atual e não cria evento; recibo novo ocupa menos de 1 KB.
- [ ] Recibos com mais de 24 h somem em até 1 h; depois da migração, o censo mostra a tabela de recibos sem o JSON de outubro.
- [ ] Requisição com If-None-Match igual ao ETag responde 304 sem ler o Redis nem montar snapshot (teste com espião); o Redis guarda 1 chave de snapshot por edição.
- [ ] Renovação de trava pelo mesmo aparelho não cria linha de auditoria; o log registra a duração de cada ação, e o PR traz a mediana de match/registerEvent antes e depois.

**Onde mexer.** API: `src/main.ts: middleware compression (dependência nova) para JSON acima de 1 KB, com filtro que pula text/event-stream`, `src/edition-snapshots/edition-snapshots.service.ts: chave fixa edition-snapshot:public:v3:<edição> com a revisão no valor, TTL de 600 s, single-flight e 304 antes de ler o cache`, `src/public/public.controller.ts e src/edition-snapshots/edition-snapshots.controller.ts: If-None-Match conferido antes de montar, inclusive no snapshot privado`, `src/edition-actions/edition-actions.service.ts: recibo só com _actorId e _routeEditionId; reenvio remonta o snapshot atual; log com a duração de cada ação`, `migração 20261020120000_recibo_enxuto: esvazia responseData e apaga recibos com mais de 24 h; VACUUM da tabela por workflow self-hosted`, `Expurgo horário de recibos com mais de 24 h em EditionActionsService (OnModuleInit + setInterval, sem @nestjs/schedule)`, `match/claimOperator: renovação pelo mesmo aparelho não grava auditoria (a revisão continua subindo para as outras mesas verem o dono da trava)`, `docker-compose.yml: redis com --maxmemory 256mb --maxmemory-policy volatile-lru; .github/workflows/cd.yml: checagem de Content-Encoding pela URL pública`.

**Depende de:** nada. **Risco:** Compressão mal filtrada pode reter o SSE. O reenvio idempotente passa a devolver o estado atual, não o da época: inofensivo para o front, mas exige teste.

<sub>Achados: PWA-01, APIINFRA-09, DADOS-08, APIINFRA-R2, MESA-R4, DADOS-06, APIINFRA-04, JMESA-R1, JORG-R4, JDADOS-R2, ADMIN-R4</sub>

### SYNC-I02 · Tirar do snapshot o estado de desfazer e o regulamento repetido

Onda 1 sugerida · infra · esforço P · ~3 dia(s) · cobre 1 achado(s), 1 crítico(s)/alto(s)

**Problema.** No snapshot de outubro (1.011.515 bytes), o estado anterior de cada lance (previous e previousScoreA/B, 344 KB) e o regulamento copiado nos 96 jogos (81 KB) somam 42% do peso. O público nunca lê esses campos, e a modalidade já traz o mesmo regulamento.

**Solução.** API: mapMatchEvent deixa de enviar previous e previousScoreA/B; mapMatches deixa de repetir rules em cada jogo, porque disciplines já leva o mesmo mapRules. undoEvent aceita restore ausente e usa o previousScore gravado, sem recusar o payload antigo. Front: matchView (edition-catalog), MatchDetailClient, MatchManager, scheduling-rules e a mesa passam a ler o regulamento de state.disciplines; Desfazer deixa de montar restore. Publicar a API antes do front. Quando EST congelar o regulamento por jogo, o snapshot volta a mandar rules apenas no jogo cuja cópia difere da modalidade.

**Critérios de aceite**

- [ ] O snapshot dos dados de outubro cai de 1.011.515 B para no máximo 620 KB sem gzip (no máximo 65 KB com gzip), sem previous* nem rules dentro de matches.
- [ ] Com regulamento personalizado na modalidade, tabela, mesa, página do jogo e conflito de agenda mostram o mesmo de antes (teste de componente).
- [ ] Desfazer o último lance funciona sem restore no payload; o payload antigo, com restore, continua aceito (spec da API).
- [ ] No vôlei, isSetBased do cartão continua correto sem rules no jogo.

**Onde mexer.** Front: `app/lib/edition-catalog.ts: matchView recebe o regulamento de state.disciplines`, `app/components/MatchDetailClient.tsx e app/components/MatchManager.tsx: regulamento só da modalidade`, `app/lib/scheduling-rules.ts: duração calculada pelo regulamento da modalidade`, `app/matches/live/page.tsx: undoLastAction sem restore; resolveRegulation sem persisted.rules`, `app/lib/frontend-state.ts: MatchEventState sem previous, previousScoreA e previousScoreB`. API: `src/edition-snapshots/snapshot.mapper.ts: mapMatchEvent sem previous e previousScoreA/B; mapMatches sem rules por jogo`, `src/edition-actions/handlers/match-action.handler.ts: undoEvent com restore opcional, usando previousScore`, `DTOs MatchSnapshotDto e MatchEventSnapshotDto e snapshot.mapper.spec.ts atualizados`.

**Depende de:** nada. **Risco:** Uma tela que ainda leia match.rules cai no padrão do esporte e mostra regra errada. Antes do merge, achar todos os leitores por busca e cobri-los com teste.

<sub>Achados: DADOS-07</sub>

### SYNC-I03 · Tela que não some e selo de conexão com a hora do dado

Onda 1 sugerida · correção · esforço M · ~4 dia(s) · cobre 8 achado(s), 5 crítico(s)/alto(s)

**Problema.** Recarga que falha troca placar ou agenda por 'DADOS INDISPONÍVEIS' e desmonta a mesa. Sem rede, o service worker devolve snapshot antigo sob o selo 'Resultados ao vivo'. Nenhuma tela mostra a hora do dado; 'Sem conexão' sai verde, some a 430 px e falta no placar.

**Solução.** use-frontend-state: com dado na tela, a falha de recarga mantém o status 'ready', marca a conexão como desatualizada e tenta de novo com espera de 2 a 30 s; erro em tela cheia só sem dado nenhum; absorb volta a 'ready'. A API devolve meta.generatedAt. sw.js: rede com prazo de 4 s, cache também em 5xx e cabeçalho X-SW-Cache com a hora em que o dado foi guardado; public-snapshot.ts lança erro com a API fora, para o SW não gravar 'sem competição'. O adaptador guarda lastFreshAt e só marca 'online' quando a resposta vem da rede. ConnectionBadge passa a ter três estados, também no placar. O chip de modalidade só recarrega se o escopo mudar.

**Tela alvo.** Topo de toda tela, inclusive a mesa: 'Ao vivo · 14:32:05', discreto. Dado com mais de 30 s: 'Atualizado às 14:31'. Sem resposta: faixa de largura total na cor de perigo, 'Sem conexão · dados das 14:10', com o botão 'Tentar agora'; o conteúdo continua embaixo. No cartão público ao vivo, abaixo do selo: 'último lance há 3 min'.

**Critérios de aceite**

- [ ] Com a API devolvendo 502 por 60 s, agenda, página do jogo e placar da mesa continuam na tela com a faixa e se atualizam sozinhos quando a API volta (e2e).
- [ ] Resposta servida pelo cache do SW nunca aparece como 'Ao vivo': o selo mostra a hora do dado.
- [ ] 'DADOS INDISPONÍVEIS' só aparece em aba que nunca recebeu dado.
- [ ] A 360 px, 'Sem conexão' aparece com texto e contraste de perigo, e o placar ao vivo também mostra o selo.
- [ ] Trocar o chip de modalidade sem mudar o escopo não dispara requisição.
- [ ] O cartão ao vivo mostra 'último lance há N min', calculado a partir de events[0].at.

**Onde mexer.** Front: `app/lib/repositories/use-frontend-state.ts: falha com dado mantém 'ready', marca a conexão como desatualizada e tenta de novo em 2 a 30 s`, `app/lib/repositories/http-adapter.ts e api-client.ts: timeout de 10 s no GET, lastFreshAt e leitura do cabeçalho X-SW-Cache`, `app/components/ConnectionBadge.tsx: três estados com hora e botão 'Tentar agora'`, `app/matches/live/page.tsx: selo no placar; não soltar a trava em desmontagem causada por erro`, `public/sw.js: rede com prazo de 4 s, cache também em 5xx e cabeçalho X-SW-Cache`, `app/lib/public-snapshot.ts: com a API fora, lança erro em vez de devolver 'sem competição' (sem edição ativa continua vazio)`, `app/globals.css: cascata de .sync-state.sync-offline e regra de 430 px que zera o texto`, `app/components/DisciplineSelector.tsx (recarrega só com escopo novo) e PublicMatchCollection.tsx ('último lance há N min')`. API: `src/edition-snapshots/snapshot-http.ts e envelope da ação: meta.generatedAt`.

**Depende de:** DS: token de cor de perigo e de erro (--danger); NAV: padrão visual dos estados globais (faixa no topo). **Risco:** Uma faixa permanente vira ruído se o limiar for curto. Calibrar junto com a sondagem de 3 s da SYNC-I04 para o selo não piscar.

<sub>Achados: DADOS-05, PWA-04, NAV-08, DADOS-R3, PUBLICO-R2, JESP-R3, CSS-04, PUBLICO-07</sub>

### SYNC-I04 · Tempo real que chega: sondagem condicional de 3 s e vigia do SSE

Onda 1 sugerida · correção · esforço M · ~4 dia(s) · cobre 4 achado(s), 2 crítico(s)/alto(s)

**Problema.** Em produção, o /stream passa de 75 a 100 s sem enviar um byte. Tudo depende da sondagem de 12 s do snapshot inteiro, e o primeiro sinal do stream desliga essa sondagem para sempre. O heartbeat é ignorado, e o teto de 40 conexões por IP pode valer para todos.

**Solução.** Sem contrato novo. Front: http-adapter manda If-None-Match com o último ETag, aceita 304 e não troca o estado quando a revisão é igual; sonda a cada 3 s, com a aba visível, sempre que o stream passar 45 s sem sinal, e também ao voltar para a aba; no público, baixa no máximo uma vez a cada 3 s. realtime-channel escuta o heartbeat, reabre o stream mudo e, após 3 falhas, fica 5 min só na sondagem. API: revisão da edição em memória por 1 s, invalidada ao publicar; um leitor Redis e um temporizador por edição. Gateway: location do /stream sem buffer e com timeout de 1 h; conferir TRUSTED_PROXY_HOPS.

**Tela alvo.** Espectador e telão veem o ponto em até 5 s sem tocar em nada; voltar ao app depois de bloquear a tela atualiza na hora. O selo da SYNC-I03 diz 'Ao vivo', com a hora, sempre que o SSE ou a sondagem estiverem respondendo.

**Critérios de aceite**

- [ ] Com o SSE mudo como hoje, um ponto lançado na mesa aparece no segundo navegador em até 5 s (hoje até 12 s): e2e com dois contextos.
- [ ] Sondagem sem mudança responde 304 sem consultar Postgres nem Redis; 300 clientes simulados geram menos de 5 consultas/s.
- [ ] 45 s sem evento nem heartbeat reabrem o EventSource e ligam a sondagem; voltar a aba para visível recarrega na hora.
- [ ] Depois de 3 reaberturas recusadas (429), o cliente fica 5 min só na sondagem, sem o selo piscar.
- [ ] Um workflow mede, pela URL pública, se o /stream entrega o primeiro evento em menos de 2 s; o resultado fica registrado no PR.
- [ ] TRUSTED_PROXY_HOPS igual ao número real de proxies, conferido pelo X-Forwarded-For.

**Onde mexer.** Front: `app/lib/repositories/http-adapter.ts: If-None-Match explícito, aceita 304, revisão igual não troca o estado; sondagem de 3 s nunca desligada de vez; visibilitychange; intervalo mínimo de 3 s no público`, `app/lib/repositories/api-client.ts: validateStatus aceita 304 e devolve o ETag`, `app/lib/repositories/realtime-channel.ts: escuta heartbeat, vigia de 45 s e recuo de 5 min após 3 falhas`, `tests/unit/sondagem-tempo-real.test.ts: casos de stream mudo e de 304`. API: `src/edition-snapshots/active-edition.resolver.ts: edição e revisão em memória por 1 s, invalidadas em publishCommittedRevisions`, `src/realtime/realtime.service.ts e edition-realtime.controller.ts: um leitor Redis e um temporizador por edição, compartilhados entre conexões`, `incinera-gateway (nginx): location do /stream com proxy_buffering off, proxy_read_timeout 3600s e gzip off; aplicar com recarregar-gateway.yml`, `secret DOTENV_FILE: TRUSTED_PROXY_HOPS conferido com inspecionar-gateway.yml; /health expõe as conexões SSE abertas`, `workflow de verificação: curl no /stream pela URL pública mede o tempo até o primeiro evento`.

**Depende de:** SYNC-I01; ADM: acesso ao incinera-gateway e contato com o proxy de borda do CIn. **Risco:** A sondagem de 3 s multiplica as requisições. Se a borda continuar retendo o stream, todo o custo cai na API de 1 vCPU; medir com a SYNC-I07.

<sub>Achados: PWA-03, APIINFRA-R1, DADOS-09, PWA-R3</sub>

### SYNC-I05 · Lance como incremento, em fila, com placar otimista e faixa de envio

Onda 1 sugerida · correção · esforço M · ~6 dia(s) · cobre 7 achado(s), 7 crítico(s)/alto(s)

**Problema.** Cada toque envia o placar absoluto da tela, que só muda quando o snapshot volta. Toque dado antes disso leva 409 e o ponto some num toast de 3,2 s, depois do som. Não há timeout nem fila; nos jogos lançados em lote, nenhum lance foi aceito a menos de 0,576 s do anterior.

**Solução.** Front: extrair a conta do lance de live/page.tsx para lib/match-projection.ts e criar match-event-queue.ts, uma fila por partida. Cada toque entra com Idempotency-Key própria; o placar exibido é o do servidor mais os pendentes; sai um POST por vez, com timeout de 8 s, levando só id, tipo, lado e pontos, com patch vazio. Rede ou 5xx: reenvio com a mesma chave em 1, 2, 4 e 8 s. Trava vencida: claimOperator e reenvio. Outra recusa: a fila para e pergunta. Desfazer de lance não enviado só o tira da fila; iniciar, avançar e encerrar esperam a fila esvaziar. API: período omitido vale o atual; códigos de erro próprios.

**Tela alvo.** Placar ao vivo: os botões de ponto nunca travam e o número sobe no toque, sem toast por ponto. Logo abaixo do placar, uma faixa fina: 'Tudo salvo · 14:32:05'; 'Enviando 2 lances…'; em âmbar, 'Sem rede · 3 lances guardados, não feche o app'; na cor de perigo, 'Lance recusado: partida encerrada · 2 não enviados', com 'Descartar' e 'Tentar de novo'. Essa faixa só some por escolha do mesário.

**Critérios de aceite**

- [ ] Com 800 ms de atraso injetado na rota de ações, 5 toques em 1 s viram 5 pontos e 0 recusas (e2e-http).
- [ ] Lançar 25×18 25×20 por toques leva menos de 60 s (hoje cerca de 88 toques × 1,4 s, uns 2 min).
- [ ] Com a rede cortada por 30 s e 6 toques, a faixa mostra 6 pendentes; quando a rede volta, os 6 eventos são gravados na ordem, sem duplicata.
- [ ] Trava vencida no meio da fila é reassumida sozinha, e o lance sai sem o mesário tocar em nada.
- [ ] Nenhuma falha de lance vira toast: a recusa fica na faixa até 'Descartar' ou 'Tentar de novo'.
- [ ] O payload de match/registerEvent não leva scoreA, scoreB nem periodResult.

**Onde mexer.** Front: `app/lib/match-projection.ts (novo): projeção pura do lance (placar, parcial, set) extraída de registerScore`, `app/lib/repositories/match-event-queue.ts (novo): fila por partida, chave fixa, um envio por vez, reenvio e retomada da trava`, `app/lib/repositories/http-adapter.ts e state-adapter.ts: apply(action, { idempotencyKey, timeoutMs })`, `app/lib/repositories/use-frontend-state.ts: dispatch silencioso, sem toast de sucesso`, `app/matches/live/page.tsx: writeEvent só com id, tipo, lado e pontos; sem a trava de 350 ms; Desfazer retira o lance pendente`, `app/components/MatchSendStatus.tsx (novo): faixa de envio`, `tests/unit/match-event-queue.test.ts e tests/e2e-http/mesa-rede-lenta.spec.ts (800 ms de atraso, 5 toques)`. API: `src/edition-actions/handlers/match-action.handler.ts: registerEvent grava period = currentPeriod quando o campo vem omitido`, `src/common/filters/global-exception.filter.ts: respeitar o code da exceção; OPERATOR_LOCK_STALE, OPERATOR_LOCK_TAKEN e MATCH_NOT_LIVE`, `spec: cinco registerEvent seguidos, só com incremento`.

**Depende de:** SYNC-I02; SYNC-I03; MESA: bloquear ponto com jogo decidido (MESA-03); QA: job e2e contra a API real (TESTES-02). **Risco:** A projeção local pode divergir do servidor na virada de set. A verdade é sempre a resposta, e a fila reprojeta os pendentes sobre ela; precisa de teste por modalidade.

<sub>Achados: MESA-05, DADOS-02, DADOS-03, PWA-R1, JMESA-04, JDADOS-R3, TESTES-09</sub>

### SYNC-I06 · Sessão que só cai com 401: renovação tolerante e saída por aparelho

Onda 1 sugerida · correção · esforço M · ~4 dia(s) · cobre 4 achado(s), 1 crítico(s)/alto(s)

**Problema.** restore() devolve null em qualquer falha: rede fraca na renovação leva ao login no meio do jogo. A rotação do refresh não tolera resposta perdida, 'Sair' revoga todas as sessões da conta (7 contas para 96 jogos) e, sem 'Manter acesso', desmarcado por padrão, fechar o app desloga.

**Solução.** Front: restore() só descarta a sessão com 401; erro de rede mantém a sessão, mostra 'Reconectando sua sessão' e tenta de novo; sem sessão local, tenta /auth/refresh pelo cookie uma vez. Renovar aos 12 min e ao voltar para a aba. Sessão em localStorage por padrão; a caixa vira 'Aparelho compartilhado'. AdminRouteGuard só manda ao login com 401 confirmado, sem desmontar a mesa nem a fila. API: revoke() derruba só a sessão do token; novo POST /auth/logout-all; rotate() aceita por 60 s o token recém-rotacionado e gira a sessão sucessora, usando rotatedTo, que já existe (sem migração).

**Tela alvo.** Login: e-mail, senha e a caixa desmarcada 'Aparelho compartilhado (sair ao fechar)'. Na mesa, com rede ruim, aparece no topo 'Reconectando sua sessão…' e o placar continua. O Perfil ganha 'Sair deste aparelho' e, abaixo, 'Sair de todos os aparelhos'.

**Critérios de aceite**

- [ ] Com a rede desligada no momento da renovação, a pessoa continua na tela; ninguém vai para /login sem 401 (e2e).
- [ ] Resposta de refresh perdida: reenviar o token antigo em até 60 s devolve sessão nova (spec da API).
- [ ] Sair num aparelho não derruba a mesma conta em outro; 'Sair de todos os aparelhos' derruba.
- [ ] Fechar e reabrir o app instalado mantém a sessão, salvo quando 'Aparelho compartilhado' foi marcado.
- [ ] O token de acesso é renovado antes de vencer, aos 12 dos 15 min.

**Onde mexer.** Front: `app/lib/repositories/http-auth-adapter.ts: restore só descarta com 401; sem sessão local, refresh pelo cookie`, `app/lib/frontend-session.ts: renovação aos 12 min e ao voltar o foco; estado 'reconectando'`, `app/components/AdminRouteGuard.tsx: login só com 401 confirmado`, `app/lib/repositories/session-storage.ts e app/login/page.tsx: localStorage por padrão e caixa 'Aparelho compartilhado'`, `app/profile/page.tsx: 'Sair deste aparelho' e 'Sair de todos os aparelhos'`. API: `src/auth/services/refresh-sessions.service.ts: revoke por tokenHash; janela de 60 s usando rotatedTo`, `src/auth/auth.controller.ts: POST /auth/logout-all, que usa revokeAllForStaff`, `specs: rotação com resposta perdida e logout por aparelho`.

**Depende de:** NAV: redirecionamento pós-login que preserva ?partida e ?modalidade. **Risco:** Sessão persistente num celular emprestado fica aberta por 7 dias. Atenuam isso a caixa 'Aparelho compartilhado' e o 'Sair de todos'; a decisão é da organização.

<sub>Achados: DADOS-04, APIINFRA-06, NAV-05, NAV-R3</sub>

### SYNC-I07 · Telemetria mínima: erros, tempo de cada lance, tempo real e visitas

Onda 2 sugerida · feature · esforço M · ~5 dia(s) · cobre 1 achado(s), 0 crítico(s)/alto(s)

**Problema.** Não existe medição nenhuma no front nem na API: error.tsx descarta o erro, recusas de lance não deixam rastro, e não se sabe quanta gente abriu a área pública nem se o basquete parou por falha ou por desistência.

**Solução.** Front: lib/telemetry.ts junta eventos em memória e os envia em lote a cada 30 s e no pagehide, por sendBeacon: erro de tela e erro não tratado; cada lance com tipo, código, tentativas e latência (vindos da fila da SYNC-I05); troca de modo do tempo real; versão do app; visita por rota. Nada de cookie, nome, IP ou id de aparelho. API: POST /telemetry público com throttler, gravando em client_telemetry, com as visitas agregadas por rota e minuto; expurgo de 30 dias no job horário; GET /telemetry/summary. Tela 'Saúde do evento' para super admin e admin da edição.

**Tela alvo.** Saúde do evento: no topo, filtro de dia e quatro números de hoje (lances salvos, tempo mediano e p95 de um lance, recusas, erros de tela). Abaixo, barras por hora de lances e recusas, a tabela 'Recusas por motivo', 'Aparelhos agora: SSE, sondagem, sem conexão' e 'Visitas por tela pública'. É uma tela só de leitura.

**Critérios de aceite**

- [ ] Erro de tela, recusa de lance e troca de modo do tempo real aparecem no resumo em até 60 s.
- [ ] Nenhum registro guarda nome, e-mail, IP ou id persistente de aparelho (teste do DTO).
- [ ] O resumo por hora mostra lances, latência mediana e p95, recusas por código e visitas por rota.
- [ ] Registros com mais de 30 dias são apagados, e POST /telemetry tem limite por IP.
- [ ] Com a API fora, o front descarta o lote sem erro e sem tentar de novo para sempre.

**Onde mexer.** Front: `app/lib/telemetry.ts (novo): buffer, lote a cada 30 s e sendBeacon no pagehide`, `app/error.tsx e app/components/PwaRegistration.tsx: onerror, unhandledrejection e erro de tela`, `app/lib/repositories/match-event-queue.ts: latência, tentativas e código de cada lance`, `app/lib/repositories/http-adapter.ts: modo do tempo real (SSE, sondagem ou sem conexão)`, `app/saude/page.tsx (novo): tela Saúde do evento`. API: `src/telemetry/telemetry.module.ts, controller e service (novos): POST /telemetry com throttler e GET /telemetry/summary`, `migração 20261101120000_client_telemetry: tabela (kind, route, actionType, code, latencyMs, appVersion, count, createdAt) com índice por createdAt e kind`, `expurgo de 30 dias no job horário criado na SYNC-I01`.

**Depende de:** SYNC-I05; ADM: aviso de privacidade e regra de LGPD; NAV: entrada 'Saúde' em Gestão. **Risco:** Visitas em massa podem encher a tabela; agregar por rota e minuto no servidor e nunca gravar uma linha por visita.

<sub>Achados: PWA-07</sub>

### SYNC-I08 · Lances de jogo encerrado sob demanda; snapshot só com lances ao vivo

Onda 2 sugerida · infra · esforço M · ~5 dia(s) · cobre 5 achado(s), 3 crítico(s)/alto(s)

**Problema.** 86% do snapshot são lances (874 KB de 2.689), quase todos de jogos encerrados, que só a página de um jogo usa. Cada ação ainda lê todos os lances do banco para montar a resposta, e todo aparelho baixa tudo de novo a cada revisão.

**Solução.** API: o mapper manda todos os lances apenas dos jogos Ao vivo; nos demais, só os que sustentam artilharia e fair play (com autor ou de evento secundário), em forma enxuta, mais eventCount e eventsPartial. A consulta filtra no banco. Novo GET /editions/:id/matches/:matchId/events, público, com ETag pela revisão. Front: o hook use-match-events busca os lances ao abrir o jogo quando eventsPartial; MatchDetailClient usa o hook; artilharia e TournamentClassification continuam lendo o snapshot. A resposta da ação continua sendo o snapshot, agora pequeno, sem protocolo de delta.

**Tela alvo.** Página do jogo encerrado: placar, parciais e vencedor aparecem na hora; a lista de lances mostra 'Carregando lances…' por menos de 1 s e depois os 135 lances. Nas outras telas nada muda, só fica mais rápido.

**Critérios de aceite**

- [ ] Snapshot público dos dados de outubro com no máximo 80 KB sem gzip e 10 KB com gzip (hoje 1.032.090 B e 91.372 B); a resposta de registerEvent fica na mesma ordem de tamanho.
- [ ] Os lances do maior jogo (135, 45 KB) chegam pelo GET próprio em menos de 1 s num 4G simulado.
- [ ] Artilharia e desempate por fair play dão o mesmo resultado antes e depois, nos dados de outubro acrescidos de lances com autor (teste).
- [ ] Jogo Ao vivo continua com todos os lances no snapshot; ao encerrar, a página do jogo não perde a lista.
- [ ] Para montar o snapshot, a ação lê no máximo os lances dos jogos ao vivo e os com autor ou de fair play (a spec conta as linhas).

**Onde mexer.** Front: `app/lib/repositories/use-match-events.ts (novo): GET de lances sob demanda, com cache por revisão`, `app/components/MatchDetailClient.tsx: usa o hook quando eventsPartial`, `app/lib/frontend-state.ts: campos eventCount e eventsPartial`, `app/lib/artilharia.ts e app/components/TournamentClassification.tsx: teste de paridade com lances parciais`. API: `src/edition-snapshots/snapshot.mapper.ts: lances completos só nos jogos Ao vivo; nos demais, só com autor ou de fair play, mais eventCount e eventsPartial`, `consulta matchEvent.findMany filtrada no banco (jogo ao vivo, athleteId não nulo ou tipo secundário)`, `src/public/public.controller.ts: GET /editions/:id/matches/:matchId/events com ETag pela revisão`, `spec de paridade da artilharia e do fair play com os dados de outubro`.

**Depende de:** SYNC-I02; PUB: página do jogo com lances recolhidos (PUBLICO-10). **Risco:** Tela que conte os lances do snapshot em jogo encerrado (ex.: 'Ver lances (N)') passa a ver lista parcial; usar eventCount e cobrir com teste.

<sub>Achados: PUBLICO-08, PWA-02, APIDOM-05, JESP-12, JDADOS-14</sub>

### SYNC-I09 · HTML leve, área pública sempre pública e aviso de versão nova

Onda 2 sugerida · infra · esforço M · ~5 dia(s) · cobre 5 achado(s), 0 crítico(s)/alto(s)

**Problema.** O layout raiz embute o snapshot em toda página, até em /login e /offline (1,2 MB de HTML, com force-dynamic). Telas logadas nascem 'prontas' com dado público, e gestor logado vê a área pública recortada. O sw.js tem versão fixa: nenhum dos 12 merges publicados depois de 09/10 avisou a aba aberta.

**Solução.** Mover loadPublicSnapshot e o initialState de app/layout.tsx para app/public/layout.tsx e tirar force-dynamic da raiz: login, mesa, gestão e /offline viram casca, e as rotas logadas nascem em carregamento. O adaptador escolhe o endpoint pela área: em /public, sempre public-snapshot sem token; cruzar de área recarrega o estado. sw.js: pré-cache só de /offline e ícones, cache-first em /_next/static, e /public e /public/matches guardados depois da primeira visita, com teto. O build carimba o sw.js e o deploymentId com o SHA e publica /version.json; PwaRegistration confere a cada 5 min e no foco, e na mesa só avisa fora de Ao vivo. error.tsx recarrega uma vez em ChunkLoadError.

**Tela alvo.** Faixa no rodapé, acima da barra: 'Nova versão do app · Atualizar'. Na mesa, com partida Ao vivo, a faixa espera o jogo terminar. Para o gestor logado, a área pública mostra todas as modalidades, igual ao visitante.

**Critérios de aceite**

- [ ] /login, /matches/live e /offline chegam com menos de 60 KB de HTML (hoje 1.201.427 B).
- [ ] Gestor de Vôlei logado vê em /public/matches as mesmas 6 modalidades que o visitante (e2e-http).
- [ ] Tela logada mostra carregamento até chegar o snapshot privado; nunca exibe dado público como pronto.
- [ ] Depois de um deploy, a aba aberta mostra 'Nova versão' em até 5 min; na mesa, só com a partida fora de Ao vivo.
- [ ] Abrir /public/matches sem rede, depois de uma visita, mostra a agenda guardada com o selo de idade.
- [ ] ChunkLoadError recarrega a página uma vez sozinho.

**Onde mexer.** Front: `app/layout.tsx: sem force-dynamic e sem loadPublicSnapshot`, `app/public/layout.tsx: carrega o snapshot público e entrega ao provider`, `app/lib/repositories/use-frontend-state.ts e http-adapter.ts: endpoint escolhido pela área; recarrega ao cruzar de área`, `app/components/AdminRouteGuard.tsx: espera o snapshot privado`, `public/sw.js: pré-cache mínimo, cache-first em /_next/static e VERSION com o SHA`, `next.config.ts: deploymentId do GIT_SHA e /version.json gerado no build; .github/workflows/cd.yml passa GIT_SHA`, `app/components/PwaRegistration.tsx: checagem a cada 5 min e no foco; na mesa, só fora de Ao vivo`, `app/error.tsx: uma única recarga em ChunkLoadError`.

**Depende de:** SYNC-I03; QA: build de teste com basePath /copahalterada (TESTES-11). **Risco:** SEO e metadados das páginas públicas dependem do snapshot no servidor. Manter o carregamento no layout público e conferir og:url e canonical antes do merge.

<sub>Achados: PWA-10, PWA-R4, NAV-R2, PWA-11, PWA-09</sub>

### SYNC-I10 · Fila de lances guardada no aparelho e mesa que reabre sem rede

Onda 3 sugerida · feature · esforço G · ~7 dia(s) · cobre 1 achado(s), 1 crítico(s)/alto(s)

**Problema.** Se o app fecha ou recarrega sem rede, os lances pendentes somem e a mesa cai em 'SEM CONEXÃO', que só leva à área pública. Em 10/10, um jogo de vôlei voltou de 7 min de silêncio com 8 pontos em 8 s: os lances ficaram na cabeça do operador.

**Solução.** Sobre a fila da SYNC-I05: gravar cada lance pendente e o último estado da partida operada (placar, parciais, regulamento, nomes e escudos) em IndexedDB, com um wrapper próprio pequeno. Ao abrir /matches/live?partida=X, a tela parte desse estado, retoma a fila e reenvia na ordem, com as mesmas chaves. navigator.locks garante um só envio por partida no aparelho. Como o recibo expira em 24 h, a API responde EVENT_ALREADY_RECORDED a id de lance repetido, e a fila trata como salvo. O sw.js guarda a casca de /matches/live. A primeira recusa na retomada para a fila e pergunta ao mesário.

**Tela alvo.** Abrir o placar sem rede mostra o último placar deste aparelho, com a faixa âmbar 'Sem rede · placar deste aparelho · 4 lances aguardando', e os botões funcionam. Quando a rede volta: 'Enviando 4 lances…' e depois 'Tudo salvo'. Se o servidor recusar: 'O jogo mudou em outro aparelho', com 'Descartar' e 'Ver placar do servidor'.

**Critérios de aceite**

- [ ] Recarregar /matches/live?partida=X sem rede abre o placar com o último estado e a fila deste aparelho.
- [ ] Fechar o app com 4 lances pendentes e reabrir com rede: os 4 eventos são gravados na ordem, sem duplicata.
- [ ] Duas abas no mesmo aparelho não enviam a mesma fila em dobro.
- [ ] Lance reenviado depois de 24 h não duplica: a API responde EVENT_ALREADY_RECORDED e a fila marca como salvo.
- [ ] A primeira recusa na retomada para a fila e mostra as duas opções.

**Onde mexer.** Front: `app/lib/repositories/match-event-queue.ts: persistência em IndexedDB`, `app/lib/repositories/offline-match-store.ts (novo): último estado da partida operada`, `app/matches/live/page.tsx: sem rede, abre com o estado local`, `public/sw.js: casca de /matches/live guardada`, `navigator.locks na fila: um envio por partida por aparelho`. API: `src/edition-actions/handlers/match-action.handler.ts: id de lance repetido em registerEvent responde com o código EVENT_ALREADY_RECORDED`.

**Depende de:** SYNC-I05; SYNC-I09. **Risco:** O estado local pode estar velho e contradizer o servidor; a recusa pede decisão. Antecipar para a onda 2 se a telemetria mostrar recargas sem rede na mesa.

<sub>Achados: PWA-06</sub>

**Fora de escopo, de propósito**

- Resposta da ação só com as entidades alteradas (delta) e versionamento do contrato, parte do APIDOM-05: sem os lances de jogos encerrados (SYNC-I08), o snapshot fica em ~60 KB, ou 5 KB com gzip. O delta exigiria reconciliação e testes que um time voluntário não sustenta.
- Trocar o SSE por WebSocket ou por serviço de terceiros: não contorna o proxy de borda que segura o stream e ainda acrescenta uma dependência. A sondagem condicional de 3 s resolve com o que já existe.
- Trava de operador (renovar a cada lance, id do aparelho em localStorage, Wake Lock, 'Passar a mesa'): é da MESA (MESA-11, JMESA-12, DADOS-12). Aqui a fila só reassume uma trava vencida para reenviar.
- Notificações push (PWA-12, DOCS-12): exigem inscrição e disparo pelo servidor; ficam com ADM e PUB e dependem da atlética seguida.
- Alertas de queda, limite por IP nas rotas públicas e auditoria sem lances nem batimento (APIINFRA-10, VADM-R2): são de ADM. Esta trilha entrega só os contadores e o fim da auditoria da renovação de trava.
- Deploy durante jogo ao vivo, rollback e recarga do gateway (PWA-05, PWA-08, PWA-R2) e o test:unit por glob (TESTES-08): são de QA. Aqui fica só o aviso de versão nova na aba aberta.

**Perguntas para a organização**

- Quem administra o proxy de borda do CIn, onde termina o TLS? Podemos pedir que desligue o buffer e alongue o timeout só em /intereng-api/api/v1/editions/*/stream? Sem isso, o tempo real fica na sondagem de 3 s.
- Quantas pessoas devem acompanhar ao mesmo tempo no próximo evento, contando o telão? Acima de ~300 aparelhos, a sondagem passa de 3 para 5 s na VM de 1 vCPU.
- A sessão do staff pode ficar guardada no aparelho por 7 dias por padrão, com a opção 'Aparelho compartilhado'? As contas de mesa são pessoais ou divididas entre voluntários?
- Podemos ligar telemetria anônima (erros, tempo de cada lance, visitas por tela, sem cookie nem nome)? Quem da organização deve ver a tela Saúde do evento?


## ADM — Acesso, staff, edição, auditoria e operação

**Objetivo.** Quem administra a edição concede e recupera acessos sozinho, pela tela, em minutos; encerra a edição e abre a próxima sem desenvolvedor; lê uma auditoria que responde "quem mudou isto". Produção ganha backup fora da VM e alerta de queda, e os resíduos de segurança de agosto ficam fechados.

**Princípios**

- Senha provisória é individual, gerada no aparelho de quem convida ou redefine, aparece uma única vez num cartão com 'Compartilhar' (navigator.share, nunca em parâmetro de URL) e 'Copiar mensagem', vale 72 h e obriga troca no primeiro acesso.
- O app não promete o que não faz: sem 'Solicitação registrada' que não registra nada, sem interruptor de alerta que não envia. Onde não há automação, a tela diz quem resolve ('peça ao admin da edição').
- Toda ação de acesso ou destrutiva tem rótulo escrito (nunca só ícone), alvo de 44 px, confirmação que diz a consequência real ('Bruno perde o acesso agora e sai de todos os aparelhos') e linha legível na auditoria.
- Uma pessoa, um cartão: Staff organizado por pessoa, com papéis como etiquetas e o estado do acesso à vista ('Ainda não entrou', 'Senha provisória pendente', 'Último acesso 12/10 14:31').
- O servidor decide e explica: toda regra (quem redefine quem, quem encerra a edição, o que trava depois do fim) vale na API. A tela só esconde o que daria 403 e, quando o servidor recusa, mostra a frase dele.
- Fechamento é lista de pendências clicável: bloqueia só o que deixa dado errado (jogo ao vivo ou sem desfecho); o resto vira aviso que pede motivo. Workflow manual na VM vira último recurso documentado, não caminho de rotina.

**Desenho alvo**

ACESSO. Toda senha nasce provisória e individual: o aparelho de quem convida ou redefine gera 12+ caracteres (lib/temporary-password.ts); a API guarda o hash, liga mustChangePassword e grava Staff.temporaryPasswordExpiresAt (72 h, migração). Ações: staff/upsert (initialPassword obrigatório em conta nova e recusado em conta existente), staff/resetPassword (nova), staff/remove por roleAssignmentId, staff/promoteSuperAdmin com initialPassword. STAFF_INVITE_PASSWORD deixa de existir. Login: 401 só para credencial errada; 403 com frase para provisória vencida e para conta sem papel na edição ativa. Logout revoga só a sessão do aparelho; POST /auth/logout-all revoga todas. Regras em authorize(): super admin alcança qualquer conta; admin da edição, só gestores e responsáveis da própria edição.

STAFF. Snapshot de staff com staffId, mustChangePassword e lastSeenAt (maior refresh_sessions.createdAt, sem migração). Tela por pessoa; super admin vê 'Acesso global'.

CICLO DA EDIÇÃO. PLANNING vira ONGOING no primeiro match/start; edition/close (admin da edição) exige zero jogos Ao vivo, Agendada ou Adiada, aceita avisos com motivo e grava closedAt/closedById; edição FINISHED recusa ações de dado; edition/reopen com motivo. edition/create aceita copyFrom (modalidades com regulamento, equipes, métricas, staff). Ativar mostra quem perde acesso.

AUDITORIA. audit_logs ganha summary e entityLabel; match_events ganha createdById; lance, relógio e trava saem da trilha. GET /editions/:id/audit paginado por cursor e filtrável (tipo, pessoa, partida, dia), para super admin e admin; o snapshot deixa de carregar auditoria.

OPERAÇÃO. backup.yml (cron 30 min; grava em dia de edição ativa e às 03:00; sem dados de recibos; inclui MinIO; artefato cifrado de 30 dias; 48 na VM), ensaiar-restauracao.yml, monitor-producao.yml em runner hospedado (site, /health, idade do backup; falha abre issue). /health com commit, último backup e IP visto. Logs com rotação. Gateway versionado em incinera-gateway com /intereng-storage/. redefinir-senha-staff.yml e consultar-conta-staff.yml ficam como último recurso, registrado em docs/OPERACAO.md.

TELAS. Login (instrução de recuperação); troca obrigatória (dica, mostrar senha, Sair); Gestão (menu de NAV): Edição (situação, encerrar, reabrir, nova edição, ativar), Staff, Auditoria; Conta: Perfil (meus acessos, senha, sair deste aparelho, sair de todos); /public/privacidade. Nenhum PR aberto cobre esta trilha; o commit f88d309 (notificações) não deve ser reaplicado.

### ADM-I01 · Backup agendado e cifrado fora da VM, com ensaio de restauração

Onda 0 sugerida · infra · esforço P · ~2 dia(s) · cobre 2 achado(s), 2 crítico(s)/alto(s)

**Problema.** O pg_dump só roda dentro do deploy da API. O último deploy foi em 10/10 às 13:53, e 98% dos 2.689 lances da Copa entraram depois dele. Os 10 dumps ficam no disco da própria VM, sem cifra, e o volume do MinIO não é copiado.

**Solução.** Workflow backup.yml no runner da VM com cron a cada 30 min. Ele grava de fato quando a edição ativa está no período (mais um dia) e, fora disso, só às 03:00. Reaproveita o pg_dump -Fc do cd.yml num script único (scripts/backup.sh), com --exclude-table-data=edition_action_receipts, validação por pg_restore --list e tar do volume do MinIO. Cifra com gpg simétrico (senha no secret BACKUP_PASSPHRASE, guardada também fora do GitHub por duas pessoas) e sobe como artefato com retenção de 30 dias; a VM mantém os 48 últimos. O manual ensaiar-restauracao.yml restaura o último artefato num Postgres descartável e compara contagens. Antes de tudo, fazer um dump manual hoje.

**Critérios de aceite**

- [ ] Um dump manual existe e foi verificado antes de qualquer script do saneamento tocar produção.
- [ ] Na aba Actions, backup.yml tem uma execução verde a cada 30 min em dia de edição ativa e uma por dia fora disso, sem nenhum dia vazio nos últimos 7.
- [ ] Cada execução valida o dump com pg_restore --list e publica artefato cifrado; quem não tem a senha não consegue ler o arquivo baixado.
- [ ] ensaiar-restauracao.yml restaura o último artefato e as contagens batem com as de produção no momento do dump (em 13/10: 96 jogos, 2.689 eventos, 7 acessos).
- [ ] O dump não carrega dados de edition_action_receipts e inclui o tar do volume intereng_minio_data.

**Onde mexer.** API: `.github/workflows/backup.yml (novo, schedule */30, runs-on: self-hosted)`, `.github/workflows/ensaiar-restauracao.yml (novo, workflow_dispatch)`, `scripts/backup.sh (novo, extraído do passo B3 do cd.yml e usado pelos dois workflows)`, `.github/workflows/cd.yml (chamar scripts/backup.sh no lugar do passo inline)`, `secret BACKUP_PASSPHRASE`.

**Depende de:** nada. **Risco:** Disco da VM pode encher com dumps a cada 30 min. Mitigação: excluir os recibos, reter só 48 arquivos e alertar pela idade e falha do backup (ADM-I07).

<sub>Achados: APIINFRA-03, SCRIPTS-R3</sub>

### ADM-I02 · Redefinir senha pelo Staff e login que diz a verdade

Onda 1 sugerida · feature · esforço M · ~4 dia(s) · cobre 7 achado(s), 5 crítico(s)/alto(s)

**Problema.** 'Esqueci a senha' responde 'Solicitação registrada' e não chama nada; a API só troca senha de quem sabe a atual. Recuperar acesso exige workflow que grava hash direto no banco — o único super admin ficou trancado em 25/08. Senha certa sem papel ativo vira 'E-mail ou senha inválidos'.

**Solução.** Nova ação staff/resetPassword {email, temporaryPassword}: grava o hash, liga mustChangePassword, define validade de 72 h (Staff.temporaryPasswordExpiresAt) e revoga todas as sessões. Regra em authorize(): super admin redefine qualquer conta, menos a própria; admin da edição só quem tem papel de gestor ou responsável nesta edição e nenhum papel de admin. A senha é gerada no aparelho e não entra na auditoria: a API ignora before e after nessa ação. No login, senha certa com provisória vencida ou sem papel ativo responde 403 com frase própria, que a tela mostra. 'Esqueci a senha' passa a ser só uma instrução. A troca obrigatória ganha a dica dos 12 caracteres, mostrar senha e Sair.

**Tela alvo.** Staff › cartão de Bruno › 'Ações' › 'Redefinir senha'. Diálogo: 'A senha atual de Bruno deixa de valer e ele sai de todos os aparelhos.' Botão 'Redefinir'. Em seguida, cartão 'Senha provisória de Bruno': e-mail, senha em letra grande (ex.: halt-7Kq9-xP4m), 'vale até 18/10 14:30', botões 'Compartilhar' e 'Copiar mensagem'. No login, 'Esqueci a senha' abre: 'Peça a um admin da edição para redefinir sua senha em Staff.'

**Critérios de aceite**

- [ ] Admin da edição redefine a senha de um gestor em 4 toques a partir de Staff, sem workflow. A senha antiga passa a ser recusada e o gestor cai na próxima renovação (até 15 min).
- [ ] Spec da API: admin da edição recebe 403 ao redefinir outro admin, um super admin ou a si mesmo; super admin redefine qualquer outra conta.
- [ ] Login com senha provisória vencida, ou sem papel na edição ativa, mostra a frase da API e nunca 'E-mail ou senha inválidos'.
- [ ] 'Esqueci a senha' não exibe mais 'Solicitação registrada' nem pede e-mail.
- [ ] Na troca obrigatória, 'mínimo de 12 caracteres' aparece antes de digitar, os 3 campos têm 'mostrar senha' e existe o botão Sair.
- [ ] Nenhuma linha de audit_logs de staff/resetPassword contém senha (spec: beforeData e afterData nulos).

**Onde mexer.** Front: `app/login/page.tsx (diálogo de recuperação vira instrução)`, `lib/repositories/http-auth-adapter.ts (403 do login mostra a mensagem da API)`, `components/PasswordChangeForm.tsx (dica, mostrar senha, Sair na troca obrigatória)`, `components/TemporaryPasswordCard.tsx (novo: senha, validade, Compartilhar, Copiar)`, `lib/temporary-password.ts (novo: gerador com crypto.getRandomValues, sem caracteres ambíguos)`, `app/staff/page.tsx (item 'Redefinir senha' no cartão)`, `lib/repositories/actions.ts e reducer.ts (tipo staff/resetPassword e modo local)`. API: `migração: Staff.temporaryPasswordExpiresAt DateTime?`, `edition-actions.types.ts: 'staff/resetPassword'`, `handlers/context-action.handler.ts: staffResetPassword (hash, mustChangePassword, validade 72 h, refreshSessions.revokeAllForStaff)`, `edition-actions.service.ts: authorizeStaffReset em authorize(); before/after descartados nessa ação`, `auth/auth.service.ts: login recusa provisória vencida e conta sem papel ativo com 403 e frase própria`, `specs: redefinir-senha.spec.ts e auth.service.spec.ts`.

**Depende de:** DS: cor de erro e de perigo (.form-error legível sobre o cartão). **Risco:** Um admin com conta comprometida poderia redefinir gestores e entrar no lugar deles. Mitigação: auditoria nominal, revogação de sessões e exclusão de admins da regra.

<sub>Achados: ADMIN-02, APIINFRA-02, SCRIPTS-08, DOCS-03, NAV-13, ADMIN-03, APIINFRA-R4</sub>

### ADM-I03 · Convite com senha provisória individual e cartão 'Acesso criado'

Onda 1 sugerida · feature · esforço P · ~2.5 dia(s) · cobre 5 achado(s), 3 crítico(s)/alto(s)

**Problema.** 'Conceder acesso' volta para a lista sem dizer como a pessoa entra. A conta nasce com STAFF_INVITE_PASSWORD, igual para todos, sem prazo e guardada num secret. Quem convida não a conhece; quem a conhece entra antes do dono. Em conta existente, a senha digitada é descartada em silêncio.

**Solução.** 'Novo acesso' passa a gerar a senha provisória no aparelho (gerador de ADM-I02) e a enviá-la em initialPassword, que a API já aceita. Ao concluir, a tela mostra o cartão 'Acesso criado' com endereço de login, e-mail, senha e validade. A API passa a exigir initialPassword para conta nova (staff/upsert e staff/promoteSuperAdmin). Para conta existente, recusa initialPassword com a frase 'Esta pessoa já tem conta e entra com a senha que já usa'; a tela reenvia sem senha e mostra o aviso, com atalho para Redefinir senha. STAFF_INVITE_PASSWORD sai de env.ts, do ConfigService e do secret DOTENV_FILE, e o comentário 'intereng2026' de consultar-conta-staff.yml é apagado.

**Tela alvo.** Staff › '+ Membro': Nome, E-mail, Papel, Modalidade e o botão 'Conceder acesso'. Depois, a tela 'ACESSO CRIADO': 'Envie para Carla por mensagem direta' e um bloco com 'incinera.cin.ufpe.br/copahalterada/login · carla@ufpe.br · senha halt-7Kq9-xP4m · vale até 18/10'. Botões 'Compartilhar' (grande) e 'Copiar mensagem', e o link 'Voltar ao Staff'. Se a pessoa já tem conta: 'Carla já tem conta e entra com a senha dela. Esqueceu? Redefinir senha'.

**Critérios de aceite**

- [ ] Conceder acesso a um gestor termina no cartão com endereço, e-mail e senha em até 6 toques.
- [ ] Spec: staff/upsert de conta nova sem initialPassword responde 400; nenhuma conta nova nasce com senha compartilhada.
- [ ] Convidar e-mail que já tem conta cria só o papel, mostra o aviso de conta existente e mantém a senha antiga válida (spec).
- [ ] A API sobe em produção sem STAFF_INVITE_PASSWORD, e a variável sai do secret DOTENV_FILE.
- [ ] A senha só aparece no cartão: não fica no localStorage, na auditoria nem na URL.
- [ ] Senha provisória não usada em 72 h é recusada no login com a frase de ADM-I02.

**Onde mexer.** Front: `components/StaffAccessForm.tsx (gera senha, envia initialPassword, abre o cartão, trata conta existente)`, `components/TemporaryPasswordCard.tsx (variante 'Acesso criado', reuso de ADM-I02)`, `lib/repositories/actions.ts (initialPassword no tipo de staff/upsert e staff/promoteSuperAdmin)`. API: `handlers/context-action.handler.ts: staffUpsert exige initialPassword em conta nova e recusa em conta existente; promoteSuperAdmin aceita initialPassword`, `common/config/env.ts e config.service.ts: remover staffInvitePassword`, `edition-actions.service.ts: staff/upsert não grava before/after com senha`, `.github/workflows/consultar-conta-staff.yml: apagar o comentário com a senha antiga`, `spec: context-action.handler.spec.ts (conta nova, conta existente, sem initialPassword)`.

**Depende de:** ADM-I02. **Risco:** A senha enviada por mensagem fica no histórico da conversa. A troca obrigatória no primeiro acesso e a validade de 72 h limitam a janela.

<sub>Achados: ADMIN-04, APIINFRA-R3, APIINFRA-12, JATL-R4, DOCS-03</sub>

### ADM-I04 · Staff por pessoa: papéis, estado de acesso e ações visíveis

Onda 1 sugerida · reorganização de UX · esforço M · ~4 dia(s) · cobre 5 achado(s), 1 crítico(s)/alto(s)

**Problema.** Cada papel vira um cartão. 'Excluir' apaga todos os papéis da pessoa, e o segundo papel exige novo convite. Revogar e Excluir têm contraste 1,00 e ficam invisíveis no celular. A API deixa um admin excluir outro admin. Ninguém sabe quem já entrou, e conceder super admin não tem tela.

**Solução.** O snapshot de staff ganha staffId, mustChangePassword e lastSeenAt (maior createdAt de refresh_sessions, renovada a cada ~15 min com o app aberto; sem migração). A tela agrupa por pessoa: um cartão com etiquetas de papel e uma linha de estado. As ações ficam num botão 'Ações', com texto: Adicionar papel (formulário com nome e e-mail travados), Redefinir senha (ADM-I02), Revogar este papel e Excluir da edição. staff/remove passa a aceitar roleAssignmentId e, em authorize(), segue a regra de staff/upsert: admin da edição só remove gestor e responsável. O super admin ganha a seção 'Acesso global', com a lista que a API já envia (o front para de zerá-la), o botão 'Conceder acesso global' e um aviso quando houver uma conta só.

**Tela alvo.** Staff: '+ Membro' no topo. Uma pessoa por cartão: nome, e-mail, etiquetas 'Gestor · Vôlei' e 'Gestor · Futsal', e a linha 'Ainda não entrou', 'Senha provisória pendente' ou 'Último acesso 12/10 14:31'. O botão 'Ações' (44 px) abre: Adicionar papel, Redefinir senha, Revogar papel… e Excluir da edição. Confirmação: 'Bruno perde o acesso de Futsal agora.' Para o super admin, no fim da lista: 'Acesso global (1) · Conceder acesso global' e o aviso 'Só uma conta tem acesso global'.

**Critérios de aceite**

- [ ] Com os 7 acessos de produção, Staff mostra 7 cartões, e cada um diz 'Ainda não entrou', 'Senha provisória pendente' ou 'Último acesso DD/MM HH:MM'.
- [ ] No celular, Revogar, Excluir e Redefinir aparecem com texto, contraste de pelo menos 4,5:1 e alvo de pelo menos 44 px, sem depender de hover.
- [ ] Excluir o papel de Futsal de quem também gere Vôlei mantém o Vôlei (spec de staff/remove com roleAssignmentId); dar a segunda modalidade não pede para redigitar o nome.
- [ ] Spec em exclusao-de-staff.spec.ts: admin da edição que tenta remover outro admin recebe 403.
- [ ] O super admin concede acesso global pela tela; com uma só conta global, a seção mostra o aviso.

**Onde mexer.** Front: `app/staff/page.tsx (agrupar por pessoa, linha de estado, seção Acesso global)`, `components/StaffActionsMenu.tsx (novo: ações com texto)`, `components/StaffAccessForm.tsx (modo 'Adicionar papel' com nome e e-mail travados)`, `lib/repositories/http-adapter.ts (parar de zerar superAdmins em normalizeSnapshot)`, `app/staff/promote/page.tsx (apagar a rota; a seção passa a viver em Staff)`, `lib/repositories/actions.ts (staff/remove com roleAssignmentId)`. API: `edition-snapshots/snapshot.mapper.ts loadStaff: staffId, mustChangePassword, lastSeenAt`, `edition-snapshots/dto/frontend-snapshot.dto.ts: StaffSnapshotDto`, `handlers/context-action.handler.ts staffRemove: roleAssignmentId opcional (remove um papel só)`, `edition-actions.service.ts authorize(): staff/remove com a mesma regra de staff/upsert`, `spec: exclusao-de-staff.spec.ts (admin contra admin; remover um papel)`.

**Depende de:** ADM-I02; ATL: papel Responsável da atlética mapeado em loadStaff (mesma função); DS: botão de perigo e menu de ações. **Risco:** 'Último acesso' é a última renovação de sessão, não o último toque; basta para responder 'já entrou?' antes do evento.

<sub>Achados: ADMIN-05, ADMIN-12, ADMIN-13, ADMIN-11, APIINFRA-08</sub>

### ADM-I05 · Perfil honesto: meus acessos, sem alerta falso, sair só daqui

Onda 1 sugerida · correção · esforço P · ~1.5 dia(s) · cobre 5 achado(s), 0 crítico(s)/alto(s)

**Problema.** O perfil pede permissão de notificação para 'alertas de jogos e convites' que nada envia. Rotula super admin e responsável como 'Admin da edição' e mostra um papel só. Sair num aparelho revoga todas as sessões da conta, e quem divide o login entre mesas é expulso.

**Solução.** Remover a seção Notificações, a chamada a Notification.requestPermission e o padrão notifications: true. O commit f88d309 não é reaplicado. 'Meus acessos' lista cada item de session.editionRoles, que o login já devolve, com o rótulo certo: Super admin, Admin da edição 2026, Gestor de Vôlei, Responsável da Furiosa. Na API, logout revoga só a sessão do cookie recebido, e a nova rota POST /auth/logout-all (com JwtAuthGuard) chama revokeAllForStaff. No perfil ficam 'Sair deste aparelho' e, abaixo, 'Sair de todos os aparelhos', com confirmação.

**Tela alvo.** Perfil: nome e e-mail. Bloco 'Meus acessos' com uma linha por papel ('Gestor de Vôlei · Copa Halterada 2026'). Bloco 'Senha' com Trocar senha. No fim, o botão 'Sair deste aparelho' e o link 'Sair de todos os aparelhos', que confirma 'Encerra a sessão em todos os celulares e computadores desta conta'.

**Critérios de aceite**

- [ ] Nenhuma tela chama Notification.requestPermission, e o texto 'a entrega push será ativada' sai do app.
- [ ] Quem gere Vôlei e Futsal vê dois itens em Meus acessos; o super admin vê 'Super admin', não 'Admin da edição'.
- [ ] Teste de API com duas sessões da mesma conta: logout numa mantém a outra renovando, e logout-all derruba as duas.

**Onde mexer.** Front: `app/profile/page.tsx (meus acessos, sem notificações, dois botões de sair)`, `lib/frontend-state.ts e lib/repositories/device-preferences.ts (remover a preferência notifications)`, `lib/repositories/http-auth-adapter.ts (signOutEverywhere)`, `lib/frontend-session.ts (função única de rótulo de papel)`. API: `auth/services/refresh-sessions.service.ts: revoke() revoga só a sessão do token`, `auth/auth.controller.ts: POST /auth/logout-all`, `spec: refresh-sessions.service.spec.ts (duas sessões)`.

**Depende de:** SYNC: tolerância de 60 s na rotação do refresh (queda por rede fraca); ATL: rótulo 'Responsável da {equipe}' depende do papel chegar na sessão. **Risco:** Contas compartilhadas continuam possíveis. O ganho é não derrubar a mesa vizinha; o incentivo certo é um acesso por pessoa (ADM-I03).

<sub>Achados: ADMIN-14, PWA-12, DOCS-12, NAV-13, APIINFRA-06</sub>

### ADM-I06 · Fechar os resíduos de segurança da auditoria de agosto

Onda 1 sugerida · infra · esforço M · ~3 dia(s) · cobre 5 achado(s), 0 crítico(s)/alto(s)

**Problema.** Dos 8 bloqueadores de agosto sobram resíduos: leituras REST antigas públicas (categorias em Rascunho vazam), rotas test-* em produção, senhas padrão no compose, auditoria antiga talvez com hash, scripts apontando para produção por padrão e TRUSTED_PROXY_HOPS nunca conferido — o teto de 40 conexões por IP pode valer para todo o público.

**Solução.** API: apagar as rotas test-* de app.controller.ts. Estender legacy-mutation.guard.ts para responder 410 também aos GETs antigos, com lista permitida: health, auth, snapshot, módulo public, stream, actions, GET /teams, logo-upload-url e bootstrap, conferida contra front, MCP e scripts. /health devolve o IP que a API enxergou, para conferir TRUSTED_PROXY_HOPS com dois celulares (há dois proxies: borda e gateway). O compose deixa de ter senha padrão de Postgres e Redis, depois de conferir pelo diagnostico.yml que elas estão no .env. censo-dados.yml conta linhas de audit_logs com passwordHash, e uma migração anula esses campos se houver. Front: scripts e MCP sem URL padrão de produção; página /public/privacidade.

**Tela alvo.** Única tela nova: /public/privacidade, em texto curto. Diz o que o app guarda (nome e e-mail do staff, nome e equipe do atleta, quem alterou o quê), para quê, por quanto tempo e o e-mail da organização para pedir correção ou exclusão. Link no rodapé público.

**Critérios de aceite**

- [ ] test-request-context e as demais rotas test-* respondem 404; GET /editions/:id/tournaments sem sessão responde 410; front, MCP e importadores seguem funcionando (e2e-http).
- [ ] Dois celulares em redes diferentes veem IPs diferentes em /health, e o valor de TRUSTED_PROXY_HOPS fica registrado em docs/OPERACAO.md.
- [ ] docker compose up sem POSTGRES_PASSWORD ou REDIS_PASSWORD falha; produção sobe com os valores do secret, sem queda.
- [ ] O censo informa 0 linhas de audit_logs contendo 'passwordHash', ou a migração as zera.
- [ ] importar-copa.mjs, importar-chaveamento.mjs, importar-dados.mjs e mcp-intereng.mjs recusam rodar sem --api ou INTERENG_API explícitos.
- [ ] /public/privacidade publicada, com o contato da organização.

**Onde mexer.** Front: `scripts/importar-copa.mjs, importar-chaveamento.mjs, importar-dados.mjs e mcp-intereng.mjs (sem URL padrão de produção)`, `app/public/privacidade/page.tsx (novo)`. API: `app.controller.ts e app.controller.spec.ts (apagar rotas test-*)`, `common/guards/legacy-mutation.guard.ts (GETs antigos com lista permitida)`, `app.service.ts (/health com clientIp via resolveClientIp)`, `docker-compose.yml (${POSTGRES_PASSWORD:?} e ${REDIS_PASSWORD:?}; ALTER ROLE por workflow, se a senha atual for a padrão)`, `.github/workflows/censo-dados.yml (contagem de audit_logs com passwordHash)`, `migração condicional: anular beforeData/afterData de staff/* com passwordHash`.

**Depende de:** ADM-I01; PUB: link do rodapé público para /public/privacidade; QA: teste de contrato que lista as rotas que o front usa. **Risco:** Num Postgres já inicializado, trocar a senha exige ALTER ROLE antes de mudar o compose; errar derruba a API. Fazer por workflow, logo após um backup de ADM-I01.

<sub>Achados: APIINFRA-14, APIDOM-14, PWA-R3, SCRIPTS-10, APIINFRA-13</sub>

### ADM-I07 · Alerta de queda e de backup atrasado, e pendências da VM fechadas

Onda 1 sugerida · infra · esforço M · ~3 dia(s) · cobre 4 achado(s), 0 crítico(s)/alto(s)

**Problema.** Ninguém é avisado quando o site ou a API caem: a saúde só é testada no deploy, por dentro do container, e os logs não têm rotação nem LOG_LEVEL. Um jogo ficou 'Ao vivo' por mais de um dia sem alerta. O upload de escudo segue sem a rota /intereng-storage no gateway (api#11, aberta desde 19/08).

**Solução.** monitor-producao.yml roda em runner hospedado do GitHub, fora da VM, a cada 10 min. Testa /copahalterada/public, /intereng-api/api/v1/health e a idade do último backup. Falha abre ou atualiza a issue 'Produção fora do ar', que o GitHub avisa por e-mail, e manda mensagem ao canal que a organização escolher; a volta ao normal fecha a issue. /health passa a informar o commit (GIT_SHA no build) e a hora do último backup (pasta de dumps montada só para leitura). O compose ganha rotação de log, e a API passa a ler LOG_LEVEL. O location /intereng-storage/ entra por PR no incinera-gateway, aplicado por recarregar-gateway.yml, com registro em docs/OPERACAO.md.

**Critérios de aceite**

- [ ] Derrubar a API num ensaio abre a issue 'Produção fora do ar' em até 10 min, e ela fecha sozinha em até 10 min depois da volta.
- [ ] Backup com mais de 2 h em dia de evento, ou mais de 26 h fora dele, também abre a issue.
- [ ] GET /health devolve o commit em produção e lastBackupAt.
- [ ] Os logs do container intereng-api ficam limitados a 5 arquivos de 10 MB, e LOG_LEVEL=info é respeitado.
- [ ] /intereng-storage/ responde pelo MinIO (não 404), o envio de escudo pela tela funciona, e as issues api#11 e api#12 fecham com registro em docs/OPERACAO.md.

**Onde mexer.** Front: `docs/OPERACAO.md (plantão: monitor, backup, restauração, redefinição de último recurso; a pasta docs é mantida por QA)`. API: `.github/workflows/monitor-producao.yml (novo, runs-on: ubuntu-latest, cron */10)`, `app.service.ts e app.controller.ts (/health com version e lastBackupAt)`, `Dockerfile e .github/workflows/cd.yml (GIT_SHA como build arg)`, `docker-compose.yml (logging json-file 10m x 5; $HOME/intereng-backups montado :ro na api)`, `common/logger/logger.config.ts (ler LOG_LEVEL)`, `incinera-gateway: nginx/conf.d/incinera.conf (location /intereng-storage/)`.

**Depende de:** ADM-I01; QA: healthcheck no compose, deploy seguro e runner único; SYNC: desligar o buffering de /stream no mesmo PR do incinera-gateway. **Risco:** Issue no GitHub só avisa quem acompanha o repositório. Sem um canal da organização, o alerta chega ao desenvolvedor e a mais ninguém.

<sub>Achados: APIINFRA-10, DOCS-10, APIINFRA-11, APIINFRA-08</sub>

### ADM-I08 · Encerrar e reabrir a edição pelo admin, com pendências e trava

Onda 2 sugerida · feature · esforço M · ~4 dia(s) · cobre 3 achado(s), 1 crítico(s)/alto(s)

**Problema.** A situação da edição é um rótulo que só o super admin muda e que nada lê. A Copa acabou em 12/10, mas em 13/10 a edição seguia 'Em andamento', com 1 jogo Ao vivo e 40 Agendada vencidos. ranking/close não confere jogo pendente, e nada impede alterar resultado depois do fim.

**Solução.** Novas ações edition/close {id, reason?} e edition/reopen {id, reason}, para admin da edição e super admin. close recusa, com a lista, enquanto houver jogo Ao vivo, Agendada ou Adiada; categoria não encerrada e ranking não fechado viram avisos que exigem motivo. Grava status FINISHED, closedAt e closedById (migração). Com a edição encerrada, execute() recusa match/*, category/*, team/*, athlete/*, discipline/* e ranking/* (menos ranking/reopen) com 'Edição encerrada em 13/10. Reabra para alterar.' O primeiro match/start passa a edição de PLANNING para ONGOING. A tela calcula a lista a partir do snapshot, e o servidor confere de novo.

**Tela alvo.** Gestão › Edição 2026: selo 'Em andamento · 09 a 12/10'. Bloco 'Para encerrar': '1 jogo ao vivo — Mafiosa × Furiosa › Resolver', '40 jogos sem desfecho › Ver na agenda', e os avisos '3 categorias abertas' e 'Classificação geral não fechada'. O botão 'Encerrar edição' fica bloqueado até zerar os jogos; com avisos, pede motivo. Depois: 'Encerrada em 14/10 por Ana' e o botão 'Reabrir edição'.

**Critérios de aceite**

- [ ] Depois de o saneamento resolver os 41 jogos sem desfecho, o admin da edição encerra a 2026 pela tela, sem super admin.
- [ ] Spec: edition/close com jogo Ao vivo ou Agendada responde 409 com a lista; só com avisos e sem motivo, 409; com motivo, encerra.
- [ ] Com a edição encerrada, match/registerEvent, match/correctResult e category/update respondem 409 com a frase de reabrir (spec); reabrir exige motivo e aparece na auditoria.
- [ ] O primeiro match/start de uma edição em Planejamento a põe Em andamento, e o seletor 'Rótulo no histórico' sai da tela.

**Onde mexer.** Front: `app/competitions/page.tsx (vira 'Edição': situação, encerrar, reabrir; sai o seletor de rótulo)`, `components/EditionClosePanel.tsx (novo: pendências calculadas do snapshot, cada uma com link)`, `lib/repositories/actions.ts e reducer.ts (edition/close, edition/reopen)`, `lib/frontend-session.ts (canCloseEdition para admin da edição)`. API: `migração: CompetitionEdition.closedAt e closedById`, `edition-actions.types.ts: edition/close e edition/reopen (fora de GLOBAL_ACTIONS)`, `handlers/context-action.handler.ts: editionClose e editionReopen, com contagem de pendências`, `edition-actions.service.ts execute(): recusar ações de dado com a edição FINISHED`, `handlers/match-action.handler.ts start(): PLANNING → ONGOING`, `spec: encerrar-edicao.spec.ts`.

**Depende de:** SAN: desfecho dos 41 jogos de outubro antes de encerrar a 2026; MESA: lançar resultado, W.O. e anular início, para resolver pendências; AGD: cancelar e adiar jogo; EST: status e pódio da categoria; NAV: entrada 'Edição' em Gestão e pendências no painel Agora. **Risco:** A trava pós-encerramento pode barrar uma correção legítima tardia; reabrir com motivo resolve em dois toques e deixa rastro.

<sub>Achados: ADMIN-08, JORG-08, APIDOM-06</sub>

### ADM-I09 · Auditoria legível para o admin: sem lances, paginada e filtrável

Onda 2 sugerida · feature · esforço G · ~6 dia(s) · cobre 10 achado(s), 3 crítico(s)/alto(s)

**Problema.** Toda ação vira linha, inclusive cada ponto e o batimento da trava a cada 15 s. O snapshot leva só as 100 últimas (cerca de 5 min de vôlei), com 'match/registerEvent · Match <id>', hora sem data e o filtro Partidas sempre vazio. Só o super admin abre a tela, e os lances não guardam autor.

**Solução.** Migração: audit_logs ganha summary e entityLabel, o rótulo e a entidade que o front já envia e hoje são descartados; match_events ganha createdById, gravado em registerEvent. Com o autor no lance, registerEvent, updateClock, claimOperator e releaseOperator deixam de gerar auditoria. Novo GET /editions/:id/audit, paginado por cursor, com filtros de tipo (Resultados, Agenda, Estrutura, Acessos), pessoa, partida e dia, para super admin e admin da edição; a retificação usa o antes e depois de MatchCorrection, gravados pelo servidor. O snapshot privado deixa de carregar auditoria. A tela /audit abre ao admin, agrupada por dia, com busca, 'Carregar mais', CSV do filtro e atalho 'Histórico deste jogo'.

**Tela alvo.** Gestão › Auditoria: chips Resultados, Agenda, Estrutura, Acessos e Tudo, e busca por pessoa ou jogo. Lista agrupada por dia ('Seg, 12 out'): '10:44 · Ana Souza · Retificou resultado · Furiosa × Mafiosa (Vôlei) · 0×3 → 0×2 · Motivo: Correção'. 'Baixar CSV' no topo e 'Carregar mais' no fim. Na gestão da partida, o link 'Histórico deste jogo' abre a lista já filtrada.

**Critérios de aceite**

- [ ] O admin da edição abre a Auditoria; o gestor vê a tela de acesso restrito, com frase clara e botão para o Início.
- [ ] Um jogo de vôlei inteiro gera no máximo 3 linhas (iniciar, encerrar e, se houver, retificar), não ~90; o batimento da trava não gera nenhuma.
- [ ] Cada lance novo tem createdById preenchido (spec), e 'Histórico deste jogo' mostra quem iniciou, quem encerrou e quantos lances cada pessoa registrou.
- [ ] As 2 retificações de 12/10 aparecem na primeira página do filtro Resultados.
- [ ] Spec: GET /editions/:id/audit responde 403 ao gestor e pagina 50 por vez; o snapshot privado não traz mais o campo audit.
- [ ] O CSV baixado abre numa planilha com data, hora, pessoa, ação, entidade, antes, depois e motivo.

**Onde mexer.** Front: `app/audit/page.tsx (reescrita: por dia, filtros, busca, paginação, CSV)`, `lib/repositories/audit-api.ts (novo: GET paginado)`, `lib/frontend-session.ts (canReadAudit para admin da edição)`, `components/AdminRouteGuard.tsx (bloqueio com frase clara e volta ao Início)`, `components/MatchManager.tsx (link 'Histórico deste jogo')`, `lib/repositories/http-adapter.ts (estado sem audit)`. API: `migração: audit_logs.summary, audit_logs.entityLabel e match_events.createdById`, `edition-actions.service.ts: gravar summary e entityLabel; lista NOT_AUDITED de ações de mesa`, `handlers/match-action.handler.ts registerEvent: createdById`, `audit-logs/audit-logs.controller.ts (novo): GET /editions/:id/audit com escopo full`, `edition-snapshots/snapshot.mapper.ts: tirar loadAudit do snapshot privado`, `spec: audit-logs.controller.spec.ts`.

**Depende de:** MESA: startedBy a partir de startedById, e quem encerrou, no detalhe interno da partida; SYNC: batimento da trava sem incrementar a revisão; NAV: item Auditoria em Gestão. **Risco:** Linhas antigas não têm summary nem entityLabel: a tela traduz o tipo por uma tabela fixa e mostra o id. Os lances de outubro ficam sem autor.

<sub>Achados: ADMIN-06, ADMIN-07, APIINFRA-07, DADOS-13, JORG-R3, VADM-R2, VADM-14, APIDOM-13, ADMIN-R3, JORG-13</sub>

### ADM-I10 · Abrir a próxima edição a partir da anterior e ativar sem surpresa

Onda 2 sugerida · feature · esforço M · ~4 dia(s) · cobre 3 achado(s), 0 crítico(s)/alto(s)

**Problema.** edition/create só semeia as métricas: as 17 equipes entram uma a uma, o regulamento ajustado em quadra se perde e os 7 acessos precisam ser reconvidados. Ativar outra edição troca o app de todos, e quem só tinha papel em 2026 lê 'E-mail ou senha inválidos', sem aviso na confirmação.

**Solução.** edition/create passa a aceitar copyFrom {editionId, disciplines, teams, metrics, staff}. Na mesma transação, copia EditionDiscipline com config (regulamento), as EditionTeam não arquivadas, as OverallMetric e os EditionStaffRole não revogados, remapeando a modalidade do gestor pela disciplineId. Não copia categorias, jogos, resultados, atletas nem elencos. O formulário 'Nova edição' tem caixas marcadas, por pessoa no caso do staff, e mostra um resumo antes de criar. A confirmação de ativar mostra quem perde acesso (papéis da edição atual sem papel na nova) e avisa que a área pública muda de edição. Quem cria e ativa segue a decisão do dono (pergunta 2); o padrão é o super admin.

**Tela alvo.** Gestão › Edição › 'Nova edição': Ano 2027, Início e Fim. 'Começar a partir de: Edição 2026', com caixas marcadas: 'Modalidades e regulamentos (6)', 'Equipes (17)', 'Métricas da classificação geral' e 'Acessos do staff (7)', esta com uma caixa por pessoa. Resumo: 'Jogos, categorias e resultados não são copiados.' Botão 'Criar edição'. Ao ativar: 'A área pública passa a mostrar 2027. 2 pessoas sem papel em 2027 deixam de entrar: Bruno, Carla.'

**Critérios de aceite**

- [ ] Spec: criar 2027 a partir de 2026 traz, numa ação só, 6 modalidades com o mesmo regulamento, 17 equipes, as métricas e os 7 acessos.
- [ ] Spec: nenhuma categoria, jogo, resultado ou atleta é copiado.
- [ ] e2e-http: depois de ativar 2027, os gestores copiados entram e operam a própria modalidade.
- [ ] A confirmação de ativar lista pelo nome quem perde acesso e avisa que a área pública muda de edição.

**Onde mexer.** Front: `app/competitions/page.tsx (formulário de nova edição com caixas e resumo; diálogo de ativação com o impacto)`, `lib/repositories/actions.ts (copyFrom em edition/create)`. API: `handlers/context-action.handler.ts editionCreate: copyFrom na mesma transação`, `spec: nova-edicao-a-partir.spec.ts`.

**Depende de:** ADM-I08 (a ativação avisa se a edição atual não foi encerrada); ADM-I02 (frase de login para conta sem papel ativo); PUB: arquivo da edição anterior na área pública; EST: duplicar categoria (fica fora desta cópia). **Risco:** Copiar o staff pode reativar quem saiu da organização. Mitigação: caixa por pessoa e resumo com os nomes antes de criar.

<sub>Achados: ADMIN-10, JORG-14, ADMIN-09</sub>

**Fora de escopo, de propósito**

- Recuperação de senha por e-mail: exige serviço SMTP, domínio remetente e modelos de mensagem. Para 7 a 15 contas, a redefinição pelo admin (ADM-I02) resolve com menos peças.
- Convite por link ou QR de uso único: pede tabela de convites, rota pública e tela de definir senha. A senha provisória individual com validade de 72 h e troca obrigatória cobre o mesmo risco.
- Notificações push para staff ou espectador: não existe nenhuma peça de envio, e no iPhone só chega com o app instalado. Esta trilha só remove a promessa falsa (ADM-I05).
- Papel Mesário e acesso por código de mesa sem conta: só se a organização confirmar mesários voluntários (pergunta 4). Até lá, vale o gestor de modalidade com auditoria por pessoa.
- Tela 'Sistema' completa (censo, disco, conexões SSE) e telemetria de uso e erro: o /health ampliado e o monitor externo cobrem o que alguém de fato lê; telemetria é de SYNC.
- Relatório e exportação pós-evento (resultados, classificações, PDF) são de IMP; aqui entra só o CSV da auditoria.

**Perguntas para a organização**

- Um admin da edição pode redefinir a senha de outro admin da mesma edição, ou isso fica só com o super admin? O padrão proposto é só o super admin.
- Quem abre e ativa a próxima edição: o admin da edição, ou continua com o super admin (hoje, o desenvolvedor)? E quem da organização será o segundo super admin, para podermos tirar BOOTSTRAP_SUPER_ADMIN_* do secret?
- Para onde vai o alerta de queda e de backup atrasado: só para a issue no GitHub (e-mail a quem acompanha o repositório) ou também para um grupo da organização no Telegram, o que exige criar um bot?
- Haverá mesários voluntários, sem poder de gestão, no próximo evento? Se sim, criamos o papel Mesário (só opera o placar); se não, segue o gestor de modalidade.


## DS — Sistema visual e acessibilidade

**Objetivo.** Um sistema visual de três cores em que perigo, erro, estado do jogo e placar se leem de relance no celular, mesmo sob sol: tokens e componentes únicos, alvo de 44px, texto de 12px ou mais, um dia de 47 jogos em até 4 telas e o CSS fatiado com rede de captura no CI.

**Princípios**

- Só três cores (azul, verde e branco). O significado vem de forma, ícone e palavra, nunca só da cor: perigo é contorno branco com ícone e verbo; ao vivo é verde cheio; encerrado é só texto.
- Verde cheio fica para duas coisas: a ação principal da tela e o AO VIVO. Branco cheio só aparece na confirmação destrutiva. Texto branco sobre verde é proibido (1,39:1).
- Mínimos para todas as telas: alvo de 44px (56px na mesa), rótulo de 12px, dado de 14px, campo de 16px, contorno com 3:1 e texto com 4,5:1. Quando falta largura, a linha quebra ou o texto é abreviado; a fonte nunca encolhe.
- Densidade antes de decoração. Listas usam linha compacta, e o cartão grande fica só para o jogo ao vivo em destaque. Nada se repete: nem a categoria dentro da própria categoria, nem o local 'A definir'.
- Um componente para cada dado. Placar, selo, campo, botão e cabeçalho têm uma única implementação React, e nenhuma tela reestiliza esses componentes por tema.
- Toda mudança de CSS passa pela captura. Uma refatoração tem de dar 0 pixel de diferença; uma mudança intencional lista no PR as telas afetadas.

**Desenho alvo**

TOKENS (app/styles/tokens.css, só azul, verde e branco). Primitivos: --navy #0A105A, --lime #8CE303, --paper #EFEFEE. Superfícies: --bg (navy), --surface #1C2266, --surface-sunken #080E4A. Texto: --text (paper, 14,8:1), --text-2 (paper 72%, 8:1), --text-3 (paper 60%, 5,4:1 ou mais; substitui os alfas até .5 e o creme antigo). Linhas: --border (paper 45%, 3,6:1 ou mais) e --border-strong (lime). Ação: --accent (lime) e --on-accent (navy). Perigo e erro: --danger (paper) e --on-danger (navy); se o dono aprovar uma cor de erro, o valor muda em uma linha. Foco: --focus (lime), anel interno de 3px. Medidas: --tap 44px, --tap-lg 56px (mesa), --gutter 16px, --cut 10px. Tamanhos de fonte em rem: --fs-12, 14, 16, 18, 22, 28, 40 e 64. Aldo só de 18 para cima, em títulos, placar e nomes; hora, relógio e parciais em Outfit com algarismos tabulares. Espaços: --sp-1 a --sp-6 (4, 8, 12, 16, 24, 32). Camadas: --z-sticky, --z-nav, --z-sheet, --z-dialog e --z-toast.

COMPONENTES BASE (app/components/ui, com CSS em app/styles/components):
- I01: Button (primary, secondary, danger e danger-confirm, com ícone e rótulo, de 44 ou 56px) e Notice, FieldError e Toast.
- I02: StatusBadge de partida (live, finished, wo, postponed e cancelled, com late e stale prontos para AGD e SYNC) e Scoreline.
- I04: MatchRow (linha de 60 a 72px com encaixe de ação). MatchCard fica só para o destaque ao vivo.
- I06: Chip e Tabs de 44px.
- I07: Field, FormSection e ActionBar.
- I08: PageHeader.
- I10: DataTable.
A página /styleguide (só em modo local) mostra todos os componentes em todos os estados.

ORDEM SEGURA PARA FATIAR O CSS:
1. Capturas Linux no CI (cerca de 45 rotas em 412 e 1280px, mais /styleguide, tolerância de 0,2%) e auditoria com catraca (I03).
2. Tokens como apelidos dos valores atuais: 0 pixel de diferença.
3. Codemod que troca os apelidos que mentem: 0 pixel.
4. Piso de toque, texto e contorno: mudança intencional, revisada tela a tela (I06).
5. Apagar as classes mortas: 0 pixel.
6. Achatar os seletores .theme-*: 0 pixel.
7. Dividir o globals.css por faixas contíguas, na mesma ordem, com @import no topo: o CSS compilado tem de sair idêntico.
8. Mover cada regra para o arquivo do seu componente e adotar @layer base, components, screens, narrow numa troca única (I09).
A partir do passo 1, nenhum CSS novo entra no globals.css.

### DS-I01 · Perigo e erro visíveis dentro das três cores da marca

Onda 0 sugerida · correção · esforço P · ~2 dia(s) · cobre 6 achado(s), 6 crítico(s)/alto(s)

**Problema.** --pink, usado como cor de erro e perigo em cerca de 22 regras, vale a cor do cartão. Desativar, Excluir, Excluir categoria, Revogar e Remover da equipe ficam entre 1,00 e 1,19:1. Erros de senha e de convite somem. 'Sem conexão' sai verde como 'Ao vivo' e, no celular, sem texto.

**Solução.** Criar --danger (branco #EFEFEE), --danger-line e --on-danger (azul) e trocar só os usos semânticos de --pink: texto, borda, erro, diálogo, toast e banner offline. Os usos decorativos ficam para DS-I06. Perigo se distingue pela forma: contorno branco de 2px, ícone (Trash2 ou AlertTriangle) e verbo escrito. No diálogo, a confirmação da exclusão é branca cheia com texto azul, e Cancelar fica em contorno. .form-error vira um bloco com ícone, texto de 14px e barra branca à esquerda. No Staff, três botões rotulados de 44px, e a confirmação passa a dizer 'perde o acesso imediatamente'. No selo offline, corrigir a cascata (globals.css:513 contra :1892) e manter o texto a 360px. Criar um teste de contraste para botões destrutivos e role=alert.

**Tela alvo.** Staff: cada cartão termina com três botões rotulados de 44px — 'Papel' com contorno verde, 'Revogar' e 'Excluir' com contorno branco e ícone. Ao tocar Excluir, o diálogo mostra 'Cancelar' em contorno e 'Excluir acesso' em branco cheio com texto azul. Nos formulários, o erro aparece logo acima do botão: ícone de alerta, texto branco e barra branca à esquerda. Sem rede, o selo do topo vira 'SEM CONEXÃO' em branco cheio.

**Critérios de aceite**

- [ ] Em /disciplines/futsal, /tournaments/futsal-m/manage, /teams/alcateia e /staff, texto e borda de todo botão destrutivo medem 12:1 ou mais (hoje, de 1,00 a 1,19:1).
- [ ] Cada membro do Staff mostra 'Papel', 'Revogar' e 'Excluir' escritos, com 44px, sem precisar passar o mouse.
- [ ] Uma senha de 8 caracteres na troca obrigatória mostra a mensagem legível, com ícone. O mesmo vale em 'Novo acesso' e no acesso da atlética.
- [ ] O novo teste perigo-visivel.spec.ts falha se qualquer botão destrutivo ou role=alert dessas telas ficar abaixo de 4,5:1.
- [ ] Sem rede, a 360px, o selo diz 'SEM CONEXÃO' em texto e não tem a aparência de 'Ao vivo'. O toast de erro se distingue do de sucesso pelo ícone e pela barra.

**Onde mexer.** Front: `apps/web/app/globals.css (:root com --danger*; regras 80, 128-129, 513, 3264, 3272, 3281-3282, 3328-3331, 3603, 3608, 3669, 3709, 3761-3762, 3797-3798, 3806-3811, 3821-3822 e 4084)`, `apps/web/app/staff/page.tsx (linhas 60 e 71-73: ações com rótulo e texto da confirmação)`, `apps/web/app/components/UiProvider.tsx (diálogo destrutivo e toast)`, `apps/web/app/components/ConnectionBadge.tsx`, `apps/web/app/components/PwaRegistration.tsx (banner offline)`, `apps/web/app/components/TeamRosterManager.tsx e TeamAccessManager.tsx (remover e revogar com rótulo)`, `apps/web/tests/e2e/perigo-visivel.spec.ts (novo)`. API: `nenhuma`.

**Depende de:** nada. **Risco:** Perigo em branco depende de ícone e verbo. Um botão destrutivo novo só com ícone volta a confundir; a revisão de PR e o teste de contraste seguram isso.

<sub>Achados: CSS-01, ADMIN-R1, VADM-04, ADMIN-05, ADMIN-03, CSS-04</sub>

### DS-I02 · Placar e selo de estado únicos, sem 0 — 0 antes do jogo

Onda 0 sugerida · correção · esforço M · ~3.5 dia(s) · cobre 7 achado(s), 6 crítico(s)/alto(s)

**Problema.** A API manda 0×0 para todo jogo não iniciado, e o cartão só esconde placar nulo: os 40 jogos 'Agendada' aparecem como '0 — 0'. Seis estados viram três rótulos (Cancelada e W.O. aparecem como 'Encerrado'). No detalhe, o placar empilha na vertical. 'Ao vivo' tem três aparências e, na agenda, perde o selo.

**Solução.** Criar Scoreline: o placar aparece só com status Ao vivo, Encerrada ou W.O. (hasStarted); antes disso, aparece o horário. Os números ficam em linha, cada um numa caixa de 2 dígitos sob o seu escudo, com a coluna central automática. Abaixo, '(pên. 3–2)' ou o set atual. Criar o StatusBadge de partida com forma própria para cada estado: live (verde cheio com ponto), finished (só texto), wo (contorno), postponed (tracejado) e cancelled (contorno com ícone). As variantes late e stale já ficam prontas para AGD e SYNC. getMatchStatusLabel passa a seis rótulos. Aplicar em MatchScoreCard e MatchSummary, apagar as 12 sobrescritas de selo por tema e incorporar o PR #86 (fundo atrás do escudo).

**Tela alvo.** No cartão e no detalhe, o centro mostra o horário ('19:00') enquanto o jogo não começou. Depois, mostra '23 – 10' numa linha, cada número sob o escudo do seu lado, em Aldo branco, com '(pên. 3–2)' ou o set atual logo abaixo. O selo tem desenho fixo: AO VIVO em verde cheio com ponto, ENCERRADO só em texto, W.O. em contorno, ADIADO tracejado e CANCELADO em contorno com ícone. Tocar o cartão abre o jogo.

**Critérios de aceite**

- [ ] Com o snapshot de produção de 13/10, nenhum dos 40 jogos 'Agendada' mostra '0 — 0' na agenda, na categoria, no início ou na página do jogo: aparece o horário.
- [ ] O teste de componente cobre os seis estados com rótulos distintos: AO VIVO, ENCERRADO, W.O., ADIADO, CANCELADO e o horário.
- [ ] No detalhe do jogo a 360px, '23 – 10' aparece numa linha só, cada número sob o escudo certo (conferido por captura).
- [ ] 'AO VIVO' tem o mesmo desenho no início, na agenda, na categoria e no detalhe, e nenhuma regra de tema altera o selo de partida.
- [ ] Compressora 3×3 Furiosa mostra '(pên. 3–2)' e o vencedor em destaque.
- [ ] Teste e2e-http com um jogo 'Agendada' de placar 0 no mock.

**Onde mexer.** Front: `apps/web/app/components/ui/Scoreline.tsx (novo)`, `apps/web/app/components/ui/StatusBadge.tsx (novo; para partidas, substitui o StatusBadge de AppShell.tsx:116)`, `apps/web/app/lib/status.ts (getMatchStatusLabel, linhas 74-78, com seis estados)`, `apps/web/app/components/MatchScoreCard.tsx e MatchCard.tsx`, `apps/web/app/components/MatchSummary.tsx (placar em linha e data formatada)`, `apps/web/app/lib/edition-catalog.ts (matchView expõe tiebreak, periodResults e walkoverWinner)`, `apps/web/app/globals.css (apagar 1767-1769, 2493, 2849-2850, 2923-2924, 3028, 3042, 3074 e 3103; coluna de 36px em 2676; fundo do escudo em 2690)`, `apps/web/tests/components/scoreline.test.tsx (novo)`. API: `nenhuma: o front decide pelo status, então snapshot.mapper.ts:882 pode continuar mandando 0`.

**Depende de:** nada. **Risco:** Os testes e2e que procuram 'Próximo' e 'Encerrado' e as capturas de navigation.spec.ts precisam ser atualizados no mesmo PR.

<sub>Achados: PUBLICO-02, VPUB-R2, JESP-02, AGENDA-09, CSS-03, VPUB-03, CSS-07</sub>

### DS-I03 · Rede de captura visual no CI e auditoria automática de tela

Onda 1 sugerida · infra · esforço M · ~3.5 dia(s) · cobre 2 achado(s), 0 crítico(s)/alto(s)

**Problema.** A regressão visual cobre 4 telas públicas, as referências existem só para Windows e o CI exclui esses testes (ci.yml:134): a cobertura real é zero. Os botões destrutivos invisíveis passaram sem alarme. A tolerância de 2,5% deixa passar um dígito do placar. Sem essa rede, fatiar 4.136 linhas de CSS é trabalhar às cegas.

**Solução.** Criar o workflow manual 'atualizar-capturas', que roda o Playwright no contêiner Linux oficial e gera os -linux.png, e tirar o --grep-invert do ci.yml. Criar regressao-visual.spec.ts, que captura as cerca de 45 rotas de todas-as-telas em 412 e 1280px, com relógio fixo, e mais estes estados: mesa de futsal e de vôlei, detalhe, regras abertas, diálogo de exclusão, toast de erro, offline e troca de senha. Tolerância de 0,2%. Criar /styleguide (só em modo local), com cada componente em todos os estados, também capturada. Portar metrics() de shots.mjs para auditoria-de-tela.spec.ts, que conta por rota alvos abaixo de 44px, textos abaixo de 12px e contrastes baixos e compara com um arquivo de catraca que só pode diminuir.

**Tela alvo.** /styleguide em modo local: uma página com cada componente base (botão, selo, placar, linha de jogo, campo e aviso) em todos os estados — normal, foco, desabilitado, perigo, erro, vazio e sem conexão. No PR, o relatório do CI mostra a referência, a tela atual e a diferença de cada tela que mudou.

**Critérios de aceite**

- [ ] O CI roda a regressão visual em Linux, sem --grep-invert, sobre 45 rotas ou mais em 2 larguras, mais /styleguide.
- [ ] Três execuções seguidas sem falso positivo com tolerância de 0,2% (hoje, 2,5%).
- [ ] Apagar o texto do botão Excluir num branch de teste faz o CI falhar.
- [ ] auditoria-de-tela falha quando uma rota passa a ter mais alvos abaixo de 44px, textos abaixo de 12px ou contrastes baixos do que a catraca permite (ponto de partida: 386 alvos em 73 telas).
- [ ] Atualizar as referências é um clique no workflow manual, sem precisar de máquina Windows.

**Onde mexer.** Front: `.github/workflows/ci.yml (tirar o --grep-invert da linha 134)`, `.github/workflows/atualizar-capturas.yml (novo; workflow_dispatch no contêiner mcr.microsoft.com/playwright:v1.62.1-jammy)`, `apps/web/tests/e2e/regressao-visual.spec.ts (novo; substitui navigation.spec.ts:134-161)`, `apps/web/tests/e2e/auditoria-de-tela.spec.ts e auditoria-catraca.json (novos)`, `apps/web/playwright.config.ts (maxDiffPixelRatio de 0.002)`, `apps/web/app/styleguide/page.tsx (novo; notFound fora do modo local)`. API: `nenhuma`.

**Depende de:** QA: CI obrigatório para merge nas rulesets (TESTES-04). **Risco:** Captura instável (fonte, animação, relógio) gera falso alarme e descrédito. Fixar o relógio, desligar animações e mascarar o cronômetro antes de ligar o bloqueio.

<sub>Achados: CSS-R3, TESTES-12</sub>

### DS-I04 · Linha compacta de jogo para agenda e listas

Onda 1 sugerida · reorganização de UX · esforço M · ~4 dia(s) · cobre 6 achado(s), 3 crítico(s)/alto(s)

**Problema.** Cada jogo ocupa um cartão de ~199px: em 12/10 (47 jogos), a agenda pública somou ~11 telas e a do staff ~10. O cartão repete a modalidade em 8,8 a 10px, omite fase, pênaltis e parciais, mostra 'A definir' em 89 de 96 jogos, e o leitor de tela não ouve o placar.

**Solução.** Criar MatchRow, de ~64px (72px com contexto). A coluna da esquerda traz hora e selo; o meio, as duas equipes empilhadas (escudo de 24px, nome em Aldo 14px, perdedor em --text-2); a direita, o placar de cada lado pelo Scoreline. Uma linha de contexto de 12px mostra categoria, grupo e quadra, ou as parciais e os pênaltis. Há um encaixe de ação de 44px para MESA e AGD, e uma barra verde marca o jogo ao vivo. O local 'A definir' e a categoria repetida não aparecem; 'J16' aparece quando EST gravar o número. O nome acessível é completo. MatchRow substitui MatchCard na agenda (pública e privada) e nas listas da categoria.

**Tela alvo.** Agenda do dia com uma linha de ~64px por jogo. À esquerda, a hora em cima e o selo embaixo. No meio, as duas equipes empilhadas: escudo de 24px e nome em Aldo, vencedor em branco e perdedor apagado. À direita, o placar de cada lado. Embaixo, em 12px: 'Futsal Masc. · Grupo A · Quadra 1' ou as parciais. O jogo ao vivo tem barra verde à esquerda. Tocar a linha abre o jogo; o staff vê um botão de ação à direita.

**Critérios de aceite**

- [ ] Um teste mede a linha a 412px: no máximo 72px com contexto e 60px sem.
- [ ] A agenda de 12/10 (47 jogos) cabe em até 4 telas de 840px (hoje ~11), e o Futsal do dia (23 jogos) em até 2.
- [ ] O TalkBack lê, por exemplo, 'Futsal Masculino, Grupo A. Alcateia 2, Cangaceiros 1. Ao vivo'.
- [ ] Vôlei encerrado mostra as parciais; mata-mata decidido nos pênaltis mostra '(pên. 3–2)'; 'A definir' nunca aparece como local.
- [ ] Dentro da categoria, a linha não repete o nome da categoria.

**Onde mexer.** Front: `apps/web/app/components/ui/MatchRow.tsx (novo)`, `apps/web/app/components/MatchSchedule.tsx (troca MatchCard por MatchRow e deixa de zerar phase na linha 47)`, `apps/web/app/components/PublicTournamentDetailView.tsx (listas das linhas 76 e 80)`, `apps/web/app/components/PublicMatchCollection.tsx (modo 'próximos')`, `apps/web/app/lib/edition-catalog.ts (matchView)`, `apps/web/app/styles/components/match-row.css (novo)`, `apps/web/tests/components/match-row.test.tsx e tests/e2e/agenda-densa.spec.ts (novos)`. API: `nenhuma: tiebreak, periodResults e walkoverWinner já chegam no snapshot (MatchState); só faltam em matchView`.

**Depende de:** DS-I02; DS-I03; EST: número do jogo e rodada nos dados (exibidos quando existirem). **Risco:** Nomes longos como 'COMPRESSORA' a 360px: cortar com reticências e manter o nome inteiro no nome acessível. AGD e PUB precisam usar esta mesma linha, sem criar outra.

<sub>Achados: VPUB-R4, JESP-R2, VADM-05, JESP-10, VPUB-12, PUBLICO-R4</sub>

### DS-I05 · Correções rápidas: mesa presa, iPhone, foco e fonte Aldo

Onda 1 sugerida · correção · esforço P · ~2.5 dia(s) · cobre 6 achado(s), 0 crítico(s)/alto(s)

**Problema.** Na mesa, o overflow: hidden da .app-screen anula o sticky dos controles. No iPhone instalado, o topo fica sob o relógio (não há export viewport). O foco some nos botões de canto recortado. O til da Aldo parece acento agudo ('CLASSIFICAÇÁO') e faltam º, ª e algarismos de largura fixa. Na página do atleta, o nome da categoria quebra letra a letra.

**Solução.** Trocar overflow: hidden por overflow-x: clip em .app-screen (globals.css:340). Exportar viewport em layout.tsx (viewportFit cover, themeColor #0A105A) e somar env(safe-area-inset-top) ao topo de .app-screen e das telas de estado. Criar uma regra :focus-visible com box-shadow interno de 3px para toda classe com clip-path. No gerar-aldo-acentuada.py, redesenhar o til como onda (linha 39), acrescentar º e ª e regenerar o .ttf. Relógio, parciais e horário passam para Outfit com tabular-nums, e o placar grande ganha caixa fixa por dígito. Corrigir o comentário de layout.tsx:29-33. Em AthleteDetailView, nome da categoria inteiro na primeira linha, modalidade e selo na segunda.

**Tela alvo.** Mesa: Pausar, Avançar, Desfazer e Encerrar ficam presos logo acima da barra inferior, sem rolar, mesmo com quatro linhas de botões de lance. No iPhone instalado, a barra do topo começa abaixo do relógio. Navegando por Tab, todo botão de canto recortado mostra um anel verde interno. Os títulos leem 'CLASSIFICAÇÃO' com til de verdade, e o relógio não muda de largura.

**Critérios de aceite**

- [ ] Mesa a 360×640: Pausar, Avançar, Desfazer e Encerrar visíveis acima da barra sem rolar (teste e2e).
- [ ] Com o app instalado num iPhone com recorte, a barra do topo fica inteira abaixo do relógio (foto no PR).
- [ ] Navegando por Tab na mesa, no painel e no login, o anel aparece em todo item focável (teste e2e).
- [ ] Capturas a 412px mostram 'CLASSIFICAÇÃO', 'CONEXÃO' e '1º TEMPO' inteiros em Aldo, e a largura do relógio fica constante de 20:00 a 11:11.
- [ ] Página do atleta a 412px: nome da categoria inteiro e selo dentro do cartão.

**Onde mexer.** Front: `apps/web/app/globals.css (:340 overflow-x: clip e safe-area; :70 e :746 foco interno; .game-clock e .set-scoreboard em Outfit)`, `apps/web/app/layout.tsx (export viewport; comentário das linhas 29-33)`, `apps/web/scripts/gerar-aldo-acentuada.py (til da linha 39, º e ª) e apps/web/app/fonts/aldo-the-apache.ttf`, `apps/web/app/components/AthleteDetailView.tsx (linhas 49-55)`, `apps/web/tests/e2e/mesa-controles-visiveis.spec.ts e foco-visivel.spec.ts (novos)`. API: `nenhuma`.

**Depende de:** DS-I03. **Risco:** overflow-x: clip pode revelar enfeites que vazavam na vertical; a captura completa mostra isso antes do merge. A fonte gerada continua com licença em aberto.

<sub>Achados: CSS-R1, CSS-13, CSS-12, CSS-14, CSS-R2, EQUIPES-14</sub>

### DS-I06 · Tokens semânticos e piso de toque, texto e contorno

Onda 2 sugerida · reorganização de UX · esforço G · ~6 dia(s) · cobre 5 achado(s), 0 crítico(s)/alto(s)

**Problema.** Os tokens mentem: --orange é verde, e --pink e --blue são a cor do cartão. Há 122 tamanhos de fonte. 386 alvos ficam abaixo de 44px em 73 de 85 telas, e o celular encolhe texto até 9px. Cartões, campos e botões de lance ficam entre 1,05 e 1,6:1 do fundo; o '26' fica a 1,39:1.

**Solução.** PR1, sem mudança de pixel: styles/tokens.css com os tokens da arquitetura como apelidos dos valores atuais, e definição de --blue-light, --font-body e --muted. PR2, também sem mudança: um codemod troca os apelidos (--orange vira --accent, --black vira --bg, e os usos decorativos de --pink, --blue e --green viram --surface). PR3, mudança revisada: --tap como altura mínima de botão, ação, select, input e summary; apagar as reduções de celular (3583, 3713, 3882-3884, 666, 3428, 3435); piso de 12px para rótulo, 14px para dado e 16px para campo, quebrando linha em vez de encolher; borda --border em .match-score-card e .event-btn; desabilitado com motivo escrito; '26' em azul sobre verde. Criar Button e Chip.

**Tela alvo.** Em toda tela, cartões, campos e botões têm contorno visível mesmo sob sol. Nenhum texto fica abaixo de 12px; dados aparecem em 14px e campos em 16px. Todo alvo tem 44px (56px na mesa), e os filtros viram chips de 44px. Na mesa, os botões de lance ganham contorno e o nome da equipe em 14px. O selo '26' aparece em azul sobre verde.

**Critérios de aceite**

- [ ] PR1 e PR2 saem com capturas idênticas (0 pixel de diferença).
- [ ] Na auditoria, os alvos abaixo de 44px caem de 386 para no máximo 40, todos listados como exceção (link em texto corrido).
- [ ] Nenhum texto visível abaixo de 12px; a 360px, o cabeçalho da classificação e as abas da categoria têm 14px ou mais.
- [ ] Contorno de cartão, campo e botão de lance com 3:1 ou mais contra o fundo; nenhum texto abaixo de 4,5:1; o '26' passa de 1,39:1 para 10,6:1.
- [ ] Tamanhos de fonte distintos no CSS caem de 122 para no máximo 12; alfas de branco, de 42 para no máximo 4.

**Onde mexer.** Front: `apps/web/app/styles/tokens.css (novo, importado no início do globals.css)`, `apps/web/scripts/codemod-tokens.mjs (novo)`, `apps/web/app/globals.css (regra --tap das linhas 1257-1270; reduções 3583, 3713, 3882-3884, 666, 3428 e 3435; contorno em 1740, 421 e 2527; '26' em 1811-1814)`, `apps/web/app/motion.css (linhas 69-72: pausa sem filter)`, `apps/web/app/components/ui/Button.tsx e Chip.tsx (novos)`, `apps/web/app/components/TournamentManager.tsx (participantes como linha inteira tocável)`. API: `nenhuma`.

**Depende de:** DS-I03; DS-I01. **Risco:** Alvo de 44px e texto maior alongam telas densas, como a classificação e a gestão da categoria. Resolver quebrando colunas, nunca encolhendo de novo.

<sub>Achados: CSS-10, CSS-05, CSS-06, CSS-09, CSS-02</sub>

### DS-I07 · Formulário base: campo, seção recolhível e barra de salvar fixa

Onda 2 sugerida · reorganização de UX · esforço M · ~4 dia(s) · cobre 3 achado(s), 1 crítico(s)/alto(s)

**Problema.** As regras do Futsal reúnem 30 campos, 23 botões e 11 textos de ajuda num bloco só; 'Salvar' fica no fim e o W.O. por último. Salvar fecha o formulário antes da resposta, e uma falha apaga o rascunho. A troca de senha não informa o mínimo de 12 caracteres nem deixa ver a senha.

**Solução.** Criar três componentes. Field: rótulo de 14px, campo de 16px com 48px, dica e erro ligados por aria-describedby, aria-invalid e olho para mostrar a senha. FormSection: details com título, resumo de uma linha do valor atual e marca de 'alterado'. ActionBar: barra fixa acima da navegação, com ação principal larga e os estados Alterado, Salvando…, Salvo às HH:MM ou erro; só fecha com sucesso e mantém o rascunho em caso de erro. Pilotos: PasswordChangeForm (dica e contador), StaffAccessForm e RegulationFields, dividido em cinco seções na ordem de uso: Como pontua, Como termina, Tabela e desempate, Mata-mata e W.O., Elenco. EST e AGD reaproveitam os componentes nos formulários deles.

**Tela alvo.** Editar regras: cinco seções fechadas, cada uma com título e resumo de uma linha ('Melhor de 3 · sets de 25 · decisivo 15'), abertas uma de cada vez. Uma barra fixa acima da navegação traz 'Salvar regras' e o estado (Alterado, Salvando…, Salvo às 14:32 ou o erro). Na troca de senha, a dica 'mínimo de 12 caracteres' fica sob o campo, um contador acompanha a digitação e os três campos têm o olho de mostrar a senha.

**Critérios de aceite**

- [ ] Com as seções fechadas, as regras do Futsal cabem em 1 tela a 412×915, com 'Salvar regras' visível sem rolar.
- [ ] Se a API falhar ao salvar, o formulário continua aberto, com o rascunho e a mensagem junto do botão; com sucesso, mostra 'Salvo às HH:MM'.
- [ ] A troca de senha mostra 'mínimo de 12 caracteres' e 'faltam N' antes do envio, e os três campos têm mostrar senha.
- [ ] Nos três formulários-piloto, campos com fonte de 16px (sem zoom no iPhone), altura de 48px ou mais e erro anunciado pelo leitor de tela.

**Onde mexer.** Front: `apps/web/app/components/ui/Field.tsx, FormSection.tsx e ActionBar.tsx (novos)`, `apps/web/app/components/PasswordChangeForm.tsx`, `apps/web/app/components/StaffAccessForm.tsx`, `apps/web/app/components/RegulationFields.tsx (linhas 57-192)`, `apps/web/app/components/DisciplineManager.tsx (salvar das linhas 33-46 e formulário das 82-92)`, `apps/web/app/styles/components/form.css (novo)`, `apps/web/tests/e2e/formulario-regras.spec.ts (novo)`. API: `nenhuma; o erro por campo do regulamento chega quando EST validar no discipline/update (REGRAS-06)`.

**Depende de:** DS-I01; DS-I06. **Risco:** Mexer no formulário de regras enquanto EST muda o modelo do regulamento gera conflito. Combinar com EST a ordem dos PRs em RegulationFields.

<sub>Achados: REGRAS-10, REGRAS-R3, ADMIN-03</sub>

### DS-I08 · Cabeçalho de página compacto em uma linha

Onda 2 sugerida · reorganização de UX · esforço M · ~3 dia(s) · cobre 2 achado(s), 0 crítico(s)/alto(s)

**Problema.** Toda tela empilha barra da edição (58 + 28px), Voltar, migalha, sobretítulo, título de até 58px e subtítulo. Numa tela de 915px, o conteúdo começa a 598px na categoria pública, o placar a 400px na partida, o primeiro jogo a 447px na agenda do gestor e a 607px na aba Jogos da gestão.

**Solução.** Criar PageHeader: uma linha de 56px com o voltar ('‹ nome do pai', 44px), título em Aldo 28px (até 2 linhas) e no máximo uma ação com rótulo. O sobretítulo sai, e o subtítulo só fica quando traz dado. A barra da edição vira uma faixa de 40px, e a migalha só aparece a partir de 900px. Na partida, o título passa a ser o confronto, não 'PARTIDA', e o filtro de modalidade some quando há uma só opção. Aplicar em AppShell, PublicAppShell e MatchRouteView. NAV define o pai de cada rota e o conteúdo da barra; DS entrega a forma.

**Tela alvo.** No topo de toda tela, interna e pública, uma única faixa: '‹ Futsal' (44px), título em Aldo 28px numa linha e uma ação. A barra da edição encolhe para 40px, sem sobretítulo nem subtítulo repetidos. Na partida, o título é 'Alcateia × Cangaceiros'. Tabela, placar ou primeiro jogo aparecem já na primeira tela.

**Critérios de aceite**

- [ ] A 412×915, o primeiro conteúdo começa a 200px do topo ou menos na categoria pública (hoje ~598px), na partida (~400px), na agenda do gestor (~447px) e na aba Jogos da gestão (607px).
- [ ] Cada tela tem uma só forma de voltar; nenhuma mostra 'Voltar' e '‹ Modalidades' ao mesmo tempo.
- [ ] O título da partida, pública e interna, é 'Alcateia × Cangaceiros'.
- [ ] O gestor de uma só modalidade não vê o filtro de modalidade.

**Onde mexer.** Front: `apps/web/app/components/ui/PageHeader.tsx (novo)`, `apps/web/app/components/AppShell.tsx (cabeçalho nas linhas 47-69; PageNavigation nas 83-104)`, `apps/web/app/components/PublicAppShell.tsx (linhas 56-69)`, `apps/web/app/components/MatchRouteView.tsx (título da linha 15)`, `apps/web/app/components/MatchesHub.tsx (filtro da linha 50)`, `apps/web/app/globals.css (344, 500, 871, 3149, 3627 e 3712)`, `apps/web/tests/e2e/primeira-dobra.spec.ts (novo)`. API: `nenhuma`.

**Depende de:** DS-I06; NAV: pai declarado por rota e regra da migalha (NAV-10); NAV: conteúdo da barra de contexto (NAV-12). **Risco:** NAV mexe no AppShell no mesmo período. Fazer um PR de forma (DS) e outro de conteúdo (NAV), em sequência combinada.

<sub>Achados: VPUB-13, VADM-10</sub>

### DS-I09 · Fatiar globals.css em arquivos e camadas sem mudar a tela

Onda 3 sugerida · infra · esforço G · ~6 dia(s) · cobre 1 achado(s), 0 crítico(s)/alto(s)

**Problema.** O globals.css tem 4.136 linhas, cerca de 17% mortas (~60 classes, 36 KB) e 249 seletores .theme-* de cinco temas que já foram igualados. Várias regras 'precisam ficar no fim' porque a ordem decide a cascata, e 200 linhas já entraram depois desse bloco. Cada ajuste briga com regras anteriores.

**Solução.** Uma sequência de PRs, cada um com capturas sem diferença. (1) O script classes-mortas.mjs lista as classes sem uso, considerando nomes montados em template (status-${tone}, theme-${active}); apagar essas classes. (2) Achatar os .theme-*, fundindo as regras que o tema único já iguala. (3) Dividir por faixas contíguas, na mesma ordem: o globals.css vira só @import, no topo, de styles/base, shell, components/*, screens/*, narrow e late; um script compara o CSS compilado antes e depois, e ele tem de sair idêntico. (4) Mover cada regra para o arquivo do seu componente e envolver tudo em @layer base, components, screens, narrow numa troca única.

**Critérios de aceite**

- [ ] No PR de divisão, o CSS compilado sai idêntico ao anterior (diff normalizado igual a zero).
- [ ] Em todos os PRs da sequência, as capturas de DS-I03 não mudam.
- [ ] CSS compilado pelo menos 30 KB menor; globals.css com até 150 linhas; nenhum arquivo de CSS acima de 600 linhas.
- [ ] Seletores .theme-* caem de 249 para no máximo 20, e nenhuma regra depende de ficar no fim do arquivo.

**Onde mexer.** Front: `apps/web/app/globals.css (vira índice de @import)`, `apps/web/app/styles/base.css, shell.css, narrow.css e late.css (novos)`, `apps/web/app/styles/components/*.css e styles/screens/*.css (novos)`, `apps/web/scripts/classes-mortas.mjs (novo)`, `apps/web/scripts/comparar-css-compilado.mjs (novo; normaliza e compara .next/static/css)`, `docs/VISUAL_IMPLEMENTATION_SPEC.md (passa a apontar para tokens.css e /styleguide)`. API: `nenhuma`.

**Depende de:** DS-I03; DS-I06. **Risco:** PRs abertos de outras trilhas vão conflitar com a divisão. Anunciar uma janela de 2 dias e manter a ordem para o rebase ser mecânico. Confirmar que o Next resolve @import local.

<sub>Achados: CSS-11</sub>

### DS-I10 · Grade e tabelas no desktop a partir de 1024px

Onda 3 sugerida · reorganização de UX · esforço G · ~6 dia(s) · cobre 3 achado(s), 0 crítico(s)/alto(s)

**Problema.** No notebook, o app é a coluna do celular: .app-screen com 520px (760px na gestão) numa tela de 1280px, com as laterais vazias. Equipes ocupam 4,7 telas, a classificação 4,3 e a gestão da categoria 3,8. Quem monta categoria e confere tabela trabalha numa tira estreita.

**Solução.** A partir de 1024px: contêiner de até 1200px (globals.css:340 e 829-832), grade de 12 colunas e um componente DataTable. A agenda vira tabela, com MatchRow em modo de linha larga (hora, categoria, confronto, placar, estado e ação). Classificação e ranking geral mostram todas as colunas; equipes e categorias ficam em grade de 3 a 4; formulários ocupam uma coluna de 640px com resumo fixo ao lado. A barra inferior dá lugar ao trilho lateral de NAV. Abaixo de 1024px, nada muda.

**Tela alvo.** A partir de 1024px: navegação lateral (de NAV) e conteúdo de até 1200px. A agenda vira tabela — hora, categoria, confronto, placar, estado e ação —, com uma linha por jogo. A classificação mostra todas as colunas, as equipes ficam em grade de quatro e os formulários numa coluna de 640px com resumo ao lado. No celular, nada muda.

**Critérios de aceite**

- [ ] A 1280×900: equipes em até 1,5 tela (hoje 4,7), classificação em até 1,5 (hoje 4,3) e gestão da categoria em até 2 (hoje 3,8).
- [ ] O conteúdo usa até 1200px de largura, e nenhuma captura de celular (412px) muda.
- [ ] A 1280px, os 47 jogos de um dia cheio cabem em até 2 telas.

**Onde mexer.** Front: `apps/web/app/globals.css (340 e 829-832)`, `apps/web/app/styles/screens/desktop.css (novo, min-width 1024px)`, `apps/web/app/components/ui/DataTable.tsx (novo)`, `apps/web/app/components/MatchSchedule.tsx (MatchRow em modo de tabela)`, `apps/web/app/components/TournamentClassification.tsx e OverallStandings.tsx`, `apps/web/app/components/PublicTeamList.tsx e apps/web/app/teams/page.tsx (grade)`, `apps/web/tests/e2e/desktop-densidade.spec.ts (novo)`. API: `nenhuma`.

**Depende de:** DS-I04; DS-I09; NAV: trilho lateral no desktop (NAV-14). **Risco:** Não há dado de uso em desktop. Se a organização não usa notebook, a iniciativa espera sem prejuízo ao evento.

<sub>Achados: CSS-08, VADM-13, JORG-12</sub>

**Fora de escopo, de propósito**

- Cor nova para erro (por exemplo #FF6B6B), proposta em CSS-01: está fora da paleta decidida. O token --danger permite trocar em uma linha se o dono aprovar.
- Layout da mesa por esporte e destaque de Encerrar (MESA-10, VPUB-07): é da trilha MESA. DS entrega o botão de 56px, o Scoreline e o contorno dos botões de lance.
- Estados que envelhecem (Atrasado, Sem atualização) e o conteúdo de voltar, migalha e barra de contexto: são de AGD, SYNC e NAV. DS só dá a forma (variantes late e stale, PageHeader).
- Agrupamento da agenda por faixa de horário, chips de estado e âncora 'Agora' (PUBLICO-09 e parte de VPUB-R4 e JESP-R2): são de AGD e PUB, montados sobre o MatchRow.
- Modo sol de alto contraste, modo telão e cor própria por atlética: são ideias. O piso de contraste do DS-I06 cobre o essencial; o telão é de PUB; a cor por equipe exige API e cor fora da paleta.
- Trocar o CSS próprio por Tailwind ou uma biblioteca de componentes: o custo de migração não cabe num time pequeno, e tokens mais 10 componentes resolvem.

**Perguntas para a organização**

- Aceita uma cor semântica só para erro e perigo, fora da paleta (por exemplo #FF6B6B, 6,1:1 no fundo)? O plano assume que não: perigo fica em branco, com ícone e verbo escrito.
- O designer vai entregar a Aldo 'modificada' oficial, e com licença? Se sim, ela precisa trazer til em onda, º, ª e algarismos de largura fixa, e o DS-I05 deixa de mexer no gerador.
- A organização usa notebook para montar categorias, lançar resultados ou acompanhar o evento? A resposta decide se o DS-I10 sobe da onda 3.


## QA — Qualidade, contrato e entrega

**Objetivo.** Antes do próximo evento, nenhum código chega à produção sem passar por testes que falam com a API real e reproduzem os 96 jogos e 2.689 lances de outubro. O deploy espera o CI, não cai sobre jogo ao vivo e volta sozinho se quebrar. Cada PR e cada branch parados têm destino.

**Princípios**

- O mesmo SHA que passou nos portões é o que vai ao ar. Publicar por fora do fluxo é manual, tem nome e motivo, e fica registrado no resumo do job.
- Teste de integração fala com a API real atrás de um proxy que reproduz /copahalterada e /intereng-api/, como em produção. O modo local serve só para layout e capturas.
- Bug conhecido vira teste marcado com o id do achado e a trilha dona, não um comentário. A correção tira a marca no mesmo PR e o teste passa a proteger.
- A semente padrão é o dado de verdade: estrutura e lances de outubro (dados públicos, sem atleta) no lugar do torneio de 5 jogos.
- Todo job que falha diz em português o que aconteceu e o comando para voltar. Log cru nunca é a única pista.
- Vence a menor solução que resolve: GitHub Actions, scripts node e um nginx de teste, sem serviço pago novo. Nenhum teste roda no runner da VM de produção, só o deploy.

**Desenho alvo**

Quatro camadas, todas em GitHub Actions.

1. Portões do PR, em runner hospedado. No front: typecheck, unidade por glob, componentes, e2e local e regressão visual em Linux. Na API: typecheck, lint, jest e test:e2e com acoes.e2e-spec e mesa.e2e-spec sobre Postgres real.

2. Contrato. É o workflow reutilizável contrato-real.yml, no repositório do front, chamado pelos dois CIs: o do front passa api_ref=main e o da API passa front_ref=front-end. Ele sobe Postgres e Redis como serviços, a API compilada do commit escolhido (NODE_ENV=production, segredos de teste) e o front em modo http com basePath /copahalterada, atrás de um nginx de teste com /copahalterada e /intereng-api/. A estrutura de outubro (tests/fixtures/copa-2026/public-snapshot.json.gz) entra pelas próprias ações da API (bootstrap e /editions/active/actions), junto com o staff de teste. Em seguida rodam:
- paridade dos tipos de ação;
- specs Playwright em tests/real: sessão por papel, mesa por modalidade, regressões do evento e área pública sem sessão;
- quando pedido, o replay dos 2.689 lances, comparado com esperado.json e com métricas.
No CI da API, os testes marcados como bug conhecido rodam em passo informativo.

3. Entrega. O deploy é o último job do ci.yml, com needs dos portões e do contrato, e roda sobre o SHA testado. Tem concurrency única, respeita a variável CONGELAR_DEPLOY e é barrado se o snapshot público mostrar jogo ao vivo com lance recente. A imagem leva o SHA como tag e as 3 últimas ficam guardadas. O compose tem healthcheck e sobe com --wait. Depois vêm a recarga do gateway, o smoke pela URL pública e, se falhar, a volta automática à imagem anterior (na API, só quando não houve migração). Um vigia agendado a cada 15 min, fora da VM, abre e fecha uma issue.

4. Antes do evento. Uma instância de ensaio na VM (/copahalterada-ensaio) com a mesma imagem e o banco do replay. Roteiro D-14, D-7 e D-2 em docs/ENSAIO_GERAL.md, e OPERACAO.md como único runbook.

Fontes de verdade dos testes:
- o snapshot de outubro versionado;
- esperado.json;
- api/test/casos/*.json (mesa, classificação e regulamento padrão);
- o módulo apps/web/app/lib/invariantes.ts, que também alimenta a lista de reparos de SAN e as pendências de IMP.

### QA-I01 · Arrumar repositórios: branch padrão, branches mortas, PRs e issues parados

Onda 0 sugerida · saneamento · esforço P · ~1.5 dia(s) · cobre 3 achado(s), 0 crítico(s)/alto(s)

**Problema.** A branch padrão do front (main) está 179 commits atrás da produção, e o guia DEVELOPMENT.md manda trabalhar nela. São 54 branches no front e 28 na API, a maioria já mergeada. Os PRs #86, #95, #103 e api#41 e seis issues estão sem destino.

**Solução.** Uma sessão nas configurações e um PR por repositório. No front, front-end vira a branch padrão; main ganha a tag arquivo/main-2026-08 e é apagada. Apagar as branches sem commit próprio ou já aplicadas (45 no front, 26 na API). integracao-api, integracao-modulos e front-halterada ganham tag arquivo/ antes de sair. Destinos dos PRs: #103 fechado, superado pelo #104; #86 refeito sobre front-end, com o teste escudos-inteiros nas duas rotas de detalhe; #95 e api#41 entregues a EST. feat/siglas-copa-halterada é conferida contra equipes.csv. Issues: fechar front#54, front#55 e api#18; api#17 vai para SYNC; api#11 e api#12 vão para ADM. Na API, remover da raiz os arquivos do loop de agentes.

**Tela alvo.** Quem abre o repositório do front no GitHub cai em front-end, com um README que traz a seção 'Como contribuir' em dez linhas. A lista de branches cabe numa tela. A aba Pull requests não tem PR parado há mais de 30 dias sem comentário. Cada PR ou issue fechado tem uma linha dizendo o destino, com o link para onde o trabalho foi.

**Critérios de aceite**

- [ ] origin/HEAD do front aponta para front-end; a branch main não existe mais e a tag arquivo/main-2026-08 guarda a ponta antiga
- [ ] Branches remotas: no front, de 54 para no máximo 6; na API, de 28 para no máximo 3; só sobrevive branch com commit que não está na produção
- [ ] #103 fechado; #86 substituído por PR novo e mergeado, com escudos-inteiros.spec.ts cobrindo /public/matches/[id] e /matches/[id]; #95 e api#41 com responsável de EST no comentário
- [ ] front#54, front#55 e api#18 fechadas com motivo; api#17, api#11 e api#12 com a trilha dona escrita no corpo
- [ ] Raiz da API sem PROMPT.md, tasks.md, orchestrate.sh, ralph-loop.sh, schema.prisma.rtf e o PRD em PDF, com build e CI verdes

**Onde mexer.** Front: `Configurações do repositório (branch padrão)`, `README.md (seção Como contribuir)`, `docs/DEVELOPMENT.md (apagado)`, `apps/web/app/globals.css:2690 (refazer o #86 com :not(.team-mark-logo))`, `apps/web/tests/e2e/escudos-inteiros.spec.ts`. API: `PROMPT.md, tasks.md, orchestrate.sh, ralph-loop.sh, schema.prisma.rtf e PRD-api-sistema-competicoes.md.pdf (remover)`, `Branches feat/autor-do-lance, feat/ranking-restrito e feat/responsavel-de-atletica (já entraram por squash nos #32 a #34; apagar)`, `PR #41 fix/copa-inscrever-equipes (destino EST)`.

**Depende de:** EST: revisar e mergear api#41 e #95 (CHAVE-03, REGRAS-07); DS: o refazer do #86 toca globals.css. **Risco:** Apagar branch com trabalho não publicado. Mitigação: só sai o que git cherry mostra como já aplicado; o resto ganha tag arquivo/ antes.

<sub>Achados: DOCS-13, DOCS-07, DOCS-05</sub>

### QA-I02 · Deploy só depois do CI verde e nunca sobre jogo ao vivo

Onda 0 sugerida · infra · esforço P · ~2 dia(s) · cobre 3 achado(s), 3 crítico(s)/alto(s)

**Problema.** Nos dois repositórios, o cd.yml dispara no push, em paralelo ao CI, e publica a ponta da branch. Entre 09 e 10/10 foram 14 merges no front e 3 na API. Os PRs #116, #117 e API #40 entraram entre 10:42 e 10:53, com vôlei e handebol sendo operados.

**Solução.** O deploy vira o último job do ci.yml, com needs de todos os portões (e, depois, do contrato), e chama o cd.yml como workflow reutilizável com o SHA testado: checkout --detach desse SHA, e não reset na branch. concurrency deploy-producao, sem cancelar o que está rodando. Antes de recriar o container, um script lê o snapshot público e recusa o deploy se houver partida Ao vivo com lance nos últimos 30 min, listando qual. Jogo abandonado não bloqueia. A variável CONGELAR_DEPLOY=true pula o deploy automático nos dias de evento. O disparo manual pede SHA, motivo e forcar. As rulesets passam a exigir os checks, e a api#14 é fechada.

**Tela alvo.** Na aba Actions, cada push mostra um grafo: Typecheck → Ponta a ponta → Publicar. Publicar fica cinza se algo falhou. Com jogo ao vivo, o job termina com o aviso: 'Não publicado: Halterada × Mafiosa (Handebol) teve lance há 4 min. Rode de novo depois, ou use Publicar manual com forcar.' Em 'Run workflow' aparecem três campos: SHA, motivo e forcar.

**Critérios de aceite**

- [ ] Nenhum cd.yml dispara por push; o job Publicar declara needs de todos os jobs do CI e publica exatamente github.sha
- [ ] O script de trava, rodado sobre um snapshot com lance de 10/10 às 10:45, sai com código 1 e lista o jogo. Sobre o snapshot de 13/10, libera: Mafiosa × Furiosa está sem sinal desde 12/10 15:58
- [ ] Com CONGELAR_DEPLOY=true, o push não publica e o resumo do job escreve 'congelado'
- [ ] Rulesets de front-end e main exigem 'Typecheck, unidade e componentes', 'Ponta a ponta (Playwright)' e 'Typecheck, lint e testes'; api#14 fechada
- [ ] Dois merges seguidos publicam em fila, nunca em paralelo; push só de documentação não recria container

**Onde mexer.** Front: `.github/workflows/ci.yml (job Publicar com needs)`, `.github/workflows/cd.yml (workflow_call com sha e forcar; workflow_dispatch com motivo)`, `scripts/ops/trava-jogo-ao-vivo.sh (novo)`, `Ruleset 'Proteção da Main' de front-end (checks obrigatórios)`. API: `.github/workflows/ci.yml (job Publicar com needs de verificar)`, `.github/workflows/cd.yml (workflow_call, checkout do SHA, sem gatilho push)`, `scripts/ops/trava-jogo-ao-vivo.sh (mesmo script)`, `GET /editions/active/public-snapshot (leitura; já existe)`, `Ruleset 'Proteção da Main' (fecha a issue #14)`.

**Depende de:** ADM: definir quem liga e desliga CONGELAR_DEPLOY. **Risco:** A trava pode segurar uma correção urgente durante o jogo; o disparo manual com forcar resolve. workflow_run foi descartado porque só dispara pelo arquivo da branch padrão, hoje main.

<sub>Achados: TESTES-04, APIINFRA-05, PWA-05</sub>

### QA-I03 · Verificador de invariantes dos dados, somente leitura, contra qualquer API

Onda 0 sugerida · infra · esforço M · ~3 dia(s) · cobre 2 achado(s), 2 crítico(s)/alto(s)

**Problema.** A API valida cada ação, mas não a coerência do conjunto. Hoje, em produção: 20 jogos de grupo do Vôlei estão fora de qualquer tabela, 4 jogos de vôlei têm sets ou parciais impossíveis, há 3 confrontos repetidos e Inquisidores está sem grupo. Não existe conferência automática, nem antes nem depois de um reparo.

**Solução.** Módulo puro apps/web/app/lib/invariantes.ts com verificarInvariantes(snapshot), que devolve cada violação com código, jogo ou categoria e a frase do que corrigir. Regras de integridade:
- sets acima de setsToWin;
- parciais em número diferente dos sets jogados, ou sem vencedor válido pelo alvo e pela vantagem;
- etapa acima do previsto;
- jogo encerrado de fase classificatória que não está em exatamente uma tabela;
- inscrito sem grupo em fase com grupos;
- confronto repetido na fase sem returno declarado.
A CLI scripts/verificar-invariantes.ts --api <url> lê o snapshot público, sem senha, e imprime tabela ou JSON. Um teste de unidade sobre o snapshot de outubro fixa as contagens. Regras operacionais (jogo vencido, ao vivo parado) ficam com IMP.

**Tela alvo.** No terminal, ou no resumo do workflow manual 'Conferir dados', aparece uma tabela com código, categoria, jogo, o que está errado e o que fazer. Exemplo: 'PARCIAIS · Vôlei Feminino · Inquisidores × Furiosa · 3 sets em melhor de 3, parcial 10-26 · retificar parciais'. No fim vem a contagem por código e a hora do snapshot lido.

**Critérios de aceite**

- [ ] Rodado contra a produção de hoje, lista as contagens de JDADOS-11: 20 jogos do Vôlei fora da tabela, 4 jogos de vôlei com sets ou parciais incoerentes, 3 confrontos repetidos e 1 inscrito sem grupo
- [ ] Funciona sem credencial (só GET /editions/active/public-snapshot) e não tem nenhum código de escrita
- [ ] A saída --json é a entrada da lista de reparos de SAN; rodada de novo depois do reparo, mostra zero para os itens reparados
- [ ] invariantes.test.ts roda no test:unit com o snapshot de outubro e com um snapshot limpo (zero violações)
- [ ] IMP importa o mesmo módulo no painel de pendências, sem copiar regra

**Onde mexer.** Front: `apps/web/app/lib/invariantes.ts (novo)`, `apps/web/scripts/verificar-invariantes.ts (novo; node 22 executa .ts)`, `apps/web/tests/unit/invariantes.test.ts (novo)`, `apps/web/tests/fixtures/copa-2026/public-snapshot.json.gz (novo; baixado uma vez da produção)`, `.github/workflows/conferir-dados.yml (manual, novo)`. API: `GET /editions/active/public-snapshot (só leitura; já existe)`.

**Depende de:** SAN: usa a saída como lista de reparos e como verificação depois do reparo; IMP: o painel de pendências reaproveita o módulo; MESA: recusar ponto depois da decisão (MESA-03), para a regra também valer na escrita. **Risco:** O snapshot público omite categorias em Rascunho. Até EST congelar o regulamento por partida, as regras de vôlei usam o regulamento atual, e não o do jogo.

<sub>Achados: JDADOS-11, TESTES-03</sub>

### QA-I04 · Ligar portões que existem e não rodam: unidade, visual, e2e da API

Onda 1 sugerida · infra · esforço M · ~3.5 dia(s) · cobre 4 achado(s), 0 crítico(s)/alto(s)

**Problema.** O test:unit lista 20 arquivos à mão e deixa de fora o teste da sondagem de tempo real. As 4 capturas visuais só existem em Windows e o CI as pula. Os 196 e2e da API (5.523 linhas) miram rotas que respondem 410, e nenhum chama /editions/:id/actions.

**Solução.** Front:
- test:unit vira node --test "tests/unit/*.test.ts";
- o teste da sondagem passa a usar relógio simulado;
- um workflow manual gera as referências -linux.png no contêiner do Playwright;
- sai o --grep-invert de ci.yml:134 e entram capturas da mesa de futsal e de vôlei, do detalhe da partida, da categoria nas abas Tabela e Jogos e da agenda a 412 px, comparando o componente, não a página inteira.
API:
- apagar os 16 e2e legados;
- escrever test/acoes/acoes.e2e-spec.ts (Nest em processo, supertest, Postgres do CI), cobrindo: a mesma Idempotency-Key não duplica o lance, a revisão sobe uma por ação, o segundo operador é recusado pela trava e o gestor de outra modalidade recebe 403;
- ligar test:e2e no ci.yml.

**Tela alvo.** No PR do front, o check 'Typecheck, unidade e componentes' lista 21 arquivos de unidade (hoje 20). O 'Ponta a ponta' mostra 'regressão visual: 11 telas comparadas'; se falhar, anexa a imagem com a diferença marcada em vermelho. No PR da API, o check 'Typecheck, lint e testes' ganha a linha 'e2e das ações: 9 casos'.

**Critérios de aceite**

- [ ] Arquivo novo em tests/unit roda sem editar package.json; sondagem-tempo-real.test.ts aparece no log do CI
- [ ] ci.yml do front sem --grep-invert; referências -linux.png versionadas para as 4 telas atuais e 7 novas; trocar um dígito do placar da mesa reprova
- [ ] test/ da API sem os 16 arquivos do CRUD legado; npm run test:e2e roda no CI em menos de 5 min
- [ ] acoes.e2e-spec.ts cobre idempotência, revisão crescente, trava de operador e permissão por papel em match/registerEvent

**Onde mexer.** Front: `apps/web/package.json (script test:unit)`, `apps/web/tests/unit/sondagem-tempo-real.test.ts (relógio simulado)`, `.github/workflows/ci.yml:134 (sem --grep-invert)`, `.github/workflows/referencias-visuais.yml (manual, novo)`, `apps/web/tests/e2e/navigation.spec.ts (capturas novas)`, `apps/web/playwright.config.ts (tolerância por componente)`. API: `test/*.e2e-spec.ts legados (apagar os 16)`, `test/acoes/acoes.e2e-spec.ts (novo)`, `test/acoes/fabrica.ts (edição de teste via POST /competitions/bootstrap e ações)`, `test/jest-e2e.json`, `.github/workflows/ci.yml (passo test:e2e)`.

**Depende de:** DS: refatorar o CSS (CSS-10, CSS-11) só depois das referências Linux. **Risco:** Referência visual instável por diferença de fonte no runner. Gerar e comparar sempre no mesmo contêiner mcr.microsoft.com/playwright, com versão fixa.

<sub>Achados: TESTES-08, TESTES-10, TESTES-12, CSS-R3</sub>

### QA-I05 · Suíte de contrato front × API real nos dois CIs

Onda 1 sugerida · infra · esforço G · ~7 dia(s) · cobre 5 achado(s), 2 crítico(s)/alto(s)

**Problema.** Os 13 e2e do modo http falam com um servidor que roda o reducer do próprio front, e nenhum teste usa /copahalterada. Os bugs graves do evento eram de contrato: avançar tempo (409 em 32 de 32 jogos), responsável da atlética (403 e 401) e editar jogo com lado a definir.

**Solução.** Workflow reutilizável contrato-real.yml no front, chamado pelo CI do front (com a API de main) e pelo da API (com o front de front-end). Ele sobe Postgres e Redis, a API do commit com NODE_ENV=production e segredos de teste, o front em modo http com basePath /copahalterada e um nginx de teste. tests/real/carregar-copa.ts cria, pelas próprias ações, a estrutura de outubro e o staff de teste. Um helper ir() prefixa as rotas. Specs: paridade dos tipos de ação, sessão por papel, as três regressões do evento e a área pública sem sessão. Bug ainda aberto vira teste marcado (test.fail) com id e trilha. O workflow gera a tabela do CONTRATO_API.md e aposenta mock-api e e2e-http.

**Tela alvo.** No PR aparece o check 'Contrato com a API real', de cerca de 12 min. O resumo traz:
- tipos de ação: 39 no front, 40 na API, só na API: match/delete;
- specs aprovados;
- uma seção 'Bugs conhecidos', com linhas como 'MESA-02 avançar tempo · ainda falha · dono MESA'.
Uma falha anexa o vídeo e o traço do Playwright.

**Critérios de aceite**

- [ ] O check roda nos PRs dos dois repositórios e no push das branches de produção, em até 15 min
- [ ] Os três bugs de contrato do evento têm teste: avançar tempo em Handebol, Futsal e Basquete; o admin concede 'Responsável da atlética' e a pessoa entra; mudar horário e local do jogo '1 GRUPO A x 2 GRUPO B'. Hoje ficam marcados e passam sem marca quando MESA, ATL e AGD corrigirem
- [ ] A varredura pública sem sessão, em celular e desktop, reprova qualquer 404 de recurso sob /copahalterada e qualquer link que leve a /login
- [ ] Tipo de ação enviado pelo front e inexistente na API reprova; a tabela de ações do CONTRATO_API.md é gerada e o CI do front reprova se ela estiver desatualizada
- [ ] tests/mock-api, tests/e2e-http e o passo 'E2E contra a API de mentira' removidos, com os casos úteis portados
- [ ] O job Publicar (QA-I02) passa a ter needs deste check

**Onde mexer.** Front: `.github/workflows/contrato-real.yml (novo, reutilizável)`, `apps/web/tests/real/*.spec.ts e bugs-conhecidos.ts (novos)`, `apps/web/tests/real/carregar-copa.ts e gateway.conf (novos)`, `apps/web/playwright.real.config.ts (novo, projetos Pixel 7 e desktop)`, `apps/web/scripts/build-real.mjs (basePath /copahalterada, API /intereng-api/api/v1)`, `docs/CONTRATO_API.md (tabela gerada)`, `apps/web/tests/mock-api/server.ts, tests/e2e-http e scripts/run-e2e-http.mjs (remover)`, `apps/web/tests/components/StateAdapters.test.tsx (remover o falso teste de contrato)`. API: `.github/workflows/ci.yml (job que chama contrato-real.yml com o api_ref do PR)`, `POST /competitions/bootstrap e POST /editions/active/actions (usados pela carga, sem mudança)`, `BOOTSTRAP_SUPER_ADMIN_EMAIL/PASSWORD e STAFF_INVITE_PASSWORD (valores de teste só no job)`, `src/edition-actions/edition-actions.types.ts (lido pela paridade)`.

**Depende de:** QA-I03; MESA: avançar tempo sem relógio (MESA-02); ATL: responsável da atlética concedido e logado (EQUIPES-02); AGD: editar jogo com lado a definir (AGENDA-02); PUB: cartões e botões da agenda pública (NAV-06). **Risco:** Um bug corrigido na API faria a marca do teste reprovar o front. Por isso, no CI da API, os testes marcados rodam num passo informativo, não obrigatório.

<sub>Achados: TESTES-02, DADOS-14, DOCS-09, TESTES-11, TESTES-01</sub>

### QA-I06 · Deploy com volta automática, smoke pela URL pública e vigia do runner

Onda 1 sugerida · infra · esforço M · ~3.5 dia(s) · cobre 4 achado(s), 1 crítico(s)/alto(s)

**Problema.** O CD apaga a imagem anterior antes de verificar, testa só por dentro do container e não recarrega o gateway (deu 502 em 19/08). Tudo depende de um único runner na VM, que ficou parado de 06/09 até o primeiro dia do evento sem ninguém saber.

**Solução.** Imagens marcadas pelo SHA (pwa-torneios-web:<sha7>, intereng-api:<sha7>); as 3 últimas ficam guardadas no lugar do image prune. Healthcheck nos composes e up -d --wait. Depois de subir: nginx -t e reload no incinera-gateway, e smoke pela URL pública:
- /copahalterada/public responde 200, e o primeiro chunk /_next/static referenciado também;
- /health responde ok;
- o public-snapshot vem com partidas.
Se falhar, o job sobe a tag anterior, refaz o smoke e termina vermelho dizendo para qual SHA voltou. Na API, a volta só é automática sem migração nova. O vigia roda a cada 15 min em runner do GitHub, confere site, API e runner, abre uma issue quando algo cai e a fecha quando volta.

**Tela alvo.** No resumo do job Publicar: 'Publicado a1b2c3d · smoke público ok em 38 s · anterior guardada: 9f8e7d6'. Se falhar: 'Smoke falhou (/copahalterada/public 502). Voltou para 9f8e7d6 às 14:02.' Na aba Issues fica uma única issue, 'Vigia: runner da VM offline desde 13:45', que se fecha sozinha. Quem acompanha o repositório recebe o aviso por e-mail.

**Critérios de aceite**

- [ ] Ensaio de rollback: publicar de propósito um SHA cujo /public responde 500. Em até 3 min a versão anterior está no ar e o job fica vermelho, citando o SHA para o qual voltou
- [ ] docker images mostra as 3 últimas tags de cada serviço; o cd.yml não tem mais image prune
- [ ] Todo deploy termina com nginx -t, reload e smoke pela URL pública; recarregar-gateway.yml passa a ser só socorro
- [ ] Deploy da API com arquivo novo em migrations/ não volta sozinho e escreve o comando pg_restore do dump daquele deploy
- [ ] Desligar o runner por 20 min abre a issue do vigia; religar fecha a issue em até 15 min

**Onde mexer.** Front: `.github/workflows/cd.yml (tags por SHA, smoke e volta)`, `docker-compose.prod.yml (image com tag e healthcheck)`, `scripts/ops/smoke-publico.sh (novo)`, `apps/web/Dockerfile (HEALTHCHECK)`. API: `.github/workflows/cd.yml (tags, reload do gateway, smoke, volta só sem migração)`, `docker-compose.yml (image intereng-api:${API_TAG} e healthcheck)`, `.github/workflows/vigia.yml (novo, cron a cada 15 min, ubuntu-latest)`, `Secret VIGIA_TOKEN (leitura de runners)`, `GET /api/v1/health (já existe)`.

**Depende de:** QA-I02; ADM: resolver do Docker no gateway (127.0.0.11), rotação de log e coletor de erros 5xx; ADM: segunda pessoa com SSH na VM. **Risco:** Voltar a API depois de uma migração destrutiva quebraria a versão anterior. Regra no OPERACAO.md: migração só aditiva; remoção de coluna vai em PR posterior.

<sub>Achados: PWA-08, PWA-R2, SCRIPTS-R4, APIINFRA-10</sub>

### QA-I07 · Testes da mesa por modalidade, toque rápido e dois aparelhos

Onda 1 sugerida · infra · esforço G · ~5 dia(s) · cobre 3 achado(s), 2 crítico(s)/alto(s)

**Problema.** Os 2.689 lances do evento passaram por código quase sem teste: três specs marcam um gol no Futsal, e nenhuma pontua vôlei, avança tempo, encerra, aplica W.O. ou retifica. Na API, nenhuma spec chama registerEvent, finish, undoEvent ou correctResult. Os 437 pares de toques com menos de 1 s nunca foram testados.

**Solução.** API: test/casos/mesa.json, uma tabela por modalidade com os regulamentos gravados em produção (vôlei em melhor de 3, W.O. de 1×0 no handebol, relógio regressivo em futsal, handebol e basquete). Cada caso traz a sequência de lances e o estado esperado. test/acoes/mesa.e2e-spec.ts percorre a tabela com start, registerEvent, updateClock, undoEvent, finish com desempate, correctResult e W.O.; o que hoje está errado usa test.failing com o id do achado. Front, no job de contrato e em celular: um spec por modalidade do início ao encerramento, conferindo o placar na página pública aberta em outro contexto; toque rápido com 800 ms de atraso injetado; segundo aparelho disputando a trava.

**Tela alvo.** No check 'Contrato com a API real', o bloco 'Mesa' tem quatro linhas (Futsal, Handebol, Basquete, Vôlei), cada uma com início, lances, etapa, desfazer, encerrar e 'público atualizou em 9 s'. No PR da API aparece 'mesa.e2e-spec: 24 casos, 5 bugs conhecidos (MESA-02, MESA-03, REGRAS-R2, MESA-14, PWA-R1)'. Uma falha mostra o lance, o placar esperado e o recebido.

**Critérios de aceite**

- [ ] Um e2e por modalidade, em viewport Pixel 7, inicia, pontua, avança a etapa, desfaz, encerra e confere placar e tabela na página pública
- [ ] Com 800 ms de atraso injetado em /actions, 5 toques em 2 s resultam em 5 pontos; fica marcado como bug de SYNC até existir a fila de lances
- [ ] Vôlei: ponto depois do set decisivo é recusado, e desfazer após o fim preserva a parcial do último set; ficam marcados como MESA-03 e REGRAS-R2 até a correção
- [ ] Iniciar, soltar a trava e encerrar mantém no snapshot quem iniciou (marcado MESA-14)
- [ ] test/casos/mesa.json é a fonte que MESA e SYNC importam ao extrair a derivação do lance; caso novo entra ali, não no componente

**Onde mexer.** Front: `apps/web/tests/real/mesa-futsal.spec.ts, mesa-handebol.spec.ts, mesa-basquete.spec.ts e mesa-volei.spec.ts (novos)`, `apps/web/tests/real/mesa-toque-rapido.spec.ts (page.route com atraso)`, `apps/web/tests/real/mesa-dois-aparelhos.spec.ts (dois contextos: trava e página pública)`. API: `test/casos/mesa.json (novo)`, `test/acoes/mesa.e2e-spec.ts (novo)`, `Ações exercitadas: match/start, match/registerEvent, match/updateClock, match/undoEvent, match/finish, match/correctResult, match/update (W.O.)`.

**Depende de:** QA-I04; QA-I05; SYNC: lance enviado como incremento, com fila (PWA-R1); MESA: lançar resultado e W.O. como ação própria (MESA-01, MESA-04) ganham casos quando entrarem. **Risco:** MESA e SYNC estão reescrevendo a mesa. Seletores por rótulo acessível e casos em JSON, não no componente, reduzem o retrabalho.

<sub>Achados: TESTES-07, TESTES-09, TESTES-14</sub>

### QA-I08 · Replay dos 96 jogos e 2.689 lances de outubro como teste

Onda 1 sugerida · infra · esforço G · ~6 dia(s) · cobre 1 achado(s), 0 crítico(s)/alto(s)

**Problema.** Os dados reais revelaram bugs que nenhum teste viu: set fantasma, parcial perdida e a tabela do Vôlei contando 3 de 23 jogos. A semente de teste tem 5 jogos e nenhum Basquete. Hoje não há como saber se uma mudança na API altera o resultado de um jogo já disputado.

**Solução.** tests/real/replay-copa.ts roda depois da carga da estrutura (QA-I05). Na ordem real do tempo, envia match/start, cada lance do log (o próprio objeto do snapshot, sem placar absoluto), finish com o desempate gravado e as retificações; o basquete abandonado fica Ao vivo. Depois compara o snapshot final com tests/fixtures/copa-2026/esperado.json (placar, parciais e situação por jogo; tabela por fase; invariantes) e imprime a diferença jogo a jogo. A opção --atualizar regrava o esperado, e a diferença aparece no PR. O replay mede p50 e p95 por tipo de ação e o tamanho do snapshot, e guarda o banco final como artefato para a varredura de telas por perfil.

**Tela alvo.** No resumo do job 'Replay copa-2026': '96 jogos, 2.689 lances, 6 min 40 s · 0 diferenças contra o esperado · registerEvent p50 180 ms, p95 420 ms · snapshot 1,01 MB'. Se houver diferença, aparece uma tabela com jogo, campo, esperado e obtido, por exemplo 'Inquisidores × Furiosa · sets · 0×3 · 0×2'. Abaixo vem a varredura: 4 perfis, 38 telas, 0 telas de erro.

**Critérios de aceite**

- [ ] O replay roda em até 15 min contra a API de main, toda noite e nos PRs da API que tocam src/edition-actions, schema.prisma ou migrations
- [ ] O primeiro relatório explica cada diferença para a produção com o achado de origem (ex.: dois jogos de vôlei sem a parcial do 2º set, REGRAS-R2); nenhuma diferença fica sem explicação
- [ ] PR da API que muda placar, parcial ou tabela de qualquer jogo de outubro reprova até atualizar o esperado.json, e a mudança aparece no diff
- [ ] Métricas no resumo do job e em metricas.json, como linha de base para SYNC (snapshot hoje com cerca de 1,0 MB)
- [ ] A varredura por perfil (público, gestor, admin, super), em 412 px sobre o banco do replay, reprova 'ACESSO RESTRITO' ou 'TELA NÃO ENCONTRADA' fora do esperado e reprova tempo esgotado

**Onde mexer.** Front: `apps/web/tests/real/replay-copa.ts (novo)`, `apps/web/tests/fixtures/copa-2026/esperado.json e relatorio-replay.md (novos)`, `apps/web/tests/real/varredura-telas.spec.ts (título esperado por rota e perfil; substitui a regra de todas-as-telas.spec.ts no modo real)`, `.github/workflows/contrato-real.yml (entrada replay)`. API: `.github/workflows/replay-noturno.yml (cron; chama contrato-real.yml com replay)`, `Ações usadas: match/claimOperator, match/start, match/registerEvent, match/finish, match/correctResult (sem mudança)`.

**Depende de:** QA-I03; QA-I05; EST: tabela de Liga e grupos (CHAVE-01) muda de propósito o esperado do Vôlei; SYNC: metas de tamanho do snapshot e de latência medidas aqui. **Risco:** Estado de produção que não sai do próprio log não se reproduz, porque o desfazer apaga o lance. O relatório registra cada caso em vez de forçar igualdade.

<sub>Achados: TESTES-13</sub>

### QA-I09 · Ensaio geral com instância de ensaio e documentação de operação

Onda 1 sugerida · infra · esforço G · ~6 dia(s) · cobre 3 achado(s), 0 crítico(s)/alto(s)

**Problema.** No primeiro dia da Copa, o deploy estava parado na fila. O primeiro jogo de vôlei rodou em melhor de 5 e o W.O. virou 10 gols clicados: um ensaio teria mostrado tudo isso. O único runbook diz que a Copa 'não está no ar', e PAPEIS e REGRAS descrevem 4 perfis e um app local.

**Solução.** Instância de ensaio na VM: docker-compose.ensaio.yml nos dois repositórios, com API, Postgres e Redis próprios (sem MinIO) e web com basePath /copahalterada-ensaio e faixa fixa de ensaio. Mais um patch de duas rotas no gateway e um workflow ensaio.yml (SHA e recriar dados). O roteiro fica em ENSAIO_GERAL.md:
- D-14: versão candidata com contrato e replay verdes;
- D-7: staff ensaia no próprio celular;
- D-2: o mesmo SHA vai para produção e o congelamento é ligado.
Documentos: OPERACAO.md vira o único runbook; PAPEIS e REGRAS são reescritos a partir do código; GUIA_DA_MESA ganha uma página; BACKLOG, STACK, DEVELOPMENT e DEPLOY_PENDENTE_VM são apagados.

**Tela alvo.** No celular do gestor, /copahalterada-ensaio abre igual à produção, com uma faixa verde fixa: 'AMBIENTE DE ENSAIO · nada aqui vale'. A issue 'Ensaio geral' traz caixas de seleção, como 'Gestor de Vôlei fechou 2 sets e encerrou', 'Admin lançou W.O. no Handebol e conferiu o placar' e 'Responsável da Halterada entrou e cadastrou 5 atletas'. No fim, duas pessoas assinam o 'vai ou não vai'.

**Critérios de aceite**

- [ ] A instância de ensaio é recriada por workflow em até 10 min, com a mesma imagem que vai à produção
- [ ] Ensaio do D-7 registrado: cada gestor operou um jogo completo da sua modalidade no próprio celular, o admin fez W.O. e retificação, o responsável entrou; cada falha virou issue com dono
- [ ] No D-2, a produção roda o SHA ensaiado, com CONGELAR_DEPLOY=true, vigia verde, runner online e duas pessoas com SSH testado naquele dia
- [ ] OPERACAO.md cobre publicar, congelar, voltar versão, vigia, workflows de socorro e acessos; DEPLOY_PENDENTE_VM.md, BACKLOG.md, STACK.md e DEVELOPMENT.md apagados
- [ ] PAPEIS_E_FLUXOS.md tem 5 perfis e matriz conferida contra AdminRouteGuard.tsx e o authorize() da API; cada regra de REGRAS_DE_NEGOCIO.md diz se bloqueia ou avisa e onde é validada

**Onde mexer.** Front: `docker-compose.ensaio.yml (novo)`, `apps/web/app/components/AppShell.tsx e PublicAppShell.tsx (faixa de ensaio por NEXT_PUBLIC_AMBIENTE)`, `docs/ENSAIO_GERAL.md, docs/OPERACAO.md e docs/GUIA_DA_MESA.md (novos)`, `docs/PAPEIS_E_FLUXOS.md e docs/REGRAS_DE_NEGOCIO.md (reescritos)`, `docs/BACKLOG.md, STACK.md, DEVELOPMENT.md e DEPLOY_PENDENTE_VM.md (apagar)`, `.github/workflows/ensaio.yml (manual, novo)`. API: `docker-compose.ensaio.yml (novo)`, `.github/workflows/ensaio.yml (publicar SHA e recriar o banco a partir do artefato do replay)`, `README.md (lista de migrations e workflows atualizada)`, `incinera-gateway: rotas /copahalterada-ensaio e /intereng-api-ensaio/ (patch, no formato do gateway-rota-copahalterada.patch)`.

**Depende de:** QA-I06; QA-I08; ADM: memória livre na VM e acesso ao repositório do gateway; MESA, NAV e ATL: telas da onda 1 prontas antes do D-14, para o guia e o ensaio; DS: MARCA.md substitui VISUAL_IMPLEMENTATION_SPEC.md. **Risco:** Pode faltar memória na VM para a segunda instância. Nesse caso, o ensaio acontece em produção, numa categoria em Rascunho arquivada depois.

<sub>Achados: DOCS-11, DOCS-14, DOCS-10</sub>

### QA-I10 · Cenários compartilhados de desempate e regulamento padrão nos dois repositórios

Onda 2 sugerida · infra · esforço M · ~3 dia(s) · cobre 2 achado(s), 1 crítico(s)/alto(s)

**Problema.** A tabela de produção é gravada por computeStandings, cuja spec só tem 4 casos, todos de fair play; os testes de confronto direto estão no motor legado, que nenhuma ação chama. O regulamento padrão existe em duas cópias: sem configuração, o W.O. vale 1×0 na API e 20×0, 3×0 ou 2×0 no front.

**Solução.** Dois arquivos de casos no repositório da API, lidos pelos dois lados.
- test/casos/classificacao.json: pelo menos 12 cenários (jogos, regra, ordem esperada e critério que separou as equipes). Cobre pontos, saldo, marcados, confronto direto, empate triplo, fair play, W.O., jogo decidido nos pênaltis e empate que só o sorteio resolve. Roda em edition-action-recalculation.service.spec.ts e, no job de contrato, contra o motor do modo demonstração do front.
- test/casos/regulamento-padrao.json: por esporte, sets, pontos, set decisivo, W.O., relógio e exigência de desempate; action-regulation.spec.ts e regulation.test.ts conferem.
Futevôlei e Queimado aparecem como 'só no front' até EST unificar.

**Tela alvo.** No PR, o check da API mostra 'classificação: 14 cenários' e o de contrato mostra 'regulamento padrão: 6 esportes iguais, 2 só no front (Futevôlei, Queimado)'. Mudar o W.O. do Handebol só no front reprova com 'Handebol.walkover: front 20×0, API 1×0'.

**Critérios de aceite**

- [ ] classificacao.json, com ao menos 12 cenários, roda na API e no front; mudar um critério de um lado só reprova o CI
- [ ] Empate que só o sorteio resolve é um cenário explícito com resultado 'pendente', marcado como bug conhecido de EST (CHAVE-10) até a correção
- [ ] Se regulamento-padrao.json diverge de action-regulation.ts ou de regulation.ts, o CI fica vermelho mostrando o campo e os dois valores
- [ ] Quando EST tornar a API a única fonte do regulamento, o lado front do teste é apagado sem perder os casos

**Onde mexer.** Front: `apps/web/tests/unit/classificacao-casos.test.ts (novo; lê CASOS_DIR no job de contrato)`, `apps/web/tests/unit/regulation.test.ts`, `apps/web/app/lib/tournament-engine.ts (sob teste; usado só no modo demonstração)`. API: `test/casos/classificacao.json e test/casos/regulamento-padrao.json (novos)`, `src/edition-actions/edition-action-recalculation.service.spec.ts`, `src/edition-actions/action-regulation.spec.ts (novo)`.

**Depende de:** QA-I05; EST: critério gravado em cada posição e sorteio pendente (CHAVE-10); EST: API como única fonte do regulamento (REGRAS-07). **Risco:** Os cenários fixam o comportamento atual. EST precisa revisá-los para não congelar um critério errado como esperado.

<sub>Achados: TESTES-05, TESTES-06</sub>

**Fora de escopo, de propósito**

- Construir a imagem em runner hospedado e publicar no GHCR (PWA-08): a imagem marcada por SHA na própria VM já permite voltar versão, e com o congelamento o build na VM não concorre com jogo. Reavaliar se a VM ficar lenta.
- Homologação permanente com promoção automática de cada merge (ideia de TESTES): a instância de ensaio sob demanda cobre o pré-evento com bem menos manutenção para um time voluntário.
- Backup agendado com cópia fora da VM (APIINFRA-03, SCRIPTS-R3) é de ADM, e telemetria de erro e coletor de 5xx (PWA-07, parte de APIINFRA-10) são de SYNC e ADM. O vigia de QA só diz se está no ar, e o ensaio confere no D-2 que o último dump tem menos de 24 h.
- As correções que os testes cobram são das trilhas donas: cronômetro falso, regra congelada por partida, página da equipe e retificação por parciais (TESTES-R1 a R4), o código de avançar tempo e do set fantasma (TESTES-01, TESTES-03) e a extração da derivação do lance de matches/live/page.tsx ficam com MESA, EST, PUB e SYNC. QA entrega os testes marcados e a tabela de casos.
- Remover o modo local inteiro: ele ainda serve às capturas e à demonstração. Sai só o mock que fingia ser a API.
- Pegar regressão de contraste por comparação de pixels (PRs #116 e #117): mudança intencional regrava a referência, então contraste é assunto de DS, com teste próprio.

**Perguntas para a organização**

- Exigir 1 aprovação humana em todo PR, como pede a issue api#14? Proposta: checks obrigatórios sempre, e aprovação obrigatória só nas duas semanas do evento, para não travar correção quando houver dois voluntários.
- Quem são as duas pessoas com SSH na VM, quem recebe o alerta do vigia (e-mail do GitHub) e quem pode ligar e desligar o CONGELAR_DEPLOY?
- A VM do CIn comporta uma segunda instância, com cerca de 2 GB de memória, para o ensaio? Se não, o ensaio pode acontecer na produção, numa categoria em Rascunho arquivada depois?
- Qual é a data do próximo evento? Dela saem o D-14 (versão candidata), o D-7 (ensaio com o staff) e o D-2 (congelamento do deploy).


## IMP — Autonomia da organização: importação, prontidão e relatório

**Objetivo.** A organização carrega e corrige sozinha a tabela de jogos, colando a planilha no app, com prévia e gravação tudo ou nada. Sabe a qualquer momento o que falta antes, durante e depois do evento por uma lista única de pendências. E encerra a edição com CSVs e um relatório imprimível.

**Princípios**

- Nada é gravado sem prévia: importar e reimportar mostram, linha a linha, o que vai acontecer e gravam tudo ou nada.
- O erro vem com o conserto ao lado (usar a sugestão, definir o lado, pular a linha), sem mandar a pessoa para outra tela.
- O que a planilha não diz fica vazio e marcado ('A seguir', 'sem quadra', 'sem data'). Nunca é inventado nem exibido como certo.
- Uma regra mora num lugar só: pendências, gramática dos rótulos e colunas da planilha ficam em módulos puros, usados pelo app, pelo MCP e pelos testes.
- A planilha vai e volta: o CSV exportado é o modelo que o importador lê, e exportar, editar e reimportar mostra só a diferença.
- Toda pendência tem saída: diz o que é, quantos são e abre a tela que resolve. Fica agrupada por regra, nunca uma linha por jogo.

**Desenho alvo**

São quatro módulos puros no front e uma ação nova na API. Esta trilha não tem migração própria.

1. app/lib/importacao/ (planilha.ts, planejar.ts, diferenca.ts): texto colado ou CSV → linhas normalizadas → plano {linhas com status e conserto, itens do lote, resumo}. É a porta de planilha-copa.mjs, importar-chaveamento.mjs e planejarCopa, que já são funções puras e têm teste. Os scripts importam daqui até serem aposentados.

2. app/lib/rotulos.ts: a gramática dos lados a definir, porta de colocacao-do-chaveamento.ts. Serve ao campo 'A definir' do Novo jogo, à prévia do importador e à pendência 'rótulo não resolvido'. Quando EST guardar a vaga estruturada, só este arquivo muda.

3. app/lib/pendencias.ts: estado + agora → Pendencia[] {regra, nível, momento, título com contagem, itens com link, ação}. É a fonte única do Início (NAV), do cartão da categoria (EST), de 'Encerrar edição' (ADM), do relatório e do MCP prontidao_evento.

4. app/lib/exportacao.ts: estado → CSV/TSV de jogos, classificação e ranking, com as MESMAS colunas que o importador lê.

API: batch/apply em edition-actions.service.ts. Recebe itens de tipos que já existem (team/attach, category/update, match/schedule, match/update, match/delete), autoriza um a um e grava tudo numa transação, com uma revisão, um snapshot e um recibo. Atende o importador e a edição em lote da AGD.

Fluxo da importação: Gestão da categoria › Importar da planilha → colar ou subir → colunas reconhecidas → prévia (pronta, aviso ou erro com conserto) → 'Gravar N jogos' (batch/apply) → resultado com Desfazer → agenda da categoria. Reimportar faz o mesmo caminho e mostra só Novo, Muda e Saiu.

Fluxo das pendências: a cada revisão do snapshot roda listarPendencias(). A NAV mostra por momento: montagem antes do primeiro dia, evento durante, fechamento depois do último. Cada item abre a tela que resolve: MESA lança resultado, AGD remarca, EST confere a chave, ADM encerra.

Telas novas: /tournaments/[id]/importar, /export e /report. Componente novo: LadoDoJogoField.

Hora: o app grava a hora de parede como se fosse UTC (action-validation.ts:202). Pendências e relatório comparam com o relógio de America/Recife, nunca com Date.now() cru.

### IMP-I01 · Motor único de pendências e prontidão, no app e no MCP

Onda 0 sugerida · feature · esforço M · ~5 dia(s) · cobre 8 achado(s), 7 crítico(s)/alto(s)

**Problema.** A prontidão vive no MCP do desenvolvedor (5 checagens), e o guia do app ficou travado em 'Atletas' o evento inteiro. Em 13/10 havia 40 jogos vencidos sem resultado, 1 'Ao vivo' sem sinal desde 15:58 de 12/10, 89 sem local, 3 confrontos repetidos e 20 jogos de vôlei fora da tabela.

**Solução.** Criar app/lib/pendencias.ts: listarPendencias(estado, {agora, modalidade?}) devolve {regra, nível, momento (montagem, evento, fechamento), título com contagem, itens com link, ação}. Compara com a hora de parede de America/Recife. Montagem: categoria vazia, inscrito sem grupo, grupo fora do padrão, Liga com grupos, jogo fora da tabela, confronto repetido na fase, jogo sem quadra, rótulo que a API não resolve, chave marcada antes do fim dos grupos, W.O. incoerente, relógio que a mesa não opera, regulamento genérico (PR #95). Evento: ao vivo sem sinal há 20 min, sem resultado 60 min após o fim previsto, sets ou parciais impossíveis. Fechamento: categoria a encerrar, pódio, ranking, edição vencida. O MCP importa o mesmo módulo.

**Critérios de aceite**

- [ ] Com a fixture do snapshot privado de 13/10 (salva antes do saneamento, sem staff), a lista traz: 40 sem resultado (Futsal 20, Basquete 16, Vôlei 4), 1 ao vivo sem sinal (Mafiosa × Furiosa, desde 15:58 de 12/10), 89 sem quadra, 3 confrontos repetidos na fase de grupos do vôlei e 2 jogos de basquete com rótulo não resolvido ('Melhor classificada', '2º melhor classificada', '2º geral').
- [ ] Na mesma fixture também aponta: os 20 jogos encerrados de vôlei fora da tabela, o 'grupo c' do Handebol, a inscrita sem grupo do Vôlei Feminino, Futsal Masculino e Basquete em 'Publicado' com jogo iniciado, e a edição 2026 vencida e não finalizada.
- [ ] Jogo marcado para 19:00 não vira 'sem resultado' às 16:01 do mesmo dia (teste de fuso).
- [ ] Gestor de modalidade recebe só as pendências da modalidade dele. Com 0 atletas na edição, não aparece pendência de elenco e o guia de montagem não fica parado em 'Atletas'.
- [ ] MCP prontidao_evento e app devolvem a mesma lista para o mesmo snapshot (um teste chama os dois).

**Onde mexer.** Front: `app/lib/pendencias.ts (novo, sem enum e com imports .ts, para rodar no Node do MCP sem build)`, `app/lib/rotulos.ts (novo: porta de colocacao-do-chaveamento.ts, reaproveitada em IMP-I04 e IMP-I05)`, `app/lib/status.ts (estado exibido 'sem resultado' e 'sem sinal', compartilhado com AGD)`, `app/components/EditionProgress.tsx (passo Atletas só conta se a edição usa atletas)`, `scripts/mcp-intereng.mjs (prontidao_evento importa o módulo)`, `tests/unit/pendencias.test.ts`, `tests/fixtures/copa-2026-13out.json (snapshot de produção sem staff)`, `package.json (incluir o teste na lista de test:unit)`. API: `Nenhuma: usa o snapshot privado atual (operatorHeartbeat, events[].at, phases, assignments, periodResults)`.

**Depende de:** AGD: estados e selos que envelhecem (a mesma função decide 'sem resultado' e 'sem sinal'); EST: número do jogo e vaga estruturada (para validar 'Vencedor do Jogo N'); ADM: senha inicial pendente no snapshot (regra 'conta que ainda não entrou'). **Risco:** A lista vira ruído se cada jogo for uma linha: agrupar por regra (89 'sem quadra' numa linha só). Limiar curto gera falso alarme, com atraso mediano de 104 min.

<sub>Achados: SCRIPTS-07, JDADOS-11, JDADOS-05, JMESA-09, JORG-04, SCRIPTS-03, REGRAS-08, VADM-R4</sub>

### IMP-I02 · Blindar scripts de importação e MCP até serem aposentados

Onda 1 sugerida · infra · esforço P · ~1.5 dia(s) · cobre 1 achado(s), 0 crítico(s)/alto(s)

**Problema.** Os quatro scripts apontam para produção por padrão e entram com a senha de um admin. Só importar-copa confere a competição ativa. importar-dados só cria equipe, e o nome duplica no catálogo. O MCP devolve o staff com e-mail. E o saneamento vai rodar scripts contra produção agora.

**Solução.** Tirar a URL padrão: --api (INTERENG_API no MCP) passa a ser obrigatório, e todo script imprime 'Vai gravar em <url> · <competição> <ano>' antes do primeiro POST. Exigir --competicao e comparar com a competição ativa também em importar-chaveamento e importar-dados, reaproveitando a checagem de importar-copa.mjs:416. Em importar-dados, vincular do catálogo (team/attach) antes de criar, com a lógica de planejarCopa. No MCP, listar o staff sem e-mail. O LEIAME passa a dizer que os scripts saem quando IMP-I05 estiver em produção.

**Critérios de aceite**

- [ ] Qualquer script rodado sem --api termina com erro e não faz nenhuma requisição.
- [ ] importar-chaveamento e importar-dados com --competicao diferente da ativa abortam antes de gravar.
- [ ] importar-dados com equipe que já está no catálogo gera team/attach, não team/create (teste unitário).
- [ ] listar staff no MCP não devolve e-mail.

**Onde mexer.** Front: `scripts/importar-copa.mjs`, `scripts/importar-chaveamento.mjs`, `scripts/importar-dados.mjs`, `scripts/mcp-intereng.mjs`, `docs/copa-halterada/LEIAME.md`, `tests/unit/copa-halterada.test.ts`. API: `Nenhuma`.

**Depende de:** nada. **Risco:** Quem já roda os scripts vai errar a linha nova. A mensagem de erro mostra o comando completo e correto.

<sub>Achados: SCRIPTS-10</sub>

### IMP-I03 · Ação de lote atômica batch/apply na API

Onda 1 sugerida · infra · esforço M · ~3 dia(s) · cobre 2 achado(s), 2 crítico(s)/alto(s)

**Problema.** Importar 94 jogos são 94 POSTs. Cada um monta o snapshot inteiro, grava um recibo com ele e sobe a revisão, e uma falha no meio deixa metade gravada (importar-copa.mjs:461-479). Não existe 'tudo ou nada' nem como mandar o lote de uma vez.

**Solução.** Novo tipo batch/apply {rotulo, acoes:[{type, payload, audit}]}, tratado em edition-actions.service.ts na mesma transação. Para cada item: authorize(), handler do registro, checagem de escopo da modalidade e um audit_log. Ao fim: uma revisão, um snapshot e um recibo. Tipos aceitos: team/attach, category/update, match/schedule, match/update e match/delete; lote dentro de lote é recusado. Até 200 itens, com body JSON de 512 KB. Erro em qualquer item desfaz tudo e responde 409 com {indice, mensagem}. No front, entra o tipo em actions.ts e um caso no reducer.ts para o modo local. A edição em lote da AGD pode usar a mesma ação.

**Critérios de aceite**

- [ ] Lote com os 94 match/schedule da Copa gera 1 revisão e 1 recibo (antes eram 94 e 94) e termina em menos de 5 s no banco de ensaio.
- [ ] Item 37 inválido: nenhum jogo é gravado e a resposta é 409, com indice 37 e a mensagem do handler.
- [ ] Gestor de Futsal com um jogo de Vôlei no lote: o lote inteiro é recusado com 403.
- [ ] Reenvio com a mesma Idempotency-Key devolve o mesmo resultado sem duplicar.
- [ ] A spec cobre os 5 tipos aceitos e a recusa de match/registerEvent e de lote aninhado.

**Onde mexer.** Front: `app/lib/repositories/actions.ts (tipo batch/apply)`, `app/lib/repositories/reducer.ts (aplica os itens em sequência no modo local)`, `app/lib/repositories/http-adapter.ts (repassa o índice do item que falhou)`, `tests/unit/reducer.test.ts`. API: `src/edition-actions/edition-actions.types.ts: 'batch/apply' em EDITION_ACTION_TYPES`, `src/edition-actions/edition-actions.service.ts: laço dos itens em execute(), com authorize e audit_log por item`, `src/main.ts: limite do body JSON em 512 KB`, `src/edition-actions/batch-apply.spec.ts (novo)`, `docs/CONTRATO_API.md: nova ação`.

**Depende de:** nada. **Risco:** A trava da edição segura todas as ações durante o lote, então importar com jogo ao vivo atrasa a mesa. Medir o tempo e avisar na tela.

<sub>Achados: SCRIPTS-01, JORG-09</sub>

### IMP-I04 · Novo jogo com lado a definir e vaga na chave

Onda 1 sugerida · feature · esforço M · ~4 dia(s) · cobre 3 achado(s), 2 crítico(s)/alto(s)

**Problema.** 31 dos 94 jogos da Copa têm rótulo num dos lados ('1 GRUPO A', 'Vencedor do Jogo 16', 'Perdedor do Jogo 1 × Compressora') e só existiram por script. 'Novo jogo' aceita só equipes inscritas, e um jogo de 'Mata-mata' criado ali ganha id match-* e fica fora da chave.

**Solução.** Componente LadoDoJogoField, com 'Equipe | A definir'. 'A definir' oferece: colocado do grupo (posição e grupo da categoria), melhor colocado da posição seguinte, e vencedor ou perdedor de um jogo escolhido na lista da categoria. Mostra 'Vai aparecer como…' e grava placeholderA/B, que a API já aceita. Só oferece o que app/lib/rotulos.ts (IMP-I01) sabe que a API resolve. Em fase de formato Mata-mata, o formulário pede antes a vaga (Quartas 1, Semifinal 2, Final, 3º lugar), gera o id <categoria>-advanced-rN-M e preenche sozinho os lados das rodadas seguintes. Vaga ocupada mostra 'Abrir jogo existente'.

**Tela alvo.** Novo jogo, depois de Categoria: em Equipe A e Equipe B há dois botões, 'Equipe' e 'A definir'. Em 'A definir' aparecem dois campos curtos ('1º' e 'Grupo A') e a linha 'Vai aparecer como: 1º do Grupo A'. Com fase Mata-mata, primeiro aparece 'Vaga na chave' e os lados já vêm prontos ('Vencedor das Quartas 1'). Ação principal: Agendar jogo.

**Critérios de aceite**

- [ ] Criar pela tela a Semifinal 1 do Futsal Masculino, com data, hora e local, em até 10 toques. O jogo nasce com id …-advanced-r2-1 e lados 'Vencedor das Quartas 1 × Vencedor das Quartas 2'.
- [ ] Criar 'Perdedor do Jogo 1 × Compressora' no grupo único de 3 do Basquete Feminino, sem script.
- [ ] Rótulo que a API não resolveria ('2º geral', 'Melhor classificada') não é oferecido nem salvo.
- [ ] Vaga já ocupada não cria segundo jogo: a tela mostra o jogo existente.
- [ ] Teste e2e-http grava placeholderA/B e o snapshot devolve aDefinirA/aDefinirB, sem mudança na API.

**Onde mexer.** Front: `app/components/LadoDoJogoField.tsx (novo)`, `app/components/MatchCreationForm.tsx (lados e vaga na chave)`, `app/lib/rotulos.ts (reuso de IMP-I01)`, `app/lib/tournament-progression.ts (exportar knockoutRound)`, `app/lib/bracket-rules.ts (roundName para nomear a vaga)`, `tests/unit/rotulos.test.ts`, `tests/e2e-http/novo-jogo-a-definir.spec.ts (novo)`. API: `Nenhuma obrigatória: match/schedule aceita placeholderA/B (match-action.handler.ts:212) e lê rodada e vaga do id (:1600)`, `Opcional, junto com EST: aceitar 'Melhor Nº colocado' e 'Nº geral' em colocacao-do-chaveamento.ts`.

**Depende de:** IMP-I01; AGD: formulário de novo jogo (A SEGUIR, quadra, 'Agendar e criar outro'). É o mesmo arquivo: combinar a ordem dos PRs; EST: vaga estruturada e número do jogo (substituem o rótulo em texto e o id com rodada). **Risco:** Gerar o id com rodada no front repete o atalho do importador. Quando EST guardar a vaga em coluna, trocar aqui no mesmo PR.

<sub>Achados: SCRIPTS-05, AGENDA-13, CHAVE-08</sub>

### IMP-I05 · Importar jogos da planilha: colar, prévia, corrigir e gravar

Onda 1 sugerida · feature · esforço G · ~9 dia(s) · cobre 5 achado(s), 4 crítico(s)/alto(s)

**Problema.** A tabela de 94 jogos (8 abas, um layout por aba) só entrou por três scripts .mjs com senha de admin, commitados na madrugada depois do primeiro dia (f83c330). A organização não consegue carregar nem corrigir a própria tabela sem um desenvolvedor.

**Solução.** Portar para app/lib/importacao/ o que já é puro e testado: lerCsv, lerAba (cabeçalho por nome), dataIso, horaHHMM, grafias, grupos pelo grafo de confrontos, vagasDoMataMata, maisParecida e planejarCopa por categoria. A rota /tournaments/[id]/importar aceita colar (TSV do Google Planilhas ou CSV) ou subir um .csv, reconhece as colunas, monta a prévia linha a linha com conserto de um toque e grava tudo num batch/apply. Categoria sem jogos pode ser configurada pela planilha (inscritos, grupos e avanço via category/update). 'A SEGUIR' vira jogo sem horário (AGD). Até lá, a hora estimada vem marcada e é confirmada na prévia. O rascunho fica no aparelho.

**Tela alvo.** Gestão da categoria, Etapa 4: botão 'Importar da planilha'. A tela abre com 'Cole as linhas com o cabeçalho' e 'Escolher CSV'. Depois de colar: chips das colunas reconhecidas, faixa fixa '27 linhas · 25 prontas · 2 erros' com filtro e lista compacta ('J5 · 12/10 · A seguir · Grupo B · Halterada 2 × Devoradora'). Cada erro traz o conserto: 'Usar Engrenada', 'Definir lado', 'Pular'. Rodapé: 'Gravar 25 jogos'.

**Critérios de aceite**

- [ ] Teste dourado: as 8 abas de docs/copa-halterada/planilha geram na prévia os mesmos 94 jogos, grupos e avisos que planilha-copa.mjs + importar-copa.mjs, incluindo os jogos 6 e 8 do vôlei masculino com o grupo corrigido.
- [ ] Colar a aba Futsal Masculino (27 jogos) numa categoria configurada e gravar em até 4 toques depois de colar, sem desenvolvedor.
- [ ] Gravação atômica: se a API recusar o item 37, nenhum jogo entra e a linha 37 fica marcada com a mensagem.
- [ ] Nome com até 2 letras de diferença ('Engrenanda') sugere a equipe inscrita. Nome desconhecido bloqueia a linha. Confronto que já existe na fase vem marcado 'Pular' por padrão.
- [ ] Nenhum horário inventado aparece como confirmado: com o modo da AGD pronto, os 51 'A SEGUIR' viram 'A seguir'; antes disso, a prévia marca 'estimado' e exige confirmação.
- [ ] Gestor importa na própria modalidade; em outra, a rota mostra acesso restrito.

**Onde mexer.** Front: `app/tournaments/[id]/importar/page.tsx (novo)`, `app/components/ImportacaoDeJogos.tsx (novo: colar, colunas, prévia, gravar)`, `app/components/CorrigirLinhaSheet.tsx (novo)`, `app/lib/importacao/planilha.ts (porta de planilha-copa.mjs e importar-chaveamento.mjs)`, `app/lib/importacao/planejar.ts (porta de planejarCopa por categoria)`, `app/components/TournamentManager.tsx (botão na Etapa 4, ao lado de Montar os jogos)`, `tests/unit/importacao.test.ts (absorve copa-halterada.test.ts e chaveamento.test.ts; as 8 abas viram teste dourado)`, `tests/e2e/importar-jogos.spec.ts (novo)`. API: `batch/apply (IMP-I03)`, `Nenhuma migração própria: usa jogo sem horário e quadra da AGD quando existirem`.

**Depende de:** IMP-I03; IMP-I04; AGD: modo A SEGUIR (jogo sem horário, com ordem na quadra); AGD: quadra como entidade; AGD: detecção de confronto duplicado na API; EST: grupos como entidade e número do jogo. **Risco:** Planilha com um layout que o detector não reconhece. O mapeamento manual de colunas e o modelo exportado (IMP-I06) reduzem o risco.

<sub>Achados: SCRIPTS-01, JORG-09, SCRIPTS-04, SCRIPTS-03, DOCS-06</sub>

### IMP-I06 · Exportar jogos, tabelas e ranking em CSV no modelo da importação

Onda 2 sugerida · feature · esforço M · ~3 dia(s) · cobre 2 achado(s), 1 crítico(s)/alto(s)

**Problema.** Nada sai do app: não há CSV, impressão nem cópia (a busca por csv e createObjectURL volta vazia nos dois repositórios). O balanço de 2026 saiu por consulta de desenvolvedor, e a organização não tem um modelo de planilha que o importador leia sem adaptação.

**Solução.** app/lib/exportacao.ts, puro, gera a partir do snapshot: jogos (Nº, Data, Hora ou 'A seguir', Quadra, Grupo/Fase, Lado A, Lado B, Placar, Parciais '25-18 25-20', Desempate 'pên. 3×2', Situação, Retificado), classificação por fase e grupo (posição, J, V, E, D, pró, contra, saldo, pontos) e ranking geral. Baixa CSV com ';' e BOM, que abre certo no Excel, e oferece 'Copiar para planilha' (TSV na área de transferência) para colar no Google Planilhas pelo celular. As colunas de jogos são as que o importador lê: 'Baixar modelo' é a exportação da categoria sem resultados, já com as equipes e os grupos dela.

**Tela alvo.** Na categoria, aba Jogos: no topo, 'Baixar CSV' e 'Copiar para planilha'. Na aba Tabela, os mesmos dois botões, para a classificação. Em Gestão, 'Exportar edição' lista Jogos, Classificações e Ranking geral, cada um com Baixar e Copiar. No importador, o link 'Baixar modelo desta categoria'.

**Critérios de aceite**

- [ ] O CSV de jogos de 2026 abre no Excel pt-BR com acentos corretos e 96 linhas; o 3×3 do Futsal decidido nos pênaltis mostra 'pên. 3×2'.
- [ ] Jogo não disputado sai sem placar e com situação 'Sem resultado', nunca '0 × 0'.
- [ ] No celular, 'Copiar para planilha' cola no Google Planilhas uma coluna por campo.
- [ ] Gestor exporta só a própria modalidade; a exportação funciona sem rede, com o snapshot em cache.
- [ ] O 'Baixar modelo' de uma categoria, preenchido e colado no importador (IMP-I05), é reconhecido sem mapear nenhuma coluna.

**Onde mexer.** Front: `app/lib/exportacao.ts (novo)`, `app/lib/baixar-arquivo.ts (novo: Blob, download e área de transferência)`, `app/components/CategoryDetailView.tsx (abas Jogos e Tabela)`, `app/export/page.tsx (novo: Exportar edição)`, `app/more/page.tsx (entrada no menu)`, `app/components/ImportacaoDeJogos.tsx (link Baixar modelo)`, `tests/unit/exportacao.test.ts`. API: `Nenhuma: o arquivo é gerado no aparelho a partir do snapshot`.

**Depende de:** IMP-I05; AGD: estados e selos (Sem resultado, Adiado, Cancelado); MESA: origem do resultado (ao vivo ou súmula) para a coluna Origem; NAV: lugar do item no menu Gestão; ADM: backup diário do banco (a parte de backup de SCRIPTS-R3). **Risco:** CSV com nome de pessoa (staff, atleta) cai em LGPD, que é de ADM. Estes arquivos levam só equipes, jogos e resultados.

<sub>Achados: JORG-13, SCRIPTS-R3</sub>

### IMP-I07 · Reimportar mostrando só a diferença, e desfazer a importação

Onda 2 sugerida · feature · esforço M · ~4 dia(s) · cobre 1 achado(s), 1 crítico(s)/alto(s)

**Problema.** A planilha muda durante o evento: horários 'A SEGUIR', quadras, lados que se definem. Hoje reimportar só agenda o que falta pelo id, e mudança de hora ou local não entra. Dos 79 jogos importados, só 2 horários e 7 datas foram corrigidos, todos jogo a jogo.

**Solução.** Na tela do importador, se a categoria já tem jogos, a prévia casa cada linha com o jogo existente: primeiro pelo id determinístico (<categoria>-jN ou -advanced-rN-M), depois pelo par de lados na mesma fase. E classifica cada linha: Novo, Muda data/hora/quadra, Lado definido, Igual, Já disputado (só informa) ou Saiu da planilha. Aplica tudo num batch/apply: match/schedule para os novos, match/update só em jogo Agendada, match/delete só em Agendada nunca iniciada e marcada pela pessoa. Logo depois de gravar, 'Desfazer importação' exclui os jogos criados naquele lote, enquanto nenhum tiver começado.

**Tela alvo.** Mesma tela do importador. No topo: '27 linhas · 3 novas · 4 mudam · 19 iguais · 1 já disputada'. As iguais ficam recolhidas. Cada mudança mostra antes → depois ('12/10 08:30 → A seguir · Quadra 1'). 'Saiu da planilha' vem desmarcado. Rodapé: 'Aplicar 7 mudanças'. Depois de gravar: 'Pronto · 7 mudanças às 14:32', com 'Desfazer'.

**Critérios de aceite**

- [ ] Reimportar a mesma planilha sem mudança mostra '0 mudanças', com o botão desabilitado.
- [ ] Exportar uma categoria (IMP-I06) e reimportar o próprio arquivo dá diferença zero.
- [ ] Jogo Encerrado ou Ao vivo nunca é alterado nem excluído pela reimportação.
- [ ] Mudar a hora de 5 jogos na planilha e reimportar gera 5 match/update num único lote e 1 revisão.
- [ ] 'Desfazer' remove só os jogos criados no lote e some quando um deles é iniciado.

**Onde mexer.** Front: `app/components/ImportacaoDeJogos.tsx (modo diferença)`, `app/lib/importacao/diferenca.ts (novo)`, `app/lib/repositories/actions.ts e reducer.ts (match/delete no front, se a AGD ainda não tiver levado)`, `tests/unit/importacao-diferenca.test.ts`, `tests/e2e/reimportar-jogos.spec.ts (novo)`. API: `batch/apply com match/update e match/delete (IMP-I03); match/delete já existe na API`.

**Depende de:** IMP-I05; IMP-I06; AGD: excluir jogo pela tela (match/delete no front); AGD: mudar horário de jogo com lado a definir (AGENDA-02). **Risco:** Casar linha pelo par de lados confunde returno. Por isso o id determinístico vem primeiro, e o par só vale dentro da mesma fase.

<sub>Achados: SCRIPTS-01</sub>

### IMP-I08 · Relatório da edição para imprimir no encerramento

Onda 2 sugerida · feature · esforço M · ~4 dia(s) · cobre 1 achado(s), 0 crítico(s)/alto(s)

**Problema.** Depois do evento não há ata: campeões, tabelas finais, W.O., retificações e o que ficou sem desfecho. O balanço de 2026 (55 encerrados, 40 sem resultado, 1 retificação) foi feito pelo MCP do desenvolvedor, e nada fica guardado junto da edição.

**Solução.** Rota /report, só para o admin da edição, montada a partir do snapshot e de listarPendencias. Traz: cabeçalho com período e números (jogos por situação, W.O., retificações, atraso mediano do início por modalidade, em hora de parede); campeões por categoria (campeã, vice, 3º); ranking geral; uma seção recolhível por categoria, com tabela final e resultados com parciais; lista de W.O.; retificações (antes → depois, motivo, quem, quando); e 'Pendências no fechamento'. 'Imprimir ou salvar PDF' usa a impressão do navegador, com folha em fundo branco e títulos em Aldo, mais links para os CSVs de IMP-I06. Não há PDF gerado no servidor.

**Tela alvo.** Gestão > Relatório da edição. No topo, 'Copa Halterada 2026 · 09 a 12/10' e quatro números grandes: Encerrados, W.O., Sem resultado e Retificações. Abaixo: Campeões (uma linha por categoria, com escudo), Ranking geral, categorias recolhíveis, W.O., Retificações e Pendências no fechamento. Ação principal fixa no rodapé: 'Imprimir ou salvar PDF'.

**Critérios de aceite**

- [ ] Na fixture de 13/10, o topo mostra 55 encerrados, 40 sem resultado, 1 ao vivo e 1 retificação, e o atraso mediano do início dá 104 min (prova de que o fuso está certo).
- [ ] Categoria encerrada mostra campeã, vice e 3º. Sem pódio, diz 'pódio não definido' e entra em Pendências no fechamento.
- [ ] A impressão em A4 retrato não corta tabelas, e o 'Salvar como PDF' do Chrome gera um arquivo legível.
- [ ] Retificação aparece como '0 × 3 → 0 × 2', nunca como JSON cru.
- [ ] Gestor de modalidade recebe acesso restrito em /report.

**Onde mexer.** Front: `app/report/page.tsx (novo)`, `app/components/RelatorioDaEdicao.tsx (novo)`, `app/lib/relatorio.ts (novo: números e atraso mediano, com hora de parede)`, `app/globals.css (bloco @media print em fundo branco)`, `app/lib/tournament-progression.ts (tournamentPodium)`, `app/components/AdminRouteGuard.tsx (/report só para admin)`, `app/more/page.tsx (entrada 'Relatório da edição')`, `tests/unit/relatorio.test.ts`. API: `Nenhuma`.

**Depende de:** IMP-I01; IMP-I06; EST: pódio e campeão como dado (Liga e mata-mata); ADM: encerrar edição (justificativa das pendências assumidas); MESA: retificação formatada '0 × 3 → 0 × 2'. **Risco:** Gerado antes do saneamento, o relatório registra dado errado (10×0 clicados como Encerrada). Liberar o relatório de 2026 só depois de SAN.

<sub>Achados: JORG-13</sub>

**Fora de escopo, de propósito**

- Ler .xlsx direto: exigiria uma biblioteca de centenas de KB no app, e colar do Google Planilhas ou baixar o CSV de cada aba resolve o caso real.
- Importar resultados (placares) pela planilha: o resultado final é ação da MESA (lançar por set), e importar placar pularia a validação do regulamento.
- Criar equipes novas ou elencos pela planilha: equipe nova e lista de atletas são de ATL. O importador só vincula do catálogo e aponta o que falta.
- Lote persistente, com 'desfazer' a qualquer tempo: exigiria coluna e migração. O desfazer fica na tela de resultado, e o resto se corrige pela reimportação.
- Telas que consomem as pendências (Início 'Agora' de NAV, cartão da categoria de EST, 'Encerrar edição' de ADM) e a página pública de resultados finais (PUB): esta trilha entrega as regras e os dados.
- PDF gerado no servidor, exportação da auditoria, backup e acesso de integração para scripts: a impressão do navegador basta, e o resto é de ADM.

**Perguntas para a organização**

- A organização aceita preencher a próxima tabela no modelo do app, uma aba por categoria (Nº, Data, Hora ou 'A seguir', Quadra, Grupo/Fase, Lado A, Lado B)? Se não, o mapeamento manual de colunas vira obrigatório e o importador cresce.
- Quem pode importar e reimportar: só o admin da edição, ou também o gestor da modalidade (que não consegue vincular equipe do catálogo)?
- Depois de quanto tempo sem sinal um jogo 'Ao vivo' vira pendência (proposta: 20 min)? E quanto tempo depois do fim previsto um jogo sem início vira 'sem resultado' (proposta: 60 min)? Em 2026, o atraso mediano foi de 104 min.
- O relatório final é só interno ou vai para as atléticas? Se for enviado, a lista de retificações deve mostrar o nome de quem corrigiu?

