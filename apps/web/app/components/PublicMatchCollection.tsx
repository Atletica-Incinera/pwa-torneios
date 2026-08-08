'use client';

import { Radio } from 'lucide-react';
import { StatusBadge } from './AppShell';
import { StatefulMatchCard } from './StatefulMatchCard';
import { useFrontendState } from '../lib/frontend-state';

type MatchItem = { id: string; time: string; date: string; discipline: string; entryA: string; logoA: string; entryB: string; logoB: string; scoreA: number | null; scoreB: number | null; venue: string; phase: string; status: string };

export function PublicMatchCollection({ matches, discipline, mode }: { matches: readonly MatchItem[]; discipline: string; mode: 'live' | 'upcoming' }) {
  const { state } = useFrontendState();
  const created = Object.entries(state.matches).filter(([, item]) => item.created && item.discipline === discipline).map(([id, item]) => ({ id, time: item.time ?? '--:--', date: item.date ?? 'Hoje', discipline: item.discipline ?? discipline, entryA: item.entryA ?? 'Equipe A', logoA: item.logoA ?? '', entryB: item.entryB ?? 'Equipe B', logoB: item.logoB ?? '', scoreA: item.scoreA ?? null, scoreB: item.scoreB ?? null, venue: item.venue ?? 'A definir', phase: item.phase ?? 'Fase atual', status: item.status ?? 'Agendada' }));
  const visible = [...matches, ...created].filter((match) => {
    const status = state.matches[match.id]?.status ?? match.status;
    return match.discipline === discipline && (mode === 'live' ? status === 'Ao vivo' : ['Agendada', 'Adiada'].includes(status));
  });
  return <>{mode === 'live' ? <div className="public-readonly-summary"><Radio size={18} /><strong>{visible.length} {visible.length === 1 ? 'partida' : 'partidas'} ao vivo</strong><StatusBadge tone="orange">AGORA</StatusBadge></div> : null}<section className="match-list public-readonly-list" aria-label={mode === 'live' ? `Partidas ao vivo de ${discipline}` : `Próximas partidas de ${discipline}`}>{visible.length ? visible.map((match) => <StatefulMatchCard key={match.id} className={mode === 'live' ? 'public-live-score' : 'public-upcoming-score'} href={`/public/matches/${match.id}`} match={match} />) : <p className="match-filter-empty">Nenhum jogo {mode === 'live' ? 'ao vivo' : 'programado'} nesta modalidade.</p>}</section></>;
}
