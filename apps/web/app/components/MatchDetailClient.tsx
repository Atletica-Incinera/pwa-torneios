'use client';

import Link from 'next/link';
import { Clock3, Pencil, Radio } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { MatchSummary } from './MatchSummary';
import { MatchScorers } from './MatchScorers';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { canManageDiscipline, useFrontendSession } from '../lib/frontend-session';
import { formatClock } from '../lib/tournament-engine';
import { matchClockLabel, resolveDisciplineRule } from '../lib/discipline-rules';
import { isLive, isTerminalMatch } from '../lib/status';
import type { MatchView } from '../lib/edition-catalog';

export function MatchDetailClient({ match, readOnly = false }: { match: MatchView; readOnly?: boolean }) {
  const { state } = useFrontendState();
  const { session } = useFrontendSession();
  // A partida já vem resolvida; do registro cru só saem os campos de operação
  // que a lista não precisa conhecer: relógio, eventos, desempate e retificação.
  const operation = state.matches[match.id] ?? {};
  const current = match;
  const operable = !isTerminalMatch(current.status);
  const canOperate = canManageDiscipline(session, current.discipline);
  const rules = operation.rules ?? resolveDisciplineRule(current.discipline, state.disciplines[current.discipline]);
  const currentPeriod = operation.currentPeriod ?? 1;
  const [clock, setClock] = useState(operation.clockSeconds ?? 0);
  const latestEvent = operation.events?.[0];
  const scoreAnnouncement = useMemo(() => {
    if (!isLive(current.status) && !latestEvent) return '';
    const score = `${current.entryA}, ${current.scoreA ?? 0}; ${current.entryB}, ${current.scoreB ?? 0}.`;
    return latestEvent ? `${latestEvent.type}: ${latestEvent.detail}. Placar ${score}` : `Partida ao vivo. Placar ${score}`;
  }, [current.entryA, current.entryB, current.scoreA, current.scoreB, current.status, latestEvent]);

  useEffect(() => {
    const update = () => setClock((operation.clockSeconds ?? 0) + (!operation.paused && operation.runningSince && isLive(current.status) ? Math.max(0, Math.floor((Date.now() - new Date(operation.runningSince).getTime()) / 1000)) : 0));
    update();
    if (!isLive(current.status) || operation.paused) return;
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [current.status, operation.clockSeconds, operation.paused, operation.runningSince]);

  return <>
    <MatchSummary match={current} />
    <div className="sr-only" aria-live="polite" aria-atomic="true">{scoreAnnouncement}</div>
    {isLive(current.status) || operation.events?.length ? (
      <section className="spectator-match-state">
        {/* Modalidade sem cronometro nao mostra relogio nem aviso de que nao
            ha relogio: a etapa em andamento ja diz onde a partida esta. */}
        <div className="spectator-clock-row"><small>{currentPeriod}º {rules.periodLabel.toUpperCase()} DE {rules.periodCount}</small>{rules.clockMode === 'none' ? null : <div className="game-clock" aria-label={`Tempo de partida: ${formatClock(matchClockLabel(rules, clock))}`}><Clock3 size={18} aria-hidden="true" />{formatClock(matchClockLabel(rules, clock))}</div>}</div>
        <div className="event-timeline">
          {operation.events?.length ? operation.events.map((event) => (
            <article className="timeline-item" key={event.id}><span className="timeline-minute"><small>{event.period ?? 1}º {rules.periodLabel.slice(0, 1)}</small>{rules.clockMode === 'none' ? null : formatClock(matchClockLabel(rules, event.periodElapsedSeconds ?? event.elapsedSeconds))}</span><div><strong>{event.type}</strong><p>{event.detail}{event.athleteId && state.athletes[event.athleteId] ? ` · ${state.athletes[event.athleteId].name}` : ''}</p></div></article>
          )) : <p className="match-filter-empty">A partida começou; aguardando o primeiro evento.</p>}
        </div>
      </section>
    ) : null}
    {!readOnly && canOperate ? (
      <div className="form-actions match-detail-actions">
        <Link href={`/matches/${match.id}/manage`} className="secondary-button"><Pencil size={17} aria-hidden="true" /> Editar partida</Link>
        {operable ? <Link href={`/matches/live?partida=${match.id}`} className="primary-button"><Radio size={17} aria-hidden="true" /> {isLive(current.status) ? 'Continuar placar' : 'Abrir placar'}</Link> : null}
      </div>
    ) : null}
    {/* Depois do apito, dizer quem marcou deixa de ser operar e vira registro:
        a mesa acerta a artilharia com o jogo terminado, sem o placar na mao. */}
    {!readOnly && canOperate && isTerminalMatch(current.status) ? <MatchScorers match={current} /> : null}
    {!readOnly && !canOperate ? <div className="info-banner"><p>Seu perfil não pode editar ou operar partidas de {current.discipline}.</p></div> : null}
    {operation.periodResults?.length ? <p className="period-results">Parciais: {operation.periodResults.map((item) => `${item.scoreA}-${item.scoreB}`).join(' · ')}</p> : null}
    {operation.tiebreak ? <div className="info-banner"><p><strong>{operation.tiebreak.label}:</strong> {operation.tiebreak.winner} ({operation.tiebreak.scoreA} × {operation.tiebreak.scoreB}) · {operation.tiebreak.reason}</p></div> : null}
    {operation.walkoverWinner ? <div className="info-banner"><p><strong>W.O.:</strong> {operation.walkoverWinner} vence por ausência da equipe adversária.</p></div> : null}
    {operation.reason ? <div className="info-banner"><p><strong>Motivo:</strong> {operation.reason}</p></div> : null}
    {operation.corrections?.length ? <div className="info-banner"><p><strong>Resultado retificado:</strong> {operation.corrections.at(-1)?.before} → {operation.corrections.at(-1)?.after} · {operation.corrections.at(-1)?.reason}</p></div> : null}
  </>;
}
