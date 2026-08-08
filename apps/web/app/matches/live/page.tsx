'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CircleDot, Clock3, Flag, Goal, Pause, Play, RotateCcw, Square, TimerReset } from 'lucide-react';
import { BottomNav } from '../../components/BottomNav';
import { TeamMark } from '../../components/AppShell';
import { matches } from '../../lib/mock-data';
import { useFrontendState } from '../../lib/frontend-state';

type EventTone = 'blue' | 'pink' | 'orange';
type MatchEvent = { minute: string; title: string; detail: string; tone: EventTone };
type LocalAction = { side: 'home' | 'away' | 'event' };

export default function LiveMatchPage() {
  return (
    <Suspense fallback={<main className="app-screen live-screen theme-matches"><p className="match-filter-empty">Carregando partida...</p></main>}>
      <LiveMatchContent />
    </Suspense>
  );
}

function LiveMatchContent() {
  const searchParams = useSearchParams();
  const matchId = searchParams.get('partida');
  const { state, commit } = useFrontendState();
  const storedRequested = matchId ? state.matches[matchId] : undefined;
  const localMatch = matchId && storedRequested?.created ? { id: matchId, time: storedRequested.time ?? '--:--', date: storedRequested.date ?? 'Hoje', discipline: storedRequested.discipline ?? 'Modalidade', entryA: storedRequested.entryA ?? 'Equipe A', logoA: storedRequested.logoA ?? '', entryB: storedRequested.entryB ?? 'Equipe B', logoB: storedRequested.logoB ?? '', scoreA: storedRequested.scoreA ?? null, scoreB: storedRequested.scoreB ?? null, venue: storedRequested.venue ?? 'A definir', phase: storedRequested.phase ?? 'Fase atual', status: storedRequested.status ?? 'Agendada' } : undefined;
  const requestedMatch = matchId ? matches.find((item) => item.id === matchId) ?? localMatch : undefined;
  const match = requestedMatch ?? matches.find((item) => item.status === 'Ao vivo') ?? matches[0];
  const invalidMatch = Boolean(matchId && !requestedMatch);
  const persistedMatch = state.matches[match.id] ?? {};
  const [homeScore, setHomeScore] = useState(persistedMatch.scoreA ?? match.scoreA ?? 0);
  const [awayScore, setAwayScore] = useState(persistedMatch.scoreB ?? match.scoreB ?? 0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [actions, setActions] = useState<LocalAction[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([
    { minute: "72'", title: 'Gol', detail: `${match.entryA} · evento registrado`, tone: 'blue' },
    { minute: "65'", title: 'Gol', detail: `${match.entryB} · evento registrado`, tone: 'pink' },
  ]);
  const [impact, setImpact] = useState<EventTone | null>(null);
  const [toast, setToast] = useState('');

  const statusLabel = finished ? 'ENCERRADA' : paused ? 'PAUSADA' : 'AO VIVO';
  const latestMinute = useMemo(() => "73'", []);
  const primaryEvent = match.discipline === 'Futsal' ? 'Gol' : 'Ponto';

  useEffect(() => {
    if (!invalidMatch && (state.matches[match.id]?.status ?? match.status) !== 'Ao vivo') {
      commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], status: 'Ao vivo' } } }), { action: 'Partida iniciada', entity: `${match.entryA} × ${match.entryB}`, after: 'Ao vivo' });
    }
  }, [commit, invalidMatch, match.entryA, match.entryB, match.id, match.status, state.matches]);

  function triggerImpact(tone: EventTone, message: string) {
    setImpact(tone);
    setToast(message);
    window.setTimeout(() => setImpact(null), 650);
    window.setTimeout(() => setToast(''), 1800);
  }

  function registerEvent(title: string, detail: string, tone: EventTone, side: LocalAction['side'] = 'event') {
    const event = { minute: latestMinute, title, detail, tone };
    setEvents((current) => [event, ...current]);
    setActions((current) => [...current, { side }]);
    triggerImpact(tone, `${title.toUpperCase()} REGISTRADO`);
  }

  function registerHomeScore() {
    const score = homeScore + 1;
    setHomeScore(score);
    commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], status: 'Ao vivo', scoreA: score, scoreB: awayScore } } }), { action: `${primaryEvent} registrado`, entity: match.entryA, after: String(score) });
    registerEvent(primaryEvent, `${match.entryA} · novo evento`, 'blue', 'home');
  }

  function registerAwayScore() {
    const score = awayScore + 1;
    setAwayScore(score);
    commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], status: 'Ao vivo', scoreA: homeScore, scoreB: score } } }), { action: `${primaryEvent} registrado`, entity: match.entryB, after: String(score) });
    registerEvent(primaryEvent, `${match.entryB} · novo evento`, 'pink', 'away');
  }

  function undoLastAction() {
    const lastAction = actions.at(-1);
    if (!lastAction) {
      setToast('NENHUMA AÇÃO PARA DESFAZER');
      window.setTimeout(() => setToast(''), 1800);
      return;
    }
    const nextHome = lastAction.side === 'home' ? Math.max(0, homeScore - 1) : homeScore;
    const nextAway = lastAction.side === 'away' ? Math.max(0, awayScore - 1) : awayScore;
    setHomeScore(nextHome);
    setAwayScore(nextAway);
    commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], scoreA: nextHome, scoreB: nextAway } } }), { action: 'Último evento desfeito', entity: `${match.entryA} × ${match.entryB}`, after: `${nextHome} × ${nextAway}` });
    setActions((current) => current.slice(0, -1));
    setEvents((current) => current.slice(1));
    triggerImpact('orange', 'ÚLTIMA AÇÃO DESFEITA');
  }

  function finishMatch() {
    setFinished(true);
    setPaused(true);
    commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], status: 'Encerrada', scoreA: homeScore, scoreB: awayScore } } }), { action: 'Partida encerrada', entity: `${match.entryA} × ${match.entryB}`, after: `${homeScore} × ${awayScore}` });
    setToast('PARTIDA ENCERRADA NO PROTÓTIPO');
    window.setTimeout(() => setToast(''), 1800);
  }

  if (invalidMatch) {
    return <main className="app-screen live-screen theme-matches"><div className="empty-state"><strong>PARTIDA NÃO ENCONTRADA</strong><p>O identificador informado não pertence à edição atual.</p><Link href="/matches?modalidade=Futsal" className="wide-action">VOLTAR PARA JOGOS</Link></div><BottomNav active="matches" /></main>;
  }

  return (
    <main className={`app-screen live-screen theme-matches ${paused ? 'is-paused' : ''}`}>
      <div className={`diagonal-impact impact-${impact ?? 'none'}`} aria-hidden="true" />
      {toast && <div className={`sport-toast toast-${impact ?? 'blue'}`}>{toast}</div>}

      <header className="live-topbar motion-enter motion-delay-1">
        <div><p className="eyebrow orange">{match.discipline.toUpperCase()} · INTERENG 2026</p><h1>{match.phase}</h1></div>
        <span className={`live-status ${paused ? 'paused' : ''}`}><i /> {statusLabel}</span>
      </header>

      <section className={`score-hero motion-enter motion-delay-2 ${impact ? `score-impact-${impact}` : ''}`}>
        <div className="score-team score-team-blue">
          <TeamMark initial={match.entryA[0]} tone="blue" logo={match.logoA} />
          <strong>{match.entryA}</strong>
        </div>
        <div className="score-center">
          <div className="score-numbers">
            <strong className={`score-blue ${impact === 'blue' ? 'score-pop' : ''}`}>{homeScore}</strong>
            <span>—</span>
            <strong className={`score-pink ${impact === 'pink' ? 'score-pop' : ''}`}>{awayScore}</strong>
          </div>
          <div className="game-clock"><Clock3 size={19} />72:45</div>
        </div>
        <div className="score-team score-team-pink">
          <TeamMark initial={match.entryB[0]} tone="pink" logo={match.logoB} />
          <strong>{match.entryB}</strong>
        </div>
      </section>

      <section className="event-actions motion-enter motion-delay-3" aria-label="Ações rápidas">
        <button className="event-btn blue sport-press" onClick={registerHomeScore} disabled={paused || finished}><Goal size={25} /><span>{primaryEvent} {match.entryA}</span></button>
        <button className="event-btn pink sport-press" onClick={registerAwayScore} disabled={paused || finished}><CircleDot size={25} /><span>{primaryEvent} {match.entryB}</span></button>
        <button className="event-btn orange sport-press" onClick={() => registerEvent(match.discipline === 'Vôlei' ? 'Fim de set' : 'Falta', `${match.entryA} · novo evento`, 'orange')} disabled={paused || finished}><Flag size={25} /><span>{match.discipline === 'Vôlei' ? 'Fim de set' : 'Falta'}</span></button>
        <button className="event-btn neutral sport-press" onClick={() => registerEvent(match.discipline === 'Futsal' ? 'Cartão' : 'Falta', `${match.entryB} · novo evento`, 'orange')} disabled={paused || finished}><Square size={24} /><span>{match.discipline === 'Futsal' ? 'Cartão' : 'Falta'}</span></button>
      </section>

      <section className="match-controls motion-enter motion-delay-4">
        <button type="button" className="sport-press" onClick={() => setPaused((value) => !value)} disabled={finished}>{paused ? <Play size={19} /> : <Pause size={19} />}{paused ? 'Retomar' : 'Pausar'}</button>
        <button type="button" className="sport-press" onClick={undoLastAction} disabled={finished}><RotateCcw size={19} />Desfazer</button>
        <button type="button" className="finish sport-press" onClick={finishMatch} disabled={finished}><TimerReset size={19} />{finished ? 'Encerrada' : 'Encerrar'}</button>
      </section>

      <section className="timeline-block motion-enter motion-delay-5">
        <div className="section-title-row"><div><p className="eyebrow">PARTIDA</p><h2>EVENTOS</h2></div></div>
        <div className="event-timeline">
          {events.map((event, index) => (
            <article className={`timeline-item ${index === 0 ? 'timeline-new' : ''}`} key={`${event.minute}-${event.title}-${index}`}>
              <span className={`timeline-minute minute-${event.tone}`}>{event.minute}</span>
              <div><strong>{event.title}</strong><p>{event.detail}</p></div>
            </article>
          ))}
        </div>
      </section>

      <BottomNav active="matches" />
    </main>
  );
}
