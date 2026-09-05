import { CalendarDays, MapPin } from 'lucide-react';
import { getMatchStatusLabel } from '../lib/status';
import { StatusBadge, TeamMark } from './AppShell';

type MatchSummaryProps = { match: { phase: string; status: string; entryA: string; logoA: string; entryB: string; logoB: string; scoreA: number | null; scoreB: number | null; date: string; time: string; venue: string; aDefinirA?: boolean; aDefinirB?: boolean; currentPeriod?: number; periodScoreA?: number; periodScoreB?: number; isSetBased?: boolean } };

export function MatchSummary({ match }: MatchSummaryProps) {
  const tone = match.status === 'Ao vivo' ? 'pink' : match.status === 'Encerrada' ? 'neutral' : 'orange';
  const currentSet = match.status === 'Ao vivo' && match.isSetBased;
  return <section className="match-summary-card" aria-label="Resumo da partida"><div className="match-summary-meta"><span>{match.phase.toUpperCase()}</span><StatusBadge tone={tone}>{getMatchStatusLabel(match.status)}</StatusBadge></div><div className="match-summary-teams"><div className={match.aDefinirA ? 'team-side-a-definir' : undefined}><TeamMark initial={match.aDefinirA ? '?' : match.entryA[0]} tone={match.aDefinirA ? 'neutral' : 'blue'} logo={match.aDefinirA ? undefined : match.logoA} /><strong>{match.entryA}</strong></div><b>{match.scoreA === null || match.scoreB === null ? '×' : `${match.scoreA} — ${match.scoreB}`}</b><div className={match.aDefinirB ? 'team-side-a-definir' : undefined}><TeamMark initial={match.aDefinirB ? '?' : match.entryB[0]} tone={match.aDefinirB ? 'neutral' : 'pink'} logo={match.aDefinirB ? undefined : match.logoB} /><strong>{match.entryB}</strong></div></div>{currentSet ? <p className="match-summary-current-set">Set {match.currentPeriod ?? 1}: <strong>{match.periodScoreA ?? 0} — {match.periodScoreB ?? 0}</strong></p> : null}<div className="match-summary-info"><span><CalendarDays size={19} /><small>Data e hora</small><strong>{match.date} · {match.time}</strong></span><span><MapPin size={19} /><small>Local</small><strong>{match.venue}</strong></span></div></section>;
}
