# Regras de negócio — InterEng

Este documento registra as regras aplicadas no app e, principalmente, **os padrões que foram escolhidos**. Quase tudo aqui é configurável pela interface: o padrão é ponto de partida, não decisão fechada.

## Vocabulário

Duas palavras, sem sinônimos: **Modalidade** é o esporte (Futsal) e carrega o regulamento; **Categoria** é a disputa dentro dele (Futsal Masculino) e carrega participantes, fases e chaveamento.

```
Admin    Início · Modalidades · Jogos · Equipes · Mais
              └ Futsal → Futsal Masculino
                          └ Tabela │ Jogos │ Fases │ Participantes │ Regras

Público  Ao vivo · Modalidades · Equipes
                    └ Futsal Masculino
                        └ Agenda │ Tabela │ Resultados │ Fases
```

Fonte da verdade em código: o pacote `@atletica-incinera/intereng-contract`,
publicado a partir de `packages/intereng-contract/` e consumido pelos dois
lados. **A API importa estas regras, não as reescreve** — foi para isso que
elas saíram do front.

| Assunto | Módulo |
| --- | --- |
| Regulamento esportivo por modalidade | `src/modules/regulation.ts` |
| Conflito de agenda | `src/modules/scheduling-rules.ts` |
| Ciclo de vida da partida | `src/modules/match-lifecycle.ts` |
| Classificação e desempate | `src/modules/tournament-engine.ts` |
| Chaveamento, byes e 3º lugar | `src/modules/bracket-rules.ts` |
| Elegibilidade de equipe e atleta | `src/modules/eligibility.ts` |
| Ranking geral | `src/modules/overall-ranking.ts` |
| Publicação | `src/modules/publication.ts` |

Todos saem por `@atletica-incinera/intereng-contract/rules`.

---

## 1. Críticas antes de operar partidas reais

### Conflito de agenda

Toda partida nova ou reagendada é comparada com a agenda inteira da edição — inclusive os jogos do catálogo inicial, que antes eram ignorados.

| Crítica | Comportamento |
| --- | --- |
| Fora do período da edição | Bloqueia |
| Confronto repetido no mesmo horário | Bloqueia |
| Quadra ocupada | Bloqueia |
| Equipe em dois jogos ao mesmo tempo | Bloqueia |
| Equipe sem descanso mínimo | Aviso; ao confirmar, o alerta vai sozinho para a auditoria |

**Padrões escolhidos:** 15 min de troca entre jogos na mesma quadra, 60 min de descanso mínimo por equipe. A duração de cada jogo vem do regulamento da modalidade (Futsal 45 min, Basquete 30 min, Vôlei 125 min, Xadrez 60 min).

### Fluxo de status

`Agendada → Ao vivo → Encerrada`, com saídas controladas:

| Estado | Exige | Consequência |
| --- | --- | --- |
| Adiada | motivo + nova data/horário | sai do resultado oficial, volta ao calendário |
| Cancelada | motivo | não conta na classificação, libera a quadra |
| W.O. | motivo + equipe vencedora | aplica placar regulamentar e conta como resultado oficial |

`Encerrada`, `Cancelada` e `W.O.` são terminais. O responsável já vinha da sessão; o motivo agora vai junto no registro de auditoria.

**Padrão de W.O.:** Futsal/Handebol/Xadrez/Natação 1×0, Vôlei 3×0 (sets), Basquete 20×0 (FIBA).

### Início confirmado

Abrir a tela do placar não inicia mais nada — o operador confirma o início em um clique. Fora da janela prevista (**30 min antes / 180 min depois**) a confirmação avisa do desvio, e o próprio app grava "início X min após o previsto" na partida e na auditoria. Não há texto a digitar: o horário previsto e o real já são conhecidos.

### Empate em mata-mata

Uma partida eliminatória empatada não encerra. O operador precisa registrar critério, placar do desempate, equipe classificada e motivo. A progressão do chaveamento fica parada até isso existir — nenhum vencedor é inventado.

**Padrão por modalidade:** Futsal e Handebol nos pênaltis, Basquete na prorrogação, Vôlei em set extra, Xadrez e Natação por critério técnico do regulamento.

### Correção de resultado

Partida encerrada tem fluxo próprio de retificação: novo placar, motivo obrigatório, registro em `corrections` e recálculo. Antes de aplicar, o app mostra o impacto:

- confrontos seguintes **ainda não iniciados** são apagados e regerados;
- confrontos seguintes **já operados** bloqueiam a correção até serem anulados.

---

## 2. Regras por modalidade

Configuráveis em *Modalidades → (modalidade) → Regras da modalidade*.

| Modalidade | Pontuação | Encerramento | Elenco | Classificação |
| --- | --- | --- | --- | --- |
| Futsal | Gol (1) | 2 tempos, admite empate | 5–12 | 3/1/0 |
| Handebol | Gol (1) | 2 tempos, admite empate | 7–14 | 3/1/0 |
| Basquete | Lance livre (1), Cesta de 2, Cesta de 3 | 2 tempos, **sem empate**, 1 prorrogação de 5 min | 5–12 | 2/0/1 (FIBA) |
| Vôlei | Ponto (1) | melhor de 5 sets, 25 pontos (15 no decisivo), vantagem 2 | 6–12 | 3/0/0 |
| Xadrez | Ponto (1) | resultado da rodada | não exige | 1/0,5/0 |
| Natação | Resultado (1) | resultado único da prova | 1–8 | 3/1/0 |

- **Eventos válidos:** cada modalidade declara sua lista. Cartão só existe onde foi declarado; cada evento diz se pode ser registrado com o relógio parado e quanto pesa no fair play.
- **Sem cronômetro:** Xadrez e Natação declaram o resultado da mesa/prova em vez de um contador genérico.
- **Validação de período:** avançar antes do fim válido (tempo cheio ou set decidido) exige a ação explícita de encerramento antecipado — uma confirmação. O período e o relógio ficam gravados no evento.

---

## 3. Classificação e fases

- **Pontuação e desempate configuráveis** por modalidade, com a ordem dos critérios definida na interface. Suportados: confronto direto, vitórias, saldo, pontos marcados, pontos sofridos, fair play e sorteio.
- **Desempate auditável:** cada linha da tabela mostra qual critério definiu a posição, inclusive em empates de três ou mais equipes (o confronto direto usa a mini-tabela só entre as empatadas).
- **Critério de avanço explícito:** quantas equipes avançam por grupo, quantos melhores terceiros, tipo de cruzamento e se há disputa de 3º lugar.
- **Chaveamento:** respeita seeding, faz cruzamento olímpico (1º × último seed) ou sequencial, distribui byes aos melhores seeds e gera as rodadas seguintes automaticamente.
- **Regeneração segura:** com confrontos já fora do estado *Agendada*, regerar exige anulação explícita com motivo registrado.
- **Recálculo:** corrigir um resultado sinaliza as fases impactadas e impede inconsistência com partidas já avançadas.

---

## 4. Inscrição de equipes e atletas

- **Equipe:** a inscrição na categoria é a fonte da agenda **assim que a disputa é configurada**. Enquanto ninguém definiu participantes, a tela de novo jogo oferece as equipes da edição e avisa disso — uma disputa recém-criada não fica impossível de operar.
- **Atleta:** a associação à modalidade define quem conta no elenco daquela modalidade. Elenco fora do mínimo/máximo **avisa, mas não bloqueia** o agendamento nem o início da disputa: no InterEng o elenco costuma ser preenchido depois da agenda.
- **Escalação por partida está fora do escopo:** os eventos do placar são atribuídos à equipe, não ao atleta.
- **Limites:** mínimo, máximo e obrigatoriedade de elenco são declarados por modalidade e aparecem como aviso na equipe e na disputa.
- **Bloqueio após início:** cada modalidade escolhe quando o elenco trava — nunca, no início da modalidade ou no início do mata-mata. **Padrão:** coletivas travam no mata-mata, Natação trava no início, Xadrez não trava.

---

## 5. Ranking geral

- **Anti-duplicidade:** a mesma métrica não é lançada duas vezes para a mesma equipe na mesma modalidade. Depois de estornada, volta a ficar disponível.
- **Estorno:** lançamentos não são apagados. Ficam registrados como estornados, com motivo e responsável, e saem do cálculo.
- **Fechamento:** a classificação geral pode ser fechada e vira oficial. Depois disso qualquer alteração exige motivo e aparece como retificação.
- **Automático x manual:** métricas com posição declarada (campeão, vice, terceiro, participação) saem do pódio das disputas encerradas. As demais continuam sendo lançamento manual do admin.

---

## 6. Governança e operação

- **Fonte da verdade:** as regras estão isoladas em `app/lib/*` justamente para serem reaproveitadas pelo backend. Enquanto ele não existe, o LocalStorage não garante concorrência entre dispositivos — a validação é de interface, não de servidor.
- **Trava de operador:** heartbeat de 30 s, com ações explícitas de assumir (com confirmação e auditoria) e liberar a operação.
- **Auditoria:** ações sensíveis gravam antes, depois e o motivo das exceções. A tela **nunca exibe registro de exemplo**: uma entrada inventada ali seria lida como alteração real, com nome de pessoa e placar que não aconteceram.
- **Nada de número decorativo:** contagem de elenco, inscritos, progresso da categoria e tabela de classificação saem sempre do dado real. Quando não há dado, a tela diz que está pendente em vez de preencher com um valor plausível.
- **Publicação:** `Rascunho`, `Publicado`, `Em andamento`, `Encerrado` e `Arquivado`. A área pública mostra apenas disputas publicadas e resultados oficiais (`Encerrada` e `W.O.`).

---

## Onde o app pede texto digitado

Só quando o motivo é a única fonte da informação — o app não tem como deduzi-lo:

- retificação de resultado encerrado;
- anulação de confrontos com resultado para regerar a chave;
- estorno de bonificação;
- reabertura ou alteração do ranking geral já fechado.

Operar uma partida do início ao fim não exige digitar nada: são duas confirmações (iniciar e encerrar), mais o desempate quando a eliminatória termina empatada.

## Pendências conhecidas

- As regras rodam no cliente. Conflito de agenda, permissão e consistência entre dispositivos só ficam garantidos quando o backend assumir estas mesmas validações.
- A recuperação automática quando o operador cai depende do heartbeat local: em outro dispositivo é preciso assumir a operação manualmente.
