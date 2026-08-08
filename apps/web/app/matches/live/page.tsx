'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CircleDot, Clock3, Flag, Goal, Pause, Play, RotateCcw, Square, TimerReset } from 'lucide-react';
import { BottomNav } from '../../components/BottomNav';
import { TeamMark } from '../../components/AppShell';
import { AdminRouteGuard } from '../../components/AdminRouteGuard';
import { useUi } from '../../components/UiProvider';
import { matches } from '../../lib/mock-data';
import { MatchEventState, useFrontendState } from '../../lib/frontend-state';
import { canManageDiscipline, useFrontendSession } from '../../lib/frontend-session';
import { formatClock } from '../../lib/tournament-engine';
import { progressTournament } from '../../lib/tournament-progression';

type EventTone = 'blue' | 'pink' | 'orange';

const rules: Record<string, { score: string; extraA: string; extraB: string }> = {
  Futsal: { score: 'Gol', extraA: 'Falta', extraB: 'Cartão' },
  Vôlei: { score: 'Ponto', extraA: 'Fim de set', extraB: 'Falta' },
  Handebol: { score: 'Gol', extraA: 'Falta', extraB: '2 minutos' },
  Xadrez: { score: 'Ponto', extraA: 'Advertência', extraB: 'Encerrar tabuleiro' },
};

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
  const initialized = useRef<string | null>(null);
  const operatorId = useRef(`operator-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const storedRequested = matchId ? state.matches[matchId] : undefined;
  const localMatch = matchId && storedRequested?.created ? { id: matchId, time: storedRequested.time ?? '--:--', date: storedRequested.date ?? 'Hoje', discipline: storedRequested.discipline ?? 'Modalidade', entryA: storedRequested.entryA ?? 'Equipe A', logoA: storedRequested.logoA ?? '', entryB: storedRequested.entryB ?? 'Equipe B', logoB: storedRequested.logoB ?? '', scoreA: storedRequested.scoreA ?? null, scoreB: storedRequested.scoreB ?? null, venue: storedRequested.venue ?? 'A definir', phase: storedRequested.phase ?? 'Fase atual', status: storedRequested.status ?? 'Agendada' } : undefined;
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
  const disciplineRules = rules[match.discipline] ?? { score: 'Ponto', extraA: 'Falta', extraB: 'Ocorrência' };
  const [clock, setClock] = useState(0);
  const [impact, setImpact] = useState<EventTone | null>(null);

  function currentClock() {
    const base = persisted.clockSeconds ?? 0;
    if (persisted.paused || !persisted.runningSince || finished) return base;
    return base + Math.max(0, Math.floor((Date.now() - new Date(persisted.runningSince).getTime()) / 1000));
  }

  useEffect(() => {
    if (!hydrated || invalidMatch || !allowed || initialized.current === match.id) return;
    initialized.current = match.id;
    if (!['Ao vivo', 'Encerrada'].includes(status)) {
      commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], status: 'Ao vivo', scoreA: homeScore, scoreB: awayScore, paused: false, clockSeconds: current.matches[match.id]?.clockSeconds ?? 0, runningSince: new Date().toISOString(), events: current.matches[match.id]?.events ?? [] } } }), { action: 'Partida iniciada', entity: `${match.entryA} × ${match.entryB}`, after: 'Ao vivo' });
    } else if (status === 'Ao vivo' && !paused && !persisted.runningSince) {
      commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], runningSince: new Date().toISOString() } } }));
    }
  }, [allowed, awayScore, commit, homeScore, hydrated, invalidMatch, match.entryA, match.entryB, match.id, paused, persisted.runningSince, status]);

  useEffect(() => {
    if (!hydrated || invalidMatch || !authorized || finished || operatorConflict) return;
    const heartbeat = () => commit((current) => { const active = current.matches[match.id] ?? {}; const fresh = active.operatorHeartbeat && Date.now() - new Date(active.operatorHeartbeat).getTime() < 30_000; if (fresh && active.operatorId && active.operatorId !== operatorId.current) return current; return { ...current, matches: { ...current.matches, [match.id]: { ...active, operatorId: operatorId.current, operatorName: session?.name ?? 'Operador', operatorHeartbeat: new Date().toISOString() } } }; });
    heartbeat();
    const timer = window.setInterval(heartbeat, 10_000);
    return () => { window.clearInterval(timer); commit((current) => { const active = current.matches[match.id]; if (active?.operatorId !== operatorId.current) return current; return { ...current, matches: { ...current.matches, [match.id]: { ...active, operatorId: undefined, operatorName: undefined, operatorHeartbeat: undefined } } }; }); };
  }, [authorized, commit, finished, hydrated, invalidMatch, match.id, operatorConflict, session?.name]);

  useEffect(() => {
    setClock(currentClock());
    if (paused || finished || !persisted.runningSince) return;
    const timer = window.setInterval(() => setClock(currentClock()), 1000);
    return () => window.clearInterval(timer);
  }, [finished, match.id, paused, persisted.clockSeconds, persisted.runningSince]);

  function showImpact(tone: EventTone) {
    setImpact(tone);
    window.setTimeout(() => setImpact(null), 600);
  }

  function registerEvent(type: string, detail: string, tone: EventTone, side: MatchEventState['side'] = 'neutral', nextA = homeScore, nextB = awayScore) {
    if (!allowed || paused || finished || operationLock.current) return;
    operationLock.current = true;
    const event: MatchEventState = { id: `event-${Date.now()}`, at: new Date().toISOString(), elapsedSeconds: clock, type, detail, side, scoreA: nextA, scoreB: nextB, previousScoreA: homeScore, previousScoreB: awayScore };
    commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], status: 'Ao vivo', scoreA: nextA, scoreB: nextB, events: [event, ...(current.matches[match.id]?.events ?? [])] } } }), { action: `${type} registrado`, entity: detail, after: `${nextA} × ${nextB}` });
    showImpact(tone);
    window.setTimeout(() => { operationLock.current = false; }, 350);
  }

  function togglePause() {
    if (!allowed || finished || operationLock.current) return;
    operationLock.current = true;
    const nextPaused = !paused;
    commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], paused: nextPaused, clockSeconds: nextPaused ? clock : current.matches[match.id]?.clockSeconds ?? clock, runningSince: nextPaused ? undefined : new Date().toISOString() } } }), { action: nextPaused ? 'Cronômetro pausado' : 'Cronômetro retomado', entity: `${match.entryA} × ${match.entryB}`, after: formatClock(clock) });
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
    showImpact('orange');
    window.setTimeout(() => { operationLock.current = false; }, 350);
  }

  async function finishMatch() {
    if (!allowed || finished || operationLock.current || !(await confirm({ title: 'Encerrar partida?', message: `Confirme o placar final: ${match.entryA} ${homeScore} × ${awayScore} ${match.entryB}.`, confirmLabel: 'Encerrar partida', danger: true }))) return;
    operationLock.current = true;
    commit((current) => progressTournament({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], status: 'Encerrada', paused: true, runningSince: undefined, clockSeconds: clock, scoreA: homeScore, scoreB: awayScore } } }, current.matches[match.id]?.tournamentId ?? persisted.tournamentId), { action: 'Partida encerrada', entity: `${match.entryA} × ${match.entryB}`, after: `${homeScore} × ${awayScore}` });
    operationLock.current = false;
  }

  if (invalidMatch) return <main className="app-screen live-screen theme-matches"><div className="empty-state"><strong>PARTIDA NÃO ENCONTRADA</strong><p>O identificador informado não pertence à edição atual.</p><Link href={`/matches?modalidade=${encodeURIComponent(state.preferences.selectedDiscipline)}`} className="wide-action">VOLTAR PARA JOGOS</Link></div><BottomNav active="matches" /></main>;

  return <main className={`app-screen live-screen theme-matches motion-page ${paused ? 'is-paused' : ''}`}><div className={`diagonal-impact impact-${impact ?? 'none'}`} aria-hidden="true" /><header className="live-topbar motion-enter motion-delay-1"><div><p className="eyebrow orange">{match.discipline.toUpperCase()} · INTERENG 2026</p><h1>{match.phase}</h1></div><span className={`live-status ${paused ? 'paused' : ''}`}><i /> {finished ? 'ENCERRADA' : paused ? 'PAUSADA' : 'AO VIVO'}</span></header><section className={`score-hero motion-enter motion-delay-2 ${impact ? `score-impact-${impact}` : ''}`}><div className="score-team score-team-blue"><TeamMark initial={match.entryA[0]} tone="blue" logo={match.logoA} /><strong>{match.entryA}</strong></div><div className="score-center"><div className="score-numbers"><strong className={`score-blue ${impact === 'blue' ? 'score-pop' : ''}`}>{homeScore}</strong><span>—</span><strong className={`score-pink ${impact === 'pink' ? 'score-pop' : ''}`}>{awayScore}</strong></div><div className="game-clock" aria-label={`Cronômetro ${formatClock(clock)}`}><Clock3 size={19} />{formatClock(clock)}</div></div><div className="score-team score-team-pink"><TeamMark initial={match.entryB[0]} tone="pink" logo={match.logoB} /><strong>{match.entryB}</strong></div></section>{allowed ? <><section className="event-actions motion-enter motion-delay-3" aria-label="Ações rápidas"><button className="event-btn blue sport-press" onClick={() => registerEvent(disciplineRules.score, match.entryA, 'blue', 'home', homeScore + 1, awayScore)} disabled={paused || finished}><Goal size={25} /><span>{disciplineRules.score} {match.entryA}</span></button><button className="event-btn pink sport-press" onClick={() => registerEvent(disciplineRules.score, match.entryB, 'pink', 'away', homeScore, awayScore + 1)} disabled={paused || finished}><CircleDot size={25} /><span>{disciplineRules.score} {match.entryB}</span></button><button className="event-btn orange sport-press" onClick={() => registerEvent(disciplineRules.extraA, match.entryA, 'orange')} disabled={paused || finished}><Flag size={25} /><span>{disciplineRules.extraA}</span></button><button className="event-btn neutral sport-press" onClick={() => registerEvent(disciplineRules.extraB, match.entryB, 'orange')} disabled={paused || finished}><Square size={24} /><span>{disciplineRules.extraB}</span></button></section><section className="match-controls motion-enter motion-delay-4"><button type="button" className="sport-press" onClick={togglePause} disabled={finished}>{paused ? <Play size={19} /> : <Pause size={19} />}{paused ? 'Retomar' : 'Pausar'}</button><button type="button" className="sport-press" onClick={undoLastAction} disabled={finished || !events.length}><RotateCcw size={19} />Desfazer</button><button type="button" className="finish sport-press" onClick={finishMatch} disabled={finished}><TimerReset size={19} />{finished ? 'Encerrada' : 'Encerrar'}</button></section></> : <div className="info-banner" role="status"><p>Seu perfil pode acompanhar este placar, mas não operar a modalidade {match.discipline}.</p></div>}<section className="timeline-block motion-enter motion-delay-5"><div className="section-title-row"><div><p className="eyebrow">PARTIDA</p><h2>EVENTOS</h2></div></div><div className="event-timeline">{events.length ? events.map((event, index) => { const tone: EventTone = event.side === 'home' ? 'blue' : event.side === 'away' ? 'pink' : 'orange'; return <article className={`timeline-item ${index === 0 ? 'timeline-new' : ''}`} key={event.id}><span className={`timeline-minute minute-${tone}`}>{Math.floor(event.elapsedSeconds / 60)}′</span><div><strong>{event.type}</strong><p>{event.detail}</p></div></article>; }) : <p className="match-filter-empty">Nenhum evento registrado nesta partida.</p>}</div></section><BottomNav active="matches" /></main>;
}
