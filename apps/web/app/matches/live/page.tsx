'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CircleDot, Clock3, Flag, Goal, Handshake, KeyRound, Pause, Play, PlayCircle, RotateCcw, Scale, SkipForward, Square, TimerReset, Volume2, VolumeX } from 'lucide-react';
import { BottomNav } from '../../components/BottomNav';
import { PageNavigation, TeamMark } from '../../components/AppShell';
import { AdminRouteGuard } from '../../components/AdminRouteGuard';
import { useUi } from '../../components/UiProvider';
import { MatchEventState, MatchScoreSnapshot, MatchTiebreakState, useFrontendState } from '../../lib/repositories/browser-repository';
import { canManageDiscipline, useFrontendSession } from '../../lib/frontend-session';
import { findMatch, listMatches, type MatchView } from '../../lib/edition-catalog';
import { formatClock } from '../../lib/tournament-engine';
import { matchClockLabel } from '../../lib/discipline-rules';
import { describeCompletion, knockoutMethodLabels, regulationPeriodCount, resolveRegulation, setTarget, type KnockoutMethod } from '../../lib/regulation';
import { evaluateAdvancePeriod, evaluateFinish, evaluateOperatorLock, evaluateStart, isEliminationPhase, operatorLockMs, setWinner } from '../../lib/match-lifecycle';
import { isLive, matchStatus } from '../../lib/status';
import { impactSoundForEvent, ImpactSound, playImpactSound, soundForLifecycle, warmSportsSounds } from '../../lib/sound-effects';
import { LoadingScreen } from '../../components/LoadingScreen';
import { createId } from '../../lib/create-id';
import { getOperatorDeviceId } from '../../lib/repositories/operator-device';

type EventTone = 'blue' | 'pink' | 'orange';

/** Placeholder de render: a tela devolve "partida não encontrada" logo adiante. */
const emptyMatch: MatchView = { id: '', discipline: 'Modalidade', entryA: 'Equipe A', logoA: '', entryB: 'Equipe B', logoB: '', scoreA: null, scoreB: null, date: 'A definir', time: '--:--', venue: 'A definir', phase: 'Fase atual', status: 'Agendada', created: false };

export default function LiveMatchPage() {
  return <AdminRouteGuard><Suspense fallback={<LoadingScreen message="Preparando placar..." />}><LiveMatchContent /></Suspense></AdminRouteGuard>;
}

function LiveMatchContent() {
  const searchParams = useSearchParams();
  const matchId = searchParams.get('partida');
  const { state, dispatch, hydrated, setPreference } = useFrontendState();
  const { session } = useFrontendSession();
  const { confirm, toast } = useUi();
  const operationLock = useRef(false);
  const periodEndHandled = useRef(false);
  const operatorId = useRef(getOperatorDeviceId());
  const scheduled = listMatches(state);
  const requestedMatch = matchId ? findMatch(state, matchId) : undefined;
  // Sem partida pedida, opera a que está ao vivo; sem nenhuma, a primeira da agenda.
  const resolved = requestedMatch ?? scheduled.find((item) => isLive(item.status)) ?? scheduled[0];
  // Pedido inválido ou agenda vazia: não há placar para operar.
  const invalidMatch = !resolved || Boolean(matchId && !requestedMatch);
  const match = resolved ?? emptyMatch;
  const persisted = state.matches[match.id] ?? {};
  const status = match.status;
  const phase = match.phase;
  const homeScore = match.scoreA ?? 0;
  const awayScore = match.scoreB ?? 0;
  const periodScoreA = persisted.periodScoreA ?? 0;
  const periodScoreB = persisted.periodScoreB ?? 0;
  const events = persisted.events ?? [];
  const paused = persisted.paused ?? false;
  const finished = status === matchStatus.finished;
  const live = isLive(status);
  const authorized = canManageDiscipline(session, match.discipline);
  const operatorFresh = Boolean(persisted.operatorHeartbeat && Date.now() - new Date(persisted.operatorHeartbeat).getTime() < operatorLockMs);
  const operatorConflict = Boolean(operatorFresh && persisted.operatorId && persisted.operatorId !== operatorId.current);
  const holdsOperation = persisted.operatorId === operatorId.current;
  const allowed = authorized && !operatorConflict;

  const regulation = useMemo(() => resolveRegulation(match.discipline, state.disciplines[match.discipline], persisted.rules), [match.discipline, persisted.rules, state.disciplines]);
  const completion = regulation.completion;
  const isSets = completion.mode === 'sets';
  const isDeclarative = completion.mode === 'board' || completion.mode === 'result';
  const elimination = isEliminationPhase(phase);
  const totalPeriods = regulationPeriodCount(regulation);
  const overtimePeriods = completion.mode === 'periods' ? completion.overtimePeriods : 0;
  const soundEnabled = state.preferences.soundEffects !== false;
  const currentPeriod = persisted.currentPeriod ?? 1;
  const inOvertime = currentPeriod > totalPeriods;
  const periodDurationMinutes = inOvertime && completion.mode === 'periods' ? completion.overtimeDurationMinutes : regulation.base.periodDurationMinutes;
  const periodDurationSeconds = periodDurationMinutes * 60;
  const hasClock = regulation.base.clockMode !== 'none' && periodDurationSeconds > 0;
  const periodLabel = inOvertime ? 'Prorrogação' : regulation.base.periodLabel;
  const [clock, setClock] = useState(0);
  const [impact, setImpact] = useState<EventTone | null>(null);
  const [tiebreakOpen, setTiebreakOpen] = useState(false);
  const [tiebreakDraft, setTiebreakDraft] = useState({ method: regulation.knockout.method as KnockoutMethod, scoreA: '', scoreB: '', winner: '', reason: '' });

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

  function snapshot(): MatchScoreSnapshot {
    return { scoreA: homeScore, scoreB: awayScore, periodScoreA, periodScoreB, currentPeriod };
  }

  useEffect(() => {
    if (soundEnabled) warmSportsSounds();
  }, [soundEnabled]);

  // Retoma o relógio de uma partida que já estava ao vivo, sem nunca iniciar
  // uma partida por conta própria: o início depende de confirmação do operador.
  useEffect(() => {
    if (!hydrated || invalidMatch || !allowed || !live || !hasClock || paused || persisted.runningSince) return;
    void dispatch({ type: 'match/updateClock', payload: { id: match.id, patch: { runningSince: new Date().toISOString() } } });
  }, [allowed, dispatch, hasClock, hydrated, invalidMatch, live, match.id, paused, persisted.runningSince]);

  useEffect(() => {
    if (!hydrated || invalidMatch || !authorized || finished || operatorConflict || !live) return;
    // Só grava quando a trava precisa ser renovada: sem isso o app inteiro
    // re-renderizava a cada tique, no meio da partida.
    const heartbeat = () => { void dispatch({ type: 'match/claimOperator', payload: { id: match.id, operatorId: operatorId.current, operatorName: session?.name ?? 'Operador' } }); };
    heartbeat();
    const timer = window.setInterval(heartbeat, 15_000);
    return () => {
      window.clearInterval(timer);
      void dispatch({ type: 'match/releaseOperator', payload: { id: match.id, operatorId: operatorId.current } });
    };
  }, [authorized, dispatch, finished, hydrated, invalidMatch, live, match.id, operatorConflict, session?.name]);

  useEffect(() => { periodEndHandled.current = false; }, [currentPeriod]);

  useEffect(() => {
    const update = () => {
      const nextClock = currentClock();
      setClock(nextClock);
      if (hasClock && nextClock >= periodDurationSeconds && !paused && !finished && !periodEndHandled.current) {
        periodEndHandled.current = true;
        void dispatch({ type: 'match/updateClock', payload: { id: match.id, patch: { paused: true, clockSeconds: periodDurationSeconds, runningSince: undefined } }, audit: { action: `${periodLabel} encerrado`, entity: `${match.entryA} × ${match.entryB}`, after: `${currentPeriod}/${totalPeriods}` } });
        announce(`${periodLabel} ${currentPeriod} encerrado.`);
        playSound(soundForLifecycle('period-end', match.discipline));
      }
    };
    update();
    if (!hasClock || paused || finished || !persisted.runningSince) return;
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [dispatch, currentPeriod, finished, hasClock, match.entryA, match.entryB, match.id, paused, periodDurationSeconds, periodLabel, persisted.clockSeconds, persisted.runningSince, totalPeriods]);

  function showImpact(tone: EventTone) {
    setImpact(tone);
    window.setTimeout(() => setImpact(null), 600);
  }

  function writeEvent(type: string, detail: string, side: MatchEventState['side'], next: Partial<MatchScoreSnapshot>, points = 0, periodResult?: { period: number; scoreA: number; scoreB: number }) {
    const tappedAt = currentClock();
    const previous = snapshot();
    const event: MatchEventState = {
      id: createId('event'),
      at: new Date().toISOString(),
      elapsedSeconds: hasClock ? ((currentPeriod - 1) * periodDurationSeconds) + tappedAt : events.length,
      period: currentPeriod,
      periodElapsedSeconds: tappedAt,
      type,
      detail,
      side,
      points,
      scoreA: next.scoreA ?? previous.scoreA,
      scoreB: next.scoreB ?? previous.scoreB,
      previousScoreA: previous.scoreA,
      previousScoreB: previous.scoreB,
      previous,
    };
    const moment = hasClock ? formatClock(matchClockLabel({ ...regulation.base, periodDurationMinutes }, tappedAt)) : `${periodLabel} ${currentPeriod}`;
    void dispatch({
      type: 'match/registerEvent',
      payload: {
        id: match.id,
        event,
        periodResult,
        patch: {
          status: 'Ao vivo',
          scoreA: next.scoreA ?? previous.scoreA,
          scoreB: next.scoreB ?? previous.scoreB,
          periodScoreA: next.periodScoreA ?? previous.periodScoreA,
          periodScoreB: next.periodScoreB ?? previous.periodScoreB,
          currentPeriod: next.currentPeriod ?? previous.currentPeriod,
        },
      },
      audit: { action: `${type} registrado`, entity: detail, after: `${moment} · ${event.scoreA} × ${event.scoreB}` },
    });
    return { event, moment };
  }

  function registerScore(actionLabel: string, points: number, side: 'home' | 'away', tone: EventTone) {
    if (!allowed || !live || finished || operationLock.current) return;
    if (hasClock && paused) { toast('Retome o cronômetro para registrar pontos.', 'error'); return; }
    operationLock.current = true;
    const team = side === 'home' ? match.entryA : match.entryB;

    if (isSets && completion.mode === 'sets') {
      const nextPeriodA = periodScoreA + (side === 'home' ? points : 0);
      const nextPeriodB = periodScoreB + (side === 'away' ? points : 0);
      const decided = setWinner(regulation, currentPeriod, nextPeriodA, nextPeriodB);
      const nextSetsA = homeScore + (decided === 'home' ? 1 : 0);
      const nextSetsB = awayScore + (decided === 'away' ? 1 : 0);
      const matchOver = nextSetsA >= completion.setsToWin || nextSetsB >= completion.setsToWin;
      const nextPeriod = decided && !matchOver ? currentPeriod + 1 : currentPeriod;
      writeEvent(actionLabel, team, side, {
        scoreA: nextSetsA, scoreB: nextSetsB,
        periodScoreA: decided && !matchOver ? 0 : nextPeriodA,
        periodScoreB: decided && !matchOver ? 0 : nextPeriodB,
        currentPeriod: nextPeriod,
      }, points, decided ? { period: currentPeriod, scoreA: nextPeriodA, scoreB: nextPeriodB } : undefined);
      if (decided) {
        announce(`${regulation.base.periodLabel} ${currentPeriod} para ${decided === 'home' ? match.entryA : match.entryB}: ${nextPeriodA} a ${nextPeriodB}.`);
        playSound(soundForLifecycle('period-end', match.discipline));
      } else {
        announce(`${actionLabel} para ${team}. ${regulation.base.periodLabel} ${currentPeriod}: ${nextPeriodA} a ${nextPeriodB}.`);
        playSound(impactSoundForEvent(actionLabel, match.discipline));
      }
    } else {
      const nextA = homeScore + (side === 'home' ? points : 0);
      const nextB = awayScore + (side === 'away' ? points : 0);
      // A parcial da etapa acompanha o placar para render o histórico por tempo.
      const { moment } = writeEvent(actionLabel, team, side, { scoreA: nextA, scoreB: nextB, periodScoreA: periodScoreA + (side === 'home' ? points : 0), periodScoreB: periodScoreB + (side === 'away' ? points : 0) }, points);
      announce(`${actionLabel} para ${team} em ${moment}. Placar: ${match.entryA}, ${nextA}; ${match.entryB}, ${nextB}.`);
      playSound(impactSoundForEvent(actionLabel, match.discipline));
    }
    showImpact(tone);
    window.setTimeout(() => { operationLock.current = false; }, 350);
  }

  function registerSecondary(actionLabel: string, side: 'home' | 'away' | 'neutral', allowedWhenStopped: boolean) {
    if (!allowed || !live || finished || operationLock.current) return;
    if (hasClock && paused && !allowedWhenStopped) { toast(`${actionLabel} não pode ser registrado com o relógio parado.`, 'error'); return; }
    operationLock.current = true;
    const team = side === 'home' ? match.entryA : side === 'away' ? match.entryB : 'Partida';
    writeEvent(actionLabel, team, side, {});
    announce(`${actionLabel} para ${team}.`);
    playSound(impactSoundForEvent(actionLabel, match.discipline));
    showImpact('orange');
    window.setTimeout(() => { operationLock.current = false; }, 350);
  }

  /** Xadrez e provas individuais declaram o resultado da mesa/rodada. */
  function declareResult(outcome: 'home' | 'draw' | 'away') {
    if (!allowed || !live || finished || operationLock.current) return;
    operationLock.current = true;
    const win = completion.mode === 'board' ? completion.winPoints : 1;
    const drawPoints = completion.mode === 'board' ? completion.drawPoints : 0;
    const nextA = outcome === 'home' ? win : outcome === 'draw' ? drawPoints : 0;
    const nextB = outcome === 'away' ? win : outcome === 'draw' ? drawPoints : 0;
    const detail = outcome === 'draw' ? 'Empate' : outcome === 'home' ? match.entryA : match.entryB;
    writeEvent(`Resultado da ${regulation.base.periodLabel.toLocaleLowerCase('pt-BR')}`, detail, outcome === 'draw' ? 'neutral' : outcome, { scoreA: nextA, scoreB: nextB });
    announce(`Resultado registrado: ${detail}.`);
    showImpact(outcome === 'away' ? 'pink' : 'blue');
    window.setTimeout(() => { operationLock.current = false; }, 350);
  }

  async function startMatch() {
    if (!authorized || operationLock.current) return;
    if (operatorConflict) { toast(`${persisted.operatorName ?? 'Outro operador'} está com o placar. Assuma a operação antes de iniciar.`, 'error'); return; }
    const check = evaluateStart({ status, date: persisted.date ?? match.date, time: persisted.time ?? match.time }, new Date());
    if (!check.allowed) { toast(check.message, 'error'); return; }
    // O desvio de horário é calculado pelo app e vai direto para a auditoria —
    // não faz sentido pedir para o operador redigitar o que já está registrado.
    const note = check.requiresJustification ? check.message : undefined;
    if (!(await confirm({
      title: check.requiresJustification ? 'Iniciar fora do horário previsto?' : 'Iniciar partida?',
      message: `${match.entryA} × ${match.entryB} · ${describeCompletion(regulation)}. O placar passa a valer como resultado oficial.${note ? ` ${note}` : ''}`,
      confirmLabel: 'Iniciar partida',
    }))) return;
    operationLock.current = true;
    await dispatch({
      type: 'match/start',
      payload: {
        id: match.id,
        patch: {
          status: 'Ao vivo',
          rules: persisted.rules ?? regulation.base,
          scoreA: persisted.scoreA ?? 0,
          scoreB: persisted.scoreB ?? 0,
          periodScoreA: persisted.periodScoreA ?? 0,
          periodScoreB: persisted.periodScoreB ?? 0,
          periodResults: persisted.periodResults ?? [],
          currentPeriod: persisted.currentPeriod ?? 1,
          clockSeconds: persisted.clockSeconds ?? 0,
          paused: false,
          runningSince: hasClock ? new Date().toISOString() : undefined,
          events: persisted.events ?? [],
          startedAt: new Date().toISOString(),
          startedBy: session?.name ?? 'Operador',
          startNote: note,
          operatorId: operatorId.current,
          operatorName: session?.name ?? 'Operador',
          operatorHeartbeat: new Date().toISOString(),
        },
      },
      audit: { action: 'Partida iniciada', entity: `${match.entryA} × ${match.entryB}`, after: `Ao vivo · ${describeCompletion(regulation)}`, reason: note },
    });
    announce('Partida iniciada.');
    playSound(soundForLifecycle('match-start', match.discipline));
    operationLock.current = false;
  }

  async function takeOperation() {
    if (!authorized) return;
    const holder = persisted.operatorName ?? 'outro operador';
    if (!(await confirm({ title: 'Assumir a operação?', message: `${holder} aparece como responsável pelo placar. Ao assumir, o outro dispositivo perde o controle.`, confirmLabel: 'Assumir', danger: true }))) return;
    await dispatch({ type: 'match/claimOperator', payload: { id: match.id, operatorId: operatorId.current, operatorName: session?.name ?? 'Operador', force: true }, audit: { action: 'Operação do placar assumida', entity: `${match.entryA} × ${match.entryB}`, before: holder, after: session?.name ?? 'Operador' } });
  }

  function releaseOperation() {
    void dispatch({ type: 'match/releaseOperator', payload: { id: match.id, operatorId: operatorId.current }, audit: { action: 'Operação do placar liberada', entity: `${match.entryA} × ${match.entryB}`, before: session?.name ?? 'Operador' } });
  }

  function togglePause() {
    if (!allowed || !hasClock || finished || !live || operationLock.current || clock >= periodDurationSeconds) return;
    operationLock.current = true;
    const nextPaused = !paused;
    void dispatch({ type: 'match/updateClock', payload: { id: match.id, patch: { paused: nextPaused, clockSeconds: nextPaused ? currentClock() : persisted.clockSeconds ?? clock, runningSince: nextPaused ? undefined : new Date().toISOString() } }, audit: { action: nextPaused ? 'Cronômetro pausado' : 'Cronômetro retomado', entity: `${match.entryA} × ${match.entryB}`, after: formatClock(matchClockLabel({ ...regulation.base, periodDurationMinutes }, clock)) } });
    announce(nextPaused ? 'Partida pausada.' : 'Partida retomada.');
    if (!nextPaused) playSound(soundForLifecycle('period-start', match.discipline));
    window.setTimeout(() => { operationLock.current = false; }, 350);
  }

  async function advancePeriod() {
    if (!allowed || !live || finished || operationLock.current) return;
    const check = evaluateAdvancePeriod(regulation, { currentPeriod, clockSeconds: currentClock(), paused, periodScoreA, periodScoreB });
    if (!check.allowed) { toast(check.message, 'error'); return; }
    // Encerramento antecipado só precisa de confirmação: período e relógio já
    // ficam gravados no evento, então um texto digitado não acrescenta nada.
    const note = check.requiresEarlyClose ? check.message : undefined;
    if (check.requiresEarlyClose && !(await confirm({ title: `Encerrar ${periodLabel.toLocaleLowerCase('pt-BR')} antecipadamente?`, message: check.message, confirmLabel: 'Encerrar e avançar', danger: true }))) return;
    operationLock.current = true;
    const nextPeriod = currentPeriod + 1;
    void dispatch({
      type: 'match/updateClock',
      payload: {
        id: match.id,
        patch: {
          currentPeriod: nextPeriod,
          clockSeconds: 0,
          paused: hasClock,
          runningSince: undefined,
          // No formato por sets a parcial já foi gravada quando o set fechou.
          periodResults: isSets ? persisted.periodResults ?? [] : [...(persisted.periodResults ?? []), { period: currentPeriod, scoreA: periodScoreA, scoreB: periodScoreB }],
          periodScoreA: 0,
          periodScoreB: 0,
        },
      },
      audit: { action: `${periodLabel} avançado`, entity: `${match.entryA} × ${match.entryB}`, before: String(currentPeriod), after: String(nextPeriod), reason: note },
    });
    setClock(0);
    announce(`${periodLabel} ${nextPeriod} pronto para começar.`);
    if (!hasClock) playSound(soundForLifecycle('period-start', match.discipline));
    window.setTimeout(() => { operationLock.current = false; }, 350);
  }

  async function startOvertime() {
    if (!allowed || !live || finished || operationLock.current) return;
    if (!(await confirm({ title: 'Iniciar prorrogação?', message: `${overtimePeriods} período de ${completion.mode === 'periods' ? completion.overtimeDurationMinutes : 0} min previsto no regulamento para desempatar.`, confirmLabel: 'Iniciar prorrogação' }))) return;
    operationLock.current = true;
    await dispatch({ type: 'match/updateClock', payload: { id: match.id, patch: { currentPeriod: currentPeriod + 1, clockSeconds: 0, paused: false, runningSince: new Date().toISOString(), periodScoreA: 0, periodScoreB: 0 } }, audit: { action: 'Prorrogação iniciada', entity: `${match.entryA} × ${match.entryB}`, after: `${homeScore} × ${awayScore}` } });
    setClock(0);
    announce('Prorrogação iniciada.');
    playSound(soundForLifecycle('period-start', match.discipline));
    operationLock.current = false;
  }

  async function undoLastAction() {
    const last = events[0];
    if (!last || !allowed || finished || operationLock.current) { if (!last) toast('Nenhum evento para desfazer.', 'error'); return; }
    if (!(await confirm({ title: 'Desfazer último evento?', message: `${last.type}: ${last.detail}. O placar também será restaurado.`, confirmLabel: 'Desfazer' }))) return;
    operationLock.current = true;
    const restore = last.previous ?? { scoreA: last.previousScoreA ?? homeScore, scoreB: last.previousScoreB ?? awayScore, periodScoreA, periodScoreB, currentPeriod };
    await dispatch({
      type: 'match/undoEvent',
      payload: { id: match.id, eventId: last.id, restore },
      audit: { action: 'Último evento desfeito', entity: `${match.entryA} × ${match.entryB}`, before: `${last.scoreA} × ${last.scoreB}`, after: `${restore.scoreA} × ${restore.scoreB}` },
    });
    announce(`Evento desfeito. Placar restaurado: ${match.entryA}, ${restore.scoreA}; ${match.entryB}, ${restore.scoreB}.`);
    showImpact('orange');
    window.setTimeout(() => { operationLock.current = false; }, 350);
  }

  function persistFinish(tiebreak?: MatchTiebreakState, reason?: string) {
    void dispatch({
      type: 'match/finish',
      payload: {
        id: match.id,
        patch: { status: 'Encerrada', paused: true, runningSince: undefined, clockSeconds: currentClock(), currentPeriod, scoreA: homeScore, scoreB: awayScore, tiebreak },
      },
      audit: {
        action: 'Partida encerrada',
        entity: `${match.entryA} × ${match.entryB}`,
        after: tiebreak ? `${homeScore} × ${awayScore} · ${tiebreak.label}: ${tiebreak.winner}` : `${homeScore} × ${awayScore}`,
        reason,
      },
    });
    announce(`Partida encerrada. Placar final: ${match.entryA}, ${homeScore}; ${match.entryB}, ${awayScore}.`);
    playSound(soundForLifecycle('match-end', match.discipline));
  }

  async function finishMatch() {
    if (!allowed || finished || !live || operationLock.current) return;
    const check = evaluateFinish(regulation, { scoreA: homeScore, scoreB: awayScore, currentPeriod, elimination });
    if (check.requiresTiebreak) {
      setTiebreakDraft({ method: regulation.knockout.method, scoreA: '', scoreB: '', winner: '', reason: '' });
      setTiebreakOpen(true);
      toast(check.message, 'error');
      return;
    }
    const reason = check.requiresEarlyClose ? check.message : undefined;
    if (!(await confirm({
      title: check.requiresEarlyClose ? 'Encerrar antes do previsto?' : 'Encerrar partida?',
      message: `Confirme o placar final: ${match.entryA} ${homeScore} × ${awayScore} ${match.entryB}.${reason ? ` ${reason}` : ''}`,
      confirmLabel: 'Encerrar partida',
      danger: true,
    }))) return;
    operationLock.current = true;
    persistFinish(undefined, reason);
    operationLock.current = false;
  }

  function submitTiebreak(event: React.FormEvent) {
    event.preventDefault();
    if (!tiebreakDraft.winner || tiebreakDraft.reason.trim().length < 5) { toast('Informe o vencedor e o motivo do desempate.', 'error'); return; }
    const requiresScore = ['penaltis', 'prorrogacao', 'set-extra'].includes(tiebreakDraft.method);
    if (requiresScore && (!tiebreakDraft.scoreA || !tiebreakDraft.scoreB)) { toast('Informe o placar do desempate.', 'error'); return; }
    const tiebreak: MatchTiebreakState = {
      method: tiebreakDraft.method,
      label: knockoutMethodLabels[tiebreakDraft.method],
      scoreA: Number(tiebreakDraft.scoreA || 0),
      scoreB: Number(tiebreakDraft.scoreB || 0),
      winner: tiebreakDraft.winner,
      reason: tiebreakDraft.reason.trim(),
      decidedBy: session?.name ?? 'Operador',
      at: new Date().toISOString(),
    };
    setTiebreakOpen(false);
    persistFinish(tiebreak, tiebreak.reason);
  }

  if (invalidMatch) return <main className="app-screen live-screen theme-matches"><div className="empty-state"><strong>PARTIDA NÃO ENCONTRADA</strong><p>O identificador informado não pertence à edição atual.</p><Link href={`/matches?modalidade=${encodeURIComponent(state.preferences.selectedDiscipline)}`} className="wide-action">VOLTAR PARA JOGOS</Link></div><BottomNav active="matches" /></main>;

  const displayClock = hasClock ? formatClock(matchClockLabel({ ...regulation.base, periodDurationMinutes }, clock)) : 'SEM CRONÔMETRO';
  const actionDisabled = !live || (hasClock && paused) || finished;
  const eventTime = (event: MatchEventState) => hasClock ? formatClock(matchClockLabel({ ...regulation.base, periodDurationMinutes }, event.periodElapsedSeconds ?? event.elapsedSeconds)) : `#${event.elapsedSeconds + 1}`;
  const tiedAtRegulationEnd = completion.mode === 'periods' && !completion.allowDraw && homeScore === awayScore && currentPeriod >= totalPeriods && overtimePeriods > 0 && currentPeriod < totalPeriods + overtimePeriods;
  const setLabel = isSets && completion.mode === 'sets' ? `${setTarget(regulation, currentPeriod)} pontos · vantagem ${completion.minAdvantage}` : '';

  return (
    <main className={`app-screen live-screen theme-matches motion-page ${paused ? 'is-paused' : ''}`}>
      <div className={`diagonal-impact impact-${impact ?? 'none'}`} aria-hidden="true" />
      <PageNavigation title="PLACAR AO VIVO" />
      <header className="live-topbar motion-enter motion-delay-1">
        <div><p className="eyebrow orange">{match.discipline.toUpperCase()} · INTERENG 2026</p><h1>{phase}</h1></div>
        <div className="live-status-actions">
          <button type="button" className="sound-toggle" onClick={() => void setPreference({ soundEffects: !soundEnabled })} aria-label={soundEnabled ? 'Desativar sons do placar' : 'Ativar sons do placar'}>{soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <span className={`live-status ${paused ? 'paused' : ''}`}><i /> {finished ? 'ENCERRADA' : live ? (paused ? 'PAUSADA' : 'AO VIVO') : String(status).toUpperCase()}</span>
        </div>
      </header>

      <section className={`score-hero motion-enter motion-delay-2 ${impact ? `score-impact-${impact}` : ''}`}>
        <div className="score-team score-team-blue"><TeamMark initial={match.entryA[0]} tone="blue" logo={match.logoA} /><strong>{match.entryA}</strong></div>
        <div className="score-center">
          <div className="score-numbers"><strong className={`score-blue ${impact === 'blue' ? 'score-pop' : ''}`}>{homeScore}</strong><span>—</span><strong className={`score-pink ${impact === 'pink' ? 'score-pop' : ''}`}>{awayScore}</strong></div>
          <small className="game-period">{isSets ? `SETS · ${periodLabel.toUpperCase()} ${currentPeriod} DE ${totalPeriods}` : `${currentPeriod}º ${periodLabel.toUpperCase()}${inOvertime ? '' : ` DE ${totalPeriods}`}`}</small>
          {isSets ? <div className="set-scoreboard" aria-label={`Pontos do ${regulation.base.periodLabel.toLowerCase()} atual`}><strong>{periodScoreA}</strong><small>{setLabel}</small><strong>{periodScoreB}</strong></div> : null}
          <div className="game-clock" aria-label={`${periodLabel} ${currentPeriod}, cronômetro ${displayClock}`}><Clock3 size={19} />{displayClock}</div>
        </div>
        <div className="score-team score-team-pink"><TeamMark initial={match.entryB[0]} tone="pink" logo={match.logoB} /><strong>{match.entryB}</strong></div>
      </section>

      {persisted.periodResults?.length ? <p className="period-results">Parciais: {persisted.periodResults.map((item) => `${item.scoreA}-${item.scoreB}`).join(' · ')}</p> : null}

      {operatorConflict ? <div className="info-banner" role="status"><KeyRound size={18} /><div><strong>{persisted.operatorName ?? 'Outro operador'} está operando este placar.</strong><p>Assuma a operação para registrar eventos por este dispositivo.</p></div>{authorized ? <button type="button" className="secondary-button" onClick={() => void takeOperation()}>Assumir operação</button> : null}</div> : null}

      {!authorized ? <div className="info-banner" role="status"><p>Seu perfil pode acompanhar este placar, mas não operar a modalidade {match.discipline}.</p></div> : null}

      {authorized && !live && !finished ? (
        <section className="match-start-panel motion-enter motion-delay-3">
          <div><p className="eyebrow orange">CONFIRMAÇÃO DE INÍCIO</p><h2>A PARTIDA AINDA NÃO COMEÇOU</h2><p>{describeCompletion(regulation)}. Abrir o placar não inicia o jogo: confirme o início para que o resultado passe a valer.</p></div>
          <button type="button" className="wide-action" onClick={() => void startMatch()} disabled={operatorConflict}><PlayCircle size={18} /> INICIAR PARTIDA <span>›</span></button>
        </section>
      ) : null}

      {allowed && live && !finished ? <>
        <section className="event-actions motion-enter motion-delay-3" aria-label="Ações do placar">
          {isDeclarative ? <>
            <button className="event-btn blue sport-press" onClick={() => declareResult('home')} disabled={actionDisabled}><Goal size={25} /><span>Vitória<small>{match.entryA}</small></span></button>
            {completion.mode === 'board' && completion.allowDraw ? <button className="event-btn neutral sport-press" onClick={() => declareResult('draw')} disabled={actionDisabled}><Handshake size={24} /><span>Empate<small>{completion.drawPoints} para cada</small></span></button> : null}
            <button className="event-btn pink sport-press" onClick={() => declareResult('away')} disabled={actionDisabled}><CircleDot size={25} /><span>Vitória<small>{match.entryB}</small></span></button>
          </> : regulation.scoring.flatMap((action) => ([
            <button key={`${action.id}-home`} className="event-btn blue sport-press" onClick={() => registerScore(action.label, action.points, 'home', 'blue')} disabled={actionDisabled}><Goal size={25} /><span>{action.label}{action.points > 1 ? ` +${action.points}` : ''}<small>{match.entryA}</small></span></button>,
            <button key={`${action.id}-away`} className="event-btn pink sport-press" onClick={() => registerScore(action.label, action.points, 'away', 'pink')} disabled={actionDisabled}><CircleDot size={25} /><span>{action.label}{action.points > 1 ? ` +${action.points}` : ''}<small>{match.entryB}</small></span></button>,
          ]))}
          {regulation.secondary.flatMap((action, index) => (action.requiresSide ? [
            <button key={`${action.id}-home`} className={`event-btn ${index === 0 ? 'orange' : 'neutral'} sport-press`} onClick={() => registerSecondary(action.label, 'home', action.allowedWhenStopped)} disabled={!live || finished || (hasClock && paused && !action.allowedWhenStopped)}>{index === 0 ? <Flag size={25} /> : <Square size={24} />}<span>{action.label}<small>{match.entryA}</small></span></button>,
            <button key={`${action.id}-away`} className={`event-btn ${index === 0 ? 'orange' : 'neutral'} sport-press`} onClick={() => registerSecondary(action.label, 'away', action.allowedWhenStopped)} disabled={!live || finished || (hasClock && paused && !action.allowedWhenStopped)}>{index === 0 ? <Flag size={25} /> : <Square size={24} />}<span>{action.label}<small>{match.entryB}</small></span></button>,
          ] : [
            <button key={action.id} className="event-btn neutral sport-press" onClick={() => registerSecondary(action.label, 'neutral', action.allowedWhenStopped)} disabled={!live || finished}><Square size={24} /><span>{action.label}</span></button>,
          ]))}
        </section>

        <section className="match-controls motion-enter motion-delay-4">
          {hasClock ? <button type="button" className="sport-press" onClick={togglePause} disabled={finished || clock >= periodDurationSeconds}>{paused ? <Play size={19} /> : <Pause size={19} />}{paused ? 'Retomar' : 'Pausar'}</button> : null}
          <button type="button" className="sport-press" onClick={() => void advancePeriod()} disabled={finished || currentPeriod >= totalPeriods}><SkipForward size={19} />Próximo {periodLabel.toLowerCase()}</button>
          {tiedAtRegulationEnd ? <button type="button" className="sport-press" onClick={() => void startOvertime()}><TimerReset size={19} />Prorrogação</button> : null}
          <button type="button" className="sport-press" onClick={() => void undoLastAction()} disabled={finished || !events.length}><RotateCcw size={19} />Desfazer</button>
          <button type="button" className="finish sport-press" onClick={() => void finishMatch()} disabled={finished}><TimerReset size={19} />Encerrar</button>
          {holdsOperation ? <button type="button" className="sport-press" onClick={releaseOperation}><KeyRound size={19} />Liberar operação</button> : null}
        </section>
      </> : null}

      {tiebreakOpen ? (
        <form className="tiebreak-panel motion-enter" onSubmit={submitTiebreak}>
          <div className="section-title-row"><div><p className="eyebrow orange">DESEMPATE OBRIGATÓRIO</p><h2>{elimination ? 'PARTIDA ELIMINATÓRIA EMPATADA' : 'ESTA MODALIDADE NÃO ADMITE EMPATE'}</h2></div><Scale size={22} /></div>
          <p>Regulamento da modalidade: {regulation.knockout.label}. Registre como o confronto foi resolvido.</p>
          <label><span>Critério aplicado</span><select value={tiebreakDraft.method} onChange={(event) => setTiebreakDraft({ ...tiebreakDraft, method: event.target.value as KnockoutMethod })}>{Object.entries(knockoutMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {['penaltis', 'prorrogacao', 'set-extra'].includes(tiebreakDraft.method) ? <div className="tiebreak-scores">
            <label><span>{match.entryA}</span><input type="number" min="0" value={tiebreakDraft.scoreA} onChange={(event) => setTiebreakDraft({ ...tiebreakDraft, scoreA: event.target.value })} /></label>
            <label><span>{match.entryB}</span><input type="number" min="0" value={tiebreakDraft.scoreB} onChange={(event) => setTiebreakDraft({ ...tiebreakDraft, scoreB: event.target.value })} /></label>
          </div> : null}
          <label><span>Equipe classificada</span><select value={tiebreakDraft.winner} onChange={(event) => setTiebreakDraft({ ...tiebreakDraft, winner: event.target.value })} required><option value="" disabled>Selecione</option><option>{match.entryA}</option><option>{match.entryB}</option></select></label>
          <label><span>Motivo / registro da súmula</span><input value={tiebreakDraft.reason} onChange={(event) => setTiebreakDraft({ ...tiebreakDraft, reason: event.target.value })} placeholder="Ex.: cobranças de pênaltis 4 a 2" required /></label>
          <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setTiebreakOpen(false)}>Cancelar</button><button type="submit" className="primary-button">Registrar desempate e encerrar</button></div>
        </form>
      ) : null}

      {persisted.tiebreak ? <div className="info-banner" role="status"><Scale size={18} /><div><strong>{persisted.tiebreak.label}: {persisted.tiebreak.winner}</strong><p>{persisted.tiebreak.scoreA} × {persisted.tiebreak.scoreB} · {persisted.tiebreak.reason} · decidido por {persisted.tiebreak.decidedBy}.</p></div></div> : null}
      {persisted.startNote ? <div className="info-banner" role="status"><p><strong>Justificativa do início:</strong> {persisted.startNote}</p></div> : null}

      <section className="timeline-block motion-enter motion-delay-5">
        <div className="section-title-row"><div><p className="eyebrow">PARTIDA</p><h2>EVENTOS</h2></div></div>
        <div className="event-timeline">{events.length ? events.map((event, index) => { const tone: EventTone = event.side === 'home' ? 'blue' : event.side === 'away' ? 'pink' : 'orange'; return <article className={`timeline-item ${index === 0 ? 'timeline-new' : ''}`} key={event.id}><span className={`timeline-minute minute-${tone}`}><small>{event.period ?? 1}º {regulation.base.periodLabel.slice(0, 1)}</small>{eventTime(event)}</span><div><strong>{event.type}{event.points ? ` (+${event.points})` : ''}</strong><p>{event.detail}</p></div></article>; }) : <p className="match-filter-empty">Nenhum evento registrado nesta partida.</p>}</div>
      </section>
      <BottomNav active="matches" />
    </main>
  );
}
