import { CalendarDays, MapPin } from 'lucide-react';
import { getMatchStatusLabel } from '../lib/repositories/catalog-repository';
import { StatusBadge, TeamMark } from './AppShell';

type MatchSummaryProps = { match: { phase: string; status: string; entryA: string; logoA: string; entryB: string; logoB: string; scoreA: number | null; scoreB: number | null; date: string; time: string; venue: string } };

export function MatchSummary({ match }: MatchSummaryProps) {
  const tone = match.status === 'Ao vivo' ? 'pink' : match.status === 'Encerrada' ? 'neutral' : 'orange';
  return <section className="match-summary-card" aria-label="Resumo da partida"><div className="match-summary-meta"><span>{match.phase.toUpperCase()}</span><StatusBadge tone={tone}>{getMatchStatusLabel(match.status)}</StatusBadge></div><div className="match-summary-teams"><div><TeamMark initial={match.entryA[0]} tone="blue" logo={match.logoA} /><strong>{match.entryA}</strong></div><b>{match.scoreA === null || match.scoreB === null ? '×' : `${match.scoreA} — ${match.scoreB}`}</b><div><TeamMark initial={match.entryB[0]} tone="pink" logo={match.logoB} /><strong>{match.entryB}</strong></div></div><div className="match-summary-info"><span><CalendarDays size={19} /><small>Data e hora</small><strong>{match.date} · {match.time}</strong></span><span><MapPin size={19} /><small>Local</small><strong>{match.venue}</strong></span></div></section>;
}
