# Achados da varredura de outubro de 2026

Os 408 achados que sustentam [PLANO.md](PLANO.md), por área. Cada um foi lido por um agente e conferido por um revisor que tentou refutá-lo abrindo o código; "confirmado em parte" traz a correção do revisor, que vale mais que o texto original. Severidade e esforço são estimativas.

Críticos e altos aparecem completos (o que acontece, evidência, proposta). Médios e baixos aparecem numa linha, com a primeira evidência. A evidência cita o código de produção de outubro de 2026 (front `23aa938`, API `53ad276`, prefixo `api:`) e os dados do evento.

Áreas: 16 de código (NAV a SCRIPTS), 5 jornadas de usuário (JESP, JMESA, JORG, JATL, JDADOS) e 2 auditorias visuais (VPUB, VADM). Ids com `-R` foram achados pelo revisor.

## NAV — Navegação e casca

**[NAV-01] Responsável da atlética não consegue entrar nem chegar à própria equipe** — crítica, bug, esforço M, confirmado
O admin cria o acesso na tela da equipe e o app confirma que a pessoa 'já pode entrar'. Em produção ela não entra: a API recusa o login. Se entrasse, o front não saberia qual é a equipe dela, e quatro das cinco abas levariam a 'Acesso restrito', sem caminho para o elenco nem para sair da conta.
Evidência: `api:src/auth/auth.service.ts:249-291 - resolveIdentity só trata super admin, admin da edição e gestor; conta só com TEAM_MANAGER recebe 401, que o front exibe como 'E-ma…`; `apps/web/app/lib/repositories/auth-adapter.ts:92-94 - scope só é preenchido para gestor; apps/web/app/components/AdminRouteGuard.tsx:32-34,54 precisa dele para liberar /…`
Proposta: Na API, emitir sessão para TEAM_MANAGER com a equipe. No front, preencher o escopo pelo teamName, levar o login direto a /teams/[sua] e dar a esse perfil barra própria: Elenco, Jogos da atlética (leitura) e Conta. Cobrir o percurso com teste e2e.

**[NAV-02] Início mostra contadores e um 'próximo confronto' vencido, não o agora** — alta, ux, esforço M, confirmado
No dia do evento, gestor e admin abrem o app e veem quantas equipes e categorias existem. O gestor não vê o jogo que deve operar; o admin não vê jogo parado ao vivo, jogo de horário vencido sem resultado, nem categoria ou edição por encerrar. O cartão 'próximo confronto' aponta para uma partida de dias atrás.
Evidência: `apps/web/app/dashboard/page.tsx:32-41 - quatro contadores iguais para todo perfil; 'próximo confronto' é a primeira partida 'Agendada' da lista, sem olhar a data`; `api:src/edition-snapshots/snapshot.mapper.ts:286 + dados/jogos-producao.json - a lista vem por horário agendado; a primeira 'Agendada' de produção é Basquete Halterada x…`
Proposta: Trocar o painel por 'Agora'. Gestor: jogos ao vivo, atrasados e próximos da modalidade, cada um com botão do placar. Admin: pendências com link: ao vivo sem sinal, vencidos sem resultado, categorias e edição por encerrar. Guia de montagem recolhido após o primeiro jogo.

**[NAV-03] Chegar ao placar exige três toques e rolagem; a agenda esquece o dia** — alta, ux, esforço M, confirmado
Da barra inferior: Jogos, cartão da partida, rolar, Abrir placar. Ao encerrar, é preciso voltar à agenda, reencontrar o dia e repetir. Quem lançou resultados de um dia anterior — o padrão do evento — teve de renavegar até a data a cada jogo, porque a agenda sempre reabre em hoje.
Evidência: `apps/web/app/components/MatchDetailClient.tsx:45-61 - 'Abrir placar' vem depois do resumo e da lista inteira de lances; em shots/gestor/mobile/matches_semifinal-1.png fi…`; `apps/web/app/components/MatchSchedule.tsx:17,29 - o dia escolhido é estado local do componente; ao voltar da partida a agenda reabre em hoje ou no último dia com jogo`
Proposta: Pôr 'Abrir placar' no próprio cartão da agenda para quem pode operar e fixar a ação no topo do detalhe. Guardar dia e modalidade na URL da agenda. Ao encerrar, oferecer 'Próximo jogo' da mesma modalidade e do mesmo dia.

**[NAV-04] Espectador não acha os jogos da sua atlética; início público só mostra ao vivo** — alta, feature ausente, esforço M, confirmado
Quem abre o app quer saber quando e onde sua atlética joga e quanto foi o último jogo. O início público lista só partidas ao vivo; como a maioria dos placares foi lançada depois, ele pouco mostrou — e hoje exibe um jogo abandonado. Achar a atlética exige varrer dia por dia, modalidade por modalidade.
Evidência: `apps/web/app/components/PublicLiveView.tsx:18-20 + PublicMatchCollection.tsx:17,24 - a tela inicial pública filtra só status 'Ao vivo'; sem jogo ao vivo sobra uma frase …`; `apps/web/app/components/PublicTeamDetailView.tsx:16 + shots/publico/mobile/public_teams_alcateia.png - a página da atlética tem classificação e elenco; os jogos aparecem…`
Proposta: Fazer do início público a tela 'Hoje': ao vivo, próximos do dia e últimos resultados. Na página da atlética, mostrar o próximo jogo e a lista dos jogos dela. Adicionar 'Minha atlética', guardada no aparelho, que filtra a agenda e destaca esses jogos.

- **[NAV-05] Queda de rede derruba a sessão e o retorno do login abre outro jogo** — média, bug, esforço M, confirmado. `apps/web/app/lib/repositories/http-auth-adapter.ts:53-74 + apps/web/app/lib/frontend-session.ts:106-110 - com o token vencido, qualquer falha na renovação (inclusive de …`
**[NAV-06] Na agenda pública, 'Tabela de Futsal' leva ao login e os jogos não abrem** — alta, bug, esforço P, confirmado
Na aba Jogos do espectador, ao filtrar uma modalidade aparece o botão 'TABELA DE FUTSAL', que abre a tela de login do staff. E os cartões dessa agenda não são clicáveis: o detalhe do jogo, com parciais e lances, só abre pela tela Ao vivo ou entrando na categoria.
Evidência: `apps/web/app/components/PublicMatchesHub.tsx:30 - com modalidade escolhida o botão usa disciplineHref() = /disciplines/<nome> (apps/web/app/lib/edition-catalog.ts:233-23…`; `apps/web/app/components/DisciplineDetailView.tsx:29 + AdminRouteGuard.tsx:65 - a rota usa AppShell e manda quem não tem sessão para /login?redirect=...`
Proposta: Apontar o botão para a categoria pública da modalidade (direto se houver uma; lista filtrada se houver várias) e passar href /public/matches/[id] aos cartões da agenda pública. Criar teste e2e que, sem sessão, toca todo link das telas públicas e falha se cair em /login.

**[NAV-07] Área pública não tem entrada para o staff; app instalado abre fora da gestão** — alta, ux, esforço P, confirmado
Raiz, app instalado, 404 e tela offline levam à área pública, que não tem nenhum link de volta para a gestão. Instalado no celular, sem barra de endereço, o app não oferece ao mesário caminho algum até o login ou o placar; no navegador, só digitando /login.
Evidência: `apps/web/app/manifest.ts:35,49-51 - start_url e os três atalhos do app instalado são públicos (o atalho 'Agenda' abre /public/tournaments, que é a lista de categorias)`; `apps/web/app/components/PublicAppShell.tsx:31-37,56-73 - nenhuma ligação para /login ou /dashboard; Grep por '/login' em apps/web/app só acha a tela de login, o perfil e…`
Proposta: Na barra de contexto pública, mostrar 'Gestão' quando houver sessão (abre a última tela privada) e 'Entrar' discreto quando não houver. Em 404 e offline, botão conforme a sessão e 'Tentar novamente'. Trocar o atalho 'Agenda' do app instalado para /public/matches.

- **[NAV-08] Trocar o filtro de modalidade recarrega tudo e, se falhar, apaga a tela** — média, bug, esforço P, confirmado em parte. `apps/web/app/components/DisciplineSelector.tsx:66 + MatchesHub.tsx:50 + PublicMatchesHub.tsx:28 - cada toque num chip de modalidade chama refresh(), que baixa o snapshot…`
- **[NAV-09] Barra inferior e tela Mais são iguais para todos e não seguem a tarefa** — média, ux, esforço M, confirmado. `apps/web/app/components/BottomNav.tsx:11-17 - cinco itens fixos, sem consultar o papel`
- **[NAV-10] 'Voltar' descarta formulário sem avisar e a migalha aponta para redirecionamentos** — média, inconsistencia, esforço M, confirmado. `apps/web/app/components/AppShell.tsx:103-104 - 'Voltar' é <button> com router.push para o pai calculado pela URL; apps/web/app/lib/use-unsaved-changes.ts:32 só intercept…`
- **[NAV-11] Modalidade, categoria e torneio mudam de sentido entre telas e endereços** — média, inconsistencia, esforço M, confirmado. `issues/front-issue-51.json (aberta) + apps/web/app/components/PublicTournamentsPage.tsx:16-19 - a aba pública 'Modalidades' lista categorias (Futsal Masculino); na aba v…`
- **[NAV-12] Barra de contexto finge seletor e some justamente na tela do placar** — média, ux, esforço M, confirmado em parte. `apps/web/app/components/AppShell.tsx:48-52 - link com ChevronDown em toda tela privada: para o admin abre /competitions, para o gestor abre a agenda da modalidade`
- **[NAV-13] 'Esqueci a senha' e 'Alertas do app' prometem o que não existe** — média, feature ausente, esforço M, confirmado. `apps/web/app/login/page.tsx:45-50 - 'Esqueci a senha' só exibe o aviso 'Solicitação registrada. O envio será conectado ao serviço de e-mail da API'`
- **[NAV-14] No desktop o app é uma coluna de celular com barra inferior** — média, ux, esforço G, confirmado. `apps/web/app/globals.css:340,829-832 - .app-screen com largura máxima de 520 px, 760 px a partir de 900 px; a barra inferior acompanha`
**[NAV-R1] Detalhe da partida mostra relógio e minuto de lance que a mesa não opera** — alta, precisao dados, esforço P, achado pelo revisor
A mesa foi decidida sem cronômetro, mas Futsal, Handebol e Basquete seguem com relógio regressivo no regulamento. No detalhe da partida, público e interno, todo lance aparece com o mesmo minuto ('12:00' em todos os gols de handebol) e o jogo ao vivo exibe um relógio que ninguém controla. Vale para 32 partidas de produção.
Evidência: `apps/web/app/matches/live/page.tsx:83 - 'const hasClock = false': a mesa nunca mostra nem controla relógio, em qualquer modalidade`; `apps/web/app/components/MatchDetailClient.tsx:49,52 - o detalhe exibe relógio e o minuto de cada lance sempre que rules.clockMode não é 'none'`
Proposta: No detalhe da partida, esconder relógio e minuto do lance pela mesma condição da mesa (hoje, sempre sem cronômetro), usando um único helper nos dois lugares. Mostrar no lugar a etapa e a ordem do lance.

- **[NAV-R2] Gestor logado vê a área pública recortada à própria modalidade** — média, precisao dados, esforço P, achado pelo revisor. `apps/web/app/lib/repositories/http-adapter.ts:167-181 - com token guardado, toda carga usa /snapshot privado com X-Edition-Role, em qualquer rota, inclusive /public`
- **[NAV-R3] Fechar o app desloga o staff, embora a renovação valha sete dias** — média, ux, esforço P, achado pelo revisor. `apps/web/app/login/page.tsx:18,97-99 - 'Manter acesso' nasce desmarcado; a página não verifica sessão existente e sempre mostra o formulário`
- **[NAV-R4] Aba pública Artilharia só mostra que a mesa não anotou autores** — média, ux, esforço P, achado pelo revisor. `apps/web/app/components/PublicAppShell.tsx:36 - 'Artilharia' é um dos cinco itens fixos da barra pública`

Ideias de feature desta área:

- **Modo telão para a TV do ginásio** (M)
- **Compartilhar jogo com cartão de placar** (M)
- **Avisos da organização na área pública** (M)
- **QR da mesa e QR da quadra** (M)
- **Arquivo de edições anteriores na área pública** (M)
- **Aviso no celular quando a minha atlética vai jogar** (G)

## MESA — Mesa ao vivo

**[MESA-01] Não existe lançar placar final direto; a súmula vira dezenas de toques** — crítica, feature ausente, esforço M, confirmado
O placar só entra lance a lance, com a partida Ao vivo. Quem tem a súmula em papel precisa iniciar, clicar cada ponto (52 a 99 toques por jogo de vôlei, cerca de 1,4 s cada) e encerrar. Não há entrada por set nem por placar final. O único campo numérico é a retificação, que exige jogo já encerrado.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:320 - match/update recusa placar: 'só pode ser alterado por eventos, W.O. ou retificação'`; `api:src/edition-actions/edition-actions.types.ts:9-20 - nenhuma das 12 ações de partida grava resultado direto ou parcial de set`
Proposta: Criar 'Lançar resultado' na partida agendada e no cartão da agenda: formulário com placar final (no vôlei, parciais por set validadas pelo regulamento), desempate quando empatar em mata-mata, gravando direto como Encerrada, sem eventos. Nova ação match/recordResult na API.

**[MESA-02] Avançar tempo sempre falha em handebol, futsal e basquete** — crítica, bug, esforço M, confirmado
A tela opera sem cronômetro, mas a API ainda trata handebol, futsal e basquete como cronometrados e recusa a virada de tempo que a tela envia. Nenhum jogo saiu do 1º tempo, todo encerramento virou 'Encerrar antes do previsto?' e o único jogo de basquete parou no 1º período.
Evidência: `apps/web/app/matches/live/page.tsx:83 e 405-406 - hasClock fixo em false; o avanço de etapa envia paused:false sem runningSince`; `api:src/edition-actions/handlers/match-action.handler.ts:523-526 - com clockMode diferente de 'none', paused:false sem runningSince devolve 409 'Ao retomar o cronômetro,…`
Proposta: No front, enviar runningSince ao avançar a etapa (correção imediata). Na API, aceitar a virada sem relógio quando a mesa opera sem cronômetro. Esconder 'Avançar set' no vôlei. Criar teste de contrato front-API do ciclo completo por modalidade.

**[MESA-03] Vôlei: toque depois do ponto final soma um set a mais** — crítica, bug, esforço P, confirmado
Decidido o jogo, o botão Ponto continua ativo. Um toque a mais fecha o set outra vez: 0×3 numa melhor de três, e a parcial vira 10-26. Desfazer esse toque apaga a parcial do último set. Ocorreu em 3 dos 24 jogos de vôlei; um precisou de retificação.
Evidência: `apps/web/app/matches/live/page.tsx:217-229 - registerScore não verifica se um lado já venceu os sets necessários`; `api:src/edition-actions/handlers/match-action.handler.ts:710-728 - registerEvent também não verifica; o set 'decide' de novo e soma mais um`
Proposta: Bloquear lance de placar quando um lado já tem os sets para vencer, no front e na API, e mostrar 'Encerrar 2×0' no lugar dos botões. No desfazer, remover só a parcial criada pelo lance desfeito. Reparar as parciais dos 3 jogos.

**[MESA-04] W.O. fica escondido em Editar partida e aplica 1×0, não 10×0** — alta, feature ausente, esforço P, confirmado em parte
W.O. não é ação da mesa: é preciso abrir Editar partida, trocar um select, escolher o vencedor e digitar motivo, cerca de 8 toques. O placar aplicado vem do regulamento (1×0 no handebol), e a organização lançou 10×0. Oito jogos viraram 10 gols clicados, com status Encerrada e 80 gols que não existiram.
Evidência: `apps/web/app/components/MatchManager.tsx:313-315 - W.O. é uma opção do select 'Estado da partida', seguida de vencedor e motivo digitado`; `apps/web/app/matches/live/page.tsx:573-578 - o painel de antes do início só oferece 'Iniciar partida'`
Proposta: Botão W.O. no painel de pré-jogo e no cartão da agenda: escolher a equipe ausente em dois botões grandes, ver o placar que será aplicado e confirmar, com motivo pré-preenchido. Pedir o placar de W.O. ao configurar a modalidade. Corrigir os 8 jogos por script.
Correção do revisor: São 7 jogos e 70 gols, não 8 e 80. O placar de W.O. já é configurável (RegulationFields.tsx:189-190) e ficou em 1×0. A API não converte Encerrada em W.O.: o reparo exige script direto no banco.

**[MESA-05] Cada toque espera o servidor devolver a edição inteira; toque rápido se perde** — alta, desempenho, esforço G, confirmado em parte
O placar só muda quando o POST volta, e a resposta é o snapshot da edição (1 MB só de partidas). Um toque dado antes disso parte do placar antigo e a API recusa: 'diverge do valor calculado'. Não há timeout nem fila: se a rede cai o lance some, mas som e animação já tocaram.
Evidência: `apps/web/app/lib/repositories/http-adapter.ts:103-104 e 222-235 - sem atualização otimista; toda ação responde com o snapshot completo da edição`; `api:src/edition-actions/edition-actions.service.ts:381-405 - cada ação reconstrói o snapshot privado e o grava inteiro no recibo de idempotência`
Proposta: Fila local de lances: o placar atualiza na hora e os envios saem em série, só com equipe e ação (a API já calcula o resto), com reenvio automático e selo 'N pendentes'. Timeout de 8 s. Resposta só com a partida, sem previous.
Correção do revisor: Núcleo confere: sem otimismo, 409 por valor antigo, axios sem timeout. Erros: 9 intervalos abaixo de 0,5 s (mínimo 0,28) e existe um reenvio automático (api-client.ts:184-194). Resposta só com a partida contraria a arquitetura por snapshot; fila confiável é G.

**[MESA-06] Jogo abandonado fica Ao vivo para sempre; não há alerta nem como zerar** — alta, operacao, esforço M, confirmado
A trava do operador vence em 2 minutos, mas o estado Ao vivo não tem prazo, alerta nem responsável. Jogo aberto por engano ou largado no meio segue ao vivo na área pública. Não existe voltar para Agendada nem anular lances: resta encerrar com o placar que estiver, adiar ou dar W.O.
Evidência: `dados/jogos-producao.json - Basquete Mafiosa x Furiosa: iniciado 12/10 14:31, último lance 14:52, último batimento 15:58, ainda 'Ao vivo' em 13/10`; `api:src/edition-actions/handlers/match-action.handler.ts:1669 - de Ao vivo só se vai para Encerrada, Adiada ou W.O.; não existe volta para Agendada`
Proposta: Aviso no painel e na agenda, 'Ao vivo sem sinal há X min', com duas ações: Assumir e encerrar, e Anular início (volta para Agendada e descarta os lances, com motivo). Nova ação match/reset na API, para admin e gestor da modalidade.

**[MESA-07] Editar partida muda o estado para Ao vivo ou Encerrada sem aplicar regras** — alta, contrato api, esforço P, confirmado
O formulário de edição deixa encerrar um jogo ao vivo pelo select de estado. A API aceita sem definir vencedor, sem exigir desempate e sem recalcular: no recálculo seguinte o jogo conta como empate, qualquer que seja o placar, e o mata-mata não avança. Pôr Ao vivo pelo select cria partida que recusa gol.
Evidência: `apps/web/app/components/MatchManager.tsx:113 e 313 - o select oferece toda transição de lib/match-lifecycle.ts:9-10, inclusive 'Ao vivo' e 'Encerrada' (confirmado em sho…`; `api:src/edition-actions/handlers/match-action.handler.ts:326-346 - match/update grava o status; só recalcula a tabela quando é W.O. e não define vencedor`
Proposta: Tirar Ao vivo e Encerrada do select: Editar partida passa a oferecer só Adiar, Cancelar e W.O. Na API, match/update recusa essas duas transições, que ficam exclusivas de match/start e match/finish.

**[MESA-08] Painel 'Quem marcou?' abre a cada ponto e cobre Desfazer e Encerrar** — alta, ux, esforço M, confirmado
Depois de cada gol ou ponto sobe um painel fixo perguntando o autor, por cima da barra de Desfazer e Encerrar. Na Copa não havia atleta cadastrado: o painel apareceu 2.670 vezes só para dizer isso, inclusive no vôlei, onde ninguém anota autor de ponto. Fechar exige acertar um X de 24 px.
Evidência: `apps/web/app/matches/live/page.tsx:236 e 251 - todo lance de placar abre o painel, em qualquer modalidade`; `apps/web/app/matches/live/page.tsx:561-563 - sem elenco, o painel só informa 'Nenhum atleta desta equipe está inscrito'`
Proposta: Não abrir o painel quando o elenco daquele lado está vazio nem em modalidade por sets. Havendo elenco, trocar por uma faixa de números de camisa acima dos botões, que some sozinha em 5 s e nunca cobre os controles.

**[MESA-09] Público vê relógio que ninguém opera e todo gol no mesmo minuto** — alta, precisao dados, esforço P, confirmado
A mesa não tem cronômetro, mas a página pública de handebol, futsal e basquete mostra uma contagem regressiva disparada pelo toque em Iniciar, que zera sozinha, e marca todos os gols em 12:00 (ou 20:00). O jogo inteiro aparece como 1º tempo de 2.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:422 e 451 - ao iniciar, a API carimba runningSince e paused:false em toda modalidade com clockMode`; `apps/web/app/components/MatchDetailClient.tsx:35 e 49-52 - a página da partida roda o relógio e imprime a minutagem de cada lance quando clockMode não é 'none'`
Proposta: Enquanto a mesa operar sem cronômetro, a API não carimba runningSince e as telas de partida escondem relógio e minutagem, mostrando a etapa e a hora real do lance (campo at). Gravar clockMode none nas modalidades da edição.

- **[MESA-10] Mesa igual para todo esporte: cartão sem cor, falta sem contagem, botões indistintos** — média, feature ausente, esforço G, confirmado. `apps/web/app/lib/regulation.ts:94, 103, 112 e 122 - Futsal: Falta e Cartão; Handebol: Falta e 2 minutos; Basquete: só Falta; Vôlei: Falta`
- **[MESA-11] Trava vale por aba e a tela apaga: mesário perde o placar para si mesmo** — média, ux, esforço M, confirmado. `apps/web/app/lib/repositories/operator-device.ts:10-18 - a identidade da trava vive no sessionStorage: nova aba ou app reaberto é outro operador`
- **[MESA-12] Retificação mostra JSON cru ao público e não corrige parciais nem lances** — média, bug, esforço G, confirmado. `api:src/edition-snapshots/snapshot.mapper.ts:1239-1240 - before e after saem como texto JSON; em produção o valor é {scoreA:0, scoreB:3} serializado`
- **[MESA-13] Início fora da janela grava 'Registre a justificativa' sem campo para registrar** — média, ux, esforço P, confirmado. `apps/web/app/lib/match-lifecycle.ts:48 e 71-72 - janela de 30 min antes e 180 depois; a mensagem termina em 'Registre a justificativa.'`
- **[MESA-14] Quem iniciou a partida some assim que o operador sai da tela** — média, bug, esforço M, confirmado. `api:src/edition-snapshots/snapshot.mapper.ts:923 - o startedBy do snapshot é match.operatorName, o operador do momento`
**[MESA-R1] Retificar jogo de grupo apaga a chave de mata-mata publicada da categoria** — alta, bug, esforço M, achado pelo revisor
Ao retificar um resultado da fase de grupos, a API apaga todos os jogos de mata-mata ainda agendados da categoria, com data, horário, local e cruzamentos importados da planilha. A chave só volta quando o grupo termina, por semeadura automática. Se algum jogo do mata-mata já foi operado, a retificação é recusada e não existe ação de anular.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:1150-1158 - correctResult recusa se houver dependente já operado ('Anule-as antes') e apaga todos os dependentes…`; `api:src/edition-actions/handlers/match-action.handler.ts:1213-1220 - para jogo fora do mata-mata, dependentes são todas as partidas '<categoria>-advanced*'`
Proposta: Na retificação, não apagar partidas: manter os jogos do mata-mata e só trocar participantes que mudarem, preservando data, horário e local. Permitir retificar jogo de grupo com mata-mata iniciado quando a classificação não muda. No diálogo, listar os confrontos afetados pelo nome.

- **[MESA-R2] Mudar o regulamento da modalidade altera partidas já iniciadas e encerradas** — média, precisao dados, esforço M, achado pelo revisor. `api:src/edition-snapshots/snapshot.mapper.ts:865 e 897 - o campo rules de cada partida sai da configuração atual da modalidade`
- **[MESA-R3] Vôlei com sets empatados não encerra: API exige desempate que a mesa não envia** — média, bug, esforço P, achado pelo revisor. `apps/web/app/lib/match-lifecycle.ts:136-140 - em sets, evaluateFinish nunca pede desempate; devolve só encerramento antecipado`
- **[MESA-R4] Cada toque grava o snapshot inteiro num recibo que nunca é apagado** — média, operacao, esforço P, achado pelo revisor. `api:src/edition-actions/edition-actions.service.ts:391-405 - cada ação cria EditionActionReceipt com o envelope completo em responseData`

Ideias de feature desta área:

- **Fila da mesa: próximo jogo e resultados pendentes** (P)
- **Telão: placar em tela cheia para o ginásio** (P)
- **Segundo aparelho como anotador** (M)
- **Formato por fase ou por partida** (M)
- **Foto da súmula anexada ao resultado** (M)
- **Cartão de resultado para compartilhar** (P)

## AGENDA — Agenda e partidas

**[AGENDA-01] Agenda exige horário fixo; 'A SEGUIR' vira horário inventado exibido como real** — crítica, precisao dados, esforço G, confirmado
A organização trabalha por ordem na quadra, mas o modelo só aceita data e hora fixas. O importador inventou horário para 52 jogos e nada marca que é estimativa: público e mesa leem '10:30' como compromisso. O início real ficou a 104 min de mediana do previsto, e a justificativa de atraso virou texto automático.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:221-223 - agendar exige data, hora e local; api:schema.prisma:438-508 - Match não tem ordem na quadra nem marca …`; `apps/web/scripts/planilha-copa.mjs:204-213 - 'A SEGUIR' vira horário do jogo anterior + duração; a marca 'provisório' fica só no log do importador`
Proposta: Criar o modo 'A SEGUIR': jogo com dia, quadra e posição na fila; horário opcional e marcado como previsão. Agenda ordena por quadra e fila e mostra 'A seguir · 3º da Quadra 1'. Jogo sem horário firme não pede justificativa de atraso.

**[AGENDA-02] Mudar horário, local ou estado de jogo com lado 'a definir' sempre falha** — crítica, bug, esforço P, confirmado
Em Editar partida, salvar um jogo Agendada envia sempre os dois nomes. Se um lado ainda é 'Vencedor do Jogo 16', a API procura uma equipe com esse nome e recusa. Não dá para mudar horário ou local, adiar nem cancelar semifinal ou final antes de os participantes existirem; só 'Definir participante' funciona.
Evidência: `apps/web/app/components/MatchManager.tsx:175 - todo salvamento de jogo Agendada envia entryA/entryB, mesmo quando o valor é um rótulo`; `api:src/edition-actions/handlers/match-action.handler.ts:1577 e 1642-1657 - o rótulo é buscado como equipe inscrita e a API responde 404 'não está inscrito de forma ineq…`
Proposta: Enviar entryA/entryB só quando o usuário trocou aquele lado; na API, ignorar nome igual ao rótulo atual. Cobrir com teste e2e em modo HTTP: mudar horário e local de jogo com rótulo.

**[AGENDA-03] 'Encerrada' e 'Ao vivo' no select de Editar partida pulam início e encerramento** — alta, bug, esforço P, confirmado
Num jogo ao vivo, Editar partida oferece o estado 'Encerrada' e confirma dizendo que o resultado alimenta classificação e chaveamento. A API só troca o status: não grava vencedor, não recalcula a tabela, não avança a chave. No recálculo seguinte o jogo entra como empate, qualquer que seja o placar. 'Ao vivo' pelo select também pula o início.
Evidência: `apps/web/app/lib/match-lifecycle.ts:9-10 + apps/web/app/components/MatchManager.tsx:113 e 313 - o select de estado oferece 'Ao vivo' e 'Encerrada'; a confirmação promete…`; `api:src/edition-actions/handlers/match-action.handler.ts:326-345 - match/update grava o status sem vencedor e só recalcula quando é W.O.`
Proposta: Tirar 'Ao vivo' e 'Encerrada' do select: iniciar e encerrar só pelo placar. Na API, match/update recusa transição para LIVE e FINISHED com mensagem que aponta o placar.

**[AGENDA-04] Não existe edição em lote: local e horário mudam um jogo por vez** — alta, feature ausente, esforço G, confirmado
Toda mudança de agenda exige abrir o jogo, entrar em Editar partida, mexer em até três campos e salvar. Preencher o local dos 94 jogos importados pedia 94 passagens por essa tela; ninguém fez. Não dá para atrasar o resto do dia de uma quadra, mover uma rodada de dia nem trocar o ginásio de uma modalidade.
Evidência: `produção: 89 de 96 jogos terminaram o evento com local 'A definir'; os 7 com local são exatamente os 7 criados à mão (ids match-...)`; `apps/web/app/components/TournamentManager.tsx:233 - gerar confrontos carimba todos no 1º dia, 08h-17h em ciclo, local 'A definir' (produção: generated-1..10 do Vôlei em …`
Proposta: Modo seleção na agenda (marcar jogos ou 'todos do dia, da quadra, da categoria') com ações: definir local, mover de dia, deslocar horário ±N min, adiar. Uma ação match/bulkUpdate transacional, com um motivo e um registro de auditoria.

**[AGENDA-05] Jogo atrasado aparece como 'Próximo' e some da agenda do dia** — alta, ux, esforço M, confirmado em parte
Jogo que passou do horário sem ser aberto continua 'Próximo', sem alerta, e fica preso na página do seu dia: quem abre a agenda em 12/10 não vê as semifinais marcadas em 11/10. No Início, 'Próximo confronto' é o jogo Agendada mais antigo da edição, de qualquer modalidade, mesmo vencido.
Evidência: `produção: 36 jogos com data passada seguem Agendada; semifinais do Vôlei marcadas em 11/10 13:30 e 14:15 enquanto os grupos da categoria foram jogados em 12/10`; `apps/web/app/lib/status.ts:74-78 + apps/web/app/components/MatchCard.tsx:20 - Agendada vencida recebe selo 'Próximo' e tom azul, igual a jogo futuro`
Proposta: Selo 'Atrasado há N min' no cartão. Bloco 'Pendentes' no topo da agenda com jogos vencidos de qualquer dia e ações Abrir placar, Remarcar, W.O., Cancelar. No Início, listar ao vivo e próximos da modalidade do gestor, pelo horário real.
Correção do revisor: Selo 'Próximo' e lista por dia conferem. Correções: são 40 Agendadas vencidas, não 36; em produção o gestor só recebe a própria modalidade (snapshot.mapper.ts:70), então o Vôlei no Início dele é artefato da demonstração local.

- **[AGENDA-06] Local do jogo é texto livre e 'A definir' funciona como valor mágico** — média, feature ausente, esforço G, confirmado. `api:schema.prisma:493 - venue String?, sem entidade de quadra; api:src/edition-actions/handlers/match-action.handler.ts:223 - só exige 2 caracteres`
**[AGENDA-07] Rótulos do mata-mata só se resolvem com todos os grupos encerrados, sem aviso** — alta, precisao dados, esforço G, confirmado
A chave só troca rótulo por equipe quando todos os jogos de grupo da categoria têm resultado oficial; um jogo cancelado trava para sempre e nenhuma tela diz o que falta. Um rótulo fora da gramática faz a API preencher a chave pela semeadura automática, não pelo cruzamento publicado. O cartão não mostra o número do jogo citado.
Evidência: `api:src/edition-actions/edition-action-recalculation.service.ts:473-475 (e apps/web/app/lib/tournament-progression.ts:157) - a 1ª rodada só é preenchida com TODOS os jog…`; `produção: Futsal Masc. com 3 de 15 jogos de grupo encerrados, Basquete Masc. 0 de 9, Basquete Fem. 0 de 3 - por isso 13 jogos de chave ficaram em rótulo; os 2 do Vôlei e…`
Proposta: Mostrar na categoria e no cartão 'Faltam N jogos do Grupo A para definir'. Resolver cada lado quando o grupo dele fechar; desconsiderar cancelados. Rótulo não entendido bloqueia a semeadura e pede escolha manual. Exibir 'Jogo 16' em todo cartão.

**[AGENDA-08] Jogo duplicado não é detectado e a tela não exclui nem move de grupo** — alta, precisao dados, esforço M, confirmado
O mesmo confronto pode existir duas vezes na categoria: o gerador não olha os jogos já importados ou criados à mão, e o alerta de duplicidade exige horário idêntico. Em produção dois confrontos de vôlei foram lançados duas vezes, um deles com resultados opostos. Pela tela não se exclui jogo nem se corrige o grupo.
Evidência: `produção (Vôlei, category-7213ebd17f31): Halterada 2 x Incinera encerrado duas vezes (generated-7 e j3); Inquisidores x Furiosa com 0x2 em generated-8 e 2x0 em match-34c…`; `apps/web/app/lib/scheduling-rules.ts:104 - 'confronto duplicado' só dispara com o mesmo par no mesmo minuto; api:src/edition-actions/handlers/match-action.handler.ts:172…`
Proposta: Avisar, ao agendar ou gerar, quando o par já existe na mesma categoria ('já agendado em 10/10 11:15'). Em Editar partida: botão Excluir (só Agendada nunca iniciada) e campo Grupo/fase, usando match/delete e patch.phase que a API já aceita.

**[AGENDA-09] Jogo não disputado aparece como 0 — 0; cancelado aparece como 'Encerrado'** — alta, precisao dados, esforço M, confirmado
Em produção todo jogo ainda não iniciado chega da API com placar 0 e os cartões, internos e públicos, mostram '0 — 0', inclusive entre dois rótulos de chave. Os estados se reduzem a três selos: cancelado sai como 'Encerrado 0 — 0', adiado como 'Próximo', W.O. como 'Encerrado'. O detalhe mostra a data crua, '2026-10-12'.
Evidência: `api:src/edition-snapshots/snapshot.mapper.ts:882-883 - scoreA/scoreB sempre enviados; produção: as 40 Agendadas têm scoreA=0 e scoreB=0 (nenhuma com null)`; `apps/web/app/components/MatchScoreCard.tsx:63 e MatchSummary.tsx:10 - só mostram traço quando o placar é null; as capturas mostram '— — —' porque a demonstração usa null`
Proposta: Cartão e resumo decidem pelo status: sem placar em Agendada, Adiada e Cancelada. Selos próprios 'Adiado', 'Cancelado', 'W.O.' e 'Atrasado'. A API deixa de enviar placar de jogo não iniciado. Data do resumo no mesmo formato do cartão.

**[AGENDA-10] W.O., adiar e cancelar ficam escondidos num select dentro de Editar partida** — alta, ux, esforço M, confirmado
Dar W.O. exige: agenda, cartão, Editar partida, achar 'W.O.' no campo Estado da partida, escolher vencedor, digitar motivo e confirmar. O placar, onde a mesa está, não oferece. Em produção os prováveis W.O. de handebol foram lançados como 10 gols clicados e ficaram 'Encerrada'. Adiar exige já saber a nova data.
Evidência: `produção: 7 jogos de handebol 10x0/0x10 com exatamente 10 eventos em 0-1 min, status Encerrada (jogos-resumo.json; EVIDENCIA_PRODUCAO.md item 2 lê como W.O. clicado)`; `produção: nenhum dos 96 jogos está em W.O., Adiada ou Cancelada, embora 36 não tenham sido abertos e uma atlética tenha saído`
Proposta: Menu 'Não vai acontecer' no detalhe e no placar de jogo agendado: W.O. (toque na equipe presente), Adiar (nova data opcional), Cancelar; motivo em lista curta mais texto livre. O campo Estado da partida sai do formulário de edição.

- **[AGENDA-11] Alertas de conflito nunca bloqueiam, geram ruído e contradizem a regra documentada** — média, inconsistencia, esforço M, confirmado. `docs/REGRAS_DE_NEGOCIO.md:40-46 - fora da edição, confronto repetido, quadra ocupada e equipe em dois jogos: 'Bloqueia'`
- **[AGENDA-12] Agenda só filtra por modalidade e dia: sem busca, estado, atlética ou quadra** — média, feature ausente, esforço M, confirmado. `apps/web/app/components/MatchesHub.tsx:50-51 e MatchSchedule.tsx:38-47 - únicos controles: seletor de modalidade e troca de dia (capturas admin/mobile/matches.png e gest…`
- **[AGENDA-13] Jogo avulso de mata-mata fica fora da chave e não aceita rótulo** — média, precisao dados, esforço M, confirmado em parte. `apps/web/app/components/MatchCreationForm.tsx:66 e 101 - o formulário oferece a fase 'Mata-mata' e cria o jogo com id match-...`
- **[AGENDA-14] Retirar atlética no meio do torneio exige ajustar jogo por jogo** — média, feature ausente, esforço G, confirmado. `produção: 4 jogos do Vôlei (category-a15edc3a59ed, j3 a j6) com motivo digitado 'Ajuste de/dos jogos, após a remoção da Atlética COMPRESSORA'`
**[AGENDA-R1] Jogo fora do grupo das equipes some da classificação: Vôlei contou 3 de 23** — crítica, precisao dados, esforço M, achado pelo revisor
A tabela de uma fase com grupos só soma jogo ligado a um grupo e entre equipes daquele grupo. Jogo criado como 'Fase de grupos', jogo com adversário trocado e equipe sem grupo ficam fora, sem aviso. Em produção a classificação pública do Vôlei ignorou 20 de 23 jogos encerrados e a chave feminina saiu dela.
Evidência: `api:src/edition-actions/edition-action-recalculation.service.ts:104-112 e 195-198 - fase com grupos só conta jogo com groupId e com as duas equipes alocadas naquele grup…`; `apps/web/app/components/MatchCreationForm.tsx:66 e TournamentManager.tsx:41 e 117 - grupo só é oferecido no formato 'Grupos'; trocar para 'Liga' esconde os grupos sem ap…`
Proposta: API recusa jogo sem grupo em fase com grupos e jogo cujas equipes não são do grupo, no agendamento e na troca de adversário. Categoria mostra 'N jogos encerrados fora da tabela' com correção de grupo. Trocar o formato da fase limpa os grupos.

**[AGENDA-R2] 'Montar os jogos' apaga a chave importada e duplica grupos sem confirmação** — alta, bug, esforço M, achado pelo revisor
Numa categoria que veio da planilha, o botão 'Montar os jogos' não pede confirmação: cria todos-contra-todos por cima dos jogos importados e apaga os jogos de chave já agendados, com as datas publicadas. A tela só avisa quando os jogos anteriores foram criados pelo próprio gerador.
Evidência: `api:src/edition-actions/handlers/category-action.handler.ts:185-197 - regerar apaga todo jogo <categoria>-advanced*, inclusive a chave importada com data e hora, e manté…`; `apps/web/app/components/TournamentManager.tsx:46-47, 218 e 313 - a confirmação só aparece se setup.generated; botão ativo em Rascunho e Publicado; :117 qualquer ajuste d…`
Proposta: Antes de montar, mostrar o que existe e o que será apagado ('14 jogos agendados, 8 da chave'). O gerador só apaga jogos que ele criou; pares já agendados na categoria são pulados. Com jogo importado ou avulso, exigir confirmação digitada.

- **[AGENDA-R3] Jogo adiado não pode ser iniciado pelo placar nem editado sem nova data** — média, bug, esforço P, achado pelo revisor. `apps/web/app/lib/match-lifecycle.ts:12 e 65 + apps/web/app/matches/live/page.tsx:325 - 'Adiada' não transita para 'Ao vivo': o placar responde 'Uma partida adiada não po…`
**[AGENDA-R4] Agenda pública: cartão não abre o jogo e 'Tabela de X' leva ao login** — alta, bug, esforço P, achado pelo revisor
Na aba Jogos da área pública, tocar num cartão não faz nada: parciais, lances e artilheiros do jogo só são alcançados por outras telas. Com uma modalidade selecionada, o botão 'Tabela de Futsal' manda o espectador para uma rota interna, que o joga na tela de login.
Evidência: `apps/web/app/components/MatchSchedule.tsx:47 - com publicView o cartão recebe href indefinido; o hrefBase='/public/matches' passado em PublicMatchesHub.tsx:29 nunca é us…`; `apps/web/app/components/PublicMatchesHub.tsx:30 + apps/web/app/lib/edition-catalog.ts:233-235 - com modalidade escolhida, 'TABELA DE FUTSAL' aponta para /disciplines/fut…`
Proposta: Ligar o cartão da agenda pública a /public/matches/<id>. Trocar o botão por 'Tabela de <categoria>' apontando para /public/tournaments/<id>, ou para a lista quando houver mais de uma. Teste e2e sem sessão percorrendo todos os links da agenda pública.


Ideias de feature desta área:

- **Quadro do dia por quadra** (G)
- **Previsão de início ao vivo** (M)
- **Importar tabela de jogos pela tela** (G)
- **Distribuidor automático de jogos em quadras** (G)
- **Seguir atlética e aba Meus jogos** (M)
- **Programação do dia para compartilhar** (M)

## CHAVE — Categorias, tabela e chave

**[CHAVE-01] Tabela oficial ignora em silêncio jogos que não casam com um grupo** — crítica, precisao dados, esforço M, confirmado
A API só soma jogo ligado a um grupo com as duas equipes nele. Trocar a fase para Liga esconde os grupos sem apagá-los, o formulário aceita qualquer par em qualquer grupo e equipe pode ficar sem grupo. No Vôlei, 3 de 23 jogos entraram; Inquisidores (5 vitórias em 5) não aparece; o Masculino mostra tabela vazia.
Evidência: `api:src/edition-actions/edition-action-recalculation.service.ts:104-124 e :196-198 - fase com grupos (mesmo em formato Liga) soma só jogo com groupId e com as duas equip…`; `apps/web/app/components/TournamentManager.tsx:41, :115-118, :301 e MatchCreationForm.tsx:66, :139-141 - formato muda sem limpar grupos; campos de grupo somem; qualquer p…`
Proposta: API: Liga vira tabela única com todos os jogos da fase; trocar formato apaga grupos ocultos; agendamento recusa jogo fora do grupo. Tela: equipes filtradas pelo grupo, exigir grupo para todas e listar 'jogos encerrados fora da tabela'. Recalcular o Vôlei.

**[CHAVE-02] Mata-mata é preenchido sem conferência e pode trocar a chave publicada** — crítica, precisao dados, esforço G, confirmado
Ao encerrar o último jogo da fase anterior, a API preenche a chave na mesma transação, sem prévia. Se um rótulo não é entendido ('Melhor 2º colocado', '2º geral'), troca todos os cruzamentos pela semeadura automática. Rodadas seguintes cruzam sempre vaga 1 × vaga 2. No Vôlei Feminino preencheu semifinais com a tabela errada, depois do campeonato decidido.
Evidência: `api:src/edition-actions/edition-action-recalculation.service.ts:462-491 e :567 - createFirstRound roda dentro de match/finish (handlers/match-action.handler.ts:1103); um…`; `api:src/edition-actions/chave-publicada.spec.ts:156-167 - teste fixa esse comportamento; docs/copa-halterada/LEIAME.md:71-74 diz que esses rótulos seriam definidos à mão`
Proposta: Quando a fase anterior termina, abrir 'Conferir chave': confrontos calculados, origem de cada vaga e pendências (rótulo não resolvido, empate por sorteio). Só preencher após confirmação. Guardar cada vaga como referência estruturada (vencedor/perdedor do jogo X, Nº do grupo Y) e resolver por ela.

**[CHAVE-03] Depois do primeiro jogo operado não dá para incluir nem retirar equipe** — crítica, feature ausente, esforço G, confirmado
A API recusa qualquer mudança de participantes, seeds, fases ou grupos quando existe jogo ao vivo, encerrado ou W.O. A tela trava por situação, não por jogo: com categoria 'Publicado' e jogos operados (Futsal e Basquete Masculino) mostra tudo editável e devolve erro 409. Incluir três equipes no Vôlei masculino dependia de um PR que não entrou.
Evidência: `api:src/edition-actions/handlers/category-action.handler.ts:226-246 - assertOperatedStructureUnchanged bloqueia participantes, seeds, fases, grupos e distribuições após …`; `apps/web/app/components/TournamentManager.tsx:40 e :295 - trava só por status; texto afirma 'Participantes e fases continuam editáveis até o início'`
Proposta: Criar duas ações auditadas: 'Incluir equipe' (escolhe grupo, cria os jogos que faltam) e 'Retirar equipe' (motivo; W.O. ou anulação dos jogos conforme regra escolhida). A tela trava pelos mesmos critérios da API e explica o porquê em cada campo.

**[CHAVE-04] Aba Chaveamento fica vazia em produção e não existe desenho da chave** — alta, bug, esforço M, confirmado
A aba filtra jogos pelo nome da fase com a expressão 'semi|quart|final'. Em produção os 24 jogos eliminatórios vêm com fase 'Mata-mata', então a aba diz que a chave ainda não foi gerada. O snapshot não envia rodada nem vaga: cartões e página do jogo mostram só 'MATA-MATA', sem dizer qual é a final.
Evidência: `apps/web/app/components/TournamentClassification.tsx:94 e :121 - filtro por regex no nome da fase e lista numerada, sem rodadas, horário ou link`; `api:src/edition-snapshots/snapshot.mapper.ts:877-930 (phase em :893-895) - partida sai sem round/bracketSlot; a fase do mata-mata é o nome da fase`
Proposta: API envia round, bracketSlot e marca de 3º lugar. Front desenha a chave por rodada (colunas com rolagem lateral no celular), com rótulo 'a definir', placar, horário e link do jogo; cartões passam a dizer Quartas, Semifinal, Final ou 3º lugar.

**[CHAVE-05] Jogo agendado errado não pode ser excluído nem trocado de grupo pela tela** — alta, feature ausente, esforço M, confirmado
A API ganhou 'match/delete' e troca de fase em 10/10, no meio do evento, mas o front não tem nenhuma das duas ações. A única saída na tela é cancelar, e um jogo de grupo cancelado impede para sempre o preenchimento do mata-mata. Sobraram na agenda chaves fantasmas e confrontos duplicados com resultados opostos.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:279-289 e :349-367 (commit 960503a, 10/10) - mover de fase e excluir partida agendada existem só na API`; `apps/web/app/lib/repositories/actions.ts:16-35 - não há 'match/delete'; MatchManager.tsx não edita fase nem grupo`
Proposta: No detalhe do jogo agendado e nunca iniciado: botões 'Excluir jogo' e 'Mover para outro grupo/fase', com confirmação. Aviso de confronto repetido na mesma fase ao agendar e ao lançar. Na API, jogo Cancelado deixa de bloquear a primeira rodada do mata-mata.

**[CHAVE-06] MONTAR OS JOGOS apaga a chave publicada e duplica jogos sem perguntar** — alta, bug, esforço M, confirmado
O botão fica ativo enquanto a categoria está 'Publicado', mesmo com jogos encerrados. Só pede confirmação se 'generated' for verdadeiro; categoria importada tem falso. A API apaga todo jogo '-generated-' e '-advanced' e cria o turno completo, ignorando jogos importados ou agendados à mão. Os novos nascem no primeiro dia da edição, de hora em hora, com local 'A definir'.
Evidência: `apps/web/app/components/TournamentManager.tsx:206-218 e :313 - confirmação só quando setup.generated é verdadeiro; botão desabilita apenas por status`; `api:src/edition-actions/handlers/category-action.handler.ts:185-197 - deleteMany de '-generated-' e '-advanced'; motivo exigido só se algum já saiu de Agendada`
Proposta: Antes de gerar, mostrar prévia: jogos que já existem, os que serão criados e os que seriam apagados. Gerar só os confrontos que faltam, nunca apagar a chave agendada, e pedir dia, horário inicial, intervalo e local em vez de inventar.

- **[CHAVE-07] Situação da categoria não acompanha os jogos e não tem volta** — média, inconsistencia, esforço M, confirmado. `api:src/edition-actions/edition-action-recalculation.service.ts:308-309, :390-393, :504, :781 - únicos pontos que mudam o status; sem fase Mata-mata retorna cedo`
**[CHAVE-08] Formatos da Copa não cabem na tela; lado a definir só por script** — alta, feature ausente, esforço G, confirmado
O modelo cobre grupos + mata-mata, liga e 3º lugar. Não cobre grupo único de 3 com jogos encadeados ('Perdedor do Jogo 1 × Compressora'), rótulos gerais ('2º geral', 'Melhor classificada') nem cruzamento escolhido pela organização. O formulário de jogo só aceita equipes inscritas: lado 'a definir' entra apenas pelo importador, e 'melhor 2º' foi encaixado no campo 'melhores terceiros'.
Evidência: `docs/copa-halterada/LEIAME.md:25-33 e :71-74 - contornos do conversor e rótulos que a API não resolve`; `apps/web/scripts/importar-copa.mjs:45-68 e :336-341 - bestThirds usado como 'melhor 2º'; jogos encadeados entram como partidas avulsas no grupo`
Proposta: Oferecer modelos prontos ao criar a categoria (grupos + mata-mata, liga, liga + final, grupo único de 3, mata-mata direto) e, no agendamento, lado 'a definir' com seletor estruturado: vencedor/perdedor do jogo N, Nº do grupo X, melhor Nº colocado, Nº geral.

**[CHAVE-09] Gestão grava a categoria inteira a cada toque ou tecla, sem rascunho local** — alta, ux, esforço M, confirmado
Cada checkbox, seed, letra do nome da fase ou do grupo dispara um POST com a categoria completa e espera o snapshot da edição (1,7 MB com 96 jogos). Sem atualização otimista, o segundo toque parte do estado antigo e desfaz o primeiro; campo apagado para redigitar gera erro por tecla. Outro aparelho desatualizado regrava situação e estrutura.
Evidência: `apps/web/app/components/TournamentManager.tsx:79-82, :99-105, :115-127, :299 - toda alteração chama dispatch com o setup inteiro, inclusive onChange de texto e de número`; `apps/web/app/lib/repositories/http-adapter.ts:103 - 'não há atualização otimista: a resposta é a verdade'`
Proposta: Cada etapa vira formulário com estado local e botão 'Salvar etapa' fixo no rodapé, uma requisição por etapa, indicador 'salvo às HH:MM' e aviso ao sair com mudança pendente. A API recebe ações parciais (participantes, grupos, avanço) com controle de versão.

- **[CHAVE-10] Sorteio é ordem por ID interno e a tabela oficial não mostra o desempate** — média, precisao dados, esforço G, confirmado em parte. `api:src/edition-actions/edition-action-recalculation.service.ts:239-241 x apps/web/app/lib/tournament-engine.ts:89-92 - sorteio = ordem de entryId no servidor e de nome …`
- **[CHAVE-11] Três cálculos de tabela diferentes: servidor, aba Tabela e página da equipe** — média, inconsistencia, esforço P, confirmado. `apps/web/app/components/TeamPerformance.tsx:22-24 - calculateStandings com todos os jogos da categoria e regra padrão (apps/web/app/lib/tournament-engine.ts:35)`
- **[CHAVE-12] Gestão da categoria: 5 telas de rolagem, publicação no topo e rótulos que enganam** — média, ux, esforço G, confirmado em parte. `shots/metricas.json (admin 412x915, /tournaments/futsal-m/manage) - 5,1 telas, 65 interativos, 37 campos, 44 alvos menores que 44 px (checkbox 13x13, seed 48x27); captur…`
- **[CHAVE-13] Grupos são texto livre separado por vírgula e não podem ser renomeados** — média, ux, esforço M, confirmado. `apps/web/app/components/TournamentManager.tsx:124-127 e :301 - split por vírgula a cada tecla; opção 'Definir grupo' envia '' e a API recusa`
**[CHAVE-R1] Retificar placar de grupo apaga a chave publicada e trava após o mata-mata** — crítica, precisao dados, esforço M, achado pelo revisor
Retificar o resultado de qualquer jogo de grupo apaga todos os jogos do mata-mata ainda agendados, inclusive a chave publicada com dia, hora e rótulos. Ela só volta quando o grupo termina, por semeadura automática, no dia seguinte às 18:00. Se algum jogo eliminatório já foi operado, a retificação é recusada e a tela manda 'anular', ação que não existe.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:1150-1158 e :1208-1220 - retificar jogo fora do mata-mata apaga todo jogo '-advanced' ainda agendado; se algum j…`; `apps/web/app/components/MatchManager.tsx:207-212 e :326-332 - aviso diz que os confrontos 'serão refeitos' e manda 'anular' partidas; não existe ação de anular (api:src/…`
Proposta: Na API, retificar não apaga jogo agendado: recalcula a tabela e só reabre os lados da primeira rodada se os classificados mudarem, mantendo dia, hora e local. Com mata-mata iniciado, permitir quando a classificação não muda. Tela lista o impacto por nome de equipe.

**[CHAVE-R2] Desmarcar equipe apaga a inscrição e esvazia os jogos dela sem perguntar** — alta, bug, esforço M, achado pelo revisor
Enquanto nenhum jogo foi operado, um toque no checkbox da Etapa 1 tira a equipe da categoria. A API apaga a inscrição e o banco zera o lado dela em todos os jogos agendados, que passam a mostrar 'Equipe A'. Marcar de novo cria outra inscrição e não devolve os jogos. Remover uma fase apaga os jogos dela.
Evidência: `apps/web/app/components/TournamentManager.tsx:99-105 e :299 - o checkbox dispara category/update na hora, sem confirmação`; `api:src/edition-actions/handlers/category-action.handler.ts:543-545 - apaga a inscrição ausente do payload; api:schema.prisma:449-451 - entryAId/entryBId com onDelete Se…`
Proposta: Antes de remover, listar os jogos da equipe e exigir uma escolha: substituir por outra equipe em todos, excluir esses jogos ou desistir. A API recusa category/update que retire inscrição ou fase com jogo vinculado sem essa escolha explícita.

**[CHAVE-R3] Nenhuma tela diz quem foi campeão; pódio só existe para final criada pela chave** — alta, feature ausente, esforço M, achado pelo revisor
Terminada a final, o app não mostra campeão, vice nem terceiro em lugar nenhum: a página pública da categoria continua dizendo 'Fase de grupos'. O pódio só é calculado para final com id '-advanced-' e só serve para sugerir pontos do ranking geral. Liga e final agendada à mão, como no Vôlei, nunca têm campeão.
Evidência: `apps/web/app/lib/tournament-progression.ts:21-27 e :42-60 - campeão, vice e 3º saem só de jogos com id '-advanced-rN-'`; `apps/web/app/lib/overall-ranking.ts:55-61 - único uso do pódio é sugerir pontos do ranking geral, e só com a categoria 'Encerrado'`
Proposta: API calcula e envia o pódio da categoria: final e 3º lugar pela rodada, ou 1º a 3º da tabela em Liga, confirmado pelo admin ao encerrar. Página pública e cartão da categoria mostram campeão, vice e 3º; o ranking geral usa o mesmo dado.

- **[CHAVE-R4] Sem planilha, mata-mata nasce errado: todos contra todos e uma rodada por dia** — média, bug, esforço M, achado pelo revisor. `apps/web/app/components/TournamentManager.tsx:222-230 e :312 - sem fase de grupos, MONTAR OS JOGOS gera turno completo com fase = nome da primeira fase ('Mata-mata')`

Ideias de feature desta área:

- **Situação matemática e zona de classificação na tabela** (M)
- **Sorteio de grupos pela tela** (M)
- **Importar a tabela da organização pela tela** (G)
- **Encerramento da categoria com pódio** (M)
- **Duplicar categoria** (P)
- **Pendências da categoria antes de cada rodada** (M)

## REGRAS — Modalidades e regulamento

**[REGRAS-01] No vôlei, um toque depois do set decisivo soma um set fantasma** — crítica, bug, esforço P, confirmado
Quando um time fecha o último set, a partida continua Ao vivo até alguém tocar em Encerrar. Qualquer ponto a mais passa de novo na regra do set (26-10 também 'vence') e soma outro set. Aconteceu no evento, digitando lances em sequência; o jogo foi encerrado 0×3 e só a retificação consertou o saldo de sets.
Evidência: `dado de produção: Vôlei Inquisidores × Furiosa (lançado 12/10 10:43) - último evento com previous {scoreB:2, periodScoreB:25, currentPeriod:2} virou 0×3 em melhor de 3; …`; `api:src/edition-actions/handlers/match-action.handler.ts:710-728 - setWinner é reavaliado a cada ponto, sem checar se algum lado já tem setsToWin`
Proposta: Na API, recusar evento de pontuação quando um lado já tem setsToWin. Na mesa, trocar os botões de ponto por um único 'Encerrar partida 2×0' assim que o set decisivo fecha. Corrigir a parcial 10-26 gravada.

**[REGRAS-02] W.O. tem placar por regulamento, mas o evento lançou oito como dez gols** — alta, precisao dados, esforço G, confirmado em parte
O caminho oficial daria 1×0 no handebol; a organização lançou 10×0 clicando dez gols, e os jogos constam como disputados. O placar de W.O. são os dois últimos campos do formulário de regras e não acompanha o resto: vôlei ficou 3×0 em melhor de 3, e no basquete o ausente ganha o ponto de derrota.
Evidência: `dado de produção: 8 jogos de Handebol 10×0 ou 0×10 com exatamente 10 eventos 'Gol' e status Encerrada; nenhum dos 96 jogos tem status W.O.`; `apps/web/app/components/MatchManager.tsx:313-315 - W.O. só existe no select 'Estado da partida' de Editar partida; o placar vem de regulation.walkover`
Proposta: Botão 'W.O.' no card e na mesa do jogo: escolhe o ausente, mostra o placar regulamentar e pede motivo. No regulamento, derivar o padrão (sets = setsToWin), adicionar 'pontos na tabela do ausente' e W.O. duplo. Reclassificar os 8 jogos como W.O.
Correção do revisor: São 7 jogos, não 8: 5 de 10×0 e 2 de 0×10, todos Handebol, 10 gols em 15 a 40 s. Resto confere (MatchManager.tsx:313-314; API :1720-1733). Botão é P; W.O. duplo, pontos do ausente e reclassificação passam de uma semana.

**[REGRAS-03] Relógio configurado no regulamento: a mesa ignora e o público vê cronômetro falso** — alta, inconsistencia, esforço M, confirmado
A mesa opera sem cronômetro, mas o regulamento salvo diz 'regressivo'. O espectador vê uma contagem que ninguém controla e todo gol carimbado '12:00' ou '20:00'; a mesa recebe alerta de encerramento antecipado ao trocar de tempo e ao encerrar. Ninguém avançou período no evento. Criar modalidade nasce 'sem cronômetro' e perde isso ao escolher o esporte.
Evidência: `apps/web/app/matches/live/page.tsx:83 - const hasClock = false; :177-184 grava periodElapsedSeconds 0 em todo lance; components/DisciplineCreationForm.tsx:22,34 - nasce …`; `apps/web/app/components/MatchDetailClient.tsx:35,49,52 - a página pública mostra cronômetro e minuto do lance sempre que clockMode não é 'none'`
Proposta: Fazer mesa, página pública e API lerem o mesmo campo clockMode. Enquanto a mesa não tiver cronômetro, gravar 'none' nas modalidades e esconder minutos e duração no formulário; sem relógio, trocar de tempo e encerrar não pedem confirmação de 'antecipado'.

**[REGRAS-04] Regra alterada vale na hora para jogos já disputados; a tela promete o contrário** — alta, precisao dados, esforço G, confirmado
O servidor não guarda regra por jogo: toda ação e todo snapshot leem a regra atual da modalidade (só o modo demonstração congela). Trocar pontos da tabela muda o rodapé da classificação na hora, mas as linhas só recalculam quando outro jogo daquela categoria encerrar; categoria encerrada fica com a conta antiga. Gestor pode alterar com jogo ao vivo.
Evidência: `apps/web/app/components/RegulationFields.tsx:55 e DisciplineManager.tsx:66,83 - 'Partidas já criadas mantêm o regulamento com que foram agendadas'; lib/repositories/redu…`; `api:src/edition-snapshots/snapshot.mapper.ts:435-437,865,897 - o rules de cada jogo é a regra ATUAL da modalidade; api:schema.prisma - Match não tem coluna de regra`
Proposta: Gravar a regra no jogo ao iniciar e usá-la até o fim. Ao salvar regra com jogos disputados, mostrar o impacto e oferecer 'só próximos jogos' ou 'recalcular tudo', recalculando todas as categorias na mesma transação. Bloquear edição com jogo ao vivo.

**[REGRAS-05] 'Sorteio' é ordem por ID, e a tabela não diz qual critério decidiu** — alta, precisao dados, esforço G, confirmado
Quando os critérios se esgotam, o servidor ordena pelo identificador interno da inscrição e segue preenchendo a chave com essa ordem; ninguém é avisado de que falta sortear. O texto 'o primeiro critério que separar fica registrado na tabela' só vale no modo demonstração. No vôlei 'saldo' e 'marcados' contam sets; não existe critério por pontos das parciais.
Evidência: `api:src/edition-actions/edition-action-recalculation.service.ts:239-241 - sem critério ou em 'sorteio' ordena por entryId; :674-680 - melhores terceiros por pontos, sald…`; `apps/web/app/lib/tournament-engine.ts:89-92 - no front o mesmo 'sorteio' é ordem alfabética do nome`
Proposta: Gravar na classificação o critério aplicado e um estado 'empate pendente'. Posição pendente não entra na chave até o admin usar 'Registrar sorteio'. Adicionar critérios 'saldo de pontos' e 'pontos average' usando as parciais, e aplicar a ordem configurada aos melhores terceiros.

**[REGRAS-06] Regulamento inválido é aceito ao salvar e só estoura na mesa** — alta, contrato api, esforço P, confirmado
A API grava qualquer objeto como regra e valida apenas quando um jogo usa. Se alguém apagar o último critério de desempate ou deixar um rótulo vazio na véspera, todo 'Iniciar partida', ponto e encerramento da modalidade responde 409 no ginásio, e o mesário não tem como resolver. Verificado por leitura de código, não reproduzido.
Evidência: `api:src/edition-actions/handlers/catalog-action.handler.ts:79-81,120 - rules só precisa ser um objeto para ser gravado`; `api:src/edition-actions/action-regulation.ts:302-313,370-391 - rótulo vazio, pontos não inteiros ou lista de desempate vazia lançam 409 em iniciar, pontuar, encerrar e r…`
Proposta: Rodar resolveActionRegulation dentro de discipline/update e recusar o salvamento com erro por campo. No formulário: rótulo obrigatório, inteiros em pontos e sets, lixeira desabilitada no último critério, e mensagem apontando o bloco com problema.

- **[REGRAS-07] Front e API divergem nos padrões; Queimado e Futevôlei só existem no front** — média, inconsistencia, esforço M, confirmado. `apps/web/app/lib/regulation.ts:129-147,214,216 × api:src/edition-actions/action-regulation.ts:72-165 - a API só conhece Futsal, Handebol, Basquete, Vôlei, Xadrez e Nataç…`
- **[REGRAS-08] Padrões não batem com o torneio: vôlei melhor de 5 foi trocado em quadra** — média, ux, esforço M, confirmado. `dado de produção: 1º jogo de Vôlei com 3º set até 25 e currentPeriod 4 (regra melhor de 5); todos os seguintes com 3º set até 15 (melhor de 3)`
- **[REGRAS-09] Retificação aceita placar impossível pelo regulamento e não corrige as parciais** — média, precisao dados, esforço M, confirmado. `api:src/edition-actions/handlers/match-action.handler.ts:1114-1123,1171-1178 - aceita qualquer número de 0 a 100.000, inclusive decimal; o vencedor sai só da comparação`
- **[REGRAS-10] Editar regras no celular: cerca de 30 campos num formulário só, lixeiras invisíveis** — média, ux, esforço M, confirmado. `apps/web/app/components/DisciplineManager.tsx:82-92 + RegulationFields.tsx:57-192 - Futsal: 30 campos, 23 botões e 11 textos de ajuda antes do único 'Salvar regras'; rel…`
- **[REGRAS-11] Só dá para criar as 8 modalidades da lista fixa** — média, feature ausente, esforço P, confirmado. `apps/web/app/components/DisciplineCreationForm.tsx:12,87 - select com Futsal, Vôlei, Futevôlei, Handebol, Queimado, Xadrez, Natação e Basquete; sem nome livre`
- **[REGRAS-12] Campos do regulamento sem leitor ou com leitura só de um lado** — baixa, inconsistencia, esforço M, confirmado em parte. `apps/web/app/matches/live/page.tsx:490,613 - exigir placar no desempate vem de lista fixa, knockout.requiresScore não é lido em lugar nenhum; :516 esconde 'Tempo técnico…`
**[REGRAS-R1] Avançar tempo sempre recebe 409 em modalidade com relógio configurado** — alta, bug, esforço P, achado pelo revisor
A mesa foi fixada sem cronômetro, mas a API ainda trata Futsal, Handebol e Basquete como modalidades com relógio. O pedido de avançar tempo sai sem o carimbo que a API exige e volta 409. No evento ninguém saiu do 1º tempo: não há parcial por tempo e a prorrogação do basquete fica inalcançável. Lido no código; não executado.
Evidência: `apps/web/app/matches/live/page.tsx:83,398-411 - hasClock fixo em false; avançar etapa envia paused:false e runningSince indefinido (some no JSON)`; `api:src/edition-actions/handlers/match-action.handler.ts:523-526 - clockMode diferente de 'none' com paused false e sem runningSince lança 409 'Ao retomar o cronômetro, …`
Proposta: Migrar clockMode das modalidades para 'none' e a API parar de exigir runningSince quando o pedido não traz relógio. Paliativo imediato, sem código: gravar 'Sem cronômetro' em Futsal, Handebol e Basquete. Teste e2e-http de avançar tempo e prorrogação.

**[REGRAS-R2] Desfazer lance após o set decisivo apaga a parcial do último set** — alta, bug, esforço P, achado pelo revisor
Quando o set que decide a partida fecha, a etapa não avança. Qualquer lance seguinte (ponto fantasma ou falta) desfeito com 'Desfazer último lance' restaura o placar, mas apaga a parcial do set já terminado. Dois jogos de vôlei do evento ficaram publicados com um set só. A sequência é inferida: o desfazer é a única rota que apaga parcial.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:925-927 - undo apaga todo MatchPeriodResult com period >= etapa anterior ao lance, mesmo quando o lance desfeito…`; `api:src/edition-actions/handlers/match-action.handler.ts:719-727 - no set que decide a partida a etapa não avança, então qualquer lance posterior carrega a etapa do set …`
Proposta: No undo, apagar a parcial só quando o lance desfeito foi o que fechou o set (placar de sets mudou). Regravar as duas parciais faltantes a partir de periodScore. Teste: fechar set decisivo, lançar falta, desfazer e conferir a parcial.

- **[REGRAS-R3] Salvar regras fecha o formulário antes da resposta; falha apaga o rascunho** — média, ux, esforço P, achado pelo revisor. `apps/web/app/components/DisciplineManager.tsx:44-45 - void dispatch(...) seguido de setEditing(false), sem olhar o resultado`
**[REGRAS-R4] Mata-mata é decidido pelo nome da fase no front; aba Chaveamento fica vazia** — alta, inconsistencia, esforço P, achado pelo revisor
Três telas adivinham se a fase é eliminatória pelo nome, com duas expressões diferentes; a API usa o tipo da fase. Na Copa toda fase eliminatória chama-se 'Mata-mata': a mesa reconhece, mas a aba Chaveamento da tabela pública não lista nenhum dos 24 jogos. Fase eliminatória com outro nome faria a mesa encerrar empate sem desempate e a API recusar.
Evidência: `apps/web/app/components/TournamentClassification.tsx:94 - a aba Chaveamento filtra jogos por /semi|quart|final/ no nome da fase, embora a linha 33 já tenha as fases de f…`; `dado de produção: os 24 jogos eliminatórios (Futsal 9, Handebol 5, Vôlei 5, Basquete 5) têm fase 'Mata-mata', que essa expressão não casa`
Proposta: Derivar 'é eliminatória' do formato da fase que já vem no snapshot (phases[].format), numa função única usada pela aba Chaveamento, pela mesa e pela trava de elenco. Remover as duas expressões por nome. Teste com fase 'Mata-mata' e 'Playoffs'.


Ideias de feature desta área:

- **Súmula por parciais validada pelo regulamento** (M)
- **Regulamento por categoria e por fase** (G)
- **Copiar regulamento de outra edição** (P)
- **Ensaio do regulamento antes do evento** (M)
- **Pontos na tabela por tipo de resultado** (M)
- **Segunda equipe e duplas da mesma atlética** (G)

## EQUIPES — Equipes e atletas

**[EQUIPES-01] Cadastrar elenco é um atleta por vez: 15 atletas custam 75 toques** — alta, feature ausente, esforço M, confirmado
Não há colar lista nem CSV na tela. Cada atleta exige 5 toques e 2 trocas de tela (+ Atleta, campo, Cadastrar e continuar, modalidade, Concluir). Um time de 15 são 75 toques, 30 navegações e 15 vezes a mesma modalidade. O mínimo regulamentar da edição (298 atletas) passaria de 1.400 toques.
Evidência: `apps/web/app/components/TeamAthleteForm.tsx:26-30 - formulário de 2 passos para um único nome; ao salvar volta à equipe e a modalidade marcada não é lembrada`; `apps/web/scripts/importar-dados.mjs:4-12 - importador CSV existe só como script de desenvolvedor; o próprio comentário diz que digitar um a um no app é inviável no prazo`
Proposta: Na tela da equipe, botão "Colar lista": um nome por linha (opcional "número nome"), categoria escolhida uma vez, prévia com duplicados marcados e gravação única por nova ação athlete/createMany. No formulário individual, "Salvar e adicionar outro" mantendo a modalidade.

**[EQUIPES-02] API recusa criar o acesso da atlética e recusa o login dela** — crítica, bug, esforço M, confirmado
O papel existe no banco, no snapshot e nas ações, mas não fecha o ciclo. O Admin da edição preenche o formulário na equipe e o servidor responde 403. Se o super admin criar, o login do responsável devolve 401 e a tela diz que a senha está errada. O acesso criado aparece na lista como gestor sem modalidade.
Evidência: `api:src/edition-actions/edition-actions.service.ts:605-608 - Admin da edição só pode conceder 'Gestor de modalidade'; 'Responsável da atlética' volta 403`; `api:src/auth/auth.service.ts:249-291 - resolveIdentity não tem ramo TEAM_MANAGER e lança 401 'Usuário sem papel ativo'; o front traduz para 'E-mail ou senha inválidos' (…`
Proposta: Permitir que o Admin da edição conceda e revogue "Responsável da atlética" para equipes da edição; criar o ramo TEAM_MANAGER no login (papel e nome da equipe); mapear papel, equipe e chave por teamId no snapshot de staff; teste e2e conceder, entrar, cadastrar atleta.

**[EQUIPES-03] Responsável logado não chega à própria equipe nem vê o botão de cadastrar** — crítica, bug, esforço M, confirmado
Mesmo com a API corrigida, o responsável cai no painel geral, onde Equipes, Modalidades, Jogos e Mais respondem "Acesso restrito". Não existe link para a equipe dele. Chegando por endereço digitado, o botão "+ Atleta" não aparece e o elenco não tem editar nem remover. canManageRoster existe e nenhuma tela usa.
Evidência: `apps/web/app/lib/repositories/auth-adapter.ts:92-94 - scope só é preenchido para gestor; sem ele AdminRouteGuard.tsx:32-34,54 resolve '__sem-equipe__' e bloqueia toda ro…`; `apps/web/app/dashboard/page.tsx:35-41 e components/BottomNav.tsx:11-17 - todos os atalhos levam a rotas fora de teamManagerPrefixes (AdminRouteGuard.tsx:28); nenhum leva…`
Proposta: Depois do login, levar o responsável direto a "Meu elenco" (a equipe dele), com barra própria: Elenco, Jogos da equipe, Conta. Gravar o nome da equipe como escopo da sessão e usar canManageRoster para "+ Atleta", colar lista, renomear, mudar modalidade e remover.

**[EQUIPES-04] Gestor de modalidade pode cadastrar atleta na API, mas a tela esconde o caminho** — alta, inconsistencia, esforço M, confirmado
A edição teve 4 gestores (Vôlei, Handebol, Futsal, Basquete). O servidor aceita que cadastrem e ajustem atletas da própria modalidade e o formulário já fixa essa modalidade, mas o botão "+ Atleta" e os botões da linha só aparecem para o admin. Tocar no nome do atleta leva a "Acesso restrito".
Evidência: `api:src/edition-actions/edition-actions.service.ts:76-81,543-591 - athlete/create e athlete/update estão em MANAGER_ACTIONS, restritas à modalidade do gestor`; `shots/gestor/mobile/teams_alcateia.png e metricas.json - a tela da equipe do gestor só tem o botão 'Voltar': sem '+ Atleta', sem editar, sem remover`
Proposta: Mostrar "+ Atleta" e "Colar lista" ao gestor com a modalidade dele fixa; permitir renomear; criar na API a operação de tirar o atleta só da modalidade do gestor; nome do atleta sem link para quem não acessa /athletes; corrigir PAPEIS_E_FLUXOS.md.

**[EQUIPES-05] Elenco é por modalidade, não por categoria: masculino e feminino se misturam** — alta, precisao dados, esforço G, confirmado
O atleta é ligado a "Futsal", nunca a "Futsal Feminino". Numa atlética com os dois times, o elenco soma homens e mulheres: o aviso de máximo dispara errado, o mínimo passa com um time só, e a mesa veria os dois elencos juntos ao escolher quem fez o gol. A trava também vale para as duas categorias juntas.
Evidência: `api:schema.prisma:290-309 - EditionRoster é único por (modalidade da edição, atleta); não há vínculo com a categoria`; `apps/web/app/matches/live/page.tsx:259-264 e lib/edition-catalog.ts:182-184 - a lista de autores do lance traz todos os atletas da equipe na modalidade`
Proposta: Inscrever o atleta por categoria: EditionRoster ganha tournamentId e a ação recebe categorias em vez de modalidades. Elenco, mínimo, máximo, trava e lista de autores do lance passam a filtrar pela categoria do jogo. Migração copia a inscrição atual para as categorias da equipe.

**[EQUIPES-06] Equipe que desiste não tem fluxo: arquivar não mexe em jogos nem tabela** — alta, feature ausente, esforço G, confirmado em parte
A única ação sobre a equipe é "Arquivar", que promete preservar histórico mas não toca em participantes, jogos futuros nem classificação. Na Copa, a saída da Compressora aparece como motivo digitado em 4 jogos alterados à mão. Arquivar no meio do torneio ainda tira a equipe do ranking geral automático e da atribuição de lances.
Evidência: `Produção: 4 jogos com motivo digitado 'Ajuste de/dos jogos, após a remoção da Atlética COMPRESSORA'; ela segue com 6 jogos 'Agendada' (dados/jogos-resumo.json)`; `apps/web/app/components/TeamManager.tsx:126-149 e api:src/edition-actions/handlers/catalog-action.handler.ts:348-353 - arquivar só grava EditionTeam.archived`
Proposta: Ação "Equipe desistiu" na tela da equipe: escolher categorias, ver os jogos futuros afetados e aplicar de uma vez W.O. pelo placar do regulamento ou cancelamento, com motivo único. A equipe fica como "Desistente" na tabela e no histórico, sem ser arquivada.
Correção do revisor: Não há fluxo: confirmado. Correção: a Compressora saiu só do Vôlei e jogou Handebol e Futsal até 11/10; os 6 'Agendada' são de Basquete e Futsal que ninguém operou. Melhor: Engenhosa perdeu os 4 jogos do Handebol por 10x0 clicado.

- **[EQUIPES-07] Trava de elenco bloqueia corrigir e remover, mas deixa cadastrar atleta novo** — média, inconsistencia, esforço M, confirmado. `apps/web/app/components/TeamRosterManager.tsx:41-42,55 - com a modalidade travada, remover e mudar modalidade são recusados no cliente`
- **[EQUIPES-08] Segundo time da atlética é equipe avulsa, com o mesmo escudo e acesso separado** — média, precisao dados, esforço G, confirmado. `api:schema.prisma:163-181,361-387 - Team não tem vínculo com outra Team e TournamentEntry é única por (categoria, equipe): o time B precisa ser outra equipe do catálogo`
- **[EQUIPES-09] Lista de 16 equipes ocupa 4 telas por causa de cartões de 202 px** — baixa, ux, esforço M, confirmado. `shots/admin/mobile/teams.png e metricas.json - /teams com 16 equipes mede 3785 px (4,1 telas); /public/teams mede 3661 px`
- **[EQUIPES-10] Tela da equipe enterra o elenco e mostra botão de remover sem ícone** — média, ux, esforço M, confirmado. `shots/admin/mobile/teams_alcateia.png - 2,7 telas; Elencos começa na segunda tela, depois de Arquivar, Editar e Classificações; o botão ao lado de 'editar modalidades' é…`
- **[EQUIPES-11] Atleta removido não pode ser restaurado nem recadastrado com o mesmo nome** — média, bug, esforço P, confirmado. `apps/web/app/components/TeamRosterManager.tsx:40-49 - remover grava removed: true e o atleta some das listas (lib/edition-catalog.ts:168-172)`
- **[EQUIPES-12] Escudo depende de deploy: upload desligado e lista manual desatualizada** — média, operacao, esforço M, confirmado. `issues/api-issue-11.json - upload inoperante em produção: falta o location /intereng-storage no gateway e as variáveis S3_PRESIGN_ENDPOINT e S3_PUBLIC_BASE_URL`
- **[EQUIPES-13] Catálogo global e edição se confundem ao criar, vincular e renomear equipe** — média, inconsistencia, esforço M, confirmado. `apps/web/app/components/TeamCreationForm.tsx:71-81 e api:src/edition-actions/handlers/catalog-action.handler.ts:246-248 - duplicado só é checado na edição; equipe já exi…`
- **[EQUIPES-14] Na página do atleta, nomes de categoria quebram letra a letra no celular** — baixa, bug, esforço P, confirmado. `shots/admin/mobile/athletes_ana-lima.png - 'Futsal Masculino' vira 'Masc/ulino', 'Vôlei Feminino' vira 'Femin/ino' e os selos aparecem cortados ('INSC', 'FOR')`
**[EQUIPES-R1] Página da equipe calcula classificação própria e diverge da tabela oficial** — alta, precisao dados, esforço P, achado pelo revisor
O bloco Classificações da equipe refaz a conta no navegador: junta todos os grupos da categoria numa tabela só, soma os jogos do mata-mata e ignora a pontuação da modalidade (Basquete usa 2-0-1). Mostra POS, J, V, D e PTS diferentes da tabela da categoria, com o selo da primeira fase mesmo depois dela.
Evidência: `apps/web/app/components/TeamPerformance.tsx:22-24 - calculateStandings com todos os participantes e todos os jogos da categoria: sem grupo, com mata-mata e com a regra p…`; `apps/web/app/components/TournamentClassification.tsx:63-93 - a tabela da categoria usa a classificação oficial do servidor, por grupo, e a pontuação da modalidade`
Proposta: Ler a posição na classificação oficial da fase, a mesma que a tela da categoria usa, filtrada pelo grupo da equipe, e mostrar 'Grupo C · 1º'. No mata-mata, mostrar a fase alcançada e o próximo jogo. Teste comparando com a tabela da categoria.

**[EQUIPES-R2] Ajuste de atleta pelo gestor apaga as outras modalidades e duplica pessoas** — alta, bug, esforço M, achado pelo revisor
Hoje os botões estão escondidos, mas a API já aceita. Um gestor de Futsal que salve um atleta envia só 'Futsal' e o servidor retira o atleta do Basquete. Ele também consegue remover o atleta da equipe inteira ou trocá-lo de equipe. E, sem ver quem já está cadastrado em outra modalidade, cadastra a mesma pessoa de novo.
Evidência: `api:src/edition-actions/edition-actions.service.ts:563-577 - o gestor só pode enviar modalities contendo a própria modalidade`; `api:src/edition-actions/handlers/catalog-action.handler.ts:519-527 - syncRosters marca WITHDRAWN toda inscrição do atleta que não veio na lista enviada`
Proposta: Para o gestor, trocar por uma ação que inclui ou retira o atleta só da modalidade dele, recusando removed, teamId e name. Enviar no snapshot dele os atletas das equipes do escopo, para alocar um existente em vez de recadastrar.

**[EQUIPES-R3] Atleta não tem número de camisa; a mesa escolhe o autor pelo nome** — alta, feature ausente, esforço M, achado pelo revisor
Em quadra o mesário enxerga o número da camisa, não o nome. O app não guarda número: o cadastro só aceita nome, o elenco mostra um ícone no lugar do número e o seletor de autor do lance é uma lista de nomes. Com 12 a 15 atletas por equipe, atribuir o gol atrasa o lance seguinte.
Evidência: `api:schema.prisma:299 - EditionRoster.jerseyNumber existe no banco`; `api:src/edition-actions/handlers/catalog-action.handler.ts:31 - ATHLETE_FIELDS aceita só name, teamId, modalities, created e removed; o snapshot (snapshot.mapper.ts:634-…`
Proposta: Aceitar número por atleta e modalidade em athlete/create e athlete/update e devolvê-lo no snapshot. Campo 'nº' no cadastro e na lista colada. Na mesa, grade de números grandes em ordem crescente, com o nome embaixo.

- **[EQUIPES-R4] Cadastro de atleta oferece todas as modalidades, não as que a equipe disputa** — média, ux, esforço P, achado pelo revisor. `apps/web/app/components/TeamAthleteForm.tsx:22-24 - a lista do passo 2 vem de todas as modalidades habilitadas da edição`

Ideias de feature desta área:

- **Número de camisa no elenco** (M)
- **Convite da atlética por link** (M)
- **Painel de prontidão dos elencos** (M)
- **Trazer equipes e elencos da edição anterior** (M)
- **Escalação do jogo (quem está presente)** (M)
- **Autoinscrição do atleta com aprovação do responsável** (G)

## PUBLICO — Área pública

**[PUBLICO-01] Aba Chaveamento fica vazia em produção e o mata-mata não mostra rodadas** — alta, bug, esforço G, confirmado
A chave só aparece se a fase se chamar Semifinal, Quartas ou Final. A API envia 'Mata-mata' em todo jogo eliminatório, então nas 8 categorias publicadas a aba fica com 'O chaveamento será exibido quando os confrontos forem gerados'. Semifinal, 3º lugar e final ficam indistinguíveis, e 'Vencedor do Jogo 16' cita um número que nenhum cartão exibe.
Evidência: `apps/web/app/components/TournamentClassification.tsx:94 - o mata-mata é filtrado por regex /semi|quart|final/ sobre o nome da fase`; `api:src/edition-snapshots/snapshot.mapper.ts:893 - a API envia phase.name; em dados/jogos-producao.json os 24 jogos eliminatórios têm fase 'Mata-mata' e 0 casam com a re…`
Proposta: Enviar round, bracketSlot e número do jogo no snapshot. Desenhar a chave em colunas por rodada (Quartas, Semifinal, Final, 3º lugar), com vencedor destacado e rolagem horizontal. Exibir 'Jogo N' em todo cartão e o líder provisório sob rótulos como '1 GRUPO A'.

**[PUBLICO-02] Jogo que não começou aparece como 0 — 0 com selo Próximo** — crítica, precisao dados, esforço P, confirmado
Cartão e página do jogo só escondem o placar quando ele é nulo, mas a API manda 0 para todo jogo. Em produção, 40 jogos agendados aparecem '0 — 0'; 36 deles, de dias anteriores, seguem com selo 'Próximo'. Na agenda de 12/10 o espectador lê 32 empates sem gols que nunca aconteceram.
Evidência: `api:src/edition-snapshots/snapshot.mapper.ts:882 - scoreA e scoreB sempre numéricos (schema.prisma:463, default 0)`; `apps/web/app/components/MatchScoreCard.tsx:63 - só mostra '—' quando o placar é null; MatchSummary.tsx:10 idem na página do jogo`
Proposta: Exibir placar só em jogos Ao vivo, Encerrada e W.O.; nos demais, mostrar o horário no lugar do placar. Criar selos próprios: 'Sem resultado' para agendado com data passada, 'Adiado', 'Cancelado' e 'W.O.'.

**[PUBLICO-03] Não há como ver só os jogos da minha atlética** — alta, feature ausente, esforço M, confirmado
Para saber quando a própria atlética joga, o espectador percorre a agenda dia a dia (47 cartões em 12/10) procurando o nome, ou entra em cada categoria. A página da equipe diz '2 jogos na agenda' e não lista nenhum. Não existe favorito, busca nem filtro por equipe.
Evidência: `apps/web/app/components/PublicTeamDetailView.tsx:16 - a página da equipe tem desempenho e elenco, nenhuma lista de jogos`; `apps/web/app/components/TeamPerformance.tsx:43 - só a contagem 'N jogos na agenda'; captura publico/mobile/public_teams_alcateia.png`
Proposta: Abrir a página da equipe com 'Próximo jogo' e a lista de jogos e resultados dela em todas as categorias. Botão 'Seguir', guardado no aparelho, que fixa a atlética no topo da home e vira filtro de um toque na agenda.

**[PUBLICO-04] Na aba Jogos o cartão não abre a partida e um botão leva ao login** — alta, bug, esforço P, confirmado
A aba Jogos é o caminho natural até um placar, mas ali o cartão não é clicável: lances e parciais só são alcançados por Modalidades, categoria, aba Jogos e cartão. Com uma modalidade filtrada, o botão 'TABELA DE FUTSAL' aponta para a rota administrativa e leva o espectador à tela de login.
Evidência: `apps/web/app/components/MatchSchedule.tsx:47 - href={publicView ? undefined : ...}: na área pública o cartão vira <div>`; `shots/metricas.json - /public/matches tem 8 links (pular, contexto, 5 abas e rodapé), nenhum de jogo`
Proposta: Passar href /public/matches/{id} aos cartões da agenda pública. Trocar o botão por atalhos para as categorias públicas da modalidade. Corrigir a migalha da partida, que rotula /public/matches como 'Modalidades' (AppShell.tsx:88).

**[PUBLICO-05] Final decidida nos pênaltis aparece empatada e nenhuma tela anuncia a campeã** — alta, precisao dados, esforço M, confirmado
Em cartões e listas a final do Futsal aparece '3 — 3 · Encerrado'; o 3×2 nos pênaltis só está num aviso no fim da página do jogo. Nenhum cartão marca o vencedor. As 3 categorias encerradas seguem com selo 'Fase de grupos' e não mostram campeã, vice nem terceiro.
Evidência: `dados/jogos-producao.json - category-2b1d4223a7a9-advanced-r1-1: Compressora 3×3 Furiosa, tiebreak 'Pênaltis' 3×2 para Compressora`; `apps/web/app/components/MatchCard.tsx:24 - o cartão não recebe tiebreak nem vencedor; só MatchDetailClient.tsx:68 mostra, num aviso no fim da página`
Proposta: Destacar o vencedor no cartão e mostrar '(3×2 pên.)' junto ao placar. Na categoria encerrada, abrir com bloco de pódio usando tournamentPodium e trocar o selo por 'Encerrada'; na lista de categorias, exibir a campeã.

**[PUBLICO-06] Tela inicial só lista jogos ao vivo e fica vazia no resto do tempo** — alta, ux, esforço M, confirmado
A porta de entrada mostra apenas partidas com status 'Ao vivo'. Antes do evento, entre jogos e depois dele aparece '0 partidas ao vivo' e um botão. Como a maior parte dos placares foi lançada depois do jogo, na maior parte do evento a home não tinha próximo jogo nem último resultado.
Evidência: `apps/web/app/components/PublicLiveView.tsx:19 - a home é PublicMatchCollection mode='live' mais um botão`; `apps/web/app/components/PublicMatchCollection.tsx:24 - vazio: 'Nenhum jogo ao vivo no momento.'; o modo 'upcoming' existe e nenhuma tela o usa`
Proposta: Transformar a home em 'Hoje': blocos Ao vivo, A seguir (5 próximos) e Últimos resultados (5 mais recentes), mais o atalho da atlética seguida. Antes do evento, contagem regressiva e primeiro dia; depois, campeãs por categoria.

**[PUBLICO-07] Selo Ao vivo não tem prova de vida nem horário da última atualização** — alta, precisao dados, esforço M, confirmado
Um jogo abandonado pela mesa continua na home como '1 partida ao vivo · AGORA' no dia seguinte, com cronômetro em 00:00. A tela não informa quando recebeu dados pela última vez: o selo diz 'Resultados ao vivo' tanto com stream em tempo real quanto em sondagem de 12 segundos.
Evidência: `dados/jogos-producao.json - Basquete Mafiosa 23×10 Furiosa: 'Ao vivo' desde 12/10 14:31, último lance 14:52, ainda ao vivo em 13/10 com relógio regressivo zerado`; `apps/web/app/components/PublicMatchCollection.tsx:20 - conta e rotula 'AGORA' qualquer jogo com status Ao vivo`
Proposta: Mostrar 'Atualizado às HH:MM:SS' na barra superior e 'último lance há N min' no cartão ao vivo. Jogo ao vivo sem lance há 20 minutos sai da contagem e recebe selo 'Sem atualização desde HH:MM'.

**[PUBLICO-08] Cada lance marcado faz todo espectador baixar até 1 MB de histórico** — alta, desempenho, esforço G, confirmado em parte
O espectador recebe o histórico completo de lances de todos os jogos, o regulamento repetido em cada jogo e o estado anterior de cada lance; 95% do peso só serve à página de um jogo. A cada lance de qualquer quadra, todo aparelho aberto baixa tudo de novo. A API não ativa compressão.
Evidência: `api:src/edition-snapshots/snapshot.mapper.ts:897 - o snapshot público leva rules e todos os events de todos os jogos (linha 902), cada evento com 'previous' (linha 1137)`; `dados/jogos-producao.json - parte pública dos 96 jogos: 1.009 KB; sem events e rules: 52 KB (com gzip, 88 KB e 4 KB)`
Proposta: Manter o snapshot público, sem events, rules e previous: só placar, parciais, período e último lance. Carregar os lances por GET próprio ao abrir a página do jogo. Ativar compressão na API ou no proxy.
Correção do revisor: Tamanhos conferem: 1.011 KB, 54 KB sem events e rules (gzip 89 e 4 KB). Porém events também alimentam Artilharia (artilharia.ts:59) e fair play (TournamentClassification.tsx:44); retirá-los exige substituto. Compressão no gateway não é verificável aqui.

- **[PUBLICO-09] Agenda do dia é lista única de até 47 cartões sem filtro útil** — média, ux, esforço M, confirmado. `dados/jogos-producao.json - 12/10: 47 jogos (32 agendados, 14 encerrados, 1 ao vivo) ordenados pelo horário planejado; o jogo ao vivo é o 7º da lista`
- **[PUBLICO-10] Página do jogo de vôlei enterra as parciais sob mais de cem lances** — média, ux, esforço M, confirmado. `apps/web/app/components/MatchDetailClient.tsx:51 - lista todos os eventos; linha 67 - parciais numa frase de texto depois da lista`
- **[PUBLICO-11] Artilharia e contagem de atletas expõem ao público cadastro que não existe** — média, ux, esforço M, confirmado. `apps/web/app/public/scorers/page.tsx:52 - sem autor mostra 'Nenhum lance desta modalidade foi registrado com o nome de quem marcou' e, na linha 58, 'N lances registrados…`
- **[PUBLICO-12] Tabela não marca quem classifica e a página da equipe mostra outra posição** — média, inconsistencia, esforço M, confirmado. `apps/web/app/globals.css:695 - destaque fixo por rank-1, rank-2 e rank-3 (2º e 3º com a cor do fundo, linha 19), sem relação com phase.qualifiers`
- **[PUBLICO-13] Página pública do jogo mostra JSON cru e anotação interna da organização** — média, precisao dados, esforço P, confirmado. `apps/web/app/components/MatchDetailClient.tsx:71 - imprime corrections.before → after, que a API envia como texto JSON (api:src/edition-snapshots/snapshot.mapper.ts:1239)`
- **[PUBLICO-14] Link compartilhado sai sem imagem e com endereço canônico de outro prefixo** — média, bug, esforço M, confirmado. `apps/web/app/public/page.tsx:7 - canonical e og:url fixos em /intereng/... (7 arquivos de página pública); public/matches/[id]/page.tsx:8 repete no JSON-LD`
**[PUBLICO-R1] Tabela pública do Vôlei ignora 20 dos 23 jogos de grupo encerrados** — crítica, precisao dados, esforço M, achado pelo revisor
Nas duas categorias de Vôlei a fase é Liga, mas tem grupos cadastrados. A API só conta jogos ligados a um grupo, então a tabela oficial registra 3 dos 23 jogos encerrados. O público vê, no feminino, quatro equipes com um jogo e sem a invicta Inquisidores; no masculino, tabela vazia com instrução de organizador.
Evidência: `produção (mcp intereng listar categorias, 13/10) - Vôlei Feminino (category-a15edc3a59ed): fase 'Fase de grupos' em formato Liga com Grupo A e B; standings com 4 equipes…`; `dados/jogos-producao.json - feminino: 11 jogos de grupo encerrados, Inquisidores 5 vitórias em 5; masculino: 12 encerrados, Halterada 4 em 4; 15 desses jogos têm fase 'F…`
Proposta: Na API, fase Liga vira tabela única com todos os jogos encerrados da fase, ignorando grupos; fase de Grupos conta jogo sem grupo pelo grupo das equipes. Impedir Liga com grupos na edição. Recalcular as duas categorias e reescrever a mensagem para o espectador.

**[PUBLICO-R2] Selo de conexão diz 'Resultados ao vivo' com dado do cache offline** — alta, precisao dados, esforço M, achado pelo revisor
Com sinal fraco no ginásio, a sondagem recebe do service worker o snapshot antigo como se fosse resposta da API e o selo volta a 'Resultados ao vivo'. No sentido oposto, quem passa do limite de 40 conexões por IP no wi-fi vê 'Sem conexão' piscando, embora a sondagem siga atualizando os placares. Leitura de código, não reproduzido.
Evidência: `apps/web/public/sw.js:93 - sem rede, o service worker devolve o snapshot guardado como resposta normal, sem marca de cache`; `apps/web/app/lib/repositories/http-adapter.ts:291 - todo loadSnapshot bem-sucedido chama onConnection('online'), inclusive na sondagem de 12 s (linha 394)`
Proposta: Service worker marca resposta de cache com cabeçalho; o adaptador guarda a hora do último snapshot novo. Selo com três estados: 'Ao vivo', 'Atualizando a cada 12 s' e 'Sem conexão, dados das HH:MM'. Erro de SSE não derruba o selo se a sondagem responde.

- **[PUBLICO-R3] Aba 'Modalidades' lista categorias, a migalha diz 'Categorias' e nada agrupa por esporte** — média, inconsistencia, esforço P, achado pelo revisor. `apps/web/app/components/PublicAppShell.tsx:34 - aba 'Modalidades' aponta para /public/tournaments, que lista categorias em sequência única (PublicTournamentsPage.tsx:16 …`
- **[PUBLICO-R4] Leitor de tela não anuncia placar nem horário nos cartões de jogo** — média, acessibilidade, esforço P, achado pelo revisor. `apps/web/app/components/MatchScoreCard.tsx:76 - aria-label '{teamA} contra {teamB}, {status}' aplicado ao Link (linha 87) substitui o conteúdo do cartão`

Ideias de feature desta área:

- **Modo telão do ginásio** (M)
- **Ordem do dia por quadra, com previsão recalculada** (M)
- **Avisos da atlética seguida** (G)
- **Resumo final da edição** (M)
- **Card de resultado para redes sociais** (M)
- **Medição anônima de uso da área pública** (P)

## DADOS — Estado e sincronização

**[DADOS-01] Avançar tempo é sempre recusado em Futsal, Handebol e Basquete** — crítica, bug, esforço P, confirmado
O cronômetro foi desligado só na tela da mesa; a API segue tratando essas modalidades como cronometradas. Avançar tempo responde 'Ao retomar o cronômetro, informe um horário de início válido' depois de o som tocar. Todo gol fica no 1º tempo, a prorrogação nunca aparece e o público vê uma contagem regressiva que ninguém controla.
Evidência: `apps/web/app/matches/live/page.tsx:83 e :405 - 'hasClock = false' fixo; avançar etapa envia 'paused: false' sem 'runningSince'`; `api:src/edition-actions/handlers/match-action.handler.ts:523-526 - com clockMode diferente de 'none', 'paused === false' sem 'runningSince' lança 409`
Proposta: Decidir o relógio em um lugar só: gravar `clockMode: 'none'` no regulamento das modalidades sem cronômetro (migrar a edição ativa), front e API lerem esse campo, remover o `hasClock` fixo e cobrir 'avançar tempo' com teste contra a API real.

**[DADOS-02] Segundo toque antes da resposta do servidor é recusado e o ponto some** — alta, precisao dados, esforço M, confirmado
O placar só muda quando o snapshot volta (0,7 a 1,5 s). Um toque nesse intervalo parte do placar antigo e a API responde 'O placar do participante A diverge do valor calculado pelo regulamento'. Som, flash e painel 'Quem marcou?' já dispararam: o mesário acha que marcou e o ponto não existe.
Evidência: `apps/web/app/matches/live/page.tsx:196-213 e 245-256 - o lance leva placar absoluto calculado do último snapshot; 'void dispatch' sem esperar; trava de toque solta em 35…`; `apps/web/app/lib/repositories/http-adapter.ts:103-105 - 'não há atualização otimista: a resposta é a verdade'`
Proposta: Fila serial de lances por partida no cliente e placar otimista que volta atrás com aviso se a API recusar. Enviar o lance só com lado, tipo e id (a API já aceita sem placar absoluto). Som e 'Quem marcou?' depois da confirmação.

**[DADOS-03] Lance que falha vira toast de 3 segundos; sem 'enviando', timeout ou fila** — alta, ux, esforço M, confirmado
Em rede ruim o POST fica pendurado sem prazo: nada muda e nada avisa. Quando falha, aparece o texto do servidor ('Assuma a operação antes de continuar', 'Falha na requisição (500)') e some sozinho. Não há lance pendente visível nem reenvio, e a tela do placar não mostra se está conectada.
Evidência: `apps/web/app/lib/repositories/use-frontend-state.ts:96-112 - erro de ação vira só 'toast(message, 'error')'; nada é reenviado nem recarregado`; `apps/web/app/components/UiProvider.tsx:28-32 - toast some em 3.200 ms, no máximo 3 na tela`
Proposta: Timeout de 8 s nas ações; faixa fixa no placar com 'enviando', 'não enviado: reenviar' e estado da conexão; reenvio com a mesma Idempotency-Key; mensagens na linguagem do mesário; reassumir trava vencida automaticamente antes de reenviar.

**[DADOS-04] Mesário cai no login por logout alheio, renovação perdida ou rede fraca** — alta, bug, esforço M, confirmado
Com 7 contas de staff para o evento, é provável a mesma conta em vários celulares. Um 'Sair' em qualquer um revoga todos: em até 15 min os outros caem no login no meio do jogo. O mesmo ocorre se a resposta da renovação se perder no 4G ou se ela falhar ao abrir uma tela.
Evidência: `api:src/auth/services/refresh-sessions.service.ts:82-99 - 'revoke(token)', usado pelo logout, revoga TODAS as sessões do staff, não só a daquele aparelho`; `api:src/auth/services/refresh-sessions.service.ts:44-66 - cookie de renovação rotativo sem tolerância: resposta perdida na rede deixa o aparelho com token já revogado`
Proposta: Logout revoga só a sessão do próprio cookie; rotação aceita o token anterior por 60 s; `restore()` mantém a sessão quando o erro não é 401 e tenta de novo; renovar aos 12 min, antes de vencer.

**[DADOS-05] Recarga em segundo plano que falha troca a tela inteira por erro** — alta, bug, esforço P, confirmado
Quando o celular reconecta ou o token é renovado (a cada 15 min), o app recarrega o snapshot. Se essa única tentativa falhar, o placar ou a página pública que estavam na tela dão lugar a 'DADOS INDISPONÍVEIS'; o placar desmonta, solta a trava e perde o painel aberto.
Evidência: `apps/web/app/lib/repositories/use-frontend-state.ts:49-62 - qualquer falha de 'refresh()' faz 'setStatus('error')', mesmo com estado já carregado`; `apps/web/app/lib/repositories/use-frontend-state.ts:78-93 - 'refresh()' roda a cada evento 'online' do navegador e a cada troca ou renovação de sessão`
Proposta: Com estado já carregado, falha de recarga mantém a tela, marca 'Sem conexão' e tenta de novo com espera crescente. Tela de erro só quando nunca houve dado. Não liberar a trava em desmontagem causada por erro.

**[DADOS-06] Cada toque reconstrói, grava e devolve a edição inteira sob trava única** — alta, desempenho, esforço M, confirmado
Um ponto de vôlei custa remontar a edição (cerca de 20 consultas), gravar um JSON de centenas de KB no Postgres como recibo e devolver o mesmo JSON pelo 4G, tudo em fila única por edição: o lance da quadra A espera o da quadra B. Os recibos nunca são apagados.
Evidência: `api:src/edition-actions/edition-actions.service.ts:39-43, 235 e 283 - transação Serializable com trava consultiva por edição: lances de quadras diferentes esperam um pel…`; `api:src/edition-actions/edition-actions.service.ts:381-405 - snapshot privado completo montado e gravado em 'responseData' do recibo a cada ação`
Proposta: Recibo guarda só a revisão (reenvio devolve o snapshot atual); expurgo diário de recibos com mais de 24 h; aplicar o snapshot enxuto do DADOS-07 também à resposta da ação; registrar no log a duração de cada ação.

**[DADOS-07] Espectador rebaixa ~1 MB a cada lance de qualquer quadra, sem compressão** — alta, desempenho, esforço M, confirmado
No pico de 12/10 foram 491 revisões em 33 min, cada uma com ~0,9 MB: quem estava com a área pública aberta baixou até ~450 MB nesse intervalo, se o gateway não comprime (o nginx não pôde ser verificado). 42% do peso é estado de desfazer e regulamento repetido, que o público nunca usa.
Evidência: `apps/web/app/lib/repositories/http-adapter.ts:270-283 e 340-345 - cada 'edition-revision' dispara 'loadSnapshot()' da edição inteira`; `api:src/edition-actions/edition-actions.service.ts:355-368 - toda ação incrementa a revisão, inclusive 'match/claimOperator' (batimento da trava)`
Proposta: Ligar gzip ou brotli para JSON na API; tirar `previous*` e `rules` por partida do snapshot (o regulamento já vem em `disciplines`); no cliente público, agrupar revisões em janela de 3 a 5 s; batimento de trava não incrementa revisão.

- **[DADOS-08] Cache público guarda uma cópia do snapshot por revisão durante uma hora** — média, operacao, esforço P, confirmado. `api:src/edition-snapshots/edition-snapshots.service.ts:12-13 e 264-276 - chave 'edition-snapshot:public:v2:<edição>:<revisão>' com TTL de 3.600 s; a revisão anterior nun…`
- **[DADOS-09] Tela congela com selo 'Ao vivo' quando o stream morre sem avisar** — média, bug, esforço P, confirmado. `apps/web/app/lib/repositories/http-adapter.ts:382-392 - 'streamEntregou = true' desliga a sondagem de 12 s para sempre`
- **[DADOS-10] Retificação de resultado aparece para o público como JSON cru** — média, bug, esforço P, confirmado. `api:src/edition-actions/handlers/match-action.handler.ts:1186-1190 - grava '{scoreA, scoreB}' e ignora o texto enviado pelo front`
- **[DADOS-11] 'Iniciada por' mostra quem segura a trava agora, não quem iniciou** — baixa, precisao dados, esforço P, confirmado em parte. `api:src/edition-snapshots/snapshot.mapper.ts:923 - 'startedBy: match.operatorName'`
- **[DADOS-12] Reabrir o app faz o mesário virar 'outro operador' de si mesmo** — média, ux, esforço P, confirmado em parte. `apps/web/app/lib/repositories/operator-device.ts:10-16 - id do operador em 'sessionStorage': morre ao fechar a aba ou o PWA`
- **[DADOS-13] Auditoria mostra códigos técnicos e só as 100 últimas ações** — média, inconsistencia, esforço M, confirmado. `api:src/edition-actions/edition-actions.service.ts:342-353 - grava 'action: actionType' e descarta 'audit.action' e 'audit.entity' enviados pelo front; audita também cad…`
- **[DADOS-14] Testes validam o reducer local; a API real nunca é exercitada pelo front** — média, divida tecnica, esforço M, confirmado. `apps/web/tests/mock-api/server.ts:3,8-13 e apps/web/tests/components/StateAdapters.test.tsx:15-33 - a 'API' dos testes roda o mesmo 'applyAction' do cliente`
**[DADOS-R1] Ponto depois do set decisivo cria set a mais e corrompe as parciais** — alta, precisao dados, esforço P, achado pelo revisor
No vôlei, depois do ponto que fecha a partida o placar continua aceitando toques. O ponto seguinte fecha o mesmo set outra vez: o jogo vai a 3 sets em melhor de 3 e a parcial vira 10-26. Desfazer esse ponto apaga a parcial do set final. Ocorreu em 3 dos 24 jogos de vôlei encerrados.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:707-728 - registerEvent não recusa ponto com a partida já decidida; o set fechado soma de novo e a parcial é sob…`; `apps/web/app/matches/live/page.tsx:222-235 e 509 - botões de ponto seguem ativos depois de matchOver; o cliente calcula o mesmo set extra e a API aceita`
Proposta: API recusa lance de pontuação quando um lado já tem setsToWin. Tela troca os botões de ponto por 'Encerrar partida' ao fechar o jogo. Desfazer só apaga a parcial criada pelo evento desfeito. Script para recompor as parciais dos 3 jogos afetados.

**[DADOS-R2] Editar partida muda 'Ao vivo' para 'Encerrada' sem recalcular tabela nem vencedor** — alta, bug, esforço P, achado pelo revisor
Pelo formulário de edição dá para encerrar um jogo ao vivo, ou pôr um agendado 'Ao vivo', só trocando o estado. A API grava o status e mais nada: não define vencedor, não exige desempate, não recalcula a classificação nem avança o mata-mata, e inicia jogo sem operador nem horário de início, até com lado 'a definir'.
Evidência: `apps/web/app/components/MatchManager.tsx:113 e 313 - o seletor 'Estado da partida' oferece matchTransitions: 'Encerrada' para jogo ao vivo e 'Ao vivo' para agendado (app…`; `api:src/edition-actions/handlers/match-action.handler.ts:264-270 e 326-346 - match/update aceita a transição, grava só o status e chama recomputeTournament apenas quando…`
Proposta: API: match/update recusa os destinos 'Ao vivo' e 'Encerrada', que passam a existir só em start e finish. Tela: o seletor oferece apenas Adiada, Cancelada e W.O.; para encerrar, botão que abre o placar. Testes das duas recusas.

- **[DADOS-R3] Nenhuma tela diz de quando são os dados; cache offline passa por 'ao vivo'** — média, precisao dados, esforço M, achado pelo revisor. `apps/web/public/sw.js:86-98 - quando o fetch falha, o service worker devolve o último public-snapshot guardado como resposta 200 comum`
- **[DADOS-R4] Partida abandonada fica 'Ao vivo' para sempre, sem aviso para ninguém** — média, feature ausente, esforço M, achado pelo revisor. `Produção: Basquete Mafiosa × Furiosa (category-5423d6f2cb7e-j3) segue 'Ao vivo' em 13/10, com runningSince preenchido e último batimento do operador em 12/10 15:58 (oper…`

Ideias de feature desta área:

- **Ação única de resultado final (placar digitado e W.O.)** (M)
- **Fila offline persistente de lances na mesa** (G)
- **Telemetria de toques da mesa** (M)
- **Alerta de partida ao vivo sem operador** (M)
- **Invalidação com dica de escopo** (M)
- **Contador de audiência ao vivo** (P)

## ADMIN — Staff, edição e auditoria

**[ADMIN-01] Responsável da atlética não funciona com a API: não é concedido nem consegue entrar** — crítica, bug, esforço M, confirmado
Na tela da equipe, o admin da edição cria o acesso e lê "já pode entrar", mas a API recusou: só super admin concede esse papel. Se o super admin criar, o login responde "E-mail ou senha inválidos", o front perde a equipe da sessão e o Staff lista a pessoa como gestor sem modalidade. Só funciona no modo local.
Evidência: `api:src/edition-actions/edition-actions.service.ts:605-609 - admin da edição só pode conceder "Gestor de modalidade"; Responsável devolve 403`; `api:src/auth/auth.service.ts:249-292 - resolveIdentity não trata TEAM_MANAGER: login termina em 401 "Usuário sem papel ativo"`
Proposta: API: permitir que o admin da edição conceda TEAM_MANAGER e tratar o papel em resolveIdentity e loadStaff. Front: manter a equipe em normalizeSessionUser e só mostrar sucesso com saved.ok. Cobrir com teste e2e-http de convite e login do responsável.

**[ADMIN-02] "Esqueci a senha" é só um aviso; recuperar acesso depende de workflow no GitHub** — alta, feature ausente, esforço M, confirmado
O diálogo "Recuperar acesso" pede o e-mail e responde "Solicitação registrada", mas não chama a API: não existe rota de redefinição nem envio de e-mail. Quem esquece a senha no ginásio só volta se um desenvolvedor rodar um workflow manual em produção. O único super admin já ficou trancado assim em 25/08.
Evidência: `apps/web/app/login/page.tsx:45-50 - recover() só exibe o toast "O envio será conectado ao serviço de e-mail da API"; nenhuma chamada à API`; `api:src/auth/auth.controller.ts:49-136 - rotas existentes: login, refresh, logout, change-password (exige a senha atual) e me`
Proposta: Criar ação staff/resetPassword e botão "Redefinir senha" no cartão do Staff: gera senha temporária, exige troca no próximo acesso, encerra as sessões e mostra a senha para copiar. Admin redefine gestores; super admin redefine admins. Trocar o diálogo por "peça ao admin da edição".

**[ADMIN-03] Erros da troca de senha e do convite aparecem em azul sobre azul** — alta, acessibilidade, esforço P, confirmado
A cor de erro aponta para a cor do cartão. Na troca obrigatória do primeiro acesso, quem digita menos de 12 caracteres ou erra a senha atual toca em "Trocar e entrar" e nada parece acontecer: a mensagem está lá, ilegível. A regra dos 12 caracteres só existe nesse erro. Vale também para "Novo acesso" e acesso da atlética.
Evidência: `apps/web/app/globals.css:21 e :3603 - --pink: var(--card) e .form-error { color: var(--pink) }; contraste calculado 1,00 sobre o cartão e 1,19 sobre o fundo; nenhuma out…`; `apps/web/app/components/PasswordChangeForm.tsx:8,14,25-28 - o mínimo de 12 caracteres só aparece nesse erro; campos sem dica e sem botão de mostrar senha`
Proposta: Pintar .form-error de branco, com ícone de alerta e borda verde. Escrever "mínimo de 12 caracteres" sob "Nova senha", validar ao digitar e pôr o botão de mostrar senha nos três campos. Incluir "Sair" na tela de troca obrigatória.

**[ADMIN-04] Convite de staff não mostra a senha nem como a pessoa entra** — alta, ux, esforço M, confirmado
"Conceder acesso" cria a conta com a senha de convite do servidor, que a tela não mostra: o admin precisa conhecê-la por fora e avisar a pessoa por conta própria. Não há e-mail, link nem resumo. A senha é igual para todos: quem a conhece e souber um e-mail recém-convidado entra antes do dono.
Evidência: `apps/web/app/components/StaffAccessForm.tsx:25 - depois de salvar só volta para /staff; não exibe senha, link nem instrução`; `api:src/edition-actions/handlers/context-action.handler.ts:515-520 - a senha é STAFF_INVITE_PASSWORD, igual para todos, salvo quando o payload traz initialPassword`
Proposta: Gerar uma senha temporária por convite (campo initialPassword, que a API já aceita) e, ao concluir, mostrar "Acesso criado" com endereço de login, e-mail e senha, e botões Copiar e Compartilhar. No Staff, selo "ainda não entrou" enquanto a senha inicial não for trocada.

**[ADMIN-05] Botões Revogar e Excluir do Staff estão na tela, mas invisíveis** — alta, bug, esforço P, confirmado
Os dois botões existem, mas têm borda e ícone na cor do cartão; só aparecem com o mouse por cima, o que não existe no celular. Para tirar o acesso de alguém durante o evento, o admin precisa adivinhar onde tocar. A confirmação ainda fala em "sessão local", texto do modo de demonstração.
Evidência: `shots/admin/mobile/staff.png e shots/admin/desktop/staff.png - cada cartão mostra só o botão da chave, com espaço vazio ao lado`; `shots/metricas.json (admin, /staff) - os botões "Revogar acesso de…" e "Excluir acesso de…" existem no DOM`
Proposta: Trocar os ícones soltos por ações com texto ("Editar papel", "Revogar", "Excluir") em branco com borda visível; no celular, dentro de um menu por cartão. Corrigir a confirmação para "perde o acesso imediatamente". Mesmo ajuste no botão de revogar da tela da equipe.

**[ADMIN-06] Auditoria guarda um clique por linha e a tela só carrega os 100 últimos** — alta, precisao dados, esforço G, confirmado em parte
Cada lance vira uma linha de auditoria e o app recebe só as 100 mais recentes: no evento, isso cobre cerca de 5 minutos de pontos de vôlei. A linha aparece como "match/registerEvent · Match <id>", só com hora, sem data. O filtro "Partidas" fica vazio. Não há busca, período, pessoa nem exportação.
Evidência: `api:src/edition-actions/edition-actions.service.ts:342-353 - toda ação grava uma linha (inclusive cada ponto) com o tipo técnico; rótulo e entidade enviados pelo front (…`; `api:src/edition-snapshots/snapshot.mapper.ts:1050-1072 - take: 100; entity = "<entityType> <id>"`
Proposta: Gravar o rótulo e a entidade legíveis que o front já envia; deixar de auditar lance e relógio (já ficam nos eventos da partida). Criar GET /editions/:id/audit paginado, com filtro por pessoa, tipo, partida e dia. Na tela: data completa, busca e exportar CSV.
Correção do revisor: Núcleo confere, inclusive os 100 últimos em 5 minutos. Erro na proposta: MatchEvent não guarda autor (schema.prisma:513-551); parar de auditar lance apaga o único registro de quem lançou. Exige coluna nova, endpoint, tela e exportação: passa de M.

- **[ADMIN-07] Admin da edição não vê a auditoria que o próprio app promete** — média, feature ausente, esforço P, confirmado em parte. `apps/web/app/lib/frontend-session.ts:135 e components/AdminRouteGuard.tsx:55-56 - canReadAudit só para super admin: "nem o organizador entra"`
**[ADMIN-08] Edição não tem encerramento: status é rótulo que só o super admin muda** — alta, operacao, esforço M, confirmado
Planejamento, Em andamento, Finalizada e Arquivada são texto: nada muda pela data, nada é bloqueado e só o super admin edita. O organizador não tem "Encerrar edição" nem lista do que ficou pendente. Resultado: a Copa acabou em 12/10 e o app segue com edição em andamento, um jogo ao vivo e 36 agendados vencidos.
Evidência: `apps/web/app/competitions/page.tsx:35,69 - canConfigure só para super admin; o seletor se chama "Rótulo no histórico"; a busca por uso de edition.status só encontra esta…`; `api:src/edition-actions/edition-actions.service.ts:46-52 - edition/update é ação global, só super admin`
Proposta: Criar "Encerrar edição" para o admin da edição: lista de pendências (jogo ao vivo, agendado vencido, categoria aberta, ranking não fechado) com atalho para cada uma; ao confirmar, marca Finalizada e bloqueia a operação. "Em andamento" passa a ser automático pela data de início.

- **[ADMIN-09] Ativar outra edição troca o app de todos e derruba o login do staff** — média, ux, esforço M, confirmado. `api:src/auth/auth.service.ts:40-43,291 - o login só considera papéis da edição ativa; sem papel devolve 401`
- **[ADMIN-10] Nova edição nasce vazia: equipes, regulamentos e staff são refeitos um a um** — média, feature ausente, esforço M, confirmado em parte. `api:src/edition-actions/handlers/context-action.handler.ts:230-242 - edition/create grava a edição e só semeia as métricas do ranking`
- **[ADMIN-11] Tela de conceder super admin foi removida e a issue 12 ainda manda usá-la** — média, operacao, esforço P, confirmado. `apps/web/app/staff/promote/page.tsx:3-5 - notFound(); shots/super/mobile/staff_promote.png mostra "TELA NÃO ENCONTRADA"`
- **[ADMIN-12] Segundo papel exige novo convite idêntico e "Excluir" apaga todos os papéis** — média, inconsistencia, esforço M, confirmado. `apps/web/app/components/StaffAccessForm.tsx:26 - "Atribua um único papel na edição"; segundo papel é outro convite com nome e e-mail redigitados`
- **[ADMIN-13] API permite que um admin da edição exclua outro admin** — média, seguranca, esforço P, confirmado. `api:src/edition-actions/edition-actions.service.ts:449-453 - só staff/upsert passa por authorizeEditionAdminStaff; staff/remove cai em "escopo completo, liberado"`
- **[ADMIN-14] Perfil pede permissão de notificação e nenhum alerta é enviado** — baixa, ux, esforço P, confirmado. `apps/web/app/profile/page.tsx:14 - chama Notification.requestPermission() e só grava a preferência`
**[ADMIN-R1] Cor de perigo igual à do cartão apaga botões destrutivos e erros** — alta, acessibilidade, esforço P, achado pelo revisor
ADMIN-03 e ADMIN-05 são sintomas da mesma causa: --pink, usado em cerca de 15 regras como texto ou contorno de erro e perigo, vale a cor do cartão. Somem também Desativar e Excluir modalidade, Excluir categoria, remover fase, remover atleta do elenco e a validação dos diálogos que pedem motivo. O toast de erro perde borda e ícone.
Evidência: `apps/web/app/globals.css:21 - --pink: var(--card); única definição do token usado como cor de erro e de perigo`; `shots/admin/mobile/disciplines_futsal.png - botões 'Desativar' e 'Excluir' quase invisíveis (.danger-button, globals.css:3797; DisciplineManager.tsx:92)`
Proposta: Criar os tokens --danger-text e --danger-line em branco (a marca só admite azul, verde e branco) e usá-los onde --pink é cor de texto ou borda; acrescentar ícone de alerta. Criar teste de contraste para botões destrutivos e mensagens de erro.

- **[ADMIN-R2] Não existe papel de mesário: operar o placar exige ser gestor da modalidade** — média, feature ausente, esforço M, achado pelo revisor. `api:schema.prisma:58-64 - papéis existentes: EDITION_ADMIN, DISCIPLINE_MANAGER e TEAM_MANAGER; busca por mesário, scorekeeper e apontador nos dois repositórios só acha c…`
- **[ADMIN-R3] App perde quem iniciou o jogo e não registra quem lançou cada ponto** — média, precisao dados, esforço M, achado pelo revisor. `api:src/edition-snapshots/snapshot.mapper.ts:923 - startedBy sai de match.operatorName, não de startedById (gravado em handlers/match-action.handler.ts:448)`
- **[ADMIN-R4] Cada ação da mesa grava o snapshot inteiro no banco, sem expurgo** — média, desempenho, esforço M, achado pelo revisor. `api:src/edition-actions/edition-actions.service.ts:391-405 - toda ação cria EditionActionReceipt com responseData = envelope.data (snapshot completo)`

Ideias de feature desta área:

- **Convite por link ou QR de uso único** (M)
- **Acesso de mesário por código da partida** (G)
- **Histórico de cada partida na tela do jogo** (M)
- **Edições passadas navegáveis, inclusive na área pública** (M)
- **Painel de presença do staff durante o evento** (M)
- **Relatório de encerramento da edição** (M)

## CSS — Sistema visual

**[CSS-01] Cor de perigo e de erro não existe: ações destrutivas e erros ficam invisíveis** — alta, bug, esforço P, confirmado
Na troca de marca, o vermelho virou a cor do cartão. Texto e ícone de 12 regras (botão Excluir/Desativar, lixeira do elenco, mensagem .form-error, erro em diálogo) ficam em #1C2266 sobre #0A105A ou sobre o próprio cartão: 1,19:1 e 1:1. Toast de erro e de sucesso só diferem pelo texto; no diálogo destrutivo, Cancelar pesa mais que Confirmar.
Evidência: `apps/web/app/globals.css:19-21 - --blue, --green e --pink apontam para var(--card) (#1C2266); --pink era o vermelho de erro da marca anterior (docs/VISUAL_IMPLEMENTATION…`; `apps/web/app/globals.css:3797, 3603, 3761, 3281, 3264, 3282 - .danger-button, .form-error, .roster-remove-button, erro de campo em diálogo, toast de erro e confirmar do …`
Proposta: Criar --danger (#FF6B6B, cor semântica só para erro e perigo: 6,1:1 no fundo, 5,2:1 no cartão) e aplicá-lo aos 12 usos de var(--pink) como texto ou borda; toast e diálogo de erro com ícone e faixa; teste de contraste nas telas internas.

- **[CSS-02] Botões de lance da mesa sem contorno; lados diferem só por rótulo de 9px** — média, ux, esforço P, confirmado em parte. `apps/web/app/globals.css:2527-2531 - .event-btn recebe background var(--black), que é o mesmo #0A105A da página (globals.css:11); globals.css:421 - border: 0`
**[CSS-03] No detalhe da partida o placar aparece empilhado na vertical entre os escudos** — alta, bug, esforço M, confirmado
A página de uma partida, pública e interna, mostra '2 / — / 1' de cima para baixo: não dá para saber de relance qual número é de qual equipe. Com dois dígitos (basquete 23×10, handebol) cada número passa dos 36px da coluna. Lista, detalhe e mesa desenham o placar de três formas.
Evidência: `apps/web/app/globals.css:2676 - .match-summary-teams reserva 36px para a coluna central, dimensionada para o '×' de jogo sem placar`; `apps/web/app/components/MatchSummary.tsx:10 - a mesma célula recebe '${scoreA} — ${scoreB}' em fonte de 34 a 52px (globals.css:2710-2714)`
Proposta: Criar um único componente Placar (número A, separador, número B, em linha, Aldo branco, cada número alinhado ao seu escudo) e usá-lo na lista, no detalhe e na mesa; coluna central auto com mínimo de 3 dígitos; tirar o fundo verde dos escudos.

**[CSS-04] 'Sem conexão' tem a mesma cor de 'Ao vivo' e some no celular** — alta, bug, esforço M, confirmado
O comentário do CSS diz que a queda 'precisa saltar', mas a regra é anulada pela cascata: sem rede o selo continua verde e, no celular, sem texto. Na tela em que a mesa lança os lances não há indicador; resta um banner global com borda e ícone invisíveis. Produção tem um jogo abandonado 'Ao vivo' (causa desconhecida).
Evidência: `apps/web/app/globals.css:513 x 1892 - .sync-state.sync-offline (cor de alerta) perde para .management-screen .sync-state, de mesma especificidade e declarada depois: off…`; `apps/web/app/globals.css:3890 - até 430px o rótulo vira font-size: 0; sobra um ícone de 18px (CloudOff x Radio, apps/web/app/components/ConnectionBadge.tsx:15-16)`
Proposta: Faixa fixa de largura total no topo, em --danger, com o texto 'Sem conexão', em toda tela interna e pública, inclusive no placar ao vivo; ao voltar, faixa verde 'Reconectado' por 3 segundos; selo online discreto.

- **[CSS-05] Alvos de toque abaixo de 44px em 73 das 85 telas capturadas** — média, acessibilidade, esforço M, confirmado em parte. `shots/metricas.json (alvosPequenos) - 386 ocorrências fora o link de pular: 'Voltar' 82x34 (29 telas), migalhas 'Dashboard/Jogos/Categorias' com 17px de altura (29+), ba…`
- **[CSS-06] Texto abaixo de 12px em 1.183 pontos; o CSS encolhe a letra no celular** — média, acessibilidade, esforço M, confirmado em parte. `shots/metricas.json (textoPequeno) - 1.183 ocorrências (1.027 nas capturas de celular): 169 a 11,2px (rótulos), 128 a 10,9px (migalhas, filtros), 117 a 11px (navegação i…`
- **[CSS-07] Na agenda, 'Ao vivo' tem menos destaque que 'Encerrado'** — média, inconsistencia, esforço M, confirmado. `apps/web/app/globals.css:41-48 e 522-525 - dos quatro tons de selo, info, perigo e neutro têm o mesmo fundo (--card-2) e texto branco; só 'aviso' é verde`
- **[CSS-08] No desktop o app é a coluna do celular: 520 a 760px de 1280** — média, ux, esforço G, confirmado. `apps/web/app/globals.css:340 e 829-832 - .app-screen com max-width 520px; a única media query min-width do arquivo sobe a gestão para 760px e mantém a barra inferior de …`
- **[CSS-09] Sob sol ou brilho baixo a estrutura some: cartões e campos a 1,05-1,6:1** — baixa, acessibilidade, esforço P, confirmado em parte. `Cálculo WCAG dos pares reais (globals.css:11-23): cartão #1C2266 sobre fundo #0A105A = 1,19:1; campo #080E4A sobre fundo = 1,05:1 e sobre cartão = 1,25:1; linha padrão r…`
- **[CSS-10] Tokens pela metade e apelidos que mentem: --orange é verde, --pink é azul** — média, divida tecnica, esforço G, confirmado. `apps/web/app/globals.css:11-23 - --black = azul (133 usos), --orange = verde (311), --blue/--green/--pink = cartão (189); variáveis usadas e nunca definidas: --blue-ligh…`
- **[CSS-11] 17% do CSS é morto e a regressão visual cobre só 4 telas públicas** — média, divida tecnica, esforço G, confirmado. `Grep das 494 classes de globals.css contra os 154 arquivos TS/TSX de apps/web/app: 64 sem nenhum uso (toda a família .public-header/.public-hero/.public-section, .quick-…`
- **[CSS-12] Foco de teclado é cortado pelo recorte dos cantos em botões e cartões** — baixa, acessibilidade, esforço P, confirmado. `apps/web/app/globals.css:70 - anel de foco global por outline com offset de 3px; 746-750 - o próprio comentário registra que clip-path corta o outline, e a correção (box…`
- **[CSS-13] No iPhone instalado, o topo da tela fica sob o relógio do sistema** — média, bug, esforço P, não verificável. `apps/web/app/layout.tsx:72 - appleWebApp.statusBarStyle 'black-translucent': no iOS o conteúdo ocupa a área da barra de status`
- **[CSS-14] Aldo não tem algarismos de largura fixa: cronômetro e placar mudam de largura** — baixa, ux, esforço P, confirmado. `apps/web/app/fonts/aldo-the-apache.ttf (tabela hmtx) - avanços em 2048 unidades: '0' 964, '1' 655, '4' 1053; o '1' é 32% mais estreito que o '0'; não há tabela GSUB, log…`
- **[CSS-R1] Controles da mesa não ficam presos acima da barra: overflow hidden anula o sticky** — média, bug, esforço P, achado pelo revisor. `apps/web/app/globals.css:4057 - .live-screen .match-controls { position: sticky; bottom: 74px } com fundo em degradê: a intenção é manter Pausar/Avançar/Desfazer/Encerra…`
- **[CSS-R2] Til da fonte de títulos lê como acento agudo: 'CLASSIFICAÇÁO', 'CONEXÁO'** — baixa, bug, esforço P, achado pelo revisor. `shots/gestor/mobile/standings.png e shots/admin/desktop/standings.png - o título se lê 'CLASSIFICAÇÁO GERAL' e 'MÉTRICAS DE PONTUAÇÁO'; shots/publico/mobile/offline.png …`
- **[CSS-R3] CI pula os quatro testes de regressão visual: nenhuma tela é comparada** — média, operacao, esforço P, achado pelo revisor. `.github/workflows/ci.yml:120-134 - 'npm run test:e2e -- --grep-invert "regressão visual"'; o comentário do próprio arquivo explica que as referências só existem com sufi…`

Ideias de feature desta área:

- **Modo telão: placar em tela cheia e paisagem para TV ou projetor do ginásio** (M)
- **Modo sol (alto contraste) para mesa e arquibancada** (M)
- **Cor própria de cada atlética no placar, na mesa e na tabela** (M)
- **Cartão de resultado para compartilhar** (M)
- **Visão compacta de agenda e de equipes** (M)
- **Página de estilo viva (/styleguide)** (P)

## PWA — PWA e desempenho

**[PWA-01] Snapshot de 1 MB trafega sem compressão a cada atualização** — alta, desempenho, esforço P, confirmado
O JSON do snapshot (1,03 MB) sai sem gzip: HTML e JS chegam comprimidos, application/json não. Cada lance de qualquer jogo faz todo aparelho conectado baixar 1 MB de novo, e a resposta de cada toque do mesário tem o mesmo tipo de conteúdo. No último dia isso dava ~75 MB por hora para cada aba pública aberta.
Evidência: `Produção 13/10: GET /intereng-api/api/v1/editions/active/public-snapshot com Accept-Encoding gzip,br devolve Content-Length 1.032.090 e nenhum Content-Encoding; o mesmo …`; `api:src/main.ts:8-25 e api:package.json:27-46 - a API não tem middleware de compressão; o gateway repassa application/json cru`
Proposta: Ligar gzip (ou brotli) para application/json no gateway em /intereng-api/, ou o middleware compression no Nest: 1,03 MB vira ~91 KB sem mudar contrato. Incluir no CD um teste que falha se o snapshot voltar sem Content-Encoding.

**[PWA-02] Cada lance reconstrói, grava e devolve o histórico inteiro da edição** — alta, desempenho, esforço G, confirmado em parte
O snapshot leva todos os lances de todos os jogos, inclusive encerrados. Cada ação trava a edição, remonta tudo do banco, grava uma cópia inteira no recibo de idempotência e devolve até ~1 MB. Nos lançamentos em lote o ritmo nunca passou de um lance a cada 0,6 s (mediana 1,4 s) e piorou com duas mesas simultâneas.
Evidência: `Produção 13/10: 97,8% do snapshot público são jogos; 874 KB (85%) são os eventos de 2.689 lances, 204 KB só do campo previous, 81 KB de rules repetido em 96 jogos (4 reg…`; `api:src/edition-actions/edition-actions.service.ts:283,381-405 - trava única por edição, snapshot privado montado dentro da transação e copiado inteiro em edition_action…`
Proposta: Snapshot sem events de jogo encerrado, sem previous e com rules por modalidade (79 KB; 8 KB com gzip); lances de jogo encerrado sob demanda no detalhe; artilharia agregada no servidor (issue API #17); recibo guarda só a revisão.
Correção do revisor: Números conferidos no snapshot de produção (97,8% jogos, 874 KB lances, revisão 3.816). Correção: TournamentClassification.tsx:44-46 calcula o desempate fair-play dos lances de jogo encerrado; sem agregado no servidor a tabela muda. Ritmo também limitado pelo cliente (PWA-R1).

**[PWA-03] Tempo real está mudo em produção e o selo continua dizendo 'ao vivo'** — alta, precisao dados, esforço M, confirmado em parte
Em produção o stream SSE abre e não entrega nada. Todo aparelho vive da sondagem de 12 s, então o placar público e o segundo aparelho da mesa andam até 12 s atrasados, com selo 'Resultados ao vivo'. Cada aba ainda prende uma das seis conexões HTTP/1.1 do navegador num stream que nunca responde.
Evidência: `Produção 13/10 15:34Z: GET /intereng-api/api/v1/editions/active/stream ficou 100 s sem devolver um byte nem cabeçalho; /health respondeu ok em 0,4 s. O PR front #92 (04/…`; `apps/web/app/lib/repositories/http-adapter.ts:382-395 - plano B: GET do snapshot a cada 12 s com a aba visível; :142-160 aceita revisão igual e troca o estado, re-render…`
Proposta: Desligar buffer e alongar timeout de /stream no gateway e na borda; se não der, sondar um endpoint de revisão (~60 bytes) a cada 3 s. Selo com três estados e hora da última atualização; reabrir após 45 s sem batimento.
Correção do revisor: Stream mudo confirmado: 25 s sem cabeçalho, e a API emite a revisão na abertura (controller:77). Correção: a borda negocia HTTP/2 (ALPN h2), não há fila de seis conexões. Falta dizer: streamEntregou (http-adapter.ts:382-392) desliga a sondagem para sempre.

**[PWA-04] Falha ao atualizar troca a tela inteira por erro, mesmo com dado bom** — alta, bug, esforço M, confirmado
Com sinal ruim o app espera a rede sem prazo e, quando o GET de 1 MB falha, apaga a tela que já tinha dados e mostra 'DADOS INDISPONÍVEIS' até alguém tocar em 'Tentar novamente'. Na mesa isso desmonta o placar no meio do jogo. Durante reinício da API o público vê 'sem competição' ou erro.
Evidência: `apps/web/app/lib/repositories/use-frontend-state.ts:56-61,78-93 - qualquer falha de refresh (ao montar, ao voltar a rede, a cada renovação de sessão) vira status 'error'…`; `apps/web/app/components/PublicAppShell.tsx:50 e AdminRouteGuard.tsx:74 - status 'error' substitui a página por 'DADOS INDISPONÍVEIS', inclusive o placar da mesa`
Proposta: Manter a última tela com faixa 'sem atualizar desde HH:MM'; erro de tela cheia só sem dado nenhum. SW: prazo de 4 s e cache também em 5xx; não gravar HTML com snapshot vazio. Timeout de 8 s no axios e no fetch do servidor.

**[PWA-05] Deploys do front e da API entraram no ar com jogo sendo operado** — alta, operacao, esforço M, confirmado
Qualquer merge publica na hora: constrói a imagem na VM do evento e recria o container. Em 10/10 três merges (10:42, 10:49, 10:53) caíram sobre dois jogos em operação; o vôlei ficou quase 7 min sem lance e voltou com 8 pontos em 8 s. A coincidência é forte, a causa não está provada.
Evidência: `git: front #116 (10/10 10:42 -03), #117 (10:49) e API #40 (10:53) mergeados com Vôlei Halterada x Halterada 2 (10:40-11:46) e Handebol Halterada x Mafiosa (10:34-11:01) …`; `dados/jogos-producao.json: nesse vôlei, lances a cada ~20 s até 10:58:08, silêncio de 6 min 50 s (inclui o intervalo de set) e 8 pontos em 8 s a partir de 11:04:58`
Proposta: Trava de evento no CD: antes de recriar o container, consultar /editions/active/live e esperar, ou exigir aprovação manual em environment de produção, se houver jogo ao vivo. Construir a imagem em runner hospedado e só baixá-la na VM. Voltar a exigir 1 aprovação.

**[PWA-06] Mesa sem rede perde o lance: não há fila nem recarga offline** — alta, feature ausente, esforço G, confirmado
Se a rede cai por um minuto, cada toque no placar falha depois de uma repetição imediata e o mesário precisa lembrar o que faltou. Recarregar a página sem sinal leva à tela 'SEM CONEXÃO', que só oferece voltar à área pública. O app não guarda nada da mesa no aparelho.
Evidência: `apps/web/app/lib/repositories/api-client.ts:76-82,184-197 - uma única repetição imediata em erro de rede; depois o lance vira toast de erro e some`; `apps/web/app/lib/repositories/http-adapter.ts:99-105,215-236 - sem atualização otimista: o placar só anda quando a resposta volta; a Idempotency-Key por ação já existe`
Proposta: Fila de lances no aparelho (IndexedDB) reaproveitando a Idempotency-Key: placar otimista, contador 'N lances aguardando envio', reenvio em ordem com espera crescente e aviso se o servidor recusar. SW guarda o shell de /matches/live para recarregar sem rede.

- **[PWA-07] Não existe medição de uso nem de erro no front ou na API** — média, feature ausente, esforço G, confirmado. `Grep no front por sentry|analytics|plausible|web-vitals|sendBeacon|instrumentation: nenhuma ocorrência além de NEXT_TELEMETRY_DISABLED em .github/workflows/ci.yml:95; nã…`
- **[PWA-08] CD apaga a imagem anterior antes de testar e não tem rollback** — média, operacao, esforço M, confirmado. `front .github/workflows/cd.yml:64-69 - 'up -d --build' seguido de 'docker image prune -f' antes do passo 'Verificar que o site respondeu' (:74-89); se falhar, o job fica…`
- **[PWA-09] Aviso de versão nova nunca aparece; aba aberta segue com código antigo** — baixa, bug, esforço P, confirmado em parte. `apps/web/public/sw.js:1 - VERSION fixo 'halterada-v1'; git: sw.js não muda desde #104 (09/10 00:14) e 12 merges publicáveis vieram depois, até 10/10 10:49`
- **[PWA-10] Toda página é renderizada sob demanda e carrega 1,2 MB de HTML** — média, desempenho, esforço M, confirmado. `apps/web/app/layout.tsx:14,77 - force-dynamic na raiz (commit cb8e2d6, 'melhora SEO da area publica') e await loadPublicSnapshot() em todo documento; .next/prerender-man…`
- **[PWA-11] Service worker pré-carrega 6 MB, mas não guarda JS, CSS nem a agenda** — média, desempenho, esforço M, confirmado. `apps/web/public/sw.js:13-27 - addAll atômico de 5 páginas dinâmicas (1,2 MB cada em produção) na primeira visita; /public/standings/general é rota legada que só redireci…`
- **[PWA-12] Notificações: preferência coletada no perfil, nenhuma peça de envio existe** — média, feature ausente, esforço G, confirmado. `apps/web/app/profile/page.tsx:14,18 - pede Notification.requestPermission() e grava a preferência; o próprio texto diz 'O front-end está pronto; a entrega push será ativ…`
- **[PWA-13] Sons da mesa apontam para a raiz do domínio e dão 404** — média, bug, esforço P, confirmado. `apps/web/app/lib/sound-effects.ts:29-39,87,96 - caminhos '/sounds/...' entregues a new Audio() sem passar por appPath`
- **[PWA-14] Instalação: atalho 'Agenda' abre Modalidades e o convite reaparece toda sessão** — baixa, ux, esforço P, confirmado. `apps/web/app/manifest.ts:48-52 - o atalho 'Agenda' aponta para /public/tournaments e 'Jogos ao vivo' repete o start_url; em app/components/PublicAppShell.tsx:32-36 a age…`
**[PWA-R1] Toque rápido no placar é recusado: cliente envia placar absoluto calculado de estado velho** — alta, bug, esforço M, achado pelo revisor
Cada toque envia o placar já somado, calculado do que está na tela. A tela só muda quando a resposta volta (0,6 s ou mais) e a trava é de 350 ms: o segundo toque rápido repete o valor, o servidor responde 409 e o ponto some num toast. Lançar 88 pontos exige esperar cada um.
Evidência: `apps/web/app/matches/live/page.tsx:176-212,216-256 - writeEvent manda patch com scoreA/scoreB/periodScore absolutos tirados do estado da tela; o dispatch não é aguardado…`; `api:src/edition-actions/handlers/match-action.handler.ts:736-743,1760-1771 - o servidor deriva o placar sozinho e responde 409 'diverge do valor calculado pelo regulamen…`
Proposta: Enviar o lance sem placar absoluto (tipo, lado e pontos; o servidor já deriva e os campos são opcionais). Na tela, somar na hora e despachar os toques em fila, um por vez; se um falhar, parar a fila e avisar quantos ficaram.

- **[PWA-R2] Deploy recria o container e o gateway pode seguir apontando para o IP antigo** — média, operacao, esforço P, achado pelo revisor. `api:.github/workflows/recarregar-gateway.yml:3-12,20-21 - o nginx guarda o IP do upstream; recriar o container deu 502 em 19/08; a recarga existe só como workflow manual`
- **[PWA-R3] Teto de 40 conexões SSE por IP pode valer para o público inteiro** — média, operacao, esforço P, achado pelo revisor. `api:src/common/guards/client-ip.ts:30-32,54 e api:.env.example:76 - a API lê a última entrada do X-Forwarded-For contando 1 proxy por padrão ('um, hoje: o incinera-gatew…`
- **[PWA-R4] Telas internas abrem com o snapshot público como se já fosse o dado completo** — média, precisao dados, esforço M, achado pelo revisor. `apps/web/app/layout.tsx:77-82 - toda rota, inclusive mesa e gestão, recebe o snapshot público (ou vazio, se a API falhar) como initialState`

Ideias de feature desta área:

- **Seguir minha atlética** (M)
- **Modo telão** (M)
- **Mesa que não apaga a tela e confirma cada lance** (P)
- **QR code por jogo e cartão de compartilhamento** (M)
- **Painel 'evento agora' para a organização** (M)
- **Tela 'Sobre e diagnóstico'** (P)

## TESTES — Testes

**[TESTES-01] Avançar tempo é recusado pela API em Futsal, Handebol e Basquete** — alta, bug, esforço P, confirmado
A mesa fixa `hasClock = false`, mas as três modalidades estão com relógio regressivo na API. Ao tocar em Avançar tempo, o servidor responde 409. No evento, nenhum jogo delas saiu do 1º tempo. A suíte inteira passa porque modo local e servidor falso aceitam qualquer alteração sem validar.
Evidência: `apps/web/app/matches/live/page.tsx:83 e :405-406 - 'const hasClock = false' fixo (desde 05/09, commit 92dd000); avançar etapa envia 'paused: false' sem 'runningSince'`; `api:src/edition-actions/handlers/match-action.handler.ts:523-526 - modalidade com relógio + 'paused === false' sem 'runningSince' devolve 409 'Ao retomar o cronômetro, i…`
Proposta: Derivar `hasClock` do regulamento na mesa e enviar `paused` e `runningSince` coerentes; gravar relógio 'nenhum' nas modalidades da Copa; cobrir o avanço de etapa das quatro modalidades em teste contra a API real.

**[TESTES-02] Nenhum teste liga o front à API real; o mock repete o front** — alta, contrato api, esforço G, confirmado
Os 23 specs e2e rodam em modo local (localStorage), que produção não usa; os 13 do modo http falam com um servidor que executa o reducer do próprio front. A API real tem regras próprias e recusa o que diverge. Divergência de contrato, permissão, formato ou latência só aparece em produção.
Evidência: `apps/web/tests/mock-api/server.ts:3 e :348 - o servidor falso aplica 'applyAction' do front: sem validação de placar, papel, trava de operador, revisão, idempotência ou …`; `apps/web/tests/components/StateAdapters.test.tsx:19-27 - o teste de 'contrato entre as origens' compara o reducer do front com ele mesmo`
Proposta: Criar o job `e2e-real`: Postgres, Redis e a API da `main` em contêiner, build http com basePath e banco semeado por script. Migrar para ele os fluxos de mesa, categoria e agenda; deixar o modo local só para layout.

**[TESTES-03] Vôlei aceita ponto após o fim e perde a parcial do último set** — crítica, precisao dados, esforço M, confirmado
O replay offline dos 2.689 lances reais acusou três jogos de vôlei inconsistentes. Depois do ponto que fecha a partida a mesa segue ativa: outro toque vence o set de novo. E desfazer um lance após o fim apaga a parcial do set decisivo. Nenhum dos casos tem teste, em nenhum repositório.
Evidência: `dados/jogos-producao.json - Inquisidores × Furiosa (12/10): ponto extra 0,9 s depois do match point virou 0×3 em melhor de 3, parcial 10-26 gravada, e exigiu retificação…`; `apps/web/app/matches/live/page.tsx:216-235 e api:src/edition-actions/handlers/match-action.handler.ts:707-728 - nem a tela nem a API recusam ponto com a partida já decid…`
Proposta: Recusar pontuação quando um lado já atingiu `setsToWin`, na tela e na API; ao desfazer, apagar só a parcial que o próprio lance criou. Adicionar testes de invariante: sets ≤ limite, uma parcial por set, parcial com placar válido.

**[TESTES-04] CD publica em produção no push, sem esperar o resultado do CI** — alta, operacao, esforço P, confirmado
CI e CD são workflows independentes disparados pelo mesmo push: o deploy na VM não consulta o resultado dos testes. A issue #14, aberta desde agosto, registra que as rulesets também não exigem check verde. Houve 17 merges nas branches que publicam entre 09 e 10/10, com o evento em curso.
Evidência: `front:.github/workflows/cd.yml:3-21 e api:.github/workflows/cd.yml:3-18 - gatilho próprio em 'push', sem 'needs' nem 'workflow_run' do CI`; `issues/api-issue-14.json - aberta desde 19/08: rulesets dos dois repositórios com 0 aprovações e sem 'required_status_checks'`
Proposta: Disparar o `cd.yml` por `workflow_run` do CI concluído com sucesso (mantendo `workflow_dispatch`), marcar os jobs do CI como obrigatórios nas duas rulesets e fechar a #14.

**[TESTES-05] Tabela oficial é calculada por código sem teste dos critérios de desempate** — alta, precisao dados, esforço M, confirmado
Há três calculadoras de classificação. Os testes de desempate cobrem duas que produção quase não usa; a que grava a tabela do evento só tem teste de fair play. Elas divergem em quem venceu jogo decidido no desempate e na ordem do 'sorteio': a posição na página da equipe pode diferir da tabela.
Evidência: `api:src/edition-actions/edition-action-recalculation.service.ts:153-281 - 'computeStandings'/'rankBlock' grava a tabela de produção; a spec ao lado só tem 4 casos, todos…`; `api:src/standings/standings.service.ts:56 - 'StandingsCalculator', dono dos únicos testes de confronto direto da API, está marcado para remoção e nenhuma ação o chama`
Proposta: Escrever um arquivo único de cenários (jogos, regra, ordem esperada) cobrindo cada critério e empates triplos, executado pelos dois repositórios; fazer a página da equipe ler a classificação do servidor; remover a calculadora legada da API.

- **[TESTES-06] Regulamento existe em duas cópias, front e API, sem teste de paridade** — média, contrato api, esforço M, confirmado em parte. `apps/web/app/lib/regulation.ts:129-147 × api:src/edition-actions/action-regulation.ts:73-154 - Futevôlei (sets) e Queimado só têm padrão no front; na API caem no genéric…`
**[TESTES-07] Mesa só tem teste de um gol e desfazer no Futsal** — alta, divida tecnica, esforço M, confirmado
As operações que geraram 2.689 lances no evento quase não têm teste: vôlei nunca é pontuado, basquete nem existe nos dados de demonstração, e encerrar, W.O., desempate e retificação não passam por nenhum e2e. Na API, o handler que valida cada lance não tem spec de registrar, encerrar, desfazer ou retificar.
Evidência: `apps/web/tests/e2e/admin-flows.spec.ts:288-311 - único e2e que pontua: 1 gol e desfazer em 'semifinal-1' (Futsal); nenhum spec encerra partida, pontua vôlei ou basquete,…`; `apps/web/app/matches/live/page.tsx:216-257 - a derivação do placar (sets, parciais, etapa) vive dentro do componente de 633 linhas, fora do alcance do teste de unidade`
Proposta: Extrair do componente uma função pura de derivação do lance e testá-la por tabela nas quatro modalidades; na API, specs de `registerEvent`, `finish`, `undoEvent`, `correctResult` e W.O. com banco real; um e2e por modalidade do início ao encerramento.

- **[TESTES-08] Teste do plano B do tempo real existe e nunca roda** — média, divida tecnica, esforço P, confirmado. `apps/web/package.json:11 - 'test:unit' lista 20 arquivos à mão; 'tests/unit/sondagem-tempo-real.test.ts' (3 casos) não está na lista`
**[TESTES-09] Toque rápido com rede lenta e dois aparelhos na mesa não têm teste** — alta, bug, esforço M, confirmado
Se a resposta demora mais de 350 ms, o toque seguinte é calculado sobre o placar antigo e a API o recusa: o lance some com um aviso de erro. No modo local a gravação é instantânea, então nenhum teste vê. Também não há teste de dois aparelhos disputando a trava nem de telão acompanhando.
Evidência: `apps/web/app/matches/live/page.tsx:196 e :256 - 'void dispatch(...)' sem esperar; a trava de toque solta por 'setTimeout' de 350 ms, não pela resposta`; `apps/web/app/lib/repositories/http-adapter.ts:100-104 - sem atualização otimista: o placar na tela só muda quando chega a resposta, que é o snapshot inteiro da edição`
Proposta: Enfileirar os lances na mesa, um por vez, cada um calculado sobre a resposta do anterior; testar com atraso de 800 ms injetado na rota de ações (cinco toques, cinco pontos) e com dois contextos de navegador para trava e telão.

- **[TESTES-10] 196 testes e2e da API não rodam e miram rotas que respondem 410** — média, divida tecnica, esforço M, confirmado. `api:.github/workflows/ci.yml (comentário final) - 'NÃO incluído aqui: npm run test:e2e ... nunca rodou em CI e não dá para afirmar que passa hoje'`
- **[TESTES-11] Nenhum e2e roda com o prefixo /copahalterada, que só existe em produção** — média, operacao, esforço M, confirmado. `apps/web/scripts/build-local.mjs:12-16 e build-http.mjs:5-14 - as duas builds de teste não definem NEXT_PUBLIC_BASE_PATH`
- **[TESTES-12] Regressão visual cobre quatro telas públicas e está fora do CI** — baixa, divida tecnica, esforço M, confirmado. `apps/web/tests/e2e/navigation.spec.ts:134-161 - quatro capturas, todas públicas: equipes, ao vivo, modalidades e detalhe da equipe`
- **[TESTES-13] Varreduras de tela aprovam tela de erro e usam dados vinte vezes menores** — média, divida tecnica, esforço M, confirmado. `apps/web/tests/e2e/todas-as-telas.spec.ts:72-86 e shots/metricas.json - só exige 'main' não vazio: /audit ('ACESSO RESTRITO') e /staff/promote ('TELA NÃO ENCONTRADA') pa…`
- **[TESTES-14] Quem iniciou a partida some quando o operador sai da mesa** — baixa, bug, esforço P, confirmado em parte. `api:src/edition-snapshots/snapshot.mapper.ts:923 - 'startedBy' é preenchido com 'match.operatorName', não com a relação 'startedById'`
**[TESTES-R1] Página do jogo mostra cronômetro e minuto falsos em Futsal, Handebol e Basquete** — alta, precisao dados, esforço P, achado pelo revisor
A mesa opera sem relógio, mas a página do jogo (pública e interna) segue o regulamento: com relógio regressivo mostra um cronômetro que ninguém controla — corre sozinho até 00:00 e, encerrado o jogo, volta à duração cheia — e carimba todo gol com o mesmo minuto (12:00 no Handebol, 20:00 no Futsal).
Evidência: `apps/web/app/components/MatchDetailClient.tsx:35 e :49-52 - mostra relógio e minuto do lance sempre que 'rules.clockMode !== 'none''; a mesa fixa 'hasClock = false' (mat…`; `dados/jogos-producao.json - os 580 lances de Handebol, Futsal e Basquete têm periodElapsedSeconds 0 e as três modalidades estão com clockMode 'countdown'`
Proposta: Decidir 'tem relógio' numa única função usada pela mesa e pelo detalhe; enquanto a mesa não operar cronômetro, o detalhe esconde relógio e minuto. Gravar 'Sem cronômetro' nas três modalidades. Teste: gol em modalidade regressiva não mostra minuto na página pública.

**[TESTES-R2] Regulamento muda no meio do evento e reinterpreta partidas já jogadas** — alta, precisao dados, esforço M, achado pelo revisor
A API não guarda o regulamento com que a partida foi jogada: relê sempre o atual da modalidade. No evento o Vôlei passou de melhor de 5 para melhor de 3 após o primeiro jogo, que hoje aparece como 2×1 no '4º set de 3'. Trocar pontuação ou critérios de desempate também não recalcula a tabela.
Evidência: `api:src/edition-actions/handlers/catalog-action.handler.ts:79-120 - 'discipline/update' grava 'rules' novas sem checar partidas ao vivo ou encerradas; 'recomputeTourname…`; `api:src/edition-actions/handlers/match-action.handler.ts:55 e :417-420 - 'match/start' aceita 'rules' e descarta; cada lance relê a configuração atual; snapshot.mapper.t…`
Proposta: Gravar o regulamento na partida ao iniciar e usá-lo em lance, encerramento e snapshot. Ao salvar regras com jogos já iniciados, mostrar quantos são, pedir confirmação e recalcular as tabelas da modalidade. Specs: troca de regra com partida ao vivo e encerrada.

**[TESTES-R3] Página da equipe mostra posição e pontos diferentes da tabela oficial** — alta, precisao dados, esforço P, achado pelo revisor
O cartão 'Classificações' da página da atlética recalcula no navegador: junta todos os grupos numa lista só, conta jogos do mata-mata e ignora a pontuação da modalidade. Na própria demonstração, Alcateia aparece em 3º com 1 jogo e 1 ponto na página da equipe e em 1º do Grupo A com 0 jogos na Tabela.
Evidência: `apps/web/app/components/TeamPerformance.tsx:22-24 - 'calculateStandings(participants, rows)' sem o regulamento da modalidade (3/1/0 fixo) e com todos os inscritos e jogo…`; `apps/web/app/components/TournamentClassification.tsx:63-89 - a aba Tabela usa 'phase.standings' do servidor, filtrada por grupo`
Proposta: Ler posição, jogos e pontos de `phase.standings` do grupo da equipe, a mesma fonte da aba Tabela, e rotular 'Xº do Grupo A'; no mata-mata, mostrar a fase alcançada. Teste de componente com dois grupos e uma semifinal encerrada.

- **[TESTES-R4] Retificação só troca o placar: parciais ficam erradas e qualquer número passa** — média, precisao dados, esforço M, achado pelo revisor. `api:src/edition-actions/handlers/match-action.handler.ts:1114-1123 e :1193-1203 - 'correctResult' aceita placar de 0 a 100.000, inclusive fracionário, sem conferir o reg…`

Ideias de feature desta área:

- **Ensaio geral: replay dos 96 jogos reais contra a API** (M)
- **Conferência de consistência dos dados durante o evento** (M)
- **Ambiente de ensaio com promoção para produção** (G)
- **Painel de saúde: recusas da API e erros da mesa** (M)
- **Contrato executável compartilhado entre front e API** (M)
- **Partida de treino para mesários** (M)

## APIDOM — API: domínio e contrato

**[APIDOM-01] Tabela ignora jogos sem grupo ou com equipe fora do grupo** — crítica, precisao dados, esforço M, confirmado
Em fase com grupos, o recálculo só soma jogos ligados a um grupo e disputados por duas equipes daquele grupo. Jogo agendado direto na fase, ou com equipe sem grupo, some da tabela sem aviso. Em produção isso tirou 9 de 11 resultados do Vôlei Feminino e definiu as semifinais.
Evidência: `api:src/edition-actions/edition-action-recalculation.service.ts:104-112 e :195-198 - em fase com grupos só entra jogo com groupId do grupo e disputado por dois membros d…`; `api:src/edition-actions/handlers/match-action.handler.ts:1525-1541 e apps/web/app/components/MatchCreationForm.tsx:109 - match/schedule aceita o nome da fase (groupId nu…`
Proposta: Recusar, em match/schedule e match/update, jogo sem grupo em fase que tem grupos e jogo de grupo com equipe de fora; exigir toda equipe alocada ao publicar; expor no snapshot os jogos fora da tabela; reparar e recalcular as duas categorias de Vôlei.

**[APIDOM-02] API não tem ação para lançar o resultado final de uma partida** — crítica, feature ausente, esforço M, confirmado
Quem tem só a súmula precisa iniciar a partida, assumir a trava e tocar cada ponto, esperando a resposta do servidor a cada toque. Dois terços dos jogos foram lançados assim; 36 seguem Agendada com data passada. O início falso ainda grava horário de início e nota de atraso que não existiram.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:320-324 e :610-612 - placar só muda por evento com partida Ao vivo, por W.O. ou por retificação`; `api:src/edition-actions/handlers/match-action.handler.ts:1139-1141 - correctResult exige partida já encerrada e só troca scoreA/scoreB, sem parciais`
Proposta: Criar match/recordResult {id, periods:[{scoreA,scoreB}], tiebreak?} para partida Agendada ou Adiada: valida as parciais pelo regulamento, grava MatchPeriodResult, encerra, define vencedor e recalcula. Guardar a origem (ao vivo ou súmula) em coluna nova, sem preencher startedAt.

**[APIDOM-03] No vôlei, ponto após o fim soma set e desfazer apaga a parcial** — crítica, bug, esforço M, confirmado
Depois que o set decisivo fecha, o placar parcial não zera e a etapa não avança; o toque seguinte satisfaz de novo a regra do set e soma outro. Desfazer esse toque apaga a parcial legítima. Três jogos de produção ficaram com sets ou parciais errados, visíveis ao público.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:710-728 - registerEvent não recusa ponto quando um lado já tem setsToWin; o set decidido é contado de novo`; `api:src/edition-actions/handlers/match-action.handler.ts:925-927 - undoEvent apaga parciais com period >= etapa anterior, inclusive a do set que fechou o jogo`
Proposta: Recusar evento de pontuação quando a partida por sets já está decidida; no desfazer, apagar só a parcial criada pelo evento desfeito; aceitar parciais na retificação; corrigir os três jogos por script.

**[APIDOM-04] Retificar resultado de grupo apaga o mata-mata publicado da categoria** — alta, bug, esforço M, confirmado
A retificação remove as partidas futuras do chaveamento em vez de só limpar quem joga. Dia, hora e cruzamento publicados se perdem; a chave some da agenda até o fim dos grupos e volta com semeadura automática e data inventada. category/generateMatches também apaga jogos operados e não recalcula a tabela.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:1150-1158 e :1213-1220 - correctResult apaga todas as partidas -advanced ainda agendadas quando a origem é fase …`; `api:src/edition-actions/edition-action-recalculation.service.ts:473-475 e :486-491 - com grupos incompletos nada é recriado; depois a chave volta por semeadura automática`
Proposta: Na retificação, manter a partida e devolver o rótulo original, guardado em coluna própria, preservando dia, hora e local; recriar só o que não existia. Em generateMatches, recusar apagar partida encerrada e chamar o recálculo.

**[APIDOM-05] Cada toque no placar devolve e regrava a edição inteira (~1 MB)** — alta, desempenho, esforço G, confirmado
A resposta de qualquer ação é o snapshot privado completo, montado com a edição travada e copiado para o recibo de idempotência. Cada revisão faz todos os aparelhos baixarem tudo outra vez. O peso vem de eventos de jogos já encerrados e de dados repetidos, e cresce a cada ponto.
Evidência: `api:src/edition-actions/edition-actions.service.ts:381-405 - snapshot privado reconstruído dentro da transação com a edição travada e gravado inteiro no recibo; não exis…`; `api:src/edition-snapshots/snapshot.mapper.ts:897, :902-904 e :1135-1137 - rules repetido em cada jogo, todos os eventos em cada jogo, previous em cada evento`
Proposta: Ação responde só as entidades alteradas e a revisão; snapshot sem eventos de jogos encerrados e sem rules e previous por jogo; eventos sob demanda em GET /matches/:id/events; recibo guarda apenas a revisão e expira em 24 h.

- **[APIDOM-06] Situação de categoria e de edição não acompanha os jogos** — média, inconsistencia, esforço M, confirmado. `api:src/edition-actions/edition-action-recalculation.service.ts:390-393, :501-504 e :779-782 - categoria só vira Em andamento ou Encerrado pela progressão do mata-mata`
**[APIDOM-07] Agenda exige horário, local é texto livre e não há ordem do dia** — alta, feature ausente, esforço G, confirmado
A organização publica jogos como 'a seguir' numa quadra; a API só aceita horário fixo e um texto de local. O horário inventado virou atraso em quase todo jogo, e sem quadra como entidade não há 'agora' e 'próximo' por quadra nem conflito de agenda conferido no servidor.
Evidência: `api:schema.prisma:492-493 - scheduledAt já é opcional e venue é String; não existe entidade de local nem campo de ordem`; `api:src/edition-actions/handlers/match-action.handler.ts:221-223 - match/schedule exige data, hora e local com 2 ou mais caracteres; nenhum conflito de agenda é conferido`
Proposta: Criar Venue por edição e Match.venueId; aceitar horário nulo com Match.dayOrder, a posição na fila da quadra no dia; ações venue/create, venue/update e match/reorder; a progressão do mata-mata deixa de inventar data e herda quadra e posição.

**[APIDOM-08] Cadastro de atleta é um POST por nome e não dá para delegar** — alta, feature ausente, esforço M, confirmado
Cada atleta custa uma ação completa, com a edição inteira de volta. O papel criado para a atlética montar o próprio elenco só pode ser concedido pelo super admin e, concedido, aparece com rótulo errado na lista de staff. Camisa e situação do atleta existem no banco e não são alcançáveis.
Evidência: `api:src/edition-actions/handlers/catalog-action.handler.ts:31 e :370-402 - athlete/create aceita só nome, equipe e modalidades, um atleta por ação; importação existe ape…`; `api:schema.prisma:299-300 - EditionRoster já tem jerseyNumber e status (SUSPENDED); nenhum dos dois chega à ação nem ao snapshot`
Proposta: Criar athlete/bulkUpsert {teamId, athletes:[{id,name,jerseyNumber,modalities}]} em uma transação, com erros por linha; expor jerseyNumber no snapshot; permitir ao admin da edição conceder Responsável da atlética e corrigir o rótulo do papel.

- **[APIDOM-09] W.O. aplica placar fixo, não aceita ausência dupla nem conversão posterior** — média, precisao dados, esforço M, confirmado em parte. `api:src/edition-actions/handlers/match-action.handler.ts:303-319 - W.O. é um status de match/update, com vencedor obrigatório e motivo`
**[APIDOM-10] Partida Ao vivo abandonada fica com o relógio correndo para sempre** — alta, feature ausente, esforço M, confirmado
A trava do operador vence em 2 minutos, mas a partida continua Ao vivo e cada aparelho calcula o relógio a partir de runningSince. Sem tarefa periódica, nada pausa, sinaliza ou encerra. O público vê um jogo 'ao vivo' no dia seguinte, e sair desse estado exige adiar, dar W.O. ou encerrar à mão.
Evidência: `api:package.json (dependencies) e api:src/app.module.ts:39-74 - nenhum agendador, cron ou fila; nada roda sem requisição`; `api:src/edition-actions/handlers/match-action.handler.ts:505-528 - runningSince só muda por ação do operador que detém a trava`
Proposta: Tarefa a cada 5 min pausa o relógio de partida Ao vivo sem batimento nem evento há 20 min e registra na auditoria; snapshot expõe stalled; criar match/suspend e match/reset (volta a Agendada zerando placar e eventos, com motivo).

**[APIDOM-11] Equipe que entra ou sai com a categoria em andamento não tem caminho** — alta, feature ausente, esforço G, confirmado
Depois do primeiro jogo operado, a API recusa mudar participantes ou grupos. Não há desistência de equipe, e partida Cancelada trava o avanço do mata-mata, que exige todos os jogos da fase encerrados. A organização contornou reescrevendo confrontos à mão, e a tela não envia match/delete.
Evidência: `api:src/edition-actions/handlers/category-action.handler.ts:226-246 - com qualquer partida operada, participantes, grupos e distribuição ficam congelados`; `api:src/edition-actions/edition-action-recalculation.service.ts:473-475 - o avanço exige todos os jogos da fase Encerrada ou W.O.; uma Cancelada bloqueia`
Proposta: Criar category/withdrawEntry {id, team, reason}: marca a inscrição como desistente, dá W.O. ou cancela os jogos restantes e tira os cancelados da conta do avanço. Aceitar inclusão de equipe em andamento (PR 41) e enviar match/delete pela tela.

- **[APIDOM-12] Regulamento muda com jogos encerrados, sem validação nem recálculo** — média, precisao dados, esforço M, confirmado em parte. `api:src/edition-actions/handlers/catalog-action.handler.ts:80-82 e :120-121 - rules só precisa ser um objeto; é gravado cru, sem olhar jogos existentes e sem recalcular …`
- **[APIDOM-13] Quem iniciou a partida some e a auditoria afoga em toques de placar** — média, bug, esforço M, confirmado. `api:src/edition-snapshots/snapshot.mapper.ts:923 - startedBy é preenchido com operatorName (trava atual); startedById não é lido no select (:284-317)`
- **[APIDOM-14] API antiga responde 410 nas escritas, mas segue viva, aberta e documentada** — baixa, divida tecnica, esforço M, confirmado em parte. `api:src/common/guards/legacy-mutation.guard.ts:10-19 e :50 - um guard global devolve 410; controllers e cerca de 3 mil linhas de services legados seguem no código, com u…`
**[APIDOM-R1] Fase em formato Liga com grupos sobrando gera jogos que a tabela ignora** — crítica, precisao dados, esforço M, achado pelo revisor
A categoria nasce com fase de grupos; ao trocar o formato para Liga, os grupos continuam gravados. O gerador do app cria então os jogos direto na fase, e o servidor, vendo grupos, só conta jogo de grupo. Assim o Vôlei masculino perdeu 10 resultados. Recusar esses jogos, como propõe APIDOM-01, quebraria o gerador.
Evidência: `apps/web/app/components/TournamentManager.tsx:41 e :222 - o gerador só usa grupos de fase 'Grupos'; em fase 'Liga' cria os jogos com o nome da fase, sem grupo`; `apps/web/app/components/TournamentManager.tsx:116 e CategoryCreationForm.tsx:50 - a categoria nasce com Grupo A e Grupo B e trocar o formato não limpa os grupos`
Proposta: No servidor, fase do tipo LEAGUE calcula uma tabela única e ignora grupos; category/update apaga grupos e distribuições de fase Liga. No front, limpar os grupos ao trocar o formato para Liga.

**[APIDOM-R2] Editar fases, grupos ou inscritos apaga ou desvincula jogos agendados sem avisar** — alta, bug, esforço M, achado pelo revisor
Enquanto nenhum jogo foi operado, salvar a categoria sem uma fase apaga os jogos dela; renomear um grupo, como corrigir 'grupo c', zera o grupo dos jogos, que depois ficam fora da tabela; tirar uma equipe deixa os jogos dela com um lado vazio, que a mesa não consegue abrir. O servidor não avisa nem recusa.
Evidência: `api:src/edition-actions/handlers/category-action.handler.ts:466-472 e :543-545 - category/update apaga grupos, fases e inscrições que não vieram no payload`; `api:schema.prisma:441, :443 e :449-451 - partida cascateia da fase (Cascade); grupo e participante da partida viram nulo (SetNull)`
Proposta: category/update recusa remover fase, grupo ou inscrito que tenha jogo vinculado e devolve a lista dos jogos; criar group/rename, que preserva o vínculo; trocar a equipe de jogos agendados só por ação explícita com motivo.

**[APIDOM-R3] API aceita o mesmo confronto duas vezes; Vôlei tem resultados duplicados e opostos** — alta, precisao dados, esforço M, achado pelo revisor
Gerador, importador da planilha e agendamento manual criam partidas sem que nada confira se o confronto já existe na fase. O Vôlei masculino tem 12 jogos de grupo para 10 confrontos possíveis, e um par com dois resultados contrários. Quando a tabela voltar a contar todos os jogos, os duplicados entram em dobro.
Evidência: `dados/jogos-producao.json: Vôlei masculino, Inquisidores x Furiosa encerrado 2x0 (match-34c478ce6c14) e 0x2 (category-7213ebd17f31-generated-8); Halterada 2 x Incinera e…`; `api:src/edition-actions/handlers/match-action.handler.ts:212-246 - match/schedule só confere se os dois lados são diferentes; não procura jogo igual na fase`
Proposta: match/schedule e category/generateMatches recusam segundo jogo entre as mesmas equipes na mesma fase, salvo allowRematch com motivo; a tela da categoria lista os duplicados; a organização escolhe o válido antes de recalcular o Vôlei.

**[APIDOM-R4] Jogo encerrado no grupo errado ou lançado errado não tem conserto pelo app** — alta, feature ausente, esforço M, achado pelo revisor
Jogo encerrado no grupo errado, equipe que ficou sem grupo e resultado digitado na partida errada ficam como estão: o servidor não deixa mover, anular nem realocar depois do primeiro jogo operado, e não existe ação para recalcular a tabela. O conserto das duas categorias de Vôlei hoje só sai por script no banco.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:283-285 - fase ou grupo do jogo só muda enquanto a partida está Agendada`; `api:src/edition-actions/handlers/match-action.handler.ts:356-364 e :1670 - excluir exige jogo nunca iniciado; Encerrada não transita para nenhum outro estado`
Proposta: Criar match/annul (Encerrada passa a Cancelada, sai da tabela, exige motivo); aceitar troca de fase em jogo encerrado e alocação de equipe sem grupo, com motivo e recálculo; criar category/recalculate para o admin da edição.


Ideias de feature desta área:

- **Favoritos e avisos push por equipe** (G)
- **Estatísticas por atleta servidas pela API (issue 17)** (M)
- **Suspensão automática por cartão (issue 18)** (M)
- **Importação em massa de jogos pela tela, com prévia** (M)
- **Desempate assistido e sorteio registrado** (M)
- **Previsão de início por quadra** (M)

## APIINFRA — API: segurança e infraestrutura

**[APIINFRA-01] Responsável da atlética é convidado, mas a API recusa o login dele** — alta, bug, esforço M, confirmado
A tela da equipe cria o acesso e avisa que a pessoa 'já pode entrar'. Não pode: o login responde 401, o convite feito por admin da edição responde 403 e, quando criado pelo super admin, o acesso aparece na lista de staff como gestor sem modalidade. O caminho pensado para cada atlética cadastrar seu elenco nunca funcionou.
Evidência: `api:src/auth/auth.service.ts:249-292 - resolveIdentity só trata SUPER_ADMIN, EDITION_ADMIN e DISCIPLINE_MANAGER; conta só com TEAM_MANAGER termina no 401 'Usuário sem pa…`; `api:src/edition-actions/edition-actions.service.ts:604-609 - admin da edição só pode conceder 'Gestor de modalidade' (403); o front libera o convite para ele em apps/web…`
Proposta: Tratar TEAM_MANAGER em resolveIdentity (papel, equipe e edição ativa); devolver papel e equipe corretos em loadStaff; permitir que o admin da edição conceda esse papel; cobrir com teste de ponta a ponta: convidar, entrar, trocar senha e cadastrar atleta.

**[APIINFRA-02] Quem esquece a senha não volta: 'Esqueci a senha' só exibe um aviso** — alta, feature ausente, esforço M, confirmado
A API só troca senha de quem sabe a atual. Mesário que esquece depende de alguém com escrita no GitHub disparar um workflow no runner da VM de produção; em 09/10 o runner do front estava parado e o dev sem SSH. A tela de login diz que a solicitação foi registrada, e nada acontece.
Evidência: `apps/web/app/login/page.tsx:45-50 - 'Esqueci a senha' só mostra o toast 'Solicitação registrada. O envio será conectado ao serviço de e-mail da API' e não chama a API`; `api:.github/workflows/redefinir-senha-staff.yml:5-12 - redefinição só por workflow manual; registra que em 25/08 o único super admin ficou sem acesso seis dias depois de…`
Proposta: Criar a ação staff/resetPassword (super admin para qualquer conta; admin da edição para gestores e responsáveis): gera senha temporária exibida uma vez, marca troca obrigatória e revoga sessões. No login, trocar o aviso falso por 'peça a redefinição ao admin da edição'.

**[APIINFRA-03] Backup do banco só roda em deploy, e o último deploy foi 10/10** — alta, operacao, esforço M, confirmado
O banco só é copiado quando há deploy. Pelo histórico de merges, quase todos os resultados da Copa entraram depois do último, então existem apenas no volume Docker da VM. Os dumps anteriores moram no mesmo disco, sem cifra, e as imagens do storage não são copiadas. Uma falha de disco apaga o torneio.
Evidência: `api:.github/workflows/cd.yml:59-101 - pg_dump é um passo do deploy; busca por schedule/cron em api:.github/workflows não encontra nenhum gatilho agendado (só push e disp…`; `issues/api-prs-mergeados.json - último merge com deploy da API: PR 40, 2026-10-10T13:53`
Proposta: Rodar um dump agora. Criar workflow agendado (diário; a cada 30 minutos em dia de evento) com o mesmo pg_dump verificado, incluir o volume do MinIO e enviar cópia cifrada para fora da VM. Ensaiar a restauração uma vez por edição.

- **[APIINFRA-04] Cada toque na mesa grava uma cópia inteira do snapshot no banco** — média, desempenho, esforço M, confirmado. `api:src/edition-actions/edition-actions.service.ts:391-405 - o recibo de idempotência grava responseData com o snapshot privado completo (data + meta)`
**[APIINFRA-05] Merge publica em produção sem CI, sem revisão e sem recarregar o gateway** — alta, operacao, esforço P, confirmado
O push na main constrói, migra e recria o container de produção em paralelo ao CI, não depois dele. Nenhuma aprovação é exigida. O deploy não recarrega o gateway nem testa o endereço público, então pode terminar verde com o app respondendo 502. Dois merges de código entraram durante a Copa.
Evidência: `api:.github/workflows/cd.yml:3-18 - deploy dispara em todo push na main, sem depender do job de api:.github/workflows/ci.yml:10-16, que roda em paralelo`; `issues/api-issue-14.json - rulesets dos dois repositórios com 0 aprovações exigidas e sem status check obrigatório`
Proposta: Disparar o CD por workflow_run do CI verde; ao fim, rodar nginx -t, recarregar o gateway e testar pela URL pública; exigir status check e uma aprovação nas duas rulesets; em dia de evento, deploy só por disparo manual com confirmação.

- **[APIINFRA-06] Sair em um aparelho derruba a conta em todos os outros** — média, bug, esforço M, confirmado. `api:src/auth/services/refresh-sessions.service.ts:81-100 - revoke() localiza a sessão pelo token e revoga todas as sessões do mesmo staffId`
- **[APIINFRA-07] Auditoria mostra só 100 linhas, só ao dev, com texto vindo do navegador** — média, precisao dados, esforço G, confirmado. `api:src/edition-snapshots/snapshot.mapper.ts:1050-1053,1071-1072 - take: 100, sem filtro nem paginação; ação e entidade saem como 'match/registerEvent' e 'Match <id>'`
- **[APIINFRA-08] Estado do sistema e das contas só se consulta por workflow do GitHub** — média, feature ausente, esforço M, confirmado em parte. `api:.github/workflows/consultar-conta-staff.yml:3-20 - saber se a conta existe, é super admin ou ainda está com a senha inicial exige disparar workflow`
**[APIINFRA-09] A API envia o snapshot de 1 MB sem compressão a cada ponto** — alta, desempenho, esforço M, confirmado
Toda ação sobe a revisão e cada aparelho conectado busca de novo o snapshot inteiro (1,0 MB só de jogos ao fim da Copa). A API não comprime, não junta pedidos iguais e mantém um socket Redis e uma consulta periódica por espectador. Rotas públicas não têm limite de requisições. Não há medição de audiência.
Evidência: `api:src/main.ts:8-25 e api:package.json:26-46 - nenhum middleware de compressão; a configuração do gateway não está no repositório da API, então não foi possível confirm…`; `api:src/edition-snapshots/edition-snapshots.service.ts:102-134 - cache por revisão sem single-flight: a cada ponto, todos os pedidos simultâneos reconstroem o snapshot; …`
Proposta: Ligar compressão para JSON; single-flight na montagem do snapshot público; um leitor Redis e um temporizador por edição, repartidos entre as conexões; limite generoso por IP nas rotas públicas; tirar do snapshot público o estado anterior de cada lance.

- **[APIINFRA-10] Ninguém é avisado quando a API cai, erra ou um jogo fica abandonado** — média, operacao, esforço M, confirmado. `api:package.json:26-46 - só pino; sem rastreio de erros, métricas ou módulo de health; api:src/common/filters/global-exception.filter.ts:174-176 registra 5xx apenas no s…`
- **[APIINFRA-11] Upload de escudo depende de rota de storage que não existe no gateway** — média, operacao, esforço P, confirmado em parte. `issues/api-issue-11.json - aberta desde 19/08: GET /intereng-storage/ respondia 404; os passos 1 e 3 exigem acesso à VM`
- **[APIINFRA-12] Conta nova nasce com senha compartilhada e pode ser tomada antes do dono** — média, seguranca, esforço M, confirmado em parte. `api:src/edition-actions/handlers/context-action.handler.ts:515-526,665-669 - convite e promoção usam STAFF_INVITE_PASSWORD, igual para todos, salvo senha digitada por qu…`
- **[APIINFRA-13] Dados de atleta não têm regra de guarda, exclusão nem aviso de privacidade** — baixa, seguranca, esforço M, confirmado. `api:src/edition-actions/handlers/catalog-action.handler.ts:31,387-398 - a rota ativa grava só nome, equipe e modalidades; documento, nascimento e e-mail (api:schema.pris…`
- **[APIINFRA-14] Dos 8 bloqueadores de agosto, 5 estão resolvidos e 3 seguem parciais** — baixa, seguranca, esforço P, confirmado. `RESOLVIDOS 1 e 2: api:src/common/config/env.ts:44-69 + config.service.ts:17-24 (boot falha sem segredo em produção); api:docker-compose.yml:12,35,37 (portas em 127.0.0.1…`
**[APIINFRA-R1] SSE não entrega nada em produção; tempo real é sondagem de 12 s** — alta, bug, esforço M, achado pelo revisor
Algum proxy no caminho retém a resposta do stream: o navegador abre a conexão e nunca recebe revisão nem batimento. O placar do espectador e do segundo aparelho da mesa só muda na sondagem de 12 s, e só com a aba visível. Cada conexão muda ainda ocupa vaga do teto e recursos do servidor.
Evidência: `Dado de produção (GET público, somente leitura, em 13/10/2026): /intereng-api/api/v1/editions/active/stream ficou 75 s aberto sem devolver cabeçalho nem byte (curl, http…`; `apps/web/app/lib/repositories/http-adapter.ts:365-395 - o comentário registra o stream mudo em produção e liga a sondagem do snapshot a cada 12 s, só com a aba visível e…`
Proposta: Criar GET /editions/:id/revision (resposta de cerca de 100 bytes) e sondar a cada 3 s, baixando o snapshot só quando a revisão mudar. Desligar o buffer do stream no proxy de borda e conferir TRUSTED_PROXY_HOPS. Monitorar se o stream entrega o primeiro evento.

- **[APIINFRA-R2] Cache público guarda 1 MB por revisão num Redis limitado a 512 MB** — média, operacao, esforço P, achado pelo revisor. `api:src/edition-snapshots/edition-snapshots.service.ts:12-13,264-276 - uma chave por revisão (edition-snapshot:public:v2:<edição>:<revisão>) com o JSON inteiro e validad…`
**[APIINFRA-R3] Convite de gestor não informa a senha de entrada a quem convida** — alta, ux, esforço M, achado pelo revisor
O admin concede o acesso e volta para a lista sem saber que senha passar à pessoa. A conta nasce com a senha de convite, que não aparece em tela nenhuma: mora num secret do GitHub. Cada novo gestor ou mesário depende de alguém que a saiba de cor para entrar pela primeira vez.
Evidência: `shots/admin/mobile/staff_new.png - o formulário 'Novo acesso' tem nome, e-mail, papel e modalidade; nenhum campo nem aviso sobre senha`; `apps/web/app/components/StaffAccessForm.tsx:25 - depois do staff/upsert a tela só volta para /staff; a busca por 'senha' em apps/web/app/staff e neste componente não ret…`
Proposta: O front gera senha temporária ao conceder acesso, envia em initialPassword (a API já aceita) e mostra uma única vez com 'Copiar' e 'Enviar por WhatsApp'. A API marca no cartão de staff quem ainda está com senha inicial.

- **[APIINFRA-R4] Login diz 'senha inválida' a quem tem a senha certa e nenhum papel ativo** — média, ux, esforço P, achado pelo revisor. `api:src/auth/auth.service.ts:39-43,291 - só contam papéis não revogados de edição ativa; sem nenhum, o login responde 401 'Usuário sem papel ativo na edição atual'`

Ideias de feature desta área:

- **Código de mesa: acesso temporário para operar um jogo sem conta** (G)
- **Convite por link de uso único** (M)
- **Exportar a edição pelo app** (M)
- **Aviso automático de jogo parado ou atrasado** (M)
- **Ambiente de ensaio com dados de demonstração** (M)
- **Medição de audiência própria, sem cookies** (M)

## DOCS — Documentação e PRs

**[DOCS-01] Horário inventado pelo importador aparece como oficial; a correção prometida não aconteceu** — alta, precisao dados, esforço G, confirmado
O importador calcula horário para os 52 jogos 'A SEGUIR' e grava 'A definir' como local. A marca de provisório só sai no console de quem rodou o script; no app o jogo fica igual a um confirmado. O LEIAME deixa a correção para a gestão, sem lista do que falta. 89 de 96 jogos seguiram sem local.
Evidência: `docs/copa-halterada/LEIAME.md:17-23,66-70 - 52 horários 'A SEGUIR' calculados, local 'A definir', e 'a gestão deve corrigir esses jogos pela tela'`; `apps/web/scripts/importar-copa.mjs:302-305,446-451 - a lista de provisórios só é impressa no console de quem roda o script`
Proposta: Guardar na partida a marca de horário provisório e a ordem no dia; mostrar 'A seguir, após o jogo N' no lugar da hora; criar a lista 'Agenda a confirmar' (sem local, horário provisório, lado em rótulo) editável na linha.

- **[DOCS-02] Desempate por 'sorteio' é ordem de ID interno e o critério não aparece** — média, precisao dados, esforço G, confirmado. `docs/REGRAS_DE_NEGOCIO.md:104-105 - promete sorteio como critério e 'cada linha da tabela mostra qual critério definiu a posição'`
**[DOCS-03] Quem perde a senha durante o evento depende de um desenvolvedor** — alta, feature ausente, esforço M, confirmado
'Esqueci a senha' só exibe um aviso e não registra nada. A senha de convite de gestor e admin é um segredo de ambiente que a tela não mostra: quem convida não sabe o que passar. Redefinir exige rodar um workflow do GitHub. A tela de conceder um segundo super admin responde 404 para todos.
Evidência: `apps/web/app/login/page.tsx:45-50 - 'Esqueci a senha' só mostra o aviso 'O envio será conectado ao serviço de e-mail da API'`; `api:.github/workflows/redefinir-senha-staff.yml:5-12 - 'a API não tem recuperação de senha'; em 25/08 o único super admin ficou sem acesso`
Proposta: Em Staff, 'Redefinir senha' com senha temporária digitada por quem redefine e troca obrigatória no primeiro acesso; o mesmo campo no convite de gestor e admin; reabrir 'Conceder super admin' ao super admin; no login, trocar o botão por 'peça ao admin da edição'.

**[DOCS-04] Não dá para incluir nem retirar equipe de categoria em andamento** — alta, feature ausente, esforço G, confirmado em parte
Depois do primeiro jogo, API e tela travam participantes, grupos e fases. No evento uma equipe saiu e três precisaram entrar; a resposta foi um PR de emergência que ficou sem merge, e nenhum jogo de vôlei em produção tem essas três equipes. O PR aplica limpo sobre a main, mas cobre só a inclusão e só o servidor.
Evidência: `issues/api-pr-41.json - PR aberto em 10/10, durante o evento, para inscrever Devoradora, Kinesis e Compressora no Vôlei masculino; segue sem merge`; `git api: origin/fix/copa-inscrever-equipes está 1 commit à frente e 0 atrás de origin/main (aplica limpo; 3 testes próprios)`
Proposta: Mergear api#41 após revisão. No front, liberar em categoria em andamento 'Incluir equipe' (escolhe o grupo e gera os jogos que faltam) e 'Retirar equipe' (motivo obrigatório, cancela os jogos pendentes dela), as duas com registro na auditoria.
Correção do revisor: PR #41 e ausência das três equipes confirmados. Correção: a tela trava pelo status da categoria (TournamentManager.tsx:40), a API por partida operada; Futsal ficou 'Publicado': tela editável, API responde 409. Retirar equipe não existe na API; esforço é G.

- **[DOCS-05] Artilharia, autor do lance e responsável da atlética: prontos e usados por ninguém** — média, ux, esforço P, confirmado. `EVIDENCIA_PRODUCAO.md tabela e item 6 - 0 atletas, 0 de 2.689 eventos com atleta identificado, nenhum 'Responsável da atlética'`
- **[DOCS-06] Regra de conflito de agenda diz 'bloqueia', mas nada bloqueia** — média, inconsistencia, esforço M, confirmado em parte. `docs/REGRAS_DE_NEGOCIO.md:40-46,155 - quatro críticas marcadas 'Bloqueia' e a pendência declarada de levar a validação ao servidor`
- **[DOCS-07] PRs parados do front: #86 corrige defeito visível, #95 aplica, #103 foi superado** — baixa, bug, esforço P, confirmado em parte. `apps/web/app/globals.css:2690-2695 - .match-summary-teams .team-mark:not(.mark-neutral) pinta fundo var(--orange) também atrás do escudo`
- **[DOCS-08] Links públicos apontam para /intereng e a navegação chama categoria de modalidade** — média, inconsistencia, esforço M, confirmado. `apps/web/app/public/matches/[id]/page.tsx:8,24 e mais 6 arquivos em app/public - canonical, og:url e schema.org fixos em /intereng/public/..., com o app servido em /copa…`
- **[DOCS-09] Contrato escrito tem 32 ações; o real tem 40, testado só contra mock** — média, contrato api, esforço G, confirmado em parte. `docs/CONTRATO_API.md:39,73,164-167 - 3 papéis, 32 operações, 'quando o NestJS existir'; README.md:124 e api:README.md:200 repetem 32`
- **[DOCS-10] Pendências de VM e GitHub abertas desde agosto, sem registro de conclusão** — média, operacao, esforço P, confirmado em parte. `issues/api-issue-11.json x dados/jogos-producao.json - upload de escudo dependia de rota no gateway; em produção 162 escudos vêm de /teams/* (arquivo do app) e nenhum do…`
- **[DOCS-11] PAPEIS_E_FLUXOS e REGRAS_DE_NEGOCIO descrevem um app que não existe mais** — média, doc desatualizada, esforço M, confirmado. `docs/PAPEIS_E_FLUXOS.md:12,46,50,139 x apps/web/app/components/AdminRouteGuard.tsx:28,47-52,65,72 - doc: 4 perfis, login em '/', senha padrão, gestor não cadastra atleta…`
- **[DOCS-12] Interruptor de notificações pede permissão e nunca envia nada** — baixa, feature ausente, esforço G, confirmado em parte. `docs/PAPEIS_E_FLUXOS.md:217-218 - ponto em aberto declarado: a preferência é coletada 'mas nada dispara envio'`
- **[DOCS-13] Branch padrão do front está 179 commits atrás da produção** — média, operacao, esforço P, confirmado. `git front: origin/HEAD -> origin/main; origin/main 0 à frente e 179 atrás de origin/front-end; README da main diz 'fase inicial de estruturação do MVP'`
- **[DOCS-14] Metade dos documentos deve sair e falta o que a operação usa** — baixa, doc desatualizada, esforço M, confirmado. `docs/BACKLOG.md:1-3, docs/STACK.md:37,100, docs/DEVELOPMENT.md:92-102 - 5 sprints do InterEng (41 issues fechadas em lote em 26/08), Socket.IO e BullMQ ausentes de api:p…`
**[DOCS-R1] Jogo agendado por engano não pode ser excluído pela tela** — alta, feature ausente, esforço M, achado pelo revisor
A API ganhou match/delete em 10/10, no meio do evento, para tirar jogos duplicados da agenda. O front não tem a ação nem o botão: quem agenda errado, ou gera confrontos duas vezes, só consegue marcar 'Cancelada', que é definitivo e mantém o jogo na categoria. Apagar exige chamar a API por fora do app.
Evidência: `api:src/edition-actions/handlers/match-action.handler.ts:349-367 - match/delete apaga partida Agendada que nunca foi iniciada`; `api:src/edition-actions/edition-actions.types.ts:11 x apps/web/app/lib/repositories/actions.ts - API lista 40 tipos; Grep 'match/delete' vazio em app, scripts e tests do…`
Proposta: Levar match/delete ao front (tipo da ação, reducer e mock) e pôr 'Excluir jogo' em Editar partida, só para partida Agendada sem lance, com confirmação e auditoria. Na lista de jogos, seleção múltipla para excluir duplicados de uma vez.

**[DOCS-R2] Gerar confrontos e a API também inventam horário e gravam 'A definir'** — alta, precisao dados, esforço M, achado pelo revisor
Não é só o importador. 'Gerar confrontos' põe todos os jogos de grupo no mesmo dia, um por hora a partir das 08:00, e a API marca o mata-mata para o dia seguinte às 18:00 UTC. Dez jogos de vôlei ficaram com esses horários; dois só foram lançados em 12/10.
Evidência: `apps/web/app/components/TournamentManager.tsx:231-233 - jogos gerados recebem a data de início da edição, hora 08:00 + índice e local 'A definir'`; `api:src/edition-actions/edition-action-recalculation.service.ts:826,905-911 - mata-mata criado para o dia seguinte, 18:00 UTC, local 'A definir'`
Proposta: Jogo gerado nasce sem horário, como 'a agendar': fora da agenda pública por hora e dentro da lista 'Agenda a confirmar'. API e tela passam a aceitar partida sem data até a gestão confirmar. A marca de provisório do DOCS-01 cobre as três origens.

- **[DOCS-R3] Alerta de equipe ocupada compara atléticas entre modalidades diferentes** — média, ux, esforço P, achado pelo revisor. `apps/web/app/lib/scheduling-rules.ts:101,111-117 - 'equipe-ocupada' e 'equipe-sem-descanso' comparam só o nome da equipe, na agenda inteira da edição`
- **[DOCS-R4] Categoria com jogos encerrados fica 'Publicado': tela deixa editar e API recusa** — média, inconsistencia, esforço M, achado pelo revisor. `apps/web/app/components/TournamentManager.tsx:40,79-82,99-104 - trava só com status 'Em andamento'; marcar equipe dispara category/update na hora`

Ideias de feature desta área:

- **Painel de prontidão do evento dentro do app** (M)
- **Guia rápido por perfil dentro do app** (P)
- **Modo telão para o ginásio** (M)
- **Seguir minha atlética** (M)
- **Encerramento da edição com página de resultados finais** (M)
- **Medição de audiência da área pública** (P)

## SCRIPTS — Scripts e operações

**[SCRIPTS-01] A tabela de jogos só entra no app por script de desenvolvedor** — alta, feature ausente, esforço G, confirmado
As 8 abas da planilha (colunas Data, Horário, Jogo, Grupo, Equipe 1 x Equipe 2 ou Confronto, Fase, Local — um layout por aba) viraram 94 jogos por três arquivos .mjs e um jogos.json intermediário. Não há importação no app: a organização depende de alguém com Node, repositório e senha de admin.
Evidência: `apps/web/scripts/importar-copa.mjs:22-29,384 - uso por terminal: senha em variável de ambiente, --aplicar, API de produção como padrão`; `git f83c330 (2026-10-10 00:55 -0300) - importador dos 94 jogos entrou no repositório depois do primeiro dia do evento (09/10)`
Proposta: Tela 'Importar jogos' na edição: colar da planilha ou subir CSV no modelo do app, mapear colunas, pré-visualizar linha a linha (equipe desconhecida com sugestão, grupo divergente, rótulo não entendido, sem horário), corrigir ali e aplicar tudo numa transação; reimportar mostra só a diferença.

**[SCRIPTS-02] Mudar equipe ou grupo com o torneio em andamento exigiu mexer na API** — crítica, feature ausente, esforço G, confirmado em parte
Trocar o grupo de um jogo e apagar jogo agendado viraram código na API durante o evento, sem tela no front. Incluir equipes em categoria já iniciada ficou em PR aberto: o vôlei masculino correu com 5 equipes, fora da planilha. A saída da Compressora foi acertada jogo a jogo, com o motivo digitado quatro vezes.
Evidência: `issues/api-pr-41.json - PR aberto em 10/10 14:12Z, não mesclado: 'Necessário para inscrever Devoradora, Kinesis e Compressora no Vôlei masculino'`; `api:src/edition-actions/handlers/category-action.handler.ts:242-243 - participantes, grupos e fases travam depois da primeira partida operada`
Proposta: Painel 'Ajustar categoria em andamento': incluir equipe (e gerar só os jogos dela), retirar equipe (cancelar ou dar W.O. nos jogos restantes de uma vez), mover jogo de grupo e excluir jogo agendado, sempre com motivo gravado na auditoria.
Correção do revisor: Excluir jogo e mover de grupo só existem na API e o PR 41 segue aberto. Erro: o motivo da Compressora está em 4 jogos do Vôlei FEMININO, trocados pela tela (MatchManager.tsx:134-157). No masculino faltam 15 de 16, não 11.

**[SCRIPTS-03] Gerador, importador e formulário criam o mesmo confronto sem detectar duplicata** — crítica, precisao dados, esforço M, confirmado em parte
Cada origem usa um id próprio e nenhuma compara confrontos. No vôlei masculino dois confrontos estão encerrados duas vezes cada; num deles o vencedor é o oposto, lançado em pouco mais de um minuto na manhã de 12/10. No feminino, a chave importada ficou 'Agendada' ao lado de cinco jogos criados depois pela tela.
Evidência: `dados/jogos-producao.json - Vôlei masc.: Inquisidores x Furiosa encerrado 2x0 (match-34c478ce6c14, 10/10) e 0x2 (category-7213ebd17f31-generated-8, eventos de 10:42:11Z …`; `apps/web/scripts/importar-copa.mjs:276-277,299 - categoria que já tem jogos recebe 'só os que faltam', reconhecidos apenas pelo id do próprio importador`
Proposta: Ao agendar, gerar ou importar, comparar par de equipes e fase: se já existe, bloquear mostrando o jogo existente, com opção explícita 'é returno'. Em Pendências, listar pares repetidos e jogos de chave órfãos, com cancelar ou excluir em um toque.
Correção do revisor: Duplicatas conferidas nos dados (match-34c478 2x0, generated-8 0x2). Correção: o formulário já compara o par (scheduling-rules.ts:102-105), mas só com data e hora idênticas e como aviso; isBlocking nunca é chamado. API, gerador e importador não comparam.

**[SCRIPTS-04] Hora e local obrigatórios transformaram 'A SEGUIR' em horário publicado como certo** — alta, precisao dados, esforço G, confirmado
A planilha real dá a ordem dos jogos, não o relógio. Como a API recusa jogo sem hora e sem local, o importador encadeou horários e fixou uma data para o vôlei; o gerador da tela faz o mesmo (08:00, 09:00…). A marca de provisório só existe no terminal: o público viu tudo como confirmado.
Evidência: `docs/copa-halterada/planilha/futsal_masculino.csv:6-27 - 22 de 23 jogos com 'A SEGUIR'; nas 8 abas são 51 de 94 (o LEIAME.md:17 diz 52) e o vôlei não tem coluna Data (26…`; `apps/web/scripts/planilha-copa.mjs:28-30,206-212 - horário = jogo anterior + 30/40/45 min; data fixa 2026-10-11; TournamentManager.tsx:233 gera 08:00, 09:00... e local '…`
Proposta: Aceitar jogo com hora 'a confirmar' e ordem na quadra; o público lê 'A seguir, depois de J5'. Local vira lista de quadras da edição e pode ficar vazio. Importador e gerador deixam de inventar hora e guardam a marca de provisório.

**[SCRIPTS-05] Jogo com lado a definir só pode ser criado pelo importador** — alta, feature ausente, esforço M, confirmado
A organização publica a chave inteira antes do primeiro jogo, com dia e hora ('1 GRUPO A x 2 GRUPO B', 'Vencedor do Jogo 10'). Pela tela não dá: 'Novo jogo' exige as duas equipes e 'Montar os jogos' só gera todos contra todos. Um terço da tabela da Copa dependeu do script para existir.
Evidência: `docs/copa-halterada/jogos.json - 31 dos 94 jogos têm rótulo em algum lado: 27 de chave e 4 do tipo 'Perdedor do Jogo 1 x Compressora' em grupo único de 3`; `apps/web/app/components/MatchCreationForm.tsx:139-140 - Equipe A e B só aceitam equipes inscritas; nenhuma tela envia placeholderA/placeholderB`
Proposta: Em 'Novo jogo', cada lado vira 'Equipe' ou 'A definir', com construtor: Nº colocado do grupo X, melhor Nº colocado, vencedor ou perdedor de um jogo escolhido na lista. Na categoria, botão 'Montar mata-mata' cria a chave vazia, já com data e hora editáveis.

**[SCRIPTS-06] Rótulo que a API não entende entrega o cruzamento à semeadura automática** — alta, precisao dados, esforço G, confirmado
Em 5 das 8 categorias a primeira rodada da chave usa rótulo fora da gramática da API. Nesse caso ela descarta a chave publicada inteira e semeia sozinha. Na Copa a semeadura padrão coincide com a planilha; outro desenho sairia trocado sem aviso. A tela chama a vaga extra de 'melhores terceiros' mesmo quando é o melhor 2º.
Evidência: `api:src/edition-actions/colocacao-do-chaveamento.ts:57-86 - a gramática cobre 'N GRUPO X', 'MELHOR TERCEIRO' e 'MELHOR CLASSIFICADO <grupo>'`; `api:src/edition-actions/edition-action-recalculation.service.ts:486-488,567 - um rótulo não resolvido descarta a chave publicada inteira e usa seedPairs`
Proposta: O lado a definir guarda tipo e alvo (colocação no grupo, melhor Nº colocado, posição geral, vencedor/perdedor de jogo) em vez de texto. A API resolve todos; se faltar um, não semeia e pede 'defina quem joga'. Renomear o campo para 'Melhores {N+1}º colocados'.

**[SCRIPTS-07] Prontidão do evento vive no MCP do desenvolvedor; o guia do app travou** — alta, feature ausente, esforço M, confirmado
O único 'o que falta?' do app é um guia de montagem que, com zero atletas, ficou o evento inteiro em '5 de 6 passos, continuar em Atletas'. As pendências reais — jogos vencidos não lançados, jogo ao vivo abandonado, 89 sem local, categoria e edição com situação atrasada — só aparecem analisando à mão a listagem do MCP.
Evidência: `apps/web/scripts/mcp-intereng.mjs:89-120 - prontidao_evento faz 5 checagens (equipes, atletas, participantes, fase, jogo sem data) e só roda no cliente MCP do desenvolve…`; `apps/web/app/components/EditionProgress.tsx:39,50-51 e apps/web/app/dashboard/page.tsx:41 - o guia de 6 passos só some com atletas > 0; produção tem 0 atletas (EVIDENCIA…`
Proposta: Tela 'Pendências' no painel do admin, calculada do snapshot. Antes do evento: sem local, hora provisória, equipe sem grupo, rótulo não resolvível. Durante: jogo vencido não iniciado, ao vivo parado há X minutos, chave travada, situação desatualizada. Cada linha abre a correção.

**[SCRIPTS-08] 'Esqueci a senha' finge enviar; redefinir exige workflow que grava no banco** — alta, bug, esforço M, confirmado
Quem esquece a senha no ginásio toca em 'Esqueci a senha', recebe 'Solicitação registrada' e nada acontece. O único caminho real é um desenvolvedor disparar um workflow no GitHub que grava o hash direto no Postgres de produção, com uma senha temporária compartilhada em secret.
Evidência: `apps/web/app/login/page.tsx:45-50 - 'Solicitar recuperação' só exibe 'Solicitação registrada. O envio será conectado ao serviço de e-mail da API.'; nenhuma chamada é fei…`; `api:src/auth/auth.controller.ts:49-127 - rotas: login, refresh, logout, change-password (exige a senha atual) e me`
Proposta: Botão 'Redefinir senha' no cartão do membro em Staff (admin redefine gestor e responsável; super admin redefine admin): gera senha temporária exibida uma vez e obriga a troca. No login, trocar o falso envio pela instrução 'peça ao admin da sua edição'.

**[SCRIPTS-09] Corrigir a agenda importada é partida por partida; quase nada foi corrigido** — alta, ux, esforço M, confirmado
O importador entrega 51 horários e 26 datas provisórios e 94 locais vazios para a gestão acertar depois. O único caminho é abrir partida por partida. Em produção não aconteceu: dois horários mudaram e nenhum jogo importado ou gerado ganhou local.
Evidência: `docs/copa-halterada/LEIAME.md:66-70 - depois de gravar, cabe à gestão corrigir provisórios e preencher o local 'pela tela'`; `dados/jogos-producao.json x docs/copa-halterada/jogos.json - dos 56 jogos de grupo importados, 2 tiveram a hora alterada e 7 a data; os 7 jogos com local são todos match…`
Proposta: Grade 'Agenda em lote' por categoria e por dia: uma linha por jogo, com data, hora e quadra editáveis; ações 'aplicar quadra a todos', 'mover seleção para o dia X' e 'deslocar +N minutos a partir deste jogo'; salvar tudo de uma vez.

- **[SCRIPTS-10] Scripts e MCP usam produção por padrão com a senha de um admin** — média, seguranca, esforço M, confirmado. `apps/web/scripts/importar-copa.mjs:384, importar-chaveamento.mjs:44, importar-dados.mjs:32, mcp-intereng.mjs:26 - a URL de produção é o padrão; não existe ambiente de en…`
**[SCRIPTS-11] Grupo é texto livre e o jogo se liga a ele por nome idêntico** — alta, inconsistencia, esforço M, confirmado
A planilha escreve 'A', 'Grupo A' e 'Único'; a gestão digitou 'grupo c'. Como o vínculo entre jogo e grupo é o texto, o importador precisou de duas traduções e de um grafo para corrigir rótulo trocado. Em produção, jogos da mesma categoria se dividem entre 'Fase de grupos' e 'Grupo A/B'.
Evidência: `apps/web/app/components/TournamentManager.tsx:301 - grupos digitados num campo de texto, separados por vírgula`; `api:src/edition-actions/handlers/match-action.handler.ts:1530-1540 - o jogo acha o grupo por nome idêntico; se não achar, cai na fase sem grupo`
Proposta: Trocar o campo de texto por 'quantos grupos' (A, B, C… gerados pelo app). Ao agendar jogo entre duas equipes do mesmo grupo, preencher o grupo sozinho; se forem de grupos diferentes ou sem grupo, avisar antes de salvar.

- **[SCRIPTS-12] 'Vencedor do Jogo 16' cita um número que o app não guarda nem mostra** — média, precisao dados, esforço M, confirmado. `dados/jogos-producao.json - Futsal masc.: 'Vencedor do Jogo 16 x Vencedor do Jogo 18'; Basquete masc.: 'Perdedor do Jogo 10 x Perdedor do Jogo 11'`
- **[SCRIPTS-13] Chave só progride vaga 1 contra vaga 2; importador reordenou as quartas** — média, feature ausente, esforço G, confirmado. `docs/copa-halterada/planilha/futsal_masculino.csv:24-25 - semifinal 1 = Vencedor QF1 x Vencedor QF3; semifinal 2 = Vencedor QF2 x Vencedor QF4`
- **[SCRIPTS-14] Escudo de equipe nova depende de commit e deploy do front** — média, operacao, esforço M, confirmado. `apps/web/app/lib/escudos.ts:4-13,15-40 - o upload depende de rota de storage que o gateway não tem; a lista de escudos é 'escrita à mão'`
**[SCRIPTS-R1] Jogo fora do grupo some da tabela; chave do vôlei excluiu a invicta** — crítica, precisao dados, esforço M, achado pelo revisor
A tabela de cada grupo ignora em silêncio o jogo em que uma equipe não pertence ao grupo, e todo jogo gravado como 'Fase de grupos' quando a fase tem grupos. No Vôlei Feminino, Inquisidores ficou sem grupo, venceu cinco jogos e não entrou na tabela nem nas semifinais que o app preencheu.
Evidência: `api:src/edition-actions/edition-action-recalculation.service.ts:104-112,195-198 - a tabela do grupo só lê jogos com aquele groupId e pula, sem erro, jogo em que uma das …`; `dados/jogos-producao.json - Vôlei fem. (category-a15edc3a59ed): Inquisidores venceu j3 e j5 ('Grupo A') e mais 3 jogos 'Fase de grupos'; -advanced-r1-1 e r1-2 foram pree…`
Proposta: API recusa jogo de grupo com equipe de fora; a tela bloqueia o primeiro jogo enquanto houver equipe inscrita sem grupo. Trocar adversários reatribui o grupo. A aba Tabela mostra 'N jogos fora da classificação' com atalho para corrigir cada um.

**[SCRIPTS-R2] 'Montar os jogos' apaga a chave importada e duplica a fase de grupos** — alta, bug, esforço M, achado pelo revisor
O botão só enxerga os jogos que ele mesmo gerou. Recria o todos-contra-todos por cima de jogos importados ou agendados à mão, e a API apaga, sem pergunta, a chave já publicada com data e hora. Continua ativo com jogos encerrados enquanto a categoria está 'Publicado'. No vôlei masculino a chave importada não existe mais.
Evidência: `api:src/edition-actions/handlers/category-action.handler.ts:185-197 - generateMatches apaga todo jogo com id '<categoria>-generated-' ou '<categoria>-advanced', o que in…`; `apps/web/app/components/TournamentManager.tsx:46-47,206-218,313 - a tela só conta ids -generated-, só pede confirmação se setup.generated e só desativa o botão com a cat…`
Proposta: Antes de gerar, listar o que já existe na categoria (importados, à mão, chave) e o que será apagado ou repetido, com confirmação. A API pula pares já agendados e só apaga a chave com pedido explícito.

**[SCRIPTS-R3] Banco de produção só ganha backup quando há deploy da API** — alta, operacao, esforço M, achado pelo revisor
A única cópia do banco é o dump feito antes de cada deploy da API, guardado no disco da própria VM. O último merge na API foi na manhã de 10/10; quase todos os 2.689 lances vieram depois. Sem deploy manual posterior, o evento rodou sem cópia. O app não exporta resultados.
Evidência: `api:.github/workflows/cd.yml:3-19,59-101 - pg_dump só roda no deploy (push em main ou disparo manual) e fica em $HOME/intereng-backups, na mesma VM, 10 arquivos`; `api:.github/workflows/*.yml e front:.github/workflows/*.yml - nenhum gatilho schedule/cron (Grep)`
Proposta: Workflow agendado no runner da VM: pg_dump a cada hora durante a edição e diário fora dela, com cópia cifrada para fora da VM e teste de restauração. No painel do admin, botão 'Exportar resultados' (CSV) gerado do snapshot.

**[SCRIPTS-R4] Deploy e socorro dependem de um único runner; no primeiro dia a fila travou** — alta, operacao, esforço P, achado pelo revisor
Front, API e todos os workflows de socorro (senha, diagnóstico, gateway) rodam num único runner dentro da VM. Em 09/10, primeiro dia da Copa, o deploy do site novo estava na fila sem runner e a chave SSH do mantenedor era recusada. Depois, 14 PRs do front dependeram dele. Nada avisa quando cai.
Evidência: `docs/DEPLOY_PENDENTE_VM.md:3-8 - em 09/10 o front da Copa não estava no ar: deploy na fila, último deploy bem-sucedido em 06/09, chave SSH do mantenedor recusada pela VM`; `front:.github/workflows/cd.yml:25 e api:.github/workflows/cd.yml:27 - os dois deploys rodam em runs-on: self-hosted; os sete workflows manuais da API também`
Proposta: Workflow agendado em runner do GitHub que, a cada 15 minutos, confere se o runner da VM está online e se site e API respondem, e abre issue quando falha. Segunda pessoa com acesso SSH e deploy de ensaio 48 horas antes de cada edição.


Ideias de feature desta área:

- **Modelo oficial de planilha para a organização preencher** (P)
- **Exportar jogos, resultados e classificação** (M)
- **Colar o elenco inteiro de uma equipe** (M)
- **Lotes de jogos com desfazer** (M)
- **Assistente de encerramento da edição** (M)
- **Segunda equipe da mesma atlética** (M)

## JESP — Jornada do espectador

**[JESP-01] Aba Chaveamento fica vazia em produção e cartões não informam a rodada** — crítica, bug, esforço M, confirmado
T4: Modalidades → categoria → Chaveamento (3 toques) e a tela diz que os confrontos ainda não foram gerados, mesmo no Handebol com final disputada. Na aba Jogos os eliminatórios aparecem misturados aos de grupo, sem 'Semifinal' ou 'Final' e sem número: 'Vencedor do Jogo 16' não aponta para nada.
Evidência: `apps/web/app/components/TournamentClassification.tsx:94 - mata-mata é filtrado por regex /semi|quart|final/ sobre o nome da fase; :121 mostra 'O chaveamento será exibido…`; `dados/jogos-producao.json - 0 de 96 jogos casam o regex; os 24 eliminatórios chegam com phase='Mata-mata' (api:src/edition-snapshots/snapshot.mapper.ts:893-895)`
Proposta: Filtrar mata-mata pelo formato da fase, não pelo nome. Incluir round, bracketSlot e número do jogo no snapshot. Desenhar a chave por rodada (Quartas, Semifinal, 3º lugar, Final), com 'Jogo 16' em cada cartão e o rótulo do lado como link para esse jogo.

**[JESP-02] Jogo que ainda não começou aparece com placar 0 — 0** — alta, precisao dados, esforço P, confirmado
Na agenda, na categoria e no detalhe, todo jogo agendado é exibido como 0 — 0 ao lado do selo PRÓXIMO. Em produção são 40 jogos, incluindo todo o mata-mata de futsal e basquete. Quem bate o olho lê empate sem gols; a prévia do link no WhatsApp repete o erro.
Evidência: `api:schema.prisma:463-464 e api:src/edition-snapshots/snapshot.mapper.ts:882-883 - scoreA/scoreB são Float com default 0 e vão sempre no snapshot`; `apps/web/app/lib/edition-catalog.ts:129-130 e apps/web/app/components/MatchScoreCard.tsx:63 - o traço só aparece com null; 0 vira '0 — 0' (MatchSummary.tsx:10 idem)`
Proposta: Em matchView, devolver placar nulo enquanto o status não for Ao vivo, Encerrada ou W.O.; cartão e resumo mostram o horário no lugar do placar. Ajustar o seed de demonstração para 0/0, como a API envia, e cobrir com teste.

**[JESP-03] Selos 'Próximo' e 'Ao vivo' não envelhecem e contradizem o relógio** — alta, precisao dados, esforço M, confirmado
Pelos dados de 13/10, a home anuncia '1 partida ao vivo · AGORA' para um jogo de basquete abandonado na véspera, e a aba Jogos do Futsal Masculino lista 20 partidas de ontem como PRÓXIMO. O app não cruza o estado com o relógio; Adiada, Cancelada e W.O. nem têm selo próprio.
Evidência: `apps/web/app/lib/status.ts:74-78 - seis estados viram três rótulos: tudo que não é ao vivo nem terminal é 'Próximo' (inclui Adiada); Cancelada e W.O. viram 'Encerrado'`; `dados/jogos-producao.json - 40 jogos 'Agendada', todos com data entre 09 e 12/10; só em 12/10 são 32 dos 47 cartões do dia`
Proposta: Derivar o selo de estado e tempo: 'Aguardando resultado' quando o horário passou sem início; 'Ao vivo · sem atualização há 2 h', fora do contador AGORA, quando o último lance tem mais de 20 min; selos próprios para Adiado, Cancelado e W.O.

**[JESP-04] Tela inicial só lista jogo ao vivo e fica vazia com placar lançado depois** — alta, ux, esforço M, confirmado
T1 funciona em 0 toques só quando a mesa opera ao vivo. No evento real, mais de 60% dos placares foram lançados depois; nesses períodos a home mostra '0 partidas ao vivo' e um botão. Para saber o que vem a seguir ou o que acabou de terminar é preciso trocar de aba e procurar.
Evidência: `apps/web/app/components/PublicLiveView.tsx:19-20 - a home renderiza só PublicMatchCollection mode='live' e um link para Modalidades`; `apps/web/app/components/PublicMatchCollection.tsx:11,24 - o modo 'upcoming' existe e nenhuma tela usa; vazio mostra 'Nenhum jogo ao vivo no momento.'`
Proposta: Transformar a home em 'Hoje': bloco Ao vivo (some quando vazio), 'A seguir' com os próximos 3 a 5 jogos do dia, 'Últimos resultados' com os 5 mais recentes e, no topo, os jogos da atlética seguida.

**[JESP-05] Na agenda pública nenhum cartão abre o jogo e um botão leva ao login** — alta, bug, esforço P, confirmado
T5: Jogos → dia anterior → toque no cartão e nada acontece. O caminho que funciona é Modalidades → 'Acompanhar resultados' (alvo de 29 px) → rolar por todos os pendentes → cartão. Quem filtra por modalidade e toca em 'TABELA DE FUTSAL' cai na tela 'Acesso administrativo'.
Evidência: `apps/web/app/components/MatchSchedule.tsx:47 - href={publicView ? undefined : ...}, embora PublicMatchesHub.tsx:29 passe hrefBase='/public/matches'`; `shots/metricas.json (publico/mobile/public_matches.png) - a tela tem 5 cartões e nenhum link de partida; os links são só 'VER MODALIDADES' e a barra inferior`
Proposta: Usar hrefBase também na visão pública. Apontar 'Tabela de X' para /public/tournaments filtrado pela modalidade. Na aba Jogos da categoria, ordenar encerrados do mais recente ao mais antigo e exibi-los antes dos pendentes quando a data já passou.

**[JESP-06] Não existe 'minha atlética': achar o próximo jogo exige abrir até 8 categorias** — alta, feature ausente, esforço M, confirmado
T2: Equipes → rolar 4 telas → equipe → 'Ver classificação' → aba Jogos → procurar o nome na lista, repetindo por categoria. T6: ao voltar, o app abre em Ao vivo com filtro, dia e aba zerados; nada identifica o torcedor nem a atlética dele.
Evidência: `apps/web/app/components/PublicTeamDetailView.tsx:16 e TeamPerformance.tsx:43 - a página da equipe mostra classificação por categoria e a contagem 'N jogos na agenda', se…`; `dados/jogos-producao.json - Halterada e Furiosa jogam em 8 categorias (29 e 25 jogos); a agenda de 12/10 tem 47 cartões e MatchSchedule.tsx:12 não tem filtro por equipe`
Proposta: Botão 'Seguir' na equipe, salvo nas preferências do aparelho. Página da equipe com 'Próximos jogos' e 'Resultados' de todas as modalidades. Filtro 'Minha atlética' na agenda e bloco dela na home. Lembrar modalidade e dia escolhidos; busca na lista de equipes.

**[JESP-07] Posição da atlética na página da equipe diverge da tabela da categoria** — alta, precisao dados, esforço P, confirmado
A mesma atlética tem duas posições no app. Na página da equipe, 'POS' é a colocação entre todos os inscritos da categoria, ignorando grupo, somando jogos eliminatórios e pontuando sempre 3/1/0. Com quatro grupos no Futsal Masculino, o líder de um grupo pode aparecer atrás de equipes de outros.
Evidência: `apps/web/app/components/TeamPerformance.tsx:22-24 - recalcula a tabela com todos os inscritos e todos os jogos da categoria (grupos misturados, mata-mata incluso) e a re…`; `apps/web/app/components/TournamentClassification.tsx:63-83 - a tabela da categoria usa a classificação do servidor, por grupo, com o regulamento da modalidade`
Proposta: Ler na página da equipe a classificação oficial da fase (phase.standings) e mostrar 'Xº do Grupo B'; no mata-mata, mostrar a rodada em que a equipe está ou em que caiu. Remover o recálculo local de TeamPerformance.

**[JESP-08] Depois do evento o app não mostra campeão, pódio nem ranking geral** — alta, feature ausente, esforço M, confirmado
T9: para saber quem ganhou o Handebol é preciso abrir a categoria, ir à aba Jogos, rolar até o último cartão encerrado e deduzir que era a final, porque não há rótulo. A lista mostra categorias encerradas com o nome da primeira fase. Ranking geral não tem tela pública, por decisão da organização.
Evidência: `apps/web/app/lib/edition-catalog.ts:53 e apps/web/app/components/TournamentCard.tsx:25-26 - cartão e cabeçalho da categoria mostram sempre o nome da primeira fase; o sta…`; `apps/web/app/lib/tournament-progression.ts:42 - tournamentPodium calcula campeão, vice e terceiro, mas só overall-ranking.ts:57 usa; nenhuma tela pública exibe`
Proposta: Categoria encerrada abre com bloco 'Pódio' (campeã, vice, 3º), e o cartão na lista troca a fase por 'Encerrada · Campeã: X'. Seção 'Campeões da edição' em Modalidades. Nas demais, selo da fase atual (Grupos, Semifinal, Final) no lugar da primeira fase.

- **[JESP-09] Detalhe do jogo encerrado enterra as parciais e expõe dado cru** — média, ux, esforço M, confirmado. `apps/web/app/components/MatchDetailClient.tsx:50-53,67 - 'Parciais: 25-19 · 25-27' só vem depois da linha do tempo com todos os lances, em texto de 12 px (apps/web/app/g…`
- **[JESP-10] Cartão de jogo omite fase, pênaltis e parciais e repete a modalidade** — média, ux, esforço M, confirmado. `apps/web/app/components/MatchScoreCard.tsx:48-65 - o cartão não recebe tiebreak, periodResults nem fase; MatchCard.tsx:24 não repassa e MatchSchedule.tsx:47 ainda zera p…`
- **[JESP-11] Tabela do grupo não marca quem classifica e mostra duas equipes por tela** — média, ux, esforço M, confirmado. `apps/web/app/globals.css:695-697 - destaque fixo por posição (1º verde, 2º azul, 3º rosa), sem relação com o número de vagas da fase`
- **[JESP-12] Cada atualização faz o celular baixar o snapshot inteiro, cerca de 1 MB** — média, desempenho, esforço M, confirmado em parte. `dados/jogos-producao.json - os 96 jogos somam 1.011.123 bytes minificados; 86% são lances; 'previous' de cada lance (237 KB) e 'rules' repetido por jogo (81 KB) somam 31…`
- **[JESP-13] Sem botão de compartilhar; no app instalado o placar só sai por print** — média, feature ausente, esforço M, confirmado. `Grep em apps/web/app por navigator.share, whatsapp, wa.me, clipboard e compartilhar - nenhuma ocorrência além do texto do banner de instalação no iOS (apps/web/app/compo…`
- **[JESP-14] Artilharia e elencos ocupam a navegação sem haver um atleta cadastrado** — média, ux, esforço P, confirmado. `EVIDENCIA_PRODUCAO.md - 0 atletas cadastrados e 0 dos 2.689 lances com autor`
**[JESP-R1] Tabela pública do Vôlei ignora 20 de 23 resultados e fica vazia no masculino** — crítica, precisao dados, esforço M, achado pelo revisor
Nas duas categorias de vôlei a fase é 'Liga' mas tem grupos cadastrados, e a maioria dos jogos foi lançada sem grupo. O servidor conta 3 dos 23 jogos encerrados. No feminino a tabela mostra quatro equipes com um jogo e omite a líder; no masculino a aba Tabela aparece vazia, com instrução para o organizador.
Evidência: `api:src/edition-actions/edition-action-recalculation.service.ts:104-112 - fase com grupos só soma jogo com groupId do grupo e os dois lados inscritos nele; jogo lançado …`; `produção (MCP listar categorias, 13/10) - Vôlei masculino, 'Fase de grupos': Halterada com J 0; dados/jogos-producao.json tem 4 vitórias dela nessa fase`
Proposta: No recálculo, fase 'Liga' gera tabela única com todos os jogos da fase, com ou sem grupo; fase 'Grupos' recusa jogo sem grupo. Na tela pública, fase Liga mostra uma tabela só e nunca texto de configuração. Recalcular as duas categorias em produção.

**[JESP-R2] Agenda de um dia cheio exige cerca de dez telas de rolagem** — alta, ux, esforço M, achado pelo revisor
Em 12/10 a aba Jogos listava 47 cartões de quase 200 px, cerca de 9.400 px de rolagem. Para chegar ao jogo das 17h30 o espectador passava por 42 cartões, a maioria encerrada ou nunca aberta. O filtro de modalidade ajuda pouco: só o Futsal tinha 23 jogos no dia.
Evidência: `shots/metricas.json (publico/mobile/public_matches.png) - 5 cartões em 1.539 px de página; passo de ~199 px por cartão na captura`; `dados/jogos-producao.json - 47 jogos em 12/10 (Futsal 23, Basquete 13, Vôlei 11); 42 deles com horário antes das 17:30`
Proposta: Linha compacta de ~64 px (hora, siglas, placar, selo), agrupada por faixa de horário. Abrir a agenda rolada até o primeiro jogo não encerrado, com botão 'Agora'. Encerrados do dia recolhidos num bloco 'Resultados (N)' no topo.

- **[JESP-R3] Placar guardado em cache aparece como 'Resultados ao vivo', sem hora da atualização** — média, precisao dados, esforço M, achado pelo revisor. `apps/web/public/sw.js:86-98 - se a rede falha, o service worker devolve o último snapshot público guardado como resposta normal`

Ideias de feature desta área:

- **Mural de avisos da organização no topo da área pública** (M)
- **Agenda 'a seguir' por quadra, com previsão recalculada** (G)
- **Avisos push dos jogos da atlética seguida** (G)
- **Ranking geral público a partir do fechamento oficial** (M)
- **Imagem do resultado pronta para Stories e grupos** (M)
- **Modo telão do placar para projetar no ginásio** (M)

## JMESA — Jornada da mesa

**[JMESA-01] Avançar tempo ou set é sempre recusado pela API nas quatro modalidades** — alta, contrato api, esforço M, confirmado
O front desligou o cronômetro, mas a API ainda exige horário de retomada para virar o período. Em futsal, handebol e basquete o botão pede confirmação de 'encerramento antecipado', toca o som de novo período e a API recusa. No vôlei, 'Avançar set' é recusado por regra. Nenhum jogo saiu do 1º tempo; todo encerramento virou 'antes do previsto'.
Evidência: `apps/web/app/matches/live/page.tsx:83 e :398-417 - hasClock fixo em false; o avanço envia paused:false sem runningSince e toca o som de novo período sem esperar a respos…`; `api:src/edition-actions/handlers/match-action.handler.ts:524 - modalidade com relógio + paused:false sem runningSince lança 'Ao retomar o cronômetro, informe um horário …`
Proposta: Front: virar período sem enviar 'paused' quando a mesa não tem relógio, e só sinalizar após a API confirmar. API: aceitar avanço sem relógio. Vôlei: trocar o botão por 'Fechar set com este placar' (nova ação). Teste de contrato cobrindo o avanço nas quatro modalidades.

**[JMESA-02] Não há como lançar placar final: súmula vira 88 toques e parciais inventadas** — crítica, feature ausente, esforço M, confirmado
Cerca de dois terços dos jogos foram digitados depois, lance a lance. Para 25x18 é preciso tocar 18 vezes no perdedor antes do vencedor, senão o set fecha 25x0. Cada toque espera a API (mediana de 1,4 s entre toques). Parte das parciais publicadas é fictícia e o horário de cada lance é o da digitação.
Evidência: `dados/jogos-producao.json - 18 de 24 jogos de vôlei digitados em até 6 min; 5 no padrão 'B18 A25 B17 A25' (perdedor primeiro, senão o set fecha em 25x0)`; `dados/jogos-producao.json - Halterada 2 x Incinera (agendado 10/10 14:00): 52 toques em 1,4 min, parciais gravadas 25x1 e 25x1`
Proposta: Criar 'Lançar resultado' no cartão do jogo agendado: um campo numérico por set ou tempo, validado pelo regulamento, que grava parciais, encerra e recalcula a tabela numa única ação da API (match/recordResult), sem eventos. Botão 'Salvar e próximo' percorre os jogos pendentes da modalidade.

**[JMESA-03] Vôlei aceita ponto depois do match point e o desfazer apaga a parcial** — crítica, precisao dados, esforço P, confirmado
Depois do último ponto os botões continuam ativos. Um toque a mais vira terceiro set vencido e parcial 26x10; desfazer esse toque apaga a parcial legítima do set. Em produção, um jogo ficou com 0x3 e parcial 10x26 e exigiu retificação; outros dois terminaram sem a parcial do segundo set, o que esse desfazer explica.
Evidência: `dados/jogos-producao.json - Inquisidores x Furiosa (10/10 15:00): último evento registra 0x3 em melhor de 3, parcial do 2º set 10x26, duas retificações logo depois`; `dados/jogos-producao.json - Halterada 2 x Incinera (10/10 14:00) e Mafiosa x Inquisidores (12/10 13:30): 2x0 com apenas a parcial do 1º set gravada`
Proposta: Front e API: ao atingir os sets necessários, bloquear novos pontos e abrir direto a confirmação de encerramento. Desfazer deve recalcular as parciais a partir dos eventos restantes, sem apagar. Corrigir as parciais dos três jogos afetados.

**[JMESA-04] Toque recusado pela API toca som de sucesso e some da mesa** — alta, bug, esforço G, confirmado
O placar só muda quando a API responde, e cada resposta traz o snapshot inteiro da edição. Um segundo toque antes disso, um toque sem rede ou com a trava vencida é descartado; o operador ouve o som, vê o flash e recebe apenas um aviso de 3 segundos. Teto prático: um lance por segundo.
Evidência: `apps/web/app/matches/live/page.tsx:196 e :251-256 - dispatch sem await; som, flash e anúncio disparam antes da resposta; trava local de apenas 350 ms`; `api:src/edition-actions/handlers/match-action.handler.ts:1767-1770 - evento calculado sobre placar defasado é recusado ('diverge do valor calculado pelo regulamento')`
Proposta: Fila local de lances: o placar sobe na hora, os lances vão em ordem com id idempotente e sem placar calculado pelo cliente (a API já deriva), persistem no aparelho e reenviam ao voltar a rede. Indicador 'salvo / N pendentes'; resposta enxuta da partida.

**[JMESA-05] W.O. fica escondido em 'Editar partida' e aplicaria placar diferente do usado** — alta, ux, esforço M, confirmado
O caminho oficial tem cerca de nove toques, um texto digitado e fica numa tela que a mesa não visita. No placar não há botão de W.O. Além disso o regulamento configurado daria 1x0 no handebol, e a organização usa 10x0. Resultado: W.O. virou dez gols clicados, sem marca de W.O. para tabela ou público.
Evidência: `dados/jogos-producao.json - 8 jogos de handebol 10x0 ou 0x10 com exatamente 10 gols em 15 a 40 s, status Encerrada; nenhum jogo da edição com status W.O.`; `apps/web/app/components/MatchManager.tsx:313-315 e :139-140 - W.O. é opção do select 'Estado da partida'; exige vencedor e motivo de 5+ caracteres`
Proposta: Botão 'W.O.' no cartão do jogo agendado e no painel de início: escolher quem compareceu, ver o placar regulamentar da modalidade, confirmar. Motivo pré-preenchido 'Ausência da equipe'. Cartão e tabela exibem 'W.O.'. Ajustar o W.O. do handebol para 10x0 e converter os oito jogos.

**[JMESA-06] Chegar ao placar do jogo certo custa cinco toques, três telas e rolagem** — alta, ux, esforço M, confirmado
Início → Jogos → dia certo → cartão → rolar → Abrir placar → Iniciar → confirmar. A lista segue o horário agendado, que errou por horas, e um jogo atrasado de outro dia exige trocar a data. O painel inicial do gestor não mostra o jogo ao vivo nem o próximo da modalidade com ação direta.
Evidência: `apps/web/app/components/MatchDetailClient.tsx:59-60 - único link para /matches/live; captura gestor/mobile/matches_semifinal-1.png: 'Editar partida' vem antes e 'Continu…`; `apps/web/app/components/MatchSchedule.tsx:29-33 - agenda por dia, ordenada pelo horário agendado, sem filtro de status ou local`
Proposta: Início do gestor vira 'Minha mesa': bloco Ao vivo com 'Continuar placar'; bloco A seguir com os jogos não iniciados da modalidade (inclusive de dias anteriores) e botões 'Iniciar' e 'Lançar resultado' no próprio cartão. Os cartões da agenda ganham as mesmas ações.

- **[JMESA-07] Basquete foi usado para alcançar o placar em rajadas e parou no 1º período** — média, ux, esforço M, confirmado em parte. `dados/jogos-producao.json (Mafiosa x Furiosa, 12/10) - 3 cestas em 11 s logo após iniciar; 15 min sem lance; 6 'Cesta de 3' seguidas em 60 s até 20x8; último lance 14:52…`
- **[JMESA-08] Corrigir lance antigo ou resultado encerrado é lento e deixa dado incoerente** — média, precisao dados, esforço G, confirmado. `apps/web/app/matches/live/page.tsx:432-435 e api:src/edition-actions/handlers/match-action.handler.ts:916 - só o último lance pode ser desfeito, com confirmação a cada v…`
**[JMESA-09] Nada avisa que um jogo ficou ao vivo ou sem resultado** — alta, operacao, esforço M, confirmado
O público continua vendo um jogo de basquete 'ao vivo' em 23x10 no dia seguinte, e 36 jogos passados aparecem como 'Próximo'. Ninguém da organização recebe uma lista do que falta fechar, e não dá para distinguir jogo não disputado de jogo não lançado.
Evidência: `dados/jogos-resumo.json - Basquete Mafiosa x Furiosa 'Ao vivo' desde 12/10 14:31, sem lance desde 14:52, ainda ao vivo em 13/10`; `EVIDENCIA_PRODUCAO.md - 36 jogos com data passada ainda 'Agendada' (Futsal 20, Basquete 16, Vôlei 4)`
Proposta: Fila 'Pendências' no Início de gestor e admin: ao vivo sem lance há 30 min e agendados vencidos há 2 h, cada um com Encerrar, Lançar resultado, W.O., Adiar ou 'Não aconteceu'. Na área pública, jogo parado deixa de aparecer como ao vivo.

- **[JMESA-10] Iniciar fora do horário grava justificativa automática e mantém a agenda errada** — média, precisao dados, esforço M, confirmado em parte. `apps/web/app/lib/match-lifecycle.ts:71-72 e apps/web/app/matches/live/page.tsx:328-331,:624 - a frase 'Início N min após o horário previsto. Registre a justificativa.' v…`
- **[JMESA-11] Público vê cronômetro que a mesa não controla e lances com minuto falso** — média, inconsistencia, esforço P, confirmado em parte. `apps/web/app/matches/live/page.tsx:83 e :182-184 - mesa sem relógio grava todo lance com periodElapsedSeconds 0 (confirmado nos lances de handebol de produção)`
- **[JMESA-12] Passar a mesa e voltar do bloqueio de tela dependem de sorte** — média, bug, esforço M, confirmado em parte. `apps/web/app/matches/live/page.tsx:136-141 e :374-376 - após 'Passar o placar adiante' o batimento do mesmo aparelho reassume a trava em até 15 s`
- **[JMESA-13] Painel 'Quem marcou?' abre a cada ponto mesmo sem nenhum atleta cadastrado** — média, ux, esforço P, confirmado. `apps/web/app/matches/live/page.tsx:236,:251,:546-563 - todo lance pontuado abre o painel; sem elenco ele só diz 'Nenhum atleta desta equipe está inscrito'`
- **[JMESA-14] Desempate pede dado redundante, some se a API recusar e detecta mata-mata pelo nome** — média, ux, esforço P, confirmado. `apps/web/app/matches/live/page.tsx:469-473 e :487-503 - aviso em tom de erro; exige placar, 'Equipe classificada' e motivo de 5+ caracteres; fecha o painel antes de a AP…`
**[JMESA-R1] Cada toque monta e grava no banco uma cópia inteira do snapshot** — alta, desempenho, esforço M, achado pelo revisor
Um ponto de vôlei custa: transação serializável com trava da edição inteira, reconstrução do snapshot completo (96 jogos, 2.689 lances), gravação dessa cópia como recibo de idempotência e resposta com o snapshot inteiro (1,7 MB só de jogos). Os recibos nunca são apagados. O custo por toque cresce com o evento e duas mesas simultâneas se atrasam.
Evidência: `api:src/edition-actions/edition-actions.service.ts:381-402 - toda ação monta o snapshot privado inteiro dentro da transação e o grava em edition_action_receipts.response…`; `api:schema.prisma:715-732 e grep por editionActionReceipt em api/src - só findFirst, findUnique e create; nenhuma limpeza`
Proposta: Recibo guarda só chave, hash e revisão; a repetição devolve o snapshot atual. Rotina apaga recibos com mais de 24 h. Medir em produção o tempo por ação e o tamanho da tabela antes e depois.

- **[JMESA-R2] Regulamento não é congelado na partida: mudar a regra reinterpreta jogos já feitos** — média, precisao dados, esforço M, achado pelo revisor. `dados/jogos-producao.json (Vôlei, Halterada x Halterada 2, 10/10 08:00) - currentPeriod 4, 3º set até 25 (25-14), encerrado 2x1; a regra atual diz setsToWin 2, 3 sets, d…`
**[JMESA-R3] Mesa ignora o campo 'Funcionamento do relógio' que a modalidade já oferece** — alta, inconsistencia, esforço P, achado pelo revisor
A mesa foi desligada do relógio por código, mas a regra de Futsal, Handebol e Basquete continuou 'Regressivo'. API e página pública seguem a regra; a mesa não. É a causa comum de JMESA-01 e JMESA-11: com 'Sem cronômetro', a API aceita virar o período e a página pública deixa de mostrar relógio e minuto.
Evidência: `apps/web/app/matches/live/page.tsx:83 - hasClock fixo em false, qualquer que seja rules.clockMode`; `apps/web/app/components/DisciplineManager.tsx:84 - a tela de regras oferece Regressivo, Progressivo e 'Sem cronômetro'`
Proposta: Já, sem deploy: salvar 'Sem cronômetro' nas regras das três modalidades. No código: padrões delas passam a 'none' no front e na API, a tela de regras esconde Regressivo e Progressivo enquanto a mesa não tiver relógio, com teste de contrato do avanço.


Ideias de feature desta área:

- **Mesa ideal ao vivo: tela cheia, uma metade por equipe** (M)
- **Mesa ideal pós-jogo: fila de súmulas com teclado numérico** (M)
- **Foto da súmula anexada ao jogo** (M)
- **Acesso de mesário por QR, restrito a um jogo** (G)
- **Disputa de pênaltis acompanhada ao vivo** (M)
- **Painel de mesas para quem coordena o evento** (M)

## JORG — Jornada do organizador

**[JORG-01] Desistência ou mudança de formato no meio não tem caminho; sobraram jogos duplicados** — crítica, feature ausente, esforço G, confirmado
Arquivar a equipe não mexe em categoria nem jogo. Depois do primeiro resultado, a API recusa tirar a equipe ou mudar grupos, mas a tela deixa tentar. Jogo não pode ser excluído nem mudar de grupo pela tela; cancelar trava o mata-mata. A organização refez jogos à mão e sobraram duplicados e semifinais órfãs.
Evidência: `api:src/edition-actions/handlers/category-action.handler.ts:226-246 - API recusa mudar participantes, grupos ou fases depois da 1a partida operada; apps/web/app/componen…`; `api:src/edition-actions/handlers/match-action.handler.ts:349-367 e :279-289 - match/delete e troca de fase existem na API; apps/web/app/components/MatchManager.tsx:310-3…`
Proposta: Criar o fluxo 'Retirar equipe da categoria': lista os jogos dela, aplica W.O. regulamentar nos pendentes ou anula todos, e recalcula tabela e chave. Na edição da partida, adicionar 'Excluir jogo' (agendado, nunca iniciado) e 'Mudar fase/grupo'. Cancelado deixa de travar o mata-mata.

**[JORG-02] Ranking geral premia por modalidade, não por categoria, e ignora final agendada à mão** — crítica, precisao dados, esforço G, confirmado
Com Masculino e Feminino na mesma modalidade, a atlética que repete a colocação nas duas recebe os pontos uma vez só, e o lançamento manual também é recusado. Final ou disputa de 3º agendada pela tela não entra no pódio; categoria sem mata-mata ou sem jogo de 3º fica sem campeão ou terceiro automático.
Evidência: `apps/web/app/lib/overall-ranking.ts:36-38,68 - bonificação é única por equipe+modalidade+métrica; api:src/edition-actions/handlers/ranking-action.handler.ts:229-250 recu…`; `apps/web/app/lib/tournament-progression.ts:21-27,42-61 - pódio só lê jogos com id '-advanced-rN-M' e '-advanced-third'; apps/web/app/components/MatchCreationForm.tsx:101…`
Proposta: Gravar a categoria em cada bonificação e trocar a unicidade para equipe+categoria+métrica. Ao encerrar a categoria, abrir a tela 'Pódio': o app sugere campeão, vice e terceiro (final, disputa de 3º ou tabela) e o admin confirma ou corrige antes de pontuar.

**[JORG-03] Aba Chaveamento fica vazia em produção porque filtra pelo nome da fase** — alta, bug, esforço P, confirmado
Na aba Tabela, o botão Chaveamento lista só jogos cuja fase contém 'semi', 'quart' ou 'final'. Em produção todo jogo eliminatório vem como 'Mata-mata', então a tela diz que o chaveamento ainda será gerado mesmo com semifinal e final já disputadas. Também não dá para saber qual jogo é a final.
Evidência: `apps/web/app/components/TournamentClassification.tsx:94 - chaveamento = jogos cuja fase casa /semi|quart|final/`; `api:src/edition-snapshots/snapshot.mapper.ts:893-895 - a API devolve em 'phase' o nome da fase; apps/web/app/components/CategoryCreationForm.tsx:51 cria a fase com o nom…`
Proposta: Montar o chaveamento pelos jogos da fase de formato Mata-mata, não pelo texto da fase. Derivar a rodada do id ('-advanced-rN-M', '-advanced-third') para rotular Quartas, Semifinal, 3º lugar e Final e agrupar a lista por rodada.

**[JORG-04] Painel do organizador mostra contadores e um 'próximo confronto' errado, nunca as pendências** — alta, ux, esforço M, confirmado em parte
O início tem quatro contadores e um cartão de jogo. Não diz quantos jogos estão sem local, com horário provisório, atrasados sem lançar ou abertos e esquecidos, nem quais categorias estão em rascunho ou prontas para encerrar. O guia de montagem aponta um passo que ninguém cumpriu e ocupa o topo.
Evidência: `apps/web/app/dashboard/page.tsx:32 - 'próximo confronto' é a primeira Agendada na ordem do snapshot, sem olhar data; em produção seria Basquete Halterada x Furiosa de 09…`; `apps/web/app/components/EditionProgress.tsx:39,50-51 - o guia só some com atleta cadastrado; com 0 atletas ficou 'CONTINUAR EM ATLETAS' no topo durante o evento inteiro`
Proposta: Painel em três estados pela data da edição. ANTES: pendências com contagem e link (rascunhos, jogos sem local ou horário, equipes sem elenco). DURANTE: ao vivo, atrasados sem lançar, próximos por local. DEPOIS: categorias a encerrar, pódios a lançar, fechar ranking, encerrar edição.
Correção do revisor: Núcleo confere (dashboard/page.tsx:32; snapshot ordenado por scheduledAt, então 'próximo' é a Agendada mais antiga). Correção: rascunhos já aparecem no cartão Categorias (:38) e o jogo abandonado aparece como '1 ao vivo · Agora'.

**[JORG-05] Reprogramar ou completar a agenda exige abrir e salvar jogo por jogo** — alta, feature ausente, esforço G, confirmado em parte
Atrasou duas horas: são agenda, cartão, 'Editar partida', horário e salvar para cada jogo do dia. Quase nunca foi feito. A agenda pública ficou com horário errado, 89 jogos sem local, e cada jogo iniciado fora da janela gravou nota pedindo justificativa.
Evidência: `apps/web/app/components/MatchManager.tsx:310-319 - data, horário e local só mudam no formulário de uma partida; busca por lote|bulk|massa|reagendar no front e na API não…`; `EVIDENCIA_PRODUCAO.md item 3 - atraso mediano de 104 min (p75 230 min); 52 dos 94 horários foram inventados pelo importador`
Proposta: Na agenda, modo de seleção múltipla (por dia, modalidade, local ou a partir de um horário) com as ações 'Deslocar +/- minutos', 'Mover para outro dia' e 'Definir local'. Mostrar prévia dos novos horários e conflitos antes de aplicar; gravar um único registro de auditoria.
Correção do revisor: Sem ação em lote no front nem na API; 89 de 96 com 'A definir' confere. Correção: a nota automática está em 21 dos 56 jogos iniciados, não em quase todos. Lote exige ação nova na API, prévia e testes.

**[JORG-06] Agenda só anda dia a dia e chama jogo atrasado de 'Próximo'** — alta, ux, esforço M, confirmado
Para conferir se tudo foi lançado, o admin percorre dia por dia, modalidade por modalidade, lendo selos. Jogo de três dias atrás nunca aberto aparece como 'Próximo', igual ao que ainda vai acontecer. Não existe lista de 'sem resultado' nem total por situação. Em 13/10 havia 40 assim.
Evidência: `apps/web/app/components/MatchSchedule.tsx:25-33 - a única navegação é o dia; sem filtro por situação, local ou categoria; :47 apaga a fase do cartão`; `apps/web/app/lib/status.ts:74-78 - tudo que não é ao vivo nem final vira 'Próximo', inclusive jogo de dias atrás`
Proposta: Adicionar à agenda filtros de situação com contagem (Sem resultado, Ao vivo, Encerrados, Todos) e visão 'toda a edição' em lista. Jogo agendado com horário vencido ganha selo 'Atrasado · sem resultado'. Jogo ao vivo sem lance há 30 min ganha selo 'Parado'.

**[JORG-07] Fim dos grupos não tem tela: a chave se resolve calada ou trava** — alta, ux, esforço G, confirmado
Quando o último jogo de grupo encerra, o servidor preenche a chave sem mostrar quem passou nem por quê. Se falta um jogo, nada avisa. Rótulos como '2º geral' não são lidos; o admin define jogo a jogo num seletor com todas as equipes, sem ver o ranking entre grupos.
Evidência: `api:src/edition-actions/edition-action-recalculation.service.ts:473 - a 1a rodada só é preenchida quando TODOS os jogos de grupo são oficiais; nenhuma tela diz quantos f…`; `api:src/edition-actions/colocacao-do-chaveamento.ts:49-87 e edition-action-recalculation.service.ts:486-488 - rótulo fora da gramática ('2º geral', 'Melhor classificada'…`
Proposta: Criar na categoria o passo 'Fechar fase de grupos': mostra jogos que faltam, classificação por grupo, ranking dos segundos colocados e a chave proposta. O admin confirma ou troca cada vaga antes de gravar. Renomear o campo 'Melhores terceiros' para 'Melhores da posição seguinte'.

- **[JORG-08] Admin da edição não consegue encerrar a edição, e nenhum fechamento confere pendências** — média, inconsistencia, esforço M, confirmado. `apps/web/app/competitions/page.tsx:35,64,69 - datas, situação e ativação da edição só para super admin; api:src/edition-actions/edition-actions.service.ts:46-52 (GLOBAL_…`
**[JORG-09] Planilha de 94 jogos só entra por script de desenvolvedor com senha de admin** — alta, feature ausente, esforço G, confirmado
O admin recebe a tabela pronta, mas o app só aceita jogo digitado um a um, sem lado 'a definir'. Na Copa, um desenvolvedor converteu oito abas e rodou um script com senha de admin. Horário e local que a planilha não tinha entraram como provisórios, sem marca na tela.
Evidência: `apps/web/scripts/importar-copa.mjs:21-30 e docs/copa-halterada/LEIAME.md:37-47 - importação por 'node scripts/importar-copa.mjs' com INTERENG_SENHA; busca por csv|xlsx|i…`; `apps/web/app/components/MatchCreationForm.tsx:139-143 - pela tela é um jogo por vez, só com equipes inscritas; api:src/edition-actions/handlers/match-action.handler.ts:2…`
Proposta: Tela 'Importar jogos' na categoria: colar linhas da planilha (grupo, data, hora, local, equipe A, equipe B ou rótulo). Prévia com erros por linha, equipes não reconhecidas e horários vazios marcados 'a confirmar'; gravar tudo de uma vez. Permitir lado 'a definir' no agendamento manual.

- **[JORG-10] Situação da categoria é um seletor manual sem volta e não acompanha os jogos** — média, ux, esforço M, confirmado. `apps/web/app/components/TournamentManager.tsx:294 - 'Publicação' é um select com os cinco estados, no topo de uma aba de 5,1 telas (shots/metricas.json, admin/mobile/tou…`
**[JORG-11] Gestão da categoria grava a cada tecla e aceita grupo em texto livre** — alta, precisao dados, esforço M, confirmado
Digitar 'Grupo A, Grupo B, Grupo C' envia uma gravação por letra, cada uma devolvendo a edição inteira; em rede ruim as respostas podem chegar fora de ordem. Grupos são texto separado por vírgula, sem padronização. Equipe inscrita sem grupo não gera aviso: fica fora da tabela.
Evidência: `apps/web/app/components/TournamentManager.tsx:115-127,299,301 - nome de fase, grupos, classificados e ordem do sorteio disparam category/update no onChange`; `apps/web/app/lib/repositories/use-frontend-state.ts:96-99 - cada disparo é um POST que devolve o snapshot inteiro (1,7 MB só de jogos, EVIDENCIA_PRODUCAO.md item 12)`
Proposta: Gravar esses campos ao sair do campo ou num botão 'Salvar etapa'. Trocar o texto dos grupos por botão 'Adicionar grupo' que nomeia sozinho (Grupo A, B, C) e permite renomear. Avisar 'N equipes sem grupo' na Etapa 2 e no painel.

- **[JORG-12] No computador o organizador usa a tela de celular esticada, sem visão em tabela** — média, ux, esforço G, confirmado. `apps/web/app/globals.css:340,829-832 - coluna única de no máximo 760 px e barra inferior de celular também em 1280 px`
- **[JORG-13] Não há como exportar resultados nem gerar relatório; auditoria é fechada ao organizador** — média, feature ausente, esforço M, confirmado em parte. `busca por csv|xlsx|text/csv|window.print|createObjectURL em apps/web/app e por csv|export em api:src - nenhum recurso de exportação`
- **[JORG-14] Abrir a próxima edição recomeça do zero: nada da anterior é reaproveitado** — média, feature ausente, esforço M, confirmado. `apps/web/app/competitions/page.tsx:47 - nova edição pede só ano e período; api:src/edition-actions/handlers/context-action.handler.ts:230-242 cria a edição e apenas as m…`
**[JORG-R1] Tabela do grupo descarta, sem aviso, jogo sem grupo ou com equipe de fora** — crítica, precisao dados, esforço M, achado pelo revisor
Em fase com grupos, a classificação oficial só soma o jogo gravado no grupo e com as duas equipes alocadas nele. Jogo criado com o nome da fase, grupo apagado ou renomeado, equipe trocada ou desmarcada: o resultado fica de fora e nenhuma tela avisa. Nas duas categorias de Vôlei há jogos encerrados nessa situação.
Evidência: `api:src/edition-actions/edition-action-recalculation.service.ts:104-112,193-198 - fase com grupos só conta jogo com o groupId do grupo e pula jogo cuja equipe não está a…`; `api:schema.prisma (model Match: groupId e entryAId com onDelete SetNull) e api:src/edition-actions/handlers/category-action.handler.ts:466-468,543-545 - apagar ou renome…`
Proposta: API: recusar jogo em grupo que não contém as duas equipes e, ao apagar grupo ou desinscrever equipe, exigir destino para os jogos. Na categoria, aviso 'N jogos fora da tabela' com botão 'Corrigir grupo', que usa a troca de fase já existente na API.

**[JORG-R2] 'Montar os jogos' duplica a tabela importada e apaga o mata-mata agendado** — crítica, bug, esforço M, achado pelo revisor
Numa categoria publicada que já tem jogos da planilha ou agendados à mão, o botão segue ativo e, sem perguntar, cria todos contra todos por cima e apaga o mata-mata que tinha dia e hora. Não há como desfazer pela tela. Em produção, um Vôlei tem dez gerados ao lado de importados, confrontos repetidos e nenhuma chave.
Evidência: `apps/web/app/components/TournamentManager.tsx:46,206-218,313 - só enxerga jogos '-generated-'; sem confirmação quando a categoria nunca gerou; botão ativo em categoria P…`; `api:src/edition-actions/handlers/category-action.handler.ts:185-197 - apaga todos os '-generated-' e '-advanced' da categoria e cria o lote novo, sem olhar jogos de outr…`
Proposta: Antes de montar, listar o que a categoria já tem (importados, manuais, mata-mata) e criar só os confrontos que faltam. Nunca apagar jogo de mata-mata com data marcada sem confirmação nominal. Oferecer 'Desfazer montagem' enquanto nenhum jogo criado tiver sido iniciado.

**[JORG-R3] Auditoria registra cada ponto clicado e a tela mostra só as 100 últimas ações** — alta, bug, esforço M, achado pelo revisor
Cada toque no placar vira uma linha de auditoria, e a tela lê só as 100 últimas do snapshot. Depois de um jogo de vôlei, retificação, W.O. ou troca de adversário de horas antes já saiu da lista. As linhas trazem 'match/registerEvent' e o id do jogo, hora sem dia, e o filtro Partidas vem vazio.
Evidência: `api:src/edition-actions/edition-actions.service.ts:342-353 - toda ação grava uma linha, inclusive match/registerEvent, updateClock e claimOperator; guarda o tipo técnico…`; `api:src/edition-snapshots/snapshot.mapper.ts:1050-1053 - o snapshot leva só as 100 linhas mais recentes (take: 100)`
Proposta: API: endpoint de auditoria paginado, com filtro por dia, pessoa, jogo e tipo, que por padrão esconde lances, relógio e trava de operador; gravar rótulo e nome legíveis que o app já envia. Tela com data, busca e atalho 'só retificações, W.O. e trocas'.

**[JORG-R4] Cada ação grava o snapshot inteiro no banco e trava a edição toda** — alta, desempenho, esforço M, achado pelo revisor
Cada toque (ponto, relógio, trava do operador, tecla na gestão) abre uma transação que trava a edição, remonta o snapshot inteiro, devolve-o ao aparelho e grava uma cópia no recibo, que nunca é apagado. No fim do evento cada toque movia cerca de 1,7 MB; não há medição da lentidão sentida na mesa.
Evidência: `api:src/edition-actions/edition-actions.service.ts:391-404 - o recibo de idempotência guarda em responseData o snapshot completo devolvido; busca por editionActionReceip…`; `api:src/edition-actions/edition-actions.service.ts:39-43,235,283 - transação Serializable com trava única por edição: lances de quadras diferentes entram na mesma fila`
Proposta: Recibo guarda só a revisão; no reenvio a API remonta o snapshot. Rotina apaga recibos com mais de 24 h. Tirar do snapshot o regulamento repetido em cada jogo, que já vem por modalidade. Medir e registrar o tempo de cada ação.


Ideias de feature desta área:

- **Locais como cadastro e grade por quadra** (M)
- **Jogos 'A SEGUIR': sequência por quadra com horário estimado** (G)
- **Modelos de formato e 'Duplicar categoria'** (M)
- **Aviso da organização na área pública** (M)
- **Escala de mesa: quem responde por cada quadra e turno** (M)
- **Homologação do dia** (M)

## JATL — Jornada da atlética

**[JATL-01] Responsável da atlética não consegue entrar: a API recusa o login do papel** — crítica, bug, esforço P, confirmado
A conta do responsável é criada, mas o login e a renovação de sessão passam por resolveIdentity, que não tem ramo para TEAM_MANAGER e devolve 401. No celular a pessoa lê 'E-mail ou senha inválidos' usando a senha certa. O papel foi entregue sem nunca ter sido exercitado de ponta a ponta.
Evidência: `api:src/auth/auth.service.ts:249-292 - resolveIdentity só trata SUPER_ADMIN, EDITION_ADMIN e DISCIPLINE_MANAGER; quem só tem TEAM_MANAGER cai em 401 'Usuário sem papel a…`; `apps/web/app/lib/repositories/http-auth-adapter.ts:27 e api-client.ts:202-203 - todo 401 do login vira 'E-mail ou senha inválidos.'`
Proposta: Adicionar o ramo TEAM_MANAGER em resolveIdentity (papel, equipe e edição ativa). Criar teste de API do login do responsável e um e2e-http que entra como responsável e cadastra um atleta.

**[JATL-02] Admin da edição leva 403 ao criar o responsável e a tela diz sucesso** — crítica, contrato api, esforço M, confirmado
O organizador (admin da edição) vê o formulário 'Responsável da atlética', mas a API só deixa o super admin conceder esse papel. O erro aparece junto de um aviso de sucesso e o formulário é limpo. Criado pelo super admin, o acesso não aparece na equipe: o snapshot o devolve como 'Gestor de modalidade', e revogar falha.
Evidência: `api:src/edition-actions/edition-actions.service.ts:449-451,605-609 - para quem não é super admin, staff/upsert só aceita o papel 'Gestor de modalidade'`; `apps/web/app/components/TeamAccessManager.tsx:40,60-79 - formulário aparece para admin da edição; o resultado do dispatch é ignorado e o aviso 'já pode entrar e cadastra…`
Proposta: API: permitir ao admin da edição conceder e revogar 'Responsável da atlética' de equipes da edição e devolver TEAM_MANAGER no snapshot com o nome da equipe. Front: só limpar o formulário e avisar sucesso quando saved.ok.

**[JATL-03] Depois de entrar, o responsável não encontra o próprio time nem consegue sair** — crítica, bug, esforço M, confirmado
Após o login ele cai no painel geral. Das cinco abas da barra inferior só 'Início' abre; Modalidades, Jogos, Equipes e Mais dão 'ACESSO RESTRITO'. Nenhum cartão leva à equipe dele. Com a API real o escopo chega vazio e até /teams/{id} é bloqueado. 'Sair da conta' fica atrás de 'Mais', inalcançável.
Evidência: `apps/web/app/lib/repositories/auth-adapter.ts:92-94 - no login HTTP o escopo só é preenchido para DISCIPLINE_MANAGER; o do responsável fica vazio`; `apps/web/app/components/AdminRouteGuard.tsx:28,32-34,52-54,76 - sem escopo a equipe vira '__sem-equipe__' e todo /teams/* é bloqueado; /more, /matches, /disciplines e a …`
Proposta: Levar o responsável direto para /teams/{teamId} (vem em editionRoles). Barra própria do papel: Meu time, Jogos do time, Tabela e Conta, com trocar senha e sair. O guard compara teamId, não o nome.

**[JATL-04] Botão de cadastrar atleta e ações do elenco só aparecem para admin** — alta, inconsistencia, esforço M, confirmado em parte
A API autoriza o responsável (na própria equipe) e o gestor (na própria modalidade) a criar e ajustar atletas. Mas a tela da equipe esconde '+ Atleta', 'Editar modalidades' e 'Remover' de quem não é admin. Na Copa, só os 3 admins e o super admin podiam cadastrar atletas das 17 equipes.
Evidência: `apps/web/app/components/AppShell.tsx:44,69 e TeamDetailView.tsx:19 - '+ Atleta' depende de canManageEdition`; `apps/web/app/components/TeamRosterManager.tsx:28-31,64-65 - editar modalidades e remover só com canManageEdition; o estado vazio manda usar 'o botão superior', que não e…`
Proposta: Usar canManageRoster(session, equipe) no botão '+ Atleta' e nas ações da linha; gestor edita só a própria modalidade. Estado vazio com botão 'Cadastrar primeiro atleta' no próprio bloco.
Correção do revisor: Front confere (AppShell:44, TeamRosterManager:31, canManageRoster sem uso). Erro: a API não grava para gestor — athleteCreate/Update não devolvem editionDisciplineId e edition-actions.service.ts:332-339 responde 403 após o handler. Exige backend pequeno; admins conseguiam, logo alta.

- **[JATL-05] Zero atletas: quatro portas fechadas pesam mais que qualquer atrito de formulário** — média, operacao, esforço P, confirmado em parte. `Produção: 17 equipes, 0 atletas, 0 responsáveis, nenhum lance com autor; maioria dos placares digitada depois do jogo (EVIDENCIA_PRODUCAO.md, padrões 1 e 6)`
**[JATL-06] Elenco entra um atleta por vez; colar lista ou importar não existe na tela** — alta, feature ausente, esforço M, confirmado
Para 15 atletas do futsal são 15 voltas: '+ Atleta', nome, 'Cadastrar e continuar', marcar Futsal, 'Concluir cadastro', retorno ao topo da equipe. São cerca de 75 toques, 30 trocas de tela e 15 respostas com o snapshot completo. Dá para concluir sem modalidade, e esse atleta não aparece para a mesa.
Evidência: `apps/web/app/components/TeamAthleteForm.tsx:26-31 - dois passos por atleta, modalidades zeradas a cada cadastro, retorno a /teams/{id}; 'Cadastrar e continuar' só troca …`; `apps/web/scripts/importar-dados.mjs:1-20 - importador CSV de atletas existe só como script, com senha de admin`
Proposta: Tela 'Montar elenco' por equipe e categoria: campo para colar um nome por linha, prévia com duplicados, gravação em uma ação de lote. No formulário atual, botão 'Salvar e cadastrar outro' mantendo as modalidades marcadas.

**[JATL-07] Elenco é por modalidade: masculino e feminino da mesma atlética viram uma lista só** — alta, precisao dados, esforço G, confirmado
O atleta é ligado a 'Futsal', não a 'Futsal Feminino'. Numa atlética com os dois times, a mesa do jogo feminino recebe também os nomes do masculino, a artilharia junta homens e mulheres num ranking só e o limite do regulamento (12 no futsal) acusa 'elenco acima do limite' ao somar os dois.
Evidência: `api:schema.prisma:305 - EditionRoster é único por modalidade + atleta; não há vínculo com a categoria`; `apps/web/app/matches/live/page.tsx:259-264 e apps/web/app/lib/edition-catalog.ts:182-184 - 'Quem marcou?' lista todos os atletas da equipe na modalidade do jogo`
Proposta: Inscrever o atleta na categoria: elenco, mínimo/máximo, lista da mesa e artilharia passam a ser por categoria. Na tela da equipe, o agrupamento vira 'Futsal Masculino', 'Futsal Feminino'.

- **[JATL-08] Trava de elenco do mata-mata vale só no navegador e tranca a modalidade inteira** — média, precisao dados, esforço M, confirmado. `apps/web/app/lib/eligibility.ts:54-56,61-71 e apps/web/app/lib/match-lifecycle.ts:43-45 - trava por modalidade, detectada pelo NOME da fase (expressão regular)`
**[JATL-09] Dar acesso às atléticas é manual, uma a uma; senha esquecida não tem saída** — alta, ux, esforço G, confirmado
Para 17 equipes o admin abre cada uma, rola até o fim, digita nome, e-mail e uma senha, e depois escreve à mão no WhatsApp o endereço, o e-mail e a senha. Não existe visão de quem já recebeu, entrou ou cadastrou. Senha esquecida não tem redefinição.
Evidência: `apps/web/app/components/TeamAccessManager.tsx:146-177 - nome, e-mail e senha inventada pelo admin; instrução 'Mande a senha para a pessoa por um canal direto', sem link …`; `shots/admin/mobile/teams_alcateia.png e metricas.json - o formulário é o último bloco de uma tela com 2,7 alturas de rolagem`
Proposta: Tela 'Acessos das atléticas' com as equipes em lista: situação (sem acesso, convidado, entrou, nº de atletas) e botão 'Convidar', que gera link de primeiro acesso e abre o compartilhamento com a mensagem pronta. Incluir 'Redefinir acesso'.

**[JATL-10] Sem agenda por equipe, aviso de horário ou página do atleta** — alta, feature ausente, esforço M, confirmado
Quem torce ou joga por uma atlética precisa abrir cada modalidade e cada dia para achar os jogos do time. A página da equipe mostra classificação e nomes, sem jogos. O atleta não tem onde ver seus jogos e gols. Num evento com atraso mediano de 104 minutos, nenhuma mudança de horário é avisada.
Evidência: `apps/web/app/components/MatchSchedule.tsx:12,21 - a agenda filtra por modalidade, categoria e dia; não por equipe`; `apps/web/app/components/TeamPerformance.tsx:43 - a página da equipe diz 'N jogos na agenda' e não lista nenhum`
Proposta: Bloco 'Jogos' na página da equipe, com próximos e resultados de todas as categorias. Botão 'Seguir este time', salvo no aparelho, que fixa o time na abertura do app público e destaca jogo com horário ou local alterado. Página pública do atleta.

- **[JATL-11] Atlética com dois times na categoria vira 'Halterada 2', uma equipe à parte** — média, inconsistencia, esforço G, confirmado. `api:schema.prisma:381 - uma equipe só pode ter uma inscrição por categoria`
- **[JATL-12] Papel do responsável não cobre o básico da própria equipe** — média, feature ausente, esforço M, confirmado em parte. `api:src/edition-actions/edition-actions.service.ts:515-519 - só athlete/create e athlete/update; team/update e qualquer outra ação voltam 403`
- **[JATL-13] Sem elenco, o app insiste: 'Quem marcou?' a cada lance e Artilharia pública vazia** — média, ux, esforço P, confirmado. `apps/web/app/matches/live/page.tsx:236,251,546-563 e globals.css:4045 - o painel fixo abre após todo lance que pontua, mesmo sem atleta: 'Nenhum atleta desta equipe está…`
- **[JATL-14] Atleta removido não pode ser cadastrado de novo nem restaurado** — média, bug, esforço P, confirmado. `apps/web/app/components/TeamAthleteForm.tsx:28 - a checagem de duplicado não ignora atletas com removed: true`
**[JATL-R1] API devolve 403 quando o gestor de modalidade cadastra ou ajusta atleta** — alta, bug, esforço P, achado pelo revisor
A API pôs athlete/create e athlete/update na lista do gestor (PR #25) e a checagem de escopo passa. Mas, depois de gravar, o serviço compara a modalidade devolvida pelo handler com a do gestor, e o handler de atleta não devolve nenhuma. Resultado: 403 e transação desfeita, sempre. Liberar o botão (JATL-04) sem isso entrega um erro.
Evidência: `api:src/edition-actions/edition-actions.service.ts:331-339 - depois do handler, escopo de modalidade exige mutation.editionDisciplineId igual ao do gestor; senão 403 'A …`; `api:src/edition-actions/handlers/catalog-action.handler.ts:401,442-446 - athleteCreate e athleteUpdate devolvem só entityType e entityId`
Proposta: athleteCreate e athleteUpdate passam a devolver editionDisciplineId quando o escopo é de modalidade. Criar teste que passa por execute() com gestor cadastrando e ajustando atleta da própria modalidade e sendo recusado em outra.

**[JATL-R2] Inscrever atletas já cadastrados numa modalidade é um por vez** — alta, feature ausente, esforço M, achado pelo revisor
Quando a lista chega sem modalidade (caso real do InterEng: 428 de 429), cada atleta pede abrir o editor, marcar e salvar, com uma resposta do snapshot inteiro. Não dá para marcar vários de uma vez nem ver, por equipe, quem falta. JATL-06 cobre nomes novos, não quem já está cadastrado.
Evidência: `apps/web/tests/e2e/inscrever-atleta-modalidade.spec.ts:9-11 - registro do time: na véspera do InterEng, 428 dos 429 atletas em produção estavam sem modalidade`; `apps/web/app/components/TeamRosterManager.tsx:33,63-64 - o editor de modalidades abre por atleta (abrir, marcar, salvar); só ele e AthleteManager.tsx:14 despacham athlet…`
Proposta: No bloco de cada modalidade da equipe, botão 'Adicionar atletas' abre o elenco com caixas de seleção e grava tudo numa ação de lote. Em /athletes, filtro 'Sem modalidade' com seleção múltipla e a mesma ação.

- **[JATL-R3] Elenco não acompanha a equipe quando ela é vinculada a outra edição** — média, feature ausente, esforço M, achado pelo revisor. `api:src/edition-actions/handlers/catalog-action.handler.ts:276-296 - team/attach cria só o vínculo EditionTeam; nenhum atleta vem junto`
- **[JATL-R4] Senha inicial é descartada em silêncio quando o e-mail já tem conta** — média, contrato api, esforço P, achado pelo revisor. `api:src/edition-actions/handlers/context-action.handler.ts:498-528 - initialPassword só é lida quando a conta não existe; conta existente mantém a senha antiga e não vol…`

Ideias de feature desta área:

- **Reaproveitar o elenco da edição anterior** (M)
- **Autoinscrição do atleta por link ou QR da equipe** (G)
- **Número de camisa e presença no jogo** (M)
- **Painel de prontidão dos elencos com prazo de inscrição** (M)
- **Minha Copa: cartão do atleta para compartilhar** (M)
- **Súmula pré-preenchida para imprimir** (M)

## JDADOS — Dados de produção

**[JDADOS-01] Tabela oficial do Vôlei ignora 20 dos 23 jogos de grupo encerrados** — crítica, precisao dados, esforço M, confirmado
Jogo gravado como 'Fase de grupos' (sem grupo) ou com rótulo de grupo que não é o das duas equipes fica fora do cálculo, sem aviso. No Vôlei, 15 jogos sem grupo e 5 cruzados sumiram: o público vê o líder errado e as semifinais femininas foram montadas sobre 2 jogos.
Evidência: `dado de produção: Vôlei masculino - a tabela do servidor traz Inquisidores com 1 jogo e 3 pts e as outras quatro zeradas; recalculando pelos 10 jogos do turno único: Hal…`; `dado de produção: Vôlei Feminino - tabela com 4 equipes e 1 jogo cada; Inquisidores (4 vitórias em 4, sem grupo atribuído) não aparece; as semifinais foram preenchidas c…`
Proposta: Contar todo jogo oficial da fase: sem grupo ou cruzado entra na tabela geral da fase. Mostrar na categoria 'N jogos fora da tabela', com correção em um toque. Só semear o mata-mata quando jogos contados forem iguais aos encerrados.

**[JDADOS-02] Vôlei aceita ponto com o jogo decidido e 'desfazer' apaga a parcial** — crítica, bug, esforço M, confirmado
Fechado o último set, os botões de ponto continuam ativos. Um toque a mais vira 'terceiro set vencido' em melhor de 3; desfazê-lo apaga a parcial legítima do set decisivo. A retificação troca só o placar em sets, nunca as parciais. Três de 24 jogos de vôlei ficaram com parcial errada ou ausente.
Evidência: `dado de produção: Inquisidores 0x2 Furiosa (Vôlei masculino, 12/10) - o último lance registra 0x3 em sets e a parcial virou 10-26; duas retificações depois (uma delas de…`; `dado de produção: Halterada 2 2x0 Incinera e Mafiosa 0x2 Inquisidores - placar de 2 sets com 1 parcial gravada; o 2º set (25-1 e 14-25) só existe em periodScore. Estado …`
Proposta: Bloquear ponto quando setsToWin foi atingido, no front e na API, e abrir direto a confirmação de encerramento. Desfazer remove só a parcial criada pelo próprio lance. Em modalidade por sets, a retificação edita as parciais e o placar em sets é derivado delas.

**[JDADOS-03] Produção precisa de saneamento agora: correções de dado que o app não resolve** — alta, operacao, esforço M, confirmado
Um dia depois do evento a área pública ainda mostra edição 'Em andamento', um jogo de basquete 'Ao vivo' desde 12/10, 40 jogos 'Agendada' vencidos, duas tabelas de vôlei erradas, 3 confrontos duplicados e 7 W.O. como 10x0. Jogo encerrado duplicado não pode ser apagado nem cancelado pelo app.
Evidência: `Vôlei masculino: decidir pela súmula entre os duplicados Halterada 2 x Incinera (25-9 25-16 e 25-1 25-1) e Inquisidores x Furiosa (2x0 e 0x2, vencedores opostos); pôr os…`; `Vôlei Feminino: incluir Inquisidores na tabela (turno único de 5 equipes); anular o duplicado Halterada x Inquisidores; gravar a parcial 14-25 que falta em Mafiosa x Inq…`
Proposta: Conferir com a organização, súmula em mãos, e aplicar a lista das evidências por script revisado. Antes, criar a ação 'Anular partida encerrada' (com motivo, só admin), que hoje não existe. Rodar depois o recálculo das tabelas e fechar a edição.

**[JDADOS-04] 71% dos jogos foram digitados depois, toque a toque: falta lançar resultado direto** — alta, feature ausente, esforço M, confirmado
Quem lança tem a súmula de papel, e o app só aceita placar por lance: um 25x18 25x20 custa cerca de 88 toques a um por segundo. No embalo, 15 'Falta' foram tocadas no Vôlei Feminino (13 a menos de 2 s de outro toque) e uma equipe ficou com fair play 8.
Evidência: `dado de produção: 40 dos 56 jogos abertos foram lançados em rajada (mediana abaixo de 3 s entre toques, ou até 4 gols em menos de 1 min); concentram 2.127 dos 2.689 lanc…`; `dado de produção: vôlei em rajada - mediana de 85 toques e 157 s de digitação por jogo; 74 min de digitação somados nos 37 jogos em rajada com 5 lances ou mais; o result…`
Proposta: Criar 'Lançar resultado' no card e na lista de jogos: placar final, ou parciais por set, num formulário só, com W.O. e 'não realizado' ao lado. Vale como resultado oficial sem lances, marcado 'lançado pela súmula'. 'Salvar e próximo' para lançar em lote.

**[JDADOS-05] 41 jogos sem desfecho um dia após o evento, um deles 'Ao vivo'** — alta, operacao, esforço M, confirmado
O app não percebe jogo vencido nem jogo abandonado. O público segue vendo 'Ao vivo' e 'Agendada' para o que já passou; Futsal Masculino continua 'Publicado' com jogos encerrados, Vôlei masculino 'Em andamento' com a final jogada, e a edição 'Em andamento' após o fim. Não se sabe se os 40 foram disputados.
Evidência: `dado de produção: 40 'Agendada' com data vencida (Futsal 20, Basquete 16, Vôlei 4; 25 com as duas equipes definidas); status Adiada, Cancelada e W.O. usados 0 vezes em 9…`; `dado de produção: Mafiosa 23x10 Furiosa (basquete) 'Ao vivo' desde 12/10 14:31, último lance 14:52, último sinal da mesa 15:58, relógio do servidor correndo; dois jogos …`
Proposta: Painel 'Pendências': jogos vencidos sem desfecho e 'Ao vivo' sem lance há 30 min, cada um com Lançar resultado, W.O., Adiar e Não realizado. Para o público, 'Ao vivo' sem sinal vira 'Interrompido'. Status da categoria passa a derivar dos jogos.

**[JDADOS-06] Estrutura da categoria muda no meio do evento sem validação nem assistente** — alta, precisao dados, esforço G, confirmado
Equipe saiu, equipe entrou, grupo virou turno único. Sem fluxo para isso, a organização editou jogos um a um, criou outros à mão e precisou de três correções de código em dia de jogo. Sobraram confrontos duplicados, um com resultados contraditórios, e grupos que não batem com os jogos.
Evidência: `dado de produção: 3 confrontos repetidos na mesma fase - Vôlei masculino Inquisidores x Furiosa (vencedores opostos) e Halterada 2 x Incinera (25-9 25-16 e 25-1 25-1); V…`; `dado de produção: grupo 'grupo c' ao lado de 'Grupo A' e 'Grupo B'; Vôlei masculino com 'Grupo B' sem equipes e seeds 1, 4, 5, 6, 7; 4 jogos com motivo 'Ajuste dos jogos…`
Proposta: Assistente 'Alterar participantes ou formato' para categoria em andamento: preserva os jogos encerrados, mostra os pendentes que serão removidos, criados ou movidos e aplica de uma vez. Ao agendar: aviso de confronto repetido na fase e grupo restrito às equipes do jogo.

**[JDADOS-07] W.O. virou 10 gols clicados em 7 jogos de handebol** — alta, ux, esforço M, confirmado
O W.O. fica escondido em 'Editar partida' e aplica o placar do regulamento (1x0 no handebol), diferente do que a organização pratica (10x0). A mesa abriu o jogo e clicou 10 gols. A tabela não distingue W.O. de goleada, e a equipe ausente em 4 jogos segue como participante normal.
Evidência: `dado de produção: 7 jogos 'Encerrada' em 10x0 ou 0x10 com exatamente 10 lances em 15 a 40 s (Engenhosa 4 vezes no feminino; Aguerrida 2 e Abrasiva 1 no masculino); statu…`; `apps/web/app/components/MatchManager.tsx:314 - o W.O. só existe no formulário 'Editar partida', como opção de status, com o placar fixo do regulamento`
Proposta: Botão 'W.O.' no painel de início da mesa e no card do jogo: escolhe a equipe ausente, mostra o placar que será aplicado e confirma. Placar de W.O. revisado por modalidade antes do evento. Jogo e tabela exibem o selo 'W.O.'.

**[JDADOS-08] Primeiro jogo de vôlei rodou em melhor de 5 e recebeu 9 pontos falsos** — alta, precisao dados, esforço G, confirmado em parte
O regulamento padrão (melhor de 5, decisivo só no 5º set) não era o do evento (melhor de 3). No tie-break real de 16-14 o app exigiu 25; sem botão para fechar o set, a mesa inflou o placar. A regra foi trocada com a modalidade em andamento e passou a valer também para o jogo já disputado.
Evidência: `dado de produção: Halterada 2x1 Halterada 2 (10/10, operado ao vivo por 66 min) - o 3º set estava em 16-14 e recebeu 9 pontos em 4 s até 25-14; a partida avançou para a …`; `apps/web/app/lib/regulation.ts:123 - o padrão do Vôlei é setsToWin 3; produção está em 2 hoje. A troca ocorreu em 10/10 entre 11:46 e 12:52: todos os jogos seguintes fec…`
Proposta: Checklist pré-evento por modalidade em linguagem de quadra ('melhor de 3, sets de 25, decisivo de 15, W.O. 2x0'), confirmado pelo gestor. Botão 'Encerrar set com este placar'. Congelar o regulamento na partida ao iniciar; mudança posterior só vale para jogos não iniciados.
Correção do revisor: Nove pontos em 4 s e etapa 4 conferem; padrão setsToWin 3 no front e na API. Correção: 'Avançar set' não funciona, a API recusa (handler:536-540); o botão é morto. Congelar regra exige migração: esforço G.

**[JDADOS-09] Página da equipe mostra classificação diferente da tabela oficial** — alta, inconsistencia, esforço P, confirmado
Existem dois motores de classificação. O da página da equipe soma o mata-mata à fase de grupos, junta todos os grupos numa lista, ignora a pontuação da modalidade e o desempate por pênaltis. Em toda categoria com mata-mata jogado, posição, jogos e pontos divergem da tabela oficial.
Evidência: `apps/web/app/components/TeamPerformance.tsx:22-24 - recalcula no navegador com todos os jogos da categoria (grupos e mata-mata), todas as equipes numa lista e regra fixa…`; `apps/web/app/components/TournamentClassification.tsx:63-83 - a aba Tabela usa a classificação oficial do servidor, por grupo`
Proposta: A página da equipe passa a ler a linha da equipe na classificação oficial (posição no grupo, J, V, E, D, PTS) e mostra o mata-mata à parte ('Semifinal: venceu 20x9'). Remover o cálculo local de TeamPerformance.

**[JDADOS-10] Mata-mata sem nome de rodada: aba Chaveamento vazia e rótulos que a API não lê** — alta, contrato api, esforço M, confirmado em parte
O público abre 'Tabela e chaveamento', toca em Chaveamento e lê que os confrontos ainda serão gerados, mesmo com a final jogada. Nos cards, semifinal, final e 3º lugar aparecem todos como 'Mata-mata'. No Basquete, três rótulos digitados fora da gramática fariam a chave publicada ser trocada pela semeadura automática.
Evidência: `dado de produção: os 24 jogos eliminatórios têm fase 'Mata-mata'; final e 3º lugar do Handebol Masculino só se distinguem pelo id (advanced-r2-1 e advanced-third)`; `apps/web/app/components/TournamentClassification.tsx:94 - a aba Chaveamento filtra por /semi|quart|final/ no nome da fase; nenhum jogo de produção casa`
Proposta: O snapshot passa a enviar rodada e posição com rótulo ('Semifinal 1', 'Final', '3º lugar'). A aba Chaveamento desenha por rodada. O lado 'a definir' é escolhido em lista (1º do Grupo A, melhor 2º, vencedor do jogo N); a API recusa rótulo que não interpreta.
Correção do revisor: A regex /semi|quart|final/ não casa nenhum dos 24 jogos 'Mata-mata': aba Chaveamento vazia. Correção: no Basquete a semeadura automática gera os mesmos confrontos dos rótulos (1ºA x melhor 2º, 1ºB x 1ºC); risco latente, sem troca real.

**[JDADOS-11] Invariantes que a API deveria garantir sozinha e hoje não garante** — alta, precisao dados, esforço M, confirmado em parte
A API valida o formato de cada ação, não a coerência do conjunto. Cada invariante listada nas evidências tem um caso real de 09 a 12/10 que a viola, e nenhuma depende de disciplina de quem opera.
Evidência: `Tabela: todo jogo oficial de fase classificatória conta em exatamente uma tabela, e todo inscrito está em uma tabela - violado por 20 jogos de vôlei e por Inquisidores s…`; `Jogo: nenhum ponto após a decisão; número de parciais igual ao de sets jogados; parcial respeita alvo e vantagem; etapa atual nunca maior que as previstas; placar igual …`
Proposta: Implementar as invariantes em dois lugares: validação na escrita, recusando com a frase que diz o que corrigir, e um verificador somente leitura que roda a cada revisão e alimenta o painel de pendências. Rodar o verificador em produção antes do saneamento.
Correção do revisor: Os fatos conferem, mas é guarda-chuva de 01, 02, 05, 06, 08, 10 e 13: contar à parte duplica esforço. A entrega própria é o verificador somente leitura (M). 'grupo c' não viola nome único.

- **[JDADOS-12] Público vê relógio e '1º tempo' que a mesa não opera** — média, inconsistencia, esforço P, confirmado em parte. `apps/web/app/matches/live/page.tsx:83 - 'const hasClock = false': a mesa não tem relógio, pausa nem minutagem`
- **[JDADOS-13] Quem iniciou e operou cada jogo se perde: 53 de 56 sem autor** — média, bug, esforço M, confirmado. `api:src/edition-snapshots/snapshot.mapper.ts:923 - startedBy sai de operatorName (operador atual), não de startedById`
- **[JDADOS-14] Snapshot de jogos pesa 1 MB: 86% são lances, 23% estado para desfazer** — média, desempenho, esforço G, confirmado em parte. `dado de produção (JSON compacto dos 96 jogos: 1.011.123 bytes, 89 KB em gzip): lances 86,5%, dentro deles previous 23,4% e previousScoreA/B 10,1%; rules 8,1% (4 regulame…`
**[JDADOS-R1] Aba Tabela fica vazia ou com posições repetidas em fase Liga com grupos** — alta, bug, esforço P, achado pelo revisor
Quando a fase classificatória é 'Liga' mas tem grupos, a tela não sabe qual tabela desenhar. No Vôlei masculino as três abas ficam vazias e o público lê uma instrução de gestor; no Feminino sai uma lista única com duas equipes em 1º e duas em 2º. Corrigir só o cálculo do servidor não muda isso.
Evidência: `apps/web/app/components/TournamentClassification.tsx:34-36 e 61-65 - sem fase de formato 'Grupos', as abas viram os nomes das fases; havendo duas abas, os participantes …`; `dado de produção (categorias): Vôlei masculino tem duas fases de formato 'Liga' ('Fase de grupos', com Grupo A e B, e 'Mata-mata') e todas as equipes em 'Grupo A' - as a…`
Proposta: Desenhar a partir do que o servidor envia: uma aba por grupo sempre que a fase tiver grupos, em qualquer formato, e tabela única quando não tiver. Trocar a instrução de gestão por 'Tabela em preparação' na área pública. Teste com os dados de outubro.

**[JDADOS-R2] Cada toque grava o snapshot inteiro da edição no banco, sem expurgo** — alta, desempenho, esforço M, achado pelo revisor
Para evitar envio repetido, a API guarda a resposta completa de cada ação, que é a edição inteira. Cada ponto de vôlei monta e grava até 1 MB com a edição travada. A tabela de recibos só cresce e o custo por toque aumenta ao longo do próprio evento.
Evidência: `api:src/edition-actions/edition-actions.service.ts:381-405 - toda ação monta o snapshot privado dentro da transação Serializable, com a trava da edição (:283), e grava a…`; `api:schema.prisma:715-731 - edition_action_receipts.responseData é Json sem prazo; a busca por editionActionReceipt só acha findFirst, findUnique e create, nenhum delete…`
Proposta: Gravar no recibo só a revisão resultante; na repetição, devolver o snapshot atual. Apagar recibos com mais de 24 horas numa rotina da própria API. Em produção, medir o tamanho da tabela edition_action_receipts e limpar os recibos de outubro.

**[JDADOS-R3] Toque dado antes da resposta do anterior é recusado e o ponto some** — alta, bug, esforço M, achado pelo revisor
A mesa calcula o novo placar com o que está na tela e a tela só muda quando a API responde (0,6 a 1 s no evento). Um segundo toque nesse intervalo sai com placar velho, a API recusa e aparece uma frase técnica. Não há sinal de 'enviando'.
Evidência: `apps/web/app/matches/live/page.tsx:196-212 e 256 - o lance sai com 'void dispatch', sem esperar, levando o placar calculado a partir do estado da tela; a trava é um temp…`; `apps/web/app/lib/repositories/http-adapter.ts:103-104 - 'não há atualização otimista': o placar na tela só muda quando a resposta volta; apps/web/app/lib/repositories/us…`
Proposta: A mesa envia só tipo e lado do lance, sem placar calculado; a API já aceita assim. O placar sobe na hora do toque, os lances saem em fila, um por vez, com marca de 'enviando' e reenvio automático se a rede falhar.

**[JDADOS-R4] Painel 'Quem marcou?' abre a cada ponto mesmo sem atleta cadastrado** — alta, ux, esforço P, achado pelo revisor
A pergunta de autoria aparece depois de todo gol, ponto ou cesta, inclusive quando a equipe não tem atleta inscrito, caso das 17 equipes do evento. O painel não fecha sozinho e fica sobre a faixa dos controles de desfazer e encerrar até alguém acertar um X de 24px.
Evidência: `apps/web/app/matches/live/page.tsx:236, 251 e 546-565 - todo lance pontuado chama setAtribuindo; sem elenco, o painel abre só para dizer 'Nenhum atleta desta equipe está…`; `apps/web/app/globals.css:4045, 4048 e 4057 - painel fixo a 76px do rodapé, z-index 1010, até 42vh; os controles (Desfazer, Encerrar) grudam a 74px com z-index 12 e ficam…`
Proposta: Abrir o painel só quando a equipe tiver atletas inscritos na modalidade. Quando abrir: fechar sozinho em 4 segundos, ficar acima dos controles sem cobri-los e ter botão de fechar de 44px. Chave por modalidade 'registrar autor do lance'.


Ideias de feature desta área:

- **Agenda por ordem de quadra ('agora' e 'a seguir')** (G)
- **Foto da súmula presa ao resultado** (M)
- **Boletim final da edição em PDF e planilha** (M)
- **Ensaio geral por modalidade antes do evento** (M)
- **Medição de uso da área pública e da mesa** (M)
- **Autor do lance por número de camisa, sem elenco cadastrado** (M)

## VPUB — Auditoria visual: público e mesa

**[VPUB-01] Chaveamento público fica vazio: filtro procura 'semi|quart|final' e a fase chama 'Mata-mata'** — crítica, bug, esforço M, confirmado
A aba Chaveamento só lista jogos cuja fase tem 'semi', 'quart' ou 'final' no nome. Na Copa, os 24 jogos de mata-mata foram gravados com fase 'Mata-mata': com esses dados a aba mostra 'será exibido quando os confrontos forem gerados' em todas as categorias. Quando funciona, é uma lista plana sem rodada, sem escudo e sem link para a partida.
Evidência: `apps/web/app/components/TournamentClassification.tsx:94 - knockout = jogos cujo nome de fase casa /semi|quart|final/i; :121 - sem casar, mostra 'O chaveamento será exibi…`; `dados/jogos-producao.json - os 24 jogos eliminatórios têm phase 'Mata-mata' (ids -advanced-r1-1, -advanced-third); nenhum casa com o filtro`
Proposta: Selecionar jogos eliminatórios pelo formato da fase (Mata-mata) ou pelo id -advanced-, agrupar por rodada com knockoutRound()+roundName() (Quartas, Semifinal, 3º lugar, Final) e desenhar colunas roláveis na horizontal: cada confronto com escudos, placar, pênaltis e link para a partida.

**[VPUB-02] Tela inicial 'Ao vivo' fica vazia quase sempre e não mostra próximos nem resultados** — alta, ux, esforço M, confirmado
A porta de entrada do espectador mostra apenas jogos com status 'Ao vivo'. No evento só ~1/3 dos jogos foi operado ao vivo: no resto do tempo a tela mostra '0 partidas ao vivo' e um link. Não há próximo jogo, último resultado nem hora do último lance: um jogo abandonado continua 'AGORA' no dia seguinte.
Evidência: `apps/web/app/components/PublicLiveView.tsx:18-20 - a home só renderiza PublicMatchCollection mode='live' e o link 'TODAS AS MODALIDADES'`; `apps/web/app/components/PublicMatchCollection.tsx:11 e :24 - o modo 'upcoming' existe e nenhuma tela usa; vazio = 'Nenhum jogo ao vivo no momento.'`
Proposta: Transformar a home em 'Hoje': bloco Ao vivo (com 'último lance há N min' calculado de events[0].at; acima de 20 min troca o selo por 'Sem atualização'), bloco A seguir (3 próximos por horário) e bloco Últimos resultados (5 mais recentes).

**[VPUB-03] Selo de status engana: cancelado e W.O. viram 'Encerrado'; 'Ao vivo' perde o destaque** — alta, precisao dados, esforço M, confirmado
Seis estados viram três rótulos: Cancelada e W.O. aparecem como 'Encerrado', Adiada como 'Próximo', e jogo com horário vencido também é 'Próximo'. O mesmo estado tem três aparências conforme a tela; nas listas principais o selo 'Ao vivo' fica sem fundo, enquanto 'Encerrado' ganha selo. MatchCard e MatchSummary usam tons diferentes para o mesmo estado.
Evidência: `apps/web/app/lib/status.ts:74-78 - getMatchStatusLabel devolve só 'Ao vivo', 'Encerrado' (inclui Cancelada e W.O.) e 'Próximo' (inclui Adiada)`; `apps/web/app/globals.css:1767 e :2493 - .status-orange do cartão recebe fundo --pink/--blue, que valem --card (:19-21); MatchCard.tsx:20 e MatchSummary.tsx:8 mapeiam 'Ao…`
Proposta: Criar um componente MatchStatus único com sete estados e um estilo fixo cada: AO VIVO (verde cheio), ENCERRADO (contorno), W.O., ADIADO, CANCELADO, horário (sem selo) e ATRASADO quando o horário passou sem início. Apagar as sobrescritas por tema no globals.css.

**[VPUB-04] Mesa abre 'Quem marcou?' a cada ponto, mesmo sem nenhum atleta cadastrado** — alta, ux, esforço P, confirmado
Depois de cada gol, cesta ou ponto a mesa abre um painel fixo perguntando quem marcou. Sem atletas — caso das 17 equipes da Copa — ele abre só para avisar que não há atletas e fica até o próximo lance, sobre a faixa onde ficam Desfazer e Encerrar em telas menores. O botão de fechar tem 24px.
Evidência: `apps/web/app/matches/live/page.tsx:236 e :251 - setAtribuindo() é chamado depois de todo lance pontuado, inclusive ponto de vôlei; :546-563 - sem elenco o painel abre só…`; `apps/web/app/globals.css:4045 e :4057 - painel fixo a 76px do rodapé (z-index 1010), mesma faixa em que .match-controls gruda (bottom 74px, z-index 12); :4048 - fechar é…`
Proposta: Não abrir quando a equipe não tem atleta elegível nem em modalidade por sets. Quando houver elenco, mostrar os nomes num espaço de altura fixa reservado entre placar e botões (não desloca nem cobre nada), com fechamento automático em 6s e alvos de 44px.

**[VPUB-05] W.O. fica escondido num select de 'Editar partida', fora do fluxo da mesa** — alta, ux, esforço M, confirmado em parte
Registrar W.O. exige sair do placar: Jogos › partida › rolar › Editar partida › select 'Estado da partida' › W.O. › vencedora › motivo › salvar. Nada na tela da partida nem na mesa indica esse caminho. No evento, 8 jogos com o placar de W.O. do regulamento foram lançados como dez gols clicados e ficaram como jogo normal encerrado.
Evidência: `apps/web/app/components/MatchManager.tsx:313-315 - W.O. é uma opção do select nativo 'Estado da partida'; só ao escolher surgem 'Equipe vencedora do W.O.' e 'Motivo'`; `apps/web/app/matches/live/page.tsx:573-577 - o painel 'A PARTIDA AINDA NÃO COMEÇOU' oferece só INICIAR PARTIDA`
Proposta: No painel de pré-jogo da mesa e na tela da partida, pôr ao lado de INICIAR PARTIDA o botão 'Registrar W.O.': abre diálogo com dois botões grandes (escudo de cada equipe = quem venceu), motivo pré-preenchido 'Ausência' e o placar regulamentar visível antes de confirmar.
Correção do revisor: W.O. só no select (MatchManager.tsx:313): confirmo. Correções: no bruto são 7 jogos 10×0, não 8; e o regulamento gravado dá W.O. 1×0 (rules.walkover; API handler:314), então o botão aplicaria placar diferente do praticado.

**[VPUB-06] Abrir o placar exige quatro toques e rolagem; início do gestor aponta outra modalidade** — alta, ux, esforço M, confirmado
Para operar um jogo: Jogos › cartão › rolar até o fim › Abrir placar › Iniciar › confirmar. O botão principal fica depois da lista de lances e desce a cada lance. O 'Próximo confronto' do gestor de Futsal é um jogo de Vôlei, que ele não opera. Ao encerrar, a mesa não oferece o jogo seguinte.
Evidência: `apps/web/app/components/MatchDetailClient.tsx:45-61 - 'Abrir/Continuar placar' é renderizado depois da linha do tempo inteira: com 88 lances de vôlei fica dezenas de tel…`; `shots/gestor/mobile/matches_semifinal-1.png - com zero eventos, 'Editar partida' já está na borda da dobra e 'Continuar placar' abaixo dela (página de 1017px)`
Proposta: Início do gestor vira 'Meus jogos de hoje' (da modalidade dele, por horário), cada cartão com botão 'Abrir placar' ou 'Continuar placar'. Na tela da partida, fixar esse botão no rodapé. Depois de encerrar, mostrar 'Próximo jogo: A × B — abrir placar'.

- **[VPUB-07] Na mesa, botões das duas equipes são idênticos e 'Encerrar partida' não se destaca** — média, ux, esforço M, confirmado. `shots/gestor/mobile/matches_live_partida_semifinal-1.png - seis botões de lance de ~185×86px em duas colunas iguais; quatro controles no mesmo estilo em grade 2×2; barra…`
**[VPUB-08] Página pública exibe cronômetro que a mesa não opera** — alta, precisao dados, esforço P, confirmado
A mesa foi construída sem cronômetro, mas a página pública continua desenhando um: parado no tempo cheio (demo) ou correndo sozinho desde o início até zerar (basquete em produção), sem pausa possível. Do lado da mesa, 'Avançar tempo' sempre pergunta se quer encerrar 'antecipadamente', porque o relógio gravado nunca sai do zero.
Evidência: `apps/web/app/matches/live/page.tsx:83 - const hasClock = false: a mesa não mostra nem controla relógio (sem pausar/retomar)`; `apps/web/app/components/MatchDetailClient.tsx:35 e :49 - a página soma o tempo desde runningSince e desenha .game-clock se clockMode != 'none'; api:src/edition-actions/h…`
Proposta: Derivar de um só lugar (regulamento) se a partida tem relógio operado; enquanto a mesa não tiver cronômetro, esconder .game-clock na página pública, não gravar runningSince e remover a confirmação de encerramento antecipado. Trocar 'aguardando o primeiro evento' por nada quando houver placar.

**[VPUB-09] Jogos de uma atlética não aparecem na página dela nem são filtráveis na agenda** — alta, feature ausente, esforço M, confirmado
Quem torce por uma atlética precisa abrir a agenda dia a dia e modalidade a modalidade para achar os jogos dela. A página da equipe mostra posição, V/E/D e elenco, mas não os jogos. A lista de equipes gasta quatro telas com escudos grandes, a contagem de atletas (zero em produção) e uma barra decorativa que parece progresso.
Evidência: `apps/web/app/components/PublicTeamDetailView.tsx:16 - a página tem cartão da equipe, Classificações e Elencos; nenhuma lista de jogos`; `apps/web/app/components/TeamPerformance.tsx:43 - 'N jogos na agenda' é texto, sem link; apps/web/app/components/MatchSchedule.tsx:12 - a agenda só filtra por modalidade …`
Proposta: Na página da equipe, abrir com 'Próximo jogo' e a lista 'Jogos' (todas as modalidades, por data, com placar). Na agenda, chip 'Equipe'. Na lista de equipes, grade de 2 colunas com escudo, nome e modalidades disputadas; remover a barra e a contagem zerada.

**[VPUB-10] Cartões da agenda pública não abrem a partida; na home e na categoria abrem** — alta, inconsistencia, esforço P, confirmado
O mesmo cartão de jogo é link na tela Ao vivo e na aba Jogos da categoria, mas é inerte na agenda 'Jogos', que é onde estão todos os resultados do dia. Para ver parciais de sets, pênaltis ou lances de um jogo encerrado, o espectador precisa refazer o caminho por Modalidades › categoria › Jogos e reencontrar a partida.
Evidência: `apps/web/app/components/MatchSchedule.tsx:47 - href={publicView ? undefined : ...}: na área pública o cartão vira <div>`; `apps/web/app/components/PublicMatchesHub.tsx:29 - a tela passa hrefBase='/public/matches', que é descartado`
Proposta: Passar href /public/matches/{id} também na agenda pública (MatchSchedule) e marcar a aba 'Jogos' como ativa na página da partida. No cartão encerrado de modalidade por sets, mostrar as parciais (25-18 · 25-20) sob o placar.

**[VPUB-11] Tabela anuncia 'desempate por sorteio' sem sorteio e diverge da página da equipe** — alta, precisao dados, esforço M, confirmado em parte
Antes de qualquer jogo a tabela já ordena as equipes por nome, pinta a primeira de verde e escreve 'desempate por sorteio' em todas. A página da equipe calcula a posição por outra regra (soma mata-mata, ignora grupo e regulamento) e mostra 3º onde a tabela mostra 1º (dados de demonstração). Linhas de ~98px com saldo em 9-10px.
Evidência: `apps/web/app/lib/tournament-engine.ts:89-91 - no critério 'sorteio' o bloco empatado é ordenado por nome e rotulado 'Sorteio'; apps/web/app/components/TournamentClassifi…`; `shots/publico/mobile/public_tournaments_futsal-m.png - Alcateia 1ª e Engenhosa 2ª com 0 jogos e 'desempate por sorteio'; linhas de ~98px, subtexto de 9-10px (globals.css…`
Proposta: Sem jogos, listar as equipes sem posição nem destaque. Só escrever o critério quando ele separou equipes; 'sorteio' aparece como 'empate: aguardando sorteio'. Página da equipe lê a mesma função da tabela. Linha de 48px com escudo e colunas J V E D SG PTS.
Correção do revisor: Engine:89-91 e TeamPerformance.tsx:19-24 conferem; Basquete em produção (standings []) cai nesse cálculo. Correção: após o primeiro resultado a tabela vem da API, que desempata por entryId sem rótulo (recalculation.service.ts:240); mostrar o critério exige backend.

- **[VPUB-12] Cartão de jogo omite fase e número; 'Vencedor do Jogo 16' fica sem referência** — média, ux, esforço M, confirmado em parte. `apps/web/app/components/MatchScoreCard.tsx:48-66 - o cartão imprime categoria, modalidade, data, selo, equipes, placar e local; não há fase, grupo, rodada nem número; Ma…`
- **[VPUB-13] Cabeçalho ocupa de 37% a 71% da primeira tela antes do conteúdo** — média, ux, esforço M, confirmado. `shots/publico/mobile/public_tournaments_futsal-m.png - primeira linha da tabela a ~598px de 840 úteis; antes dela: barra da edição, Voltar, migalhas, título, '‹ MODALIDA…`
- **[VPUB-14] Navegação pública: 'Modalidades' lista categorias e 'Artilharia' ocupa uma aba vazia** — média, inconsistencia, esforço M, confirmado. `apps/web/app/components/PublicAppShell.tsx:31-37 - cinco abas fixas, 'Artilharia' entre elas; EVIDENCIA_PRODUCAO.md: 0 de 2.689 eventos com atleta; shots/publico/mobile/…`
**[VPUB-R1] Tabela de Vôlei em produção ignora quase todos os jogos encerrados** — crítica, precisao dados, esforço M, achado pelo revisor
Em Vôlei masculino a API contou 1 dos 12 jogos de grupo encerrados e a tela pública mostra tabela vazia pedindo 'Distribua equipes em Fase de grupos'. Em Vôlei Feminino contou 2 de 11 e a Inquisidores, que venceu cinco jogos, não aparece. Jogo sem grupo, equipe sem grupo e fase 'Liga' com grupos são aceitos e ignorados em silêncio.
Evidência: `produção (MCP listar categorias 'Vôlei', 13/10): Vôlei masculino - standings da fase com 1 jogo contado (Inquisidores J1, Halterada J0); Vôlei Feminino - 4 equipes com J…`; `dados/jogos-producao.json - category-7213ebd17f31 tem 12 jogos de grupo encerrados (Halterada venceu 4) e category-a15edc3a59ed tem 11; 15 deles com phase 'Fase de grupo…`
Proposta: API: recusar jogo sem grupo em fase com grupos, equipe sem grupo e fase Liga com grupos; ao recalcular, devolver quantos jogos encerrados ficaram fora. Front: abas por phase.groups em qualquer formato e aviso ao admin 'N jogos fora da tabela'. Corrigir as duas categorias.

**[VPUB-R2] Jogo ainda não disputado aparece com placar 0 — 0 em produção** — alta, precisao dados, esforço P, achado pelo revisor
Na API o placar nasce 0×0 e o cartão só troca por traços quando o valor é nulo. Em produção os 40 jogos agendados — todos com data já passada — aparecem '0 — 0' com o selo PRÓXIMO, igual a um empate sem gols. A página da partida repete o 0 — 0. As capturas de demonstração escondem isso.
Evidência: `apps/web/app/components/MatchScoreCard.tsx:63 - {scoreA ?? '—'} — {scoreB ?? '—'}: só esconde placar nulo; MatchSummary.tsx:10 faz o mesmo teste de null`; `api:schema.prisma:463-464 (scoreA/scoreB Float @default(0)) e api:src/edition-snapshots/snapshot.mapper.ts:882 - a API sempre envia 0 para jogo agendado`
Proposta: No cartão e na página da partida, só exibir placar quando o estado for Ao vivo, Encerrada ou W.O. (hasStarted); antes disso, mostrar o horário no centro. Acrescentar teste e2e em modo API com jogo agendado de placar 0.

**[VPUB-R3] Categoria encerrada não mostra campeão nem pódio na área pública** — alta, feature ausente, esforço M, achado pelo revisor
Três categorias terminaram na Copa e em nenhum lugar da área pública está escrito quem ganhou. O cartão da lista continua com o selo 'Fase de grupos', a página da categoria abre na tabela de grupos e o chaveamento está vazio (VPUB-01). Para saber a campeã é preciso achar a final na aba Jogos e ler o placar.
Evidência: `apps/web/app/lib/tournament-progression.ts:42 - tournamentPodium() calcula campeão, vice e 3º; Grep: só é usada em lib/overall-ranking.ts:57 (bonificação interna)`; `apps/web/app/lib/edition-catalog.ts:53 e components/TournamentCard.tsx:25-26 - no cartão público o status é omitido e o selo é sempre phases[0].name ('Fase de grupos')`
Proposta: Na página pública da categoria encerrada, abrir com o bloco Campeã · Vice · 3º lugar (escudo e nome) vindo de tournamentPodium(). No cartão da lista, trocar o selo fixo por 'Encerrada · campeã X' ou pela fase em andamento derivada dos jogos.

**[VPUB-R4] Agenda do dia chega a 47 cartões: onze telas de rolagem** — alta, ux, esforço M, achado pelo revisor
A agenda desenha um cartão de ~199px por jogo, com escudos grandes, e mostra o dia inteiro em sequência. No dia mais cheio da Copa foram 47 jogos: cerca de onze telas para percorrer, a mesma lista usada pelo gestor para achar o jogo que vai operar. Filtrando por Futsal ainda são 23 cartões, mais de cinco telas.
Evidência: `dados/jogos-producao.json - 47 jogos em 12/10 (Futsal 23, Basquete 13, Vôlei 11) e 27 em 10/10`; `apps/web/app/components/MatchSchedule.tsx:31-33 e :47 - o dia vira lista plana de MatchCard ordenada por horário, sem agrupar, recolher encerrados ou filtrar por estado`
Proposta: Na agenda (pública e do gestor), linha compacta de ~64px por jogo — hora, escudos pequenos, nomes, placar, selo — agrupada por faixa de horário; chips Ao vivo · A seguir · Encerrados; ao abrir o dia de hoje, rolar até o primeiro jogo não encerrado.


Ideias de feature desta área:

- **Seguir minha atlética** (M)
- **Lançar resultado direto da súmula** (M)
- **Modo telão para o ginásio** (M)
- **Agenda em fila: Agora, A seguir, Depois** (M)
- **Pódio da categoria encerrada** (P)
- **Avisos da organização na área pública** (M)

## VADM — Auditoria visual: administração

**[VADM-01] Tela da equipe mostra posição e campanha diferentes da tabela da categoria** — alta, precisao dados, esforço M, confirmado
O cartão 'Classificações' da equipe recalcula a tabela no navegador juntando todos os grupos e o mata-mata, com 3/1/0 fixo. A aba Tabela usa a classificação oficial por grupo. A mesma equipe aparece em 3º com 1 jogo numa tela e em 1º com 0 jogos na outra, inclusive na página pública da equipe.
Evidência: `captura admin/mobile/teams_alcateia.png - cartão Futsal Masculino: POS 3º, J 1, E 1, PTS 1`; `captura admin/mobile/tournaments_futsal-m.png - aba Tabela, Grupo A: 1º Alcateia com J 0 e PTS 0`
Proposta: Fazer TeamPerformance ler a mesma fonte da aba Tabela (classificação oficial da fase, por grupo, com o regulamento da modalidade) e mostrar 'Nº do Grupo X'. Jogos de mata-mata saem dessa conta e viram linha própria, como 'Semifinal: classificada'.

**[VADM-02] W.O., adiamento e cancelamento ficam escondidos no seletor 'Estado da partida'** — alta, ux, esforço M, confirmado em parte
Registrar W.O. exige abrir o jogo, tocar em 'Editar partida', achar o seletor de estado, escolher W.O., escolher o vencedor, digitar o motivo, salvar e confirmar. Lista, detalhe e placar não oferecem atalho. No evento, os 8 W.O. de handebol viraram 10 gols clicados em jogo 'Encerrada': partida dada como disputada, com cerca de 80 gols inexistentes.
Evidência: `captura admin/mobile/matches_semifinal-1_manage.png - 'Estado da partida' é o último campo de Editar partida`; `apps/web/app/components/MatchManager.tsx:313 - W.O., Adiada e Cancelada são opções do select; vencedor e motivo só surgem depois (314-315)`
Proposta: No detalhe da partida agendada, substituir o seletor por três botões rotulados — 'Registrar W.O.', 'Adiar' e 'Cancelar' — cada um abrindo uma folha curta (vencedor e motivo pré-sugerido). Repetir 'Registrar W.O.' na tela de placar antes do início.
Correção do revisor: MatchManager.tsx:313 e live/page.tsx:603 conferem. Correções: são 7 jogos 10×0 de handebol, não 8; e o W.O. do app gravaria 1×0 (regra em produção), não 10×0 — tornar o botão visível não bastaria.

**[VADM-03] Estrutura da categoria trava no primeiro jogo e não há como corrigir depois** — alta, inconsistencia, esforço G, confirmado
A tela bloqueia pela situação da categoria; a API, pelo primeiro jogo operado. Em produção, Futsal Masculino ficou 'Publicado' com 7 jogos encerrados: campos aparentemente editáveis e toda alteração de estrutura recusada pelo servidor. Quando equipes entraram ou saíram, a organização editou jogo a jogo com justificativa e os desenvolvedores publicaram código durante o evento.
Evidência: `captura admin/mobile/tournaments_futsal-m_manage.png - 'A estrutura está bloqueada porque a categoria já começou' e nenhuma ação de correção`; `apps/web/app/components/TournamentManager.tsx:40 - a tela trava pela situação (isTournamentStarted)`
Proposta: Aplicar na tela a mesma regra do servidor e, com a estrutura travada, mostrar resumo de leitura mais três ações auditadas: 'Retirar equipe' (cancela os jogos pendentes dela), 'Incluir equipe em grupo' e 'Renomear grupo'.

**[VADM-04] Botões de excluir, revogar e remover e os erros de formulário estão invisíveis** — alta, bug, esforço P, confirmado
Na troca para a marca azul e verde, a variável de perigo passou a valer a cor do cartão. 'Desativar', 'Excluir', 'Revogar acesso', 'Excluir acesso', 'Remover fase' e 'Remover da equipe' ficam azul sobre azul, mas continuam clicáveis. O texto de erro de 'Novo acesso', 'Editar equipe' e 'Responsável da atlética' também some: o botão parece não responder.
Evidência: `apps/web/app/globals.css:21 - --pink: var(--card), o azul #1C2266 do cartão`; `apps/web/app/globals.css:3797 - .danger-button; :3810 .staff-revoke-button; :3806 .phase-remove-button; :3761 .roster-remove-button; :3603 .form-error — todos com color:…`
Proposta: Criar o token --danger dentro da paleta: contorno e texto brancos (#EFEFEE), com ícone e rótulo escrito; preenchido de branco ao tocar. Apontar para ele as regras que hoje usam --pink em texto ou borda (cerca de 17), incluindo .form-error.

**[VADM-05] Lista de jogos do admin: um dia de 47 jogos ocupa dez telas** — alta, ux, esforço M, confirmado
A agenda administrativa reaproveita o cartão do espectador: um jogo por faixa de cerca de 190px, sem fase ou grupo, sem filtro por estado e com só três rótulos (Próximo, Ao vivo, Encerrado). Em 12/10 eram 47 jogos no dia. Achar o que falta lançar exige rolar tudo; abrir o placar custa dois toques e uma tela intermediária.
Evidência: `captura admin/mobile/matches.png - 5 jogos em 1,8 tela; 2 cartões na primeira dobra`; `apps/web/app/components/MatchSchedule.tsx:47 - lista só por dia, sem filtro de estado, e zera a fase do cartão (phase: '')`
Proposta: Criar linha compacta para o staff (hora, grupo ou fase, siglas, placar, estado real) com ação direta 'Abrir placar' ou 'Lançar resultado'; filtros 'A lançar', 'Ao vivo' e 'Encerrados'; selo 'atrasado há N min'. No desktop, a mesma lista como tabela.

**[VADM-06] Novo jogo exige data, hora e local e recomeça do zero a cada jogo** — alta, ux, esforço M, confirmado
O formulário pede modalidade, categoria, equipes, data e hora e local digitado, e só aceita equipes reais. Vindo da categoria, é preciso escolhê-la de novo se a modalidade tiver duas. Ao salvar, volta para a agenda: uma rodada de vinte jogos são vinte formulários. A organização trabalha com 'a seguir' e local a definir, que a tela não representa.
Evidência: `captura admin/mobile/matches_new.png - 6 campos em 1,4 tela; 'Agendar jogo' desabilitado e abaixo da dobra`; `apps/web/app/components/MatchCreationForm.tsx:95 - data/hora e local obrigatórios; :139 equipes só entre inscritas; :122 volta à agenda ao salvar`
Proposta: Levar categoria e grupo no link; ordem: categoria, grupo ou fase, equipes do grupo, quando, onde; opções 'A seguir do jogo anterior' e local escolhido de uma lista da edição (com 'A definir'); botão 'Agendar e criar outro' mantendo o contexto.

- **[VADM-07] Gestão da categoria: página única de 5 telas, quase toda inerte após o início** — média, ux, esforço M, confirmado. `captura admin/mobile/tournaments_futsal-m_manage.png - 5,1 telas, 65 controles, 37 campos, 44 alvos menores que 44px (metricas.json)`
**[VADM-08] Painel inicial não mostra pendências e o 'próximo confronto' ignora data e hora** — alta, precisao dados, esforço M, confirmado
O Início gasta a primeira dobra com quatro contadores de cadastro. Nada avisa que há jogos vencidos sem resultado, placar aberto abandonado ou categoria a encerrar. 'Próximo confronto' é o primeiro agendado da lista, mesmo de dias atrás, e, com 0 atletas, o guia 'Montagem da edição' nunca some do topo.
Evidência: `captura admin/mobile/dashboard.png - quatro .stat-card de 176px (globals.css:349) tomam a primeira dobra`; `apps/web/app/dashboard/page.tsx:32 - 'próximo' é o primeiro jogo 'Agendada' na ordem do estado, sem olhar data`
Proposta: Trocar os contadores por um bloco 'Agora' (jogos ao vivo e há quanto tempo sem lance) e uma lista 'Precisa de atenção' com link: jogos vencidos sem resultado, placares parados, categorias a iniciar ou encerrar, pódios a lançar. 'Próximo' ordenado por data e hora.

**[VADM-09] Grupos, fases e nomes entram como texto livre e geram estrutura inconsistente** — alta, precisao dados, esforço M, confirmado
Nomes de grupo são digitados separados por vírgula, o nome da fase não tem relação com o formato escolhido e nada sinaliza equipe inscrita sem grupo. Ordem do sorteio, nome de fase e classificados enviam uma gravação por tecla, e o campo só reflete o valor quando o servidor responde — em rede lenta, pode engolir caracteres.
Evidência: `captura admin/desktop/tournaments_futsal-m_manage.png - 'Grupos' é campo de texto ('Grupo A, Grupo B'); nome da fase e 'Formato' são independentes`; `apps/web/app/components/TournamentManager.tsx:126 - grupos por split(','); :110 fase nova nasce 'Grupos' com nome livre; :301 'Definir grupo' sem alerta de equipe sem gr…`
Proposta: Usar controles fechados: modelos de estrutura (Grupos + mata-mata, Liga, Só mata-mata), contador que gera 'Grupo A…D', distribuição por botões com alerta 'N sem grupo' e sufixo de categoria por chips (Masculino, Feminino, Misto). Campos de texto com rascunho local, gravados ao sair.

- **[VADM-10] Cabeçalho consome de 32% a 51% da primeira dobra e triplica o 'voltar'** — média, ux, esforço M, confirmado. `captura admin/mobile/tournaments_futsal-m_manage__aba-jogos.png - abas a 397px e primeiro jogo a 607px de 915; um jogo na dobra`
- **[VADM-11] Equipes: duas por tela, barra sem significado e elenco cadastrado um a um** — média, ux, esforço M, confirmado. `captura admin/mobile/teams.png - 16 equipes em 4,1 telas, fora de ordem alfabética; admin/desktop/teams.png - 4,7 telas`
- **[VADM-12] Classificação geral mistura ranking, regulamento e lançamentos em 4,6 telas** — média, ux, esforço M, confirmado. `captura admin/mobile/standings.png - 16 linhas '1' com 0 pts; 4,6 telas, 20 campos, 58 textos abaixo de 12px (metricas.json)`
- **[VADM-13] No desktop a área interna é uma coluna de 760px com barra inferior** — baixa, ux, esforço G, confirmado. `apps/web/app/globals.css:830 - .management-screen max-width 760px e .bottom-nav 760px a partir de 900px`
- **[VADM-14] Auditoria mostra só hora e 100 registros; telas de bloqueio não explicam nem devolvem** — média, ux, esforço M, confirmado. `captura super/mobile/audit.png - filtros Tudo/Partidas/Cadastros e funil que só limpa o filtro (apps/web/app/audit/page.tsx:22)`
**[VADM-R1] Confrontos repetidos e chave abandonada em produção; app não avisa, não exclui nem move** — crítica, precisao dados, esforço M, achado pelo revisor
Em Vôlei Feminino convivem 10 jogos de 'Montar os jogos' com jogos importados e manuais do mesmo confronto. Sem excluir, e com 'Cancelada' escondida no seletor de estado, duas duplicatas foram encerradas em 12/10 com sets 25×1 e 10×26, uma com vencedor oposto ao jogo real. No Masculino, a chave gerada ficou 'Agendada' e cinco jogos foram criados à mão.
Evidência: `producao (dados/jogos-producao.json) category-7213ebd17f31: '-generated-8' Inquisidores × Furiosa 0×2 (sets 12-25 e 10-26), 73 lances em 12/10 07:42-07:43; o mesmo confr…`; `producao category-a15edc3a59ed: 4 jogos '-advanced-' (chave) seguem 'Agendada' com data 11/10; 5 jogos 'match-…' (formulário, local 'Ginásio UFPE') encerrados em 12/10 1…`
Proposta: Em 'Novo jogo' e 'Montar os jogos', mostrar jogos já existentes do mesmo confronto e oferecer abrir o existente. Em 'Editar partida' agendada, incluir 'Fase ou grupo' e 'Excluir jogo', ações que a API já aceita. Na aba Tabela, listar 'jogos fora da tabela'.

**[VADM-R2] Auditoria grava tipo técnico e batimento do placar; registros úteis somem em minutos** — alta, contrato api, esforço M, achado pelo revisor
O servidor registra toda ação — cada ponto, cada ajuste de relógio e o batimento de 15 s do operador — com o tipo técnico e um id, e descarta o texto em português que a tela envia. Com um placar aberto, os 100 registros viram ruído em 25 minutos; o filtro 'Partidas' fica vazio; quem alterou um resultado não é localizável.
Evidência: `api:src/edition-actions/edition-actions.service.ts:342-352 - toda ação cria audit_log com action = tipo técnico ('match/registerEvent') e entityType/entityId; o rótulo e…`; `apps/web/app/matches/live/page.tsx:141 - 'match/claimOperator' a cada 15 s com o placar aberto; segue o mesmo caminho: registro de auditoria, revisão da edição +1 (editi…`
Proposta: Gravar no audit_log o rótulo e a entidade que a tela já envia; não auditar o batimento do operador nem fazê-lo incrementar a revisão da edição; agrupar os lances por partida. Na tela, filtrar pelo tipo da ação.

- **[VADM-R3] Retificação de placar aparece como JSON cru e aceita envio repetido** — média, bug, esforço P, achado pelo revisor. `producao: Vôlei Inquisidores × Furiosa - corrections[0] before '{"scoreA":0,"scoreB":3}' e after '{"scoreA":0,"scoreB":2}' às 10:44:00; corrections[1] às 10:44:08 com be…`
**[VADM-R4] Placar de W.O. do regulamento não bate com o torneio: vôlei 3×0, handebol 1×0** — alta, precisao dados, esforço P, achado pelo revisor
O placar de W.O. vem de um preset por esporte e não acompanha o resto do regulamento. Em produção, o vôlei é melhor de três, mas o W.O. gravaria 3×0; no handebol gravaria 1×0, e a organização lançou 10×0 nos sete jogos sem adversário. Só tornar o W.O. visível produziria saldo diferente do usado no evento.
Evidência: `producao (rules de cada jogo em dados/jogos-producao.json): Vôlei com completion.setsToWin = 2 e walkover.winnerScore = 3 nos 28 jogos; Handebol com walkover 1×0 nos 24 …`; `producao: 7 jogos de handebol lançados como 10×0 ou 0×10 com exatamente 10 lances em 0-1 min, status 'Encerrada'; nenhum jogo com status 'W.O.'`
Proposta: Em 'Editar regras', limitar o W.O. do vôlei a 'sets para vencer' e avisar quando ficar incoerente. Na ação 'Registrar W.O.', mostrar o placar que será gravado antes de confirmar, com atalho para ajustar o regulamento. Incluir o W.O. no guia de montagem.


Ideias de feature desta área:

- **Grade de horários em lote por dia e quadra** (G)
- **Súmula e agenda do dia para imprimir e compartilhar** (M)
- **Convite por link e redefinição de senha pela tela de Staff** (M)
- **Encerramento guiado do dia e da edição** (M)
- **Histórico da partida visível ao admin da edição e ao gestor** (M)
- **Modalidade com nome livre a partir de um modelo de regra** (M)
