import { initialFrontendState, type FrontendState, type MatchState, type TeamState } from '../frontend-state.ts';
import { createId } from '../create-id.ts';
import { clearDownstream, progressTournament } from '../tournament-progression.ts';
import { evaluateOperatorLock } from '../match-lifecycle.ts';
import type { Action } from './actions.ts';

/** Quem está executando a ação — entra no registro de auditoria. */
export type ActionContext = { actor: string };

function patchMatch(current: FrontendState, id: string, patch: Partial<MatchState>): FrontendState {
  return { ...current, matches: { ...current.matches, [id]: { ...current.matches[id], ...patch } } };
}

/**
 * Encerrar ou retificar uma partida tem consequência no chaveamento: a rodada
 * seguinte nasce daí. A cascata é parte da operação, não um efeito solto.
 */
function cascade(state: FrontendState, id: string): FrontendState {
  return progressTournament(state, state.matches[id]?.tournamentId);
}

function reduce(current: FrontendState, action: Action): FrontendState {
  switch (action.type) {
    case 'match/schedule':
      return { ...current, matches: { ...current.matches, [action.payload.id]: action.payload.match } };

    case 'match/update': {
      const next = patchMatch(current, action.payload.id, action.payload.patch);
      return action.payload.cascade ? cascade(next, action.payload.id) : next;
    }

    case 'match/start':
    case 'match/updateClock':
      return patchMatch(current, action.payload.id, action.payload.patch);

    case 'match/claimOperator': {
      const { id, operatorId, operatorName, force } = action.payload;
      const active = current.matches[id] ?? {};
      // Sem `force`, respeita a trava de quem já está operando e a folga de renovação.
      if (!force && evaluateOperatorLock(active, operatorId) !== 'renew') return current;
      return patchMatch(current, id, { operatorId, operatorName, operatorHeartbeat: new Date().toISOString() });
    }

    case 'match/releaseOperator': {
      const { id, operatorId } = action.payload;
      // Só quem detém a trava a libera: sair da tela não derruba outro operador.
      if (current.matches[id]?.operatorId !== operatorId) return current;
      return patchMatch(current, id, { operatorId: undefined, operatorName: undefined, operatorHeartbeat: undefined });
    }

    case 'team/create':
      return { ...current, teams: { ...current.teams, [action.payload.id]: action.payload.team } };

    case 'team/update': {
      // `logo: null` chega do formulario como remocao; no estado local isso e
      // simplesmente ausencia de escudo, que e o que os componentes esperam.
      const { logo, ...resto } = action.payload.patch;
      const patch: Partial<TeamState> =
        logo === null ? { ...resto, logo: undefined } : { ...resto, ...(logo !== undefined ? { logo } : {}) };
      return { ...current, teams: { ...current.teams, [action.payload.id]: { ...current.teams[action.payload.id], ...patch } } };
    }

    case 'athlete/create':
      return { ...current, athletes: { ...current.athletes, [action.payload.id]: action.payload.athlete } };

    case 'athlete/update':
      return { ...current, athletes: { ...current.athletes, [action.payload.id]: { ...current.athletes[action.payload.id], ...action.payload.patch } } };

    case 'category/create':
      return { ...current, tournaments: { ...current.tournaments, [action.payload.id]: action.payload.category } };

    case 'category/update':
      return { ...current, tournaments: { ...current.tournaments, [action.payload.id]: action.payload.setup } };

    case 'category/generateMatches': {
      const { id, setup, matches } = action.payload;
      // Confrontos antigos desta categoria saem: os gerados e o mata-mata que veio deles.
      const retained = Object.fromEntries(Object.entries(current.matches).filter(([matchId]) => !matchId.startsWith(`${id}-generated-`) && !matchId.startsWith(`${id}-advanced`)));
      return { ...current, tournaments: { ...current.tournaments, [id]: setup }, matches: { ...retained, ...matches } };
    }

    case 'discipline/update': {
      const { name, patch } = action.payload;
      return { ...current, disciplines: { ...current.disciplines, [name]: { ...current.disciplines[name], ...patch } } };
    }

    case 'competition/create': {
      const { competition, edition } = action.payload;
      return { ...current, competitions: [...current.competitions, competition], editions: [edition, ...current.editions] };
    }

    case 'competition/rename':
      return { ...current, competitions: current.competitions.map((item) => item.id === action.payload.id ? { ...item, name: action.payload.name } : item) };

    case 'competition/activate':
      // Contexto é exclusivo: ativar um torneio desativa os demais.
      return { ...current, competitions: current.competitions.map((item) => ({ ...item, active: item.id === action.payload.id })) };

    case 'edition/create':
      return { ...current, editions: [action.payload.edition, ...current.editions] };

    case 'edition/update':
      return { ...current, editions: current.editions.map((item) => item.id === action.payload.id ? { ...item, ...action.payload.patch } : item) };

    case 'edition/activate':
      return { ...current, editions: current.editions.map((item) => ({ ...item, active: item.id === action.payload.id })) };

    case 'staff/upsert':
      return { ...current, staff: { ...current.staff, [action.payload.email]: action.payload.member } };

    // O modo local não modela super admin como uma entrada de state.staff — é
    // o usuário de demonstração fixo em demoUsers, fora deste estado. Só a
    // API real (staff/promoteSuperAdmin no backend) tem efeito de verdade;
    // aqui é só o toast de sucesso que a tela mostra.
    case 'staff/promoteSuperAdmin':
      return current;

    case 'ranking/addMetric':
      return { ...current, overallRanking: { ...current.overallRanking, metrics: [...current.overallRanking.metrics, action.payload.metric] } };

    case 'ranking/updateMetric': {
      const { metricId, patch } = action.payload;
      // `position: null` é o único jeito de LIMPAR a coluna, e o servidor a
      // distingue de ausente. Aqui `{ ...metric, ...patch }` gravaria o próprio
      // null, que não é um `OverallPosition` — a limpeza vira `undefined`.
      const { position, ...rest } = patch;
      const applied = position === null ? { ...rest, position: undefined } : { ...rest, ...(position === undefined ? {} : { position }) };
      return { ...current, overallRanking: { ...current.overallRanking, metrics: current.overallRanking.metrics.map((metric) => metric.id === metricId ? { ...metric, ...applied } : metric) } };
    }

    case 'ranking/removeMetric':
      return { ...current, overallRanking: { ...current.overallRanking, metrics: current.overallRanking.metrics.filter((metric) => metric.id !== action.payload.metricId) } };

    case 'ranking/addAwards':
      // O mais recente primeiro: a auditoria de lançamentos é lida de cima para baixo.
      return { ...current, overallRanking: { ...current.overallRanking, awards: [...action.payload.awards, ...current.overallRanking.awards] } };

    case 'ranking/revokeAward': {
      const { id, revokedAt, revokedBy, revokeReason } = action.payload;
      // Estorno não apaga o lançamento: marca-o, com motivo e responsável.
      return { ...current, overallRanking: { ...current.overallRanking, awards: current.overallRanking.awards.map((award) => award.id === id ? { ...award, revokedAt, revokedBy, revokeReason } : award) } };
    }

    // No modo local as métricas já vêm semeadas no estado inicial, então não há
    // o que criar: quem precisa desta ação é o banco de produção, que nasceu
    // vazio. A tela só oferece o botão quando a lista está de fato vazia.
    case 'ranking/seedDefaultMetrics':
      return current.overallRanking.metrics.length
        ? current
        : { ...current, overallRanking: { ...current.overallRanking, metrics: initialFrontendState.overallRanking.metrics } };

    case 'ranking/close':
      return { ...current, overallRanking: { ...current.overallRanking, closures: [...(current.overallRanking.closures ?? []), action.payload.closure] } };

    case 'ranking/reopen':
      return { ...current, overallRanking: { ...current.overallRanking, closures: (current.overallRanking.closures ?? []).filter((item) => item.editionId !== action.payload.editionId) } };

    case 'match/registerEvent': {
      const { id, event, patch, periodResult } = action.payload;
      const stored = current.matches[id] ?? {};
      const periodResults = periodResult ? [...(stored.periodResults ?? []), periodResult] : stored.periodResults;
      return patchMatch(current, id, { ...patch, periodResults, events: [event, ...(stored.events ?? [])] });
    }

    case 'match/undoEvent': {
      const { id, eventId, restore } = action.payload;
      const stored = current.matches[id] ?? {};
      return patchMatch(current, id, {
        ...restore,
        // Desfazer o ponto que fechou um set também apaga a parcial registrada.
        periodResults: (stored.periodResults ?? []).filter((item) => item.period < restore.currentPeriod),
        events: (stored.events ?? []).filter((item) => item.id !== eventId),
      });
    }

    case 'match/finish':
      return cascade(patchMatch(current, action.payload.id, action.payload.patch), action.payload.id);

    case 'match/correctResult': {
      const { id, scoreA, scoreB, correction } = action.payload;
      const cleared = clearDownstream(current, id);
      const stored = cleared.matches[id] ?? {};
      const corrected = patchMatch(cleared, id, {
        scoreA,
        scoreB,
        // Placar que deixou de ser empate não guarda mais o desempate anterior.
        tiebreak: scoreA === scoreB ? stored.tiebreak : undefined,
        corrections: [...(stored.corrections ?? []), correction],
      });
      return cascade(corrected, id);
    }

    default:
      return current;
  }
}

/**
 * Aplica uma ação sobre o estado e anexa o registro de auditoria.
 *
 * É o único lugar que sabe transformar estado. O adaptador local roda isto no
 * navegador; o adaptador HTTP deixará o servidor rodar o equivalente e apenas
 * absorverá a resposta.
 */
export function applyAction(current: FrontendState, action: Action, context: ActionContext): FrontendState {
  const updated = reduce(current, action);
  // Ação que não mudou nada e não registra auditoria não precisa gravar.
  if (updated === current && !action.audit) return current;
  if (!action.audit) return updated;
  return {
    ...updated,
    audit: [{ id: createId('audit'), at: new Date().toISOString(), actor: context.actor, ...action.audit }, ...updated.audit],
  };
}
