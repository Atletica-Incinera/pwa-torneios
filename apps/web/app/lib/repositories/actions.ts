import type { AthleteState, AuditState, CompetitionState, DisciplineState, EditionState, MatchCorrectionState, MatchEventState, MatchScoreSnapshot, MatchState, OverallAwardState, OverallClosureState, OverallMetricState, OverallPosition, StaffState, TeamState, TournamentState } from '../frontend-state.ts';

/** O que a auditoria registra sobre a operação. Autor e horário entram no reducer. */
export type ActionAudit = Omit<AuditState, 'id' | 'at' | 'actor'>;

type WithAudit = { audit?: ActionAudit };

/**
 * Operações de partida.
 *
 * Os payloads carregam o resultado já calculado pelo regulamento (placar, etapa,
 * evento). Quando o servidor entrar, ele recalcula com os mesmos módulos puros e
 * a resposta dele passa a ser a verdade — o formato não muda.
 */
export type MatchAction =
  | (WithAudit & { type: 'match/schedule'; payload: { id: string; match: MatchState } })
  /** Reagendamento, mudança de estado, W.O. e ajustes de operação do placar. */
  | (WithAudit & { type: 'match/update'; payload: { id: string; patch: Partial<MatchState>; cascade?: boolean } })
  /** Confirmação de início: é o que faz o placar passar a valer. */
  | (WithAudit & { type: 'match/start'; payload: { id: string; patch: Partial<MatchState> } })
  /** Relógio e etapa: retomar, pausar, encerrar tempo, avançar, prorrogação. */
  | (WithAudit & { type: 'match/updateClock'; payload: { id: string; patch: Partial<MatchState> } })
  | (WithAudit & { type: 'match/registerEvent'; payload: { id: string; event: MatchEventState; patch: Partial<MatchState>; periodResult?: { period: number; scoreA: number; scoreB: number } } })
  /** Trava do operador: o reducer decide se renova, ignora ou recusa. */
  | (WithAudit & { type: 'match/claimOperator'; payload: { id: string; operatorId: string; operatorName: string; force?: boolean } })
  | (WithAudit & { type: 'match/releaseOperator'; payload: { id: string; operatorId: string } })
  | (WithAudit & { type: 'match/undoEvent'; payload: { id: string; eventId: string; restore: MatchScoreSnapshot } })
  | (WithAudit & { type: 'match/finish'; payload: { id: string; patch: Partial<MatchState> } })
  | (WithAudit & { type: 'match/correctResult'; payload: { id: string; scoreA: number; scoreB: number; correction: MatchCorrectionState } });

/** Operações de categoria (a disputa dentro de uma modalidade). */
export type CategoryAction =
  | (WithAudit & { type: 'category/create'; payload: { id: string; category: TournamentState } })
  /** Participantes, seeds, fases, avanço, publicação e nome. */
  | (WithAudit & { type: 'category/update'; payload: { id: string; setup: TournamentState } })
  /**
   * Gera os confrontos e substitui o que havia sido gerado antes — inclusive o
   * mata-mata já avançado, que deixa de valer quando a chave é refeita.
   */
  | (WithAudit & { type: 'category/generateMatches'; payload: { id: string; setup: TournamentState; matches: Record<string, MatchState> } });

/** Operações de modalidade (o esporte e seu regulamento). */
export type DisciplineAction =
  | (WithAudit & { type: 'discipline/update'; payload: { name: string; patch: Partial<DisciplineState> } })
  /**
   * Exclusao de verdade, distinta de `enabled: false`. A API recusa quando algo
   * ainda depende da modalidade e diz o que e — categoria, elenco, gestor com
   * escopo nela ou pontuacao no ranking geral.
   */
  | (WithAudit & { type: 'discipline/delete'; payload: { name: string } });

/**
 * Operações de equipe e de atleta.
 *
 * Remover não apaga: a equipe é arquivada e o atleta sai do elenco marcado como
 * `removed`, para o histórico da edição continuar de pé.
 */
export type TeamAction =
  | (WithAudit & { type: 'team/create'; payload: { id: string; team: TeamState } })
  | (WithAudit & {
      type: 'team/update';
      // `logo: null` remove o escudo. Precisa ser distinto de omitir o campo:
      // patch sem `logo` nao mexe no escudo. `TeamState` sozinho nao expressa
      // isso, porque la o escudo e string ou ausente.
      payload: { id: string; patch: Omit<Partial<TeamState>, 'logo'> & { logo?: string | null } };
    });

export type AthleteAction =
  | (WithAudit & { type: 'athlete/create'; payload: { id: string; athlete: AthleteState } })
  | (WithAudit & { type: 'athlete/update'; payload: { id: string; patch: Partial<AthleteState> } });

/**
 * Operações do ranking geral da edição.
 *
 * Bonificação lançada não some: estornar marca o lançamento e mantém motivo e
 * responsável. Fechar a edição é o que transforma a classificação em oficial.
 */
export type RankingAction =
  | (WithAudit & { type: 'ranking/addMetric'; payload: { metric: OverallMetricState } })
  /**
   * `position: null` limpa a coluna — voltar a métrica para "Manual". Ausente
   * preserva o que estava lá: `JSON.stringify` descarta chaves `undefined`, e
   * mandar undefined chegava ao servidor como "não mexa", nunca como "limpe".
   */
  | (WithAudit & { type: 'ranking/updateMetric'; payload: { metricId: string; patch: Partial<Omit<OverallMetricState, 'position'>> & { position?: OverallPosition | null } } })
  | (WithAudit & { type: 'ranking/removeMetric'; payload: { metricId: string } })
  /** Um lançamento manual ou o lote vindo dos pódios oficiais. */
  | (WithAudit & { type: 'ranking/addAwards'; payload: { awards: OverallAwardState[] } })
  | (WithAudit & { type: 'ranking/revokeAward'; payload: { id: string; revokedAt: string; revokedBy: string; revokeReason: string } })
  /**
   * Cria as quatro métricas padrão numa edição que ainda não tem nenhuma.
   *
   * Semear na criação da edição não alcança a que já existe — e é justamente
   * essa que está em produção, sem métrica nenhuma e portanto sem pontuar nada
   * na classificação geral. Idempotente: o segundo disparo não duplica.
   */
  | (WithAudit & { type: 'ranking/seedDefaultMetrics'; payload: { editionId: string } })
  | (WithAudit & { type: 'ranking/close'; payload: { closure: OverallClosureState } })
  | (WithAudit & { type: 'ranking/reopen'; payload: { editionId: string } });

/**
 * Torneio e edição — o contexto que todo o resto usa.
 *
 * Ativar é exclusivo: só um torneio e só uma edição por torneio ficam ativos,
 * e é o reducer que garante isso, não a tela.
 */
export type CompetitionAction =
  /** O torneio nasce junto da primeira edição: um sem o outro não navega. */
  | (WithAudit & { type: 'competition/create'; payload: { competition: CompetitionState; edition: EditionState } })
  | (WithAudit & { type: 'competition/rename'; payload: { id: string; name: string } })
  | (WithAudit & { type: 'competition/activate'; payload: { id: string } });

export type EditionAction =
  | (WithAudit & { type: 'edition/create'; payload: { edition: EditionState } })
  /** Período e situação da edição. */
  | (WithAudit & { type: 'edition/update'; payload: { id: string; patch: Partial<EditionState> } })
  | (WithAudit & { type: 'edition/activate'; payload: { id: string } });

/**
 * Acesso de staff. A chave é o e-mail, e o registro é gravado inteiro: parte do
 * staff vem semeada da edição e ainda não existe no estado quando é alterada.
 */
export type StaffAction =
  | (WithAudit & { type: 'staff/upsert'; payload: { email: string; member: StaffState } })
  /** Exclusao de verdade, distinta de `revoked: true`. */
  | (WithAudit & { type: 'staff/remove'; payload: { email: string } })
  /**
   * Super admin não é um papel de edição — é a flag global da conta, sem
   * escopo nem modalidade. Cria a conta se o e-mail ainda não existir.
   */
  | (WithAudit & { type: 'staff/promoteSuperAdmin'; payload: { email: string; name: string } });

/**
 * Toda mutação que o app sabe fazer. Todo payload é serializável: esta união é,
 * na prática, a lista de endpoints que o backend precisa oferecer.
 */
export type Action = MatchAction | CategoryAction | DisciplineAction | TeamAction | AthleteAction | RankingAction | CompetitionAction | EditionAction | StaffAction;
