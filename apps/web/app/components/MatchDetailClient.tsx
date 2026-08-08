'use client';

import Link from 'next/link';
import { Clock3, Pencil, Radio } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MatchSummary } from './MatchSummary';
import { useFrontendState } from '../lib/frontend-state';
import { canManageDiscipline, useFrontendSession } from '../lib/frontend-session';
import { formatClock } from '../lib/tournament-engine';

type MatchBase = { id: string; discipline: string; phase: string; status: string; entryA: string; logoA: string; entryB: string; logoB: string; scoreA: number | null; scoreB: number | null; date: string; time: string; venue: string };

export function MatchDetailClient({ match, readOnly = false }: { match: MatchBase; readOnly?: boolean }) {
  const { state } = useFrontendState();
  const { session } = useFrontendSession();
  const override = state.matches[match.id] ?? {};
  const current = { ...match, ...override, scoreA: override.scoreA ?? match.scoreA, scoreB: override.scoreB ?? match.scoreB };
  const operable = !['Encerrada', 'Cancelada', 'W.O.'].includes(current.status);
  const canOperate = canManageDiscipline(session, current.discipline);
  const [clock, setClock] = useState(override.clockSeconds ?? 0);
  useEffect(() => {
    const update = () => setClock((override.clockSeconds ?? 0) + (!override.paused && override.runningSince && current.status === 'Ao vivo' ? Math.max(0, Math.floor((Date.now() - new Date(override.runningSince).getTime()) / 1000)) : 0));
    update();
    if (current.status !== 'Ao vivo' || override.paused) return;
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [current.status, override.clockSeconds, override.paused, override.runningSince]);
  return <><MatchSummary match={current} />{current.status === 'Ao vivo' || override.events?.length ? <section className="spectator-match-state" aria-live="polite"><div className="game-clock"><Clock3 size={18} />{formatClock(clock)}</div><div className="event-timeline">{override.events?.length ? override.events.map((event) => <article className="timeline-item" key={event.id}><span className="timeline-minute">{Math.floor(event.elapsedSeconds / 60)}′</span><div><strong>{event.type}</strong><p>{event.detail}</p></div></article>) : <p className="match-filter-empty">A partida começou; aguardando o primeiro evento.</p>}</div></section> : null}{!readOnly && canOperate ? <div className="form-actions match-detail-actions"><Link href={`/matches/${match.id}/manage`} className="secondary-button"><Pencil size={17} /> Editar partida</Link>{operable ? <Link href={`/matches/live?partida=${match.id}`} className="primary-button"><Radio size={17} /> {current.status === 'Ao vivo' ? 'Continuar placar' : 'Iniciar partida'}</Link> : null}</div> : null}{!readOnly && !canOperate ? <div className="info-banner"><p>Seu perfil não pode editar ou operar partidas de {current.discipline}.</p></div> : null}{override.reason ? <div className="info-banner"><p><strong>Motivo:</strong> {override.reason}</p></div> : null}</>;
}
