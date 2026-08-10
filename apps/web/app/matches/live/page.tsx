'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CircleDot, Clock3, Flag, Goal, Pause, Play, RotateCcw, SkipForward, Square, TimerReset, Volume2, VolumeX } from 'lucide-react';
import { BottomNav } from '../../components/BottomNav';
import { PageNavigation, TeamMark } from '../../components/AppShell';
import { AdminRouteGuard } from '../../components/AdminRouteGuard';
import { useUi } from '../../components/UiProvider';
import { matches } from '../../lib/repositories/catalog-repository';
import { MatchEventState, useFrontendState } from '../../lib/repositories/browser-repository';
import { canManageDiscipline, useFrontendSession } from '../../lib/frontend-session';
import { formatClock } from '../../lib/tournament-engine';
import { progressTournament } from '../../lib/tournament-progression';
import { formatDisciplineRule, matchClockLabel, resolveDisciplineRule } from '../../lib/discipline-rules';
import { impactSoundForEvent, ImpactSound, playImpactSound, soundForLifecycle, warmSportsSounds } from '../../lib/sound-effects';

type EventTone = 'blue' | 'pink' | 'orange';

export default function LiveMatchPage() {
  return <AdminRouteGuard><Suspense fallback={<main className="global-state-screen"><span className="loading-mark">26</span><div className="loading-line" /><p>Preparando placar...</p></main>}><LiveMatchContent /></Suspense></AdminRouteGuard>;
}

function LiveMatchContent() {
  const searchParams = useSearchParams();
  const matchId = searchParams.get('partida');
  const { state, commit, hydrated } = useFrontendState();
  const { session } = useFrontendSession();
  const { confirm, toast } = useUi();
  const operationLock = useRef(false);
  const periodEndHandled = useRef(false);
  const initialized = useRef<string | null>(null);
  const operatorId = useRef(`operator-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const storedRequested = matchId ? state.matches[matchId] : undefined;
  const localMatch = matchId && storedRequested?.created ? {
    id: matchId,
    time: storedRequested.time ?? '--:--',
    date: storedRequested.date ?? 'Hoje',
    discipline: storedRequested.discipline ?? 'Modalidade',
    entryA: storedRequested.entryA ?? 'Equipe A',
    logoA: storedRequested.logoA ?? '',
    entryB: storedRequested.entryB ?? 'Equipe B',
    logoB: storedRequested.logoB ?? '',
    scoreA: storedRequested.scoreA ?? null,
    scoreB: storedRequested.scoreB ?? null,
    venue: storedRequested.venue ?? 'A definir',
    phase: storedRequested.phase ?? 'Fase atual',
    status: storedRequested.status ?? 'Agendada',
  } : undefined;
  const requestedMatch = matchId ? matches.find((item) => item.id === matchId) ?? localMatch : undefined;
  const match = requestedMatch ?? matches.find((item) => item.status === 'Ao vivo') ?? matches[0];
  const invalidMatch = Boolean(matchId && !requestedMatch);
  const persisted = state.matches[match.id] ?? {};
  const status = persisted.status ?? match.status;
  const homeScore = persisted.scoreA ?? match.scoreA ?? 0;
  const awayScore = persisted.scoreB ?? match.scoreB ?? 0;
  const events = persisted.events ?? [];
  const paused = persisted.paused ?? false;
  const finished = status === 'Encerrada';
  const authorized = canManageDiscipline(session, match.discipline);
  const operatorFresh = persisted.operatorHeartbeat && Date.now() - new Date(persisted.operatorHeartbeat).getTime() < 30_000;
  const operatorConflict = Boolean(operatorFresh && persisted.operatorId && persisted.operatorId !== operatorId.current);
  const allowed = authorized && !operatorConflict;
  const disciplineRules = persisted.rules ?? resolveDisciplineRule(match.discipline, state.disciplines[match.discipline]);
  const soundEnabled = state.preferences.soundEffects !== false;
  const currentPeriod = persisted.currentPeriod ?? 1;
  const periodDurationSeconds = disciplineRules.periodDurationMinutes * 60;
  const hasClock = disciplineRules.clockMode !== 'none' && periodDurationSeconds > 0;
  const [clock, setClock] = useState(0);
  const [impact, setImpact] = useState<EventTone | null>(null);

  function currentClock() {
    const base = persisted.clockSeconds ?? 0;
    if (!hasClock || persisted.paused || !persisted.runningSince || finished) return base;
    const elapsed = base + Math.max(0, Math.floor((Date.now() - new Date(persisted.runningSince).getTime()) / 1000));
    return Math.min(periodDurationSeconds, elapsed);
  }

  function announce(message: string) {
    window.dispatchEvent(new CustomEvent('intereng:announce', { detail: message }));
  }

  function playSound(sound: ImpactSound) {
    if (soundEnabled) playImpactSound(sound);
  }

  useEffect(() => {
    if (soundEnabled) warmSportsSounds();
  }, [soundEnabled]);

  useEffect(() => {
    if (!hydrated || invalidMatch || !allowed || initialized.current === match.id) return;
    initialized.current = match.id;
    if (!['Ao vivo', 'Encerrada'].includes(status)) {
      commit((current) => ({
        ...current,
        matches: {
          ...current.matches,
          [match.id]: {
            ...current.matches[match.id],
            status: 'Ao vivo',
            scoreA: homeScore,
            scoreB: awayScore,
            rules: disciplineRules,
            currentPeriod: current.matches[match.id]?.currentPeriod ?? 1,
            paused: false,
            clockSeconds: current.matches[match.id]?.clockSeconds ?? 0,
            runningSince: hasClock ? new Date().toISOString() : undefined,
            events: current.matches[match.id]?.events ?? [],
          },
        },
      }), { action: 'Partida iniciada', entity: `${match.entryA} × ${match.entryB}`, after: `Ao vivo · ${formatDisciplineRule(disciplineRules)}` });
      playSound(soundForLifecycle('match-start', match.discipline));
    } else if (status === 'Ao vivo' && hasClock && !paused && !persisted.runningSince) {
      commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], rules: current.matches[match.id]?.rules ?? disciplineRules, currentPeriod: current.matches[match.id]?.currentPeriod ?? 1, runningSince: new Date().toISOString() } } }));
    }
  }, [allowed, awayScore, commit, disciplineRules, hasClock, homeScore, hydrated, invalidMatch, match.entryA, match.entryB, match.id, paused, persisted.runningSince, status]);

  useEffect(() => {
    if (!hydrated || invalidMatch || !authorized || finished || operatorConflict) return;
    const heartbeat = () => commit((current) => {
      const active = current.matches[match.id] ?? {};
      const fresh = active.operatorHeartbeat && Date.now() - new Date(active.operatorHeartbeat).getTime() < 30_000;
      if (fresh && active.operatorId && active.operatorId !== operatorId.current) return current;
      return { ...current, matches: { ...current.matches, [match.id]: { ...active, operatorId: operatorId.current, operatorName: session?.name ?? 'Operador', operatorHeartbeat: new Date().toISOString() } } };
    });
    heartbeat();
    const timer = window.setInterval(heartbeat, 10_000);
    return () => {
      window.clearInterval(timer);
      commit((current) => {
        const active = current.matches[match.id];
        if (active?.operatorId !== operatorId.current) return current;
        return { ...current, matches: { ...current.matches, [match.id]: { ...active, operatorId: undefined, operatorName: undefined, operatorHeartbeat: undefined } } };
      });
    };
  }, [authorized, commit, finished, hydrated, invalidMatch, match.id, operatorConflict, session?.name]);

  useEffect(() => {
    periodEndHandled.current = false;
  }, [currentPeriod]);

  useEffect(() => {
    const update = () => {
      const nextClock = currentClock();
      setClock(nextClock);
      if (hasClock && nextClock >= periodDurationSeconds && !paused && !finished && !periodEndHandled.current) {
        periodEndHandled.current = true;
        commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], paused: true, clockSeconds: periodDurationSeconds, runningSince: undefined } } }), { action: `${disciplineRules.periodLabel} encerrado`, entity: `${match.entryA} × ${match.entryB}`, after: `${currentPeriod}/${disciplineRules.periodCount}` });
        announce(`${disciplineRules.periodLabel} ${currentPeriod} encerrado.`);
        playSound(soundForLifecycle('period-end', match.discipline));
      }
    };
    update();
    if (!hasClock || paused || finished || !persisted.runningSince) return;
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [commit, currentPeriod, disciplineRules.periodCount, disciplineRules.periodLabel, finished, hasClock, match.entryA, match.entryB, match.id, paused, periodDurationSeconds, persisted.clockSeconds, persisted.runningSince]);

  function showImpact(tone: EventTone) {
    setImpact(tone);
    window.setTimeout(() => setImpact(null), 600);
  }

  function registerEvent(type: string, detail: string, tone: EventTone, side: MatchEventState['side'] = 'neutral', nextA = homeScore, nextB = awayScore) {
    if (!allowed || (hasClock && paused) || finished || operationLock.current) return;
    operationLock.current = true;
    const tappedAt = currentClock();
    const event: MatchEventState = {
      id: `event-${Date.now()}`,
      at: new Date().toISOString(),
      elapsedSeconds: hasClock ? ((currentPeriod - 1) * periodDurationSeconds) + tappedAt : events.length,
      period: currentPeriod,
      periodElapsedSeconds: tappedAt,
      type,
      detail,
      side,
      scoreA: nextA,
      scoreB: nextB,
      previousScoreA: homeScore,
      previousScoreB: awayScore,
    };
    const recordedMoment = hasClock ? formatClock(matchClockLabel(disciplineRules, tappedAt)) : `${disciplineRules.periodLabel} ${currentPeriod}`;
    commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], status: 'Ao vivo', scoreA: nextA, scoreB: nextB, events: [event, ...(current.matches[match.id]?.events ?? [])] } } }), { action: `${type} registrado`, entity: detail, after: `${recordedMoment} · ${nextA} × ${nextB}` });
    announce(`${type} para ${detail} em ${recordedMoment}. Placar: ${match.entryA}, ${nextA}; ${match.entryB}, ${nextB}.`);
    playSound(impactSoundForEvent(type, match.discipline));
    showImpact(tone);
    window.setTimeout(() => { operationLock.current = false; }, 350);
  }

  function togglePause() {
    if (!allowed || !hasClock || finished || operationLock.current || clock >= periodDurationSeconds) return;
    operationLock.current = true;
    const nextPaused = !paused;
    commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], paused: nextPaused, clockSeconds: nextPaused ? currentClock() : current.matches[match.id]?.clockSeconds ?? clock, runningSince: nextPaused ? undefined : new Date().toISOString() } } }), { action: nextPaused ? 'Cronômetro pausado' : 'Cronômetro retomado', entity: `${match.entryA} × ${match.entryB}`, after: formatClock(matchClockLabel(disciplineRules, clock)) });
    announce(nextPaused ? `Partida pausada em ${formatClock(matchClockLabel(disciplineRules, clock))}.` : `Partida retomada em ${formatClock(matchClockLabel(disciplineRules, clock))}.`);
    if (!nextPaused) playSound(soundForLifecycle('period-start', match.discipline));
    window.setTimeout(() => { operationLock.current = false; }, 350);
  }

  function advancePeriod() {
    if (!allowed || finished || operationLock.current || currentPeriod >= disciplineRules.periodCount || (hasClock && !paused)) return;
    operationLock.current = true;
    const nextPeriod = currentPeriod + 1;
    commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], currentPeriod: nextPeriod, clockSeconds: 0, paused: hasClock, runningSince: undefined } } }), { action: `${disciplineRules.periodLabel} avançado`, entity: `${match.entryA} × ${match.entryB}`, before: String(currentPeriod), after: String(nextPeriod) });
    setClock(0);
    announce(`${disciplineRules.periodLabel} ${nextPeriod} pronto para começar.`);
    if (!hasClock) playSound(soundForLifecycle('period-start', match.discipline));
    window.setTimeout(() => { operationLock.current = false; }, 350);
  }

  async function undoLastAction() {
    const last = events[0];
    if (!last || !allowed || finished || operationLock.current) { if (!last) toast('Nenhum evento para desfazer.', 'error'); return; }
    if (!(await confirm({ title: 'Desfazer último evento?', message: `${last.type}: ${last.detail}. O placar também será restaurado.`, confirmLabel: 'Desfazer' }))) return;
    operationLock.current = true;
    const nextA = last.previousScoreA ?? Math.max(0, last.scoreA - (last.side === 'home' ? 1 : 0));
    const nextB = last.previousScoreB ?? Math.max(0, last.scoreB - (last.side === 'away' ? 1 : 0));
    commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], scoreA: nextA, scoreB: nextB, events: (current.matches[match.id]?.events ?? []).filter((event) => event.id !== last.id) } } }), { action: 'Último evento desfeito', entity: `${match.entryA} × ${match.entryB}`, after: `${nextA} × ${nextB}` });
    announce(`Evento desfeito. Placar restaurado: ${match.entryA}, ${nextA}; ${match.entryB}, ${nextB}.`);
    showImpact('orange');
    window.setTimeout(() => { operationLock.current = false; }, 350);
  }

  async function finishMatch() {
    if (!allowed || finished || operationLock.current || !(await confirm({ title: 'Encerrar partida?', message: `Confirme o placar final: ${match.entryA} ${homeScore} × ${awayScore} ${match.entryB}.`, confirmLabel: 'Encerrar partida', danger: true }))) return;
    operationLock.current = true;
    commit((current) => progressTournament({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], status: 'Encerrada', paused: true, runningSince: undefined, clockSeconds: currentClock(), currentPeriod, scoreA: homeScore, scoreB: awayScore } } }, current.matches[match.id]?.tournamentId ?? persisted.tournamentId), { action: 'Partida encerrada', entity: `${match.entryA} × ${match.entryB}`, after: `${homeScore} × ${awayScore}` });
    announce(`Partida encerrada. Placar final: ${match.entryA}, ${homeScore}; ${match.entryB}, ${awayScore}.`);
    playSound(soundForLifecycle('match-end', match.discipline));
    operationLock.current = false;
  }

  if (invalidMatch) return <main className="app-screen live-screen theme-matches"><div className="empty-state"><strong>PARTIDA NÃO ENCONTRADA</strong><p>O identificador informado não pertence à edição atual.</p><Link href={`/matches?modalidade=${encodeURIComponent(state.preferences.selectedDiscipline)}`} className="wide-action">VOLTAR PARA JOGOS</Link></div><BottomNav active="matches" /></main>;

  const displayClock = hasClock ? formatClock(matchClockLabel(disciplineRules, clock)) : 'SEM CRONÔMETRO';
  const actionDisabled = (hasClock && paused) || finished;
  const eventTime = (event: MatchEventState) => hasClock ? formatClock(matchClockLabel(disciplineRules, event.periodElapsedSeconds ?? event.elapsedSeconds)) : `#${event.elapsedSeconds + 1}`;

  return (
    <main className={`app-screen live-screen theme-matches motion-page ${paused ? 'is-paused' : ''}`}>
      <div className={`diagonal-impact impact-${impact ?? 'none'}`} aria-hidden="true" />
      <PageNavigation title="PLACAR AO VIVO" />
      <header className="live-topbar motion-enter motion-delay-1"><div><p className="eyebrow orange">{match.discipline.toUpperCase()} · INTERENG 2026</p><h1>{match.phase}</h1></div><div className="live-status-actions"><button type="button" className="sound-toggle" onClick={() => commit((current) => ({ ...current, preferences: { ...current.preferences, soundEffects: !soundEnabled } }))} aria-label={soundEnabled ? 'Desativar sons do placar' : 'Ativar sons do placar'}>{soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button><span className={`live-status ${paused ? 'paused' : ''}`}><i /> {finished ? 'ENCERRADA' : paused ? 'PAUSADA' : 'AO VIVO'}</span></div></header>
      <section className={`score-hero motion-enter motion-delay-2 ${impact ? `score-impact-${impact}` : ''}`}>
        <div className="score-team score-team-blue"><TeamMark initial={match.entryA[0]} tone="blue" logo={match.logoA} /><strong>{match.entryA}</strong></div>
        <div className="score-center"><div className="score-numbers"><strong className={`score-blue ${impact === 'blue' ? 'score-pop' : ''}`}>{homeScore}</strong><span>—</span><strong className={`score-pink ${impact === 'pink' ? 'score-pop' : ''}`}>{awayScore}</strong></div><small className="game-period">{currentPeriod}º {disciplineRules.periodLabel.toUpperCase()} DE {disciplineRules.periodCount}</small><div className="game-clock" aria-label={`${disciplineRules.periodLabel} ${currentPeriod}, cronômetro ${displayClock}`}><Clock3 size={19} />{displayClock}</div></div>
        <div className="score-team score-team-pink"><TeamMark initial={match.entryB[0]} tone="pink" logo={match.logoB} /><strong>{match.entryB}</strong></div>
      </section>
      {allowed ? <>
        <section className="event-actions motion-enter motion-delay-3" aria-label="Ações rápidas">
          <button className="event-btn blue sport-press" onClick={() => registerEvent(disciplineRules.scoringEvent, match.entryA, 'blue', 'home', homeScore + 1, awayScore)} disabled={actionDisabled}><Goal size={25} /><span>{disciplineRules.scoringEvent} {match.entryA}</span></button>
          <button className="event-btn pink sport-press" onClick={() => registerEvent(disciplineRules.scoringEvent, match.entryB, 'pink', 'away', homeScore, awayScore + 1)} disabled={actionDisabled}><CircleDot size={25} /><span>{disciplineRules.scoringEvent} {match.entryB}</span></button>
          {disciplineRules.secondaryEvents.flatMap((eventType, eventIndex) => ([
            <button key={`${eventType}-home`} className={`event-btn ${eventIndex === 0 ? 'orange' : 'neutral'} sport-press`} onClick={() => registerEvent(eventType, match.entryA, 'orange', 'home')} disabled={actionDisabled}>{eventIndex === 0 ? <Flag size={25} /> : <Square size={24} />}<span>{eventType}<small>{match.entryA}</small></span></button>,
            <button key={`${eventType}-away`} className={`event-btn ${eventIndex === 0 ? 'orange' : 'neutral'} sport-press`} onClick={() => registerEvent(eventType, match.entryB, 'orange', 'away')} disabled={actionDisabled}>{eventIndex === 0 ? <Flag size={25} /> : <Square size={24} />}<span>{eventType}<small>{match.entryB}</small></span></button>,
          ]))}
        </section>
        <section className="match-controls motion-enter motion-delay-4">
          {hasClock ? <button type="button" className="sport-press" onClick={togglePause} disabled={finished || clock >= periodDurationSeconds}>{paused ? <Play size={19} /> : <Pause size={19} />}{paused ? 'Retomar' : 'Pausar'}</button> : null}
          <button type="button" className="sport-press" onClick={advancePeriod} disabled={finished || currentPeriod >= disciplineRules.periodCount || (hasClock && !paused)}><SkipForward size={19} />Próximo {disciplineRules.periodLabel.toLowerCase()}</button>
          <button type="button" className="sport-press" onClick={undoLastAction} disabled={finished || !events.length}><RotateCcw size={19} />Desfazer</button>
          <button type="button" className="finish sport-press" onClick={finishMatch} disabled={finished}><TimerReset size={19} />{finished ? 'Encerrada' : 'Encerrar'}</button>
        </section>
      </> : <div className="info-banner" role="status"><p>Seu perfil pode acompanhar este placar, mas não operar a modalidade {match.discipline}.</p></div>}
      <section className="timeline-block motion-enter motion-delay-5"><div className="section-title-row"><div><p className="eyebrow">PARTIDA</p><h2>EVENTOS</h2></div></div><div className="event-timeline">{events.length ? events.map((event, index) => { const tone: EventTone = event.side === 'home' ? 'blue' : event.side === 'away' ? 'pink' : 'orange'; return <article className={`timeline-item ${index === 0 ? 'timeline-new' : ''}`} key={event.id}><span className={`timeline-minute minute-${tone}`}><small>{event.period ?? 1}º {disciplineRules.periodLabel.slice(0, 1)}</small>{eventTime(event)}</span><div><strong>{event.type}</strong><p>{event.detail}</p></div></article>; }) : <p className="match-filter-empty">Nenhum evento registrado nesta partida.</p>}</div></section>
      <BottomNav active="matches" />
    </main>
  );
}
