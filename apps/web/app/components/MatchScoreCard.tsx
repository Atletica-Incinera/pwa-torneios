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
  /** O lado é um rótulo do chaveamento ("Vencedor do Jogo 3"), não uma equipe. */
  aDefinirA?: boolean;
  aDefinirB?: boolean;
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
  aDefinirA = false,
  aDefinirB = false,
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
        <div className={`team-side${aDefinirA ? ' team-side-a-definir' : ''}`}>
          {/* Sem escudo e sem inicial: "V" num círculo azul faria "Vencedor do
              Jogo 3" parecer uma atlética chamada assim. */}
          <TeamMark initial={aDefinirA ? '?' : teamA[0]} tone={aDefinirA ? 'neutral' : 'blue'} logo={aDefinirA ? undefined : teamALogo} />
          <strong>{teamA}</strong>
        </div>
        <div className="versus-mark">
          <span>{scoreA ?? '–'} — {scoreB ?? '–'}</span>
          <small>{venue}</small>
        </div>
        <div className={`team-side align-right${aDefinirB ? ' team-side-a-definir' : ''}`}>
          <TeamMark initial={aDefinirB ? '?' : teamB[0]} tone={aDefinirB ? 'neutral' : 'pink'} logo={aDefinirB ? undefined : teamBLogo} />
          <strong>{teamB}</strong>
        </div>
      </div>
    </Link>
  );
}
