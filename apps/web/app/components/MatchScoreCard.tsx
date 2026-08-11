import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { StatusBadge, TeamMark } from './AppShell';
import { getMatchStatusLabel } from '../lib/status';

type MatchScoreCardProps = {
  href: string;
  dateLabel: string;
  discipline?: string;
  status: string;
  statusTone?: 'blue' | 'pink' | 'orange' | 'neutral';
  teamA: string;
  teamALogo?: string;
  teamB: string;
  teamBLogo?: string;
  scoreA: number | null;
  scoreB: number | null;
  venue: string;
  className?: string;
};

export function MatchScoreCard({
  href,
  dateLabel,
  discipline = 'Futsal',
  status,
  statusTone = 'neutral',
  teamA,
  teamALogo,
  teamB,
  teamBLogo,
  scoreA,
  scoreB,
  venue,
  className = '',
}: MatchScoreCardProps) {
  return (
    <Link
      className={`next-match-card next-match-link match-score-card ${className}`.trim()}
      href={href}
      aria-label={`${teamA} contra ${teamB}, ${status}`}
    >
      <div className="match-date">
        {discipline ? <span className="match-discipline">{discipline}</span> : null}
        <CalendarDays size={18} />
        <span>{dateLabel}</span>
        <StatusBadge tone={statusTone}>{getMatchStatusLabel(status)}</StatusBadge>
      </div>
      <div className="versus-row">
        <div className="team-side">
          <TeamMark initial={teamA[0]} tone="blue" logo={teamALogo} />
          <strong>{teamA}</strong>
        </div>
        <div className="versus-mark">
          <span>{scoreA ?? '–'} — {scoreB ?? '–'}</span>
          <small>{venue}</small>
        </div>
        <div className="team-side align-right">
          <TeamMark initial={teamB[0]} tone="pink" logo={teamBLogo} />
          <strong>{teamB}</strong>
        </div>
      </div>
    </Link>
  );
}
