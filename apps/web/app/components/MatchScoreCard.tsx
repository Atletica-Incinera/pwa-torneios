import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { StatusBadge, TeamMark } from './AppShell';
import { getMatchStatusLabel } from '../lib/status';

type MatchScoreCardProps = {
  href?: string;
  dateLabel: string;
  discipline?: string;
  categoryLabel?: string;
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
  currentSet?: { number: number; scoreA: number; scoreB: number };
  venue: string;
  className?: string;
};

export function MatchScoreCard({
  href,
  dateLabel,
  discipline = 'Futsal',
  categoryLabel,
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
  currentSet,
  venue,
  className = '',
}: MatchScoreCardProps) {
  const inner = (
    <>
      {categoryLabel ? <span className="match-category-tag">{categoryLabel}</span> : null}
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
          <span>{scoreA ?? '—'} — {scoreB ?? '—'}</span>
          {currentSet ? <b className="current-set-score">Set {currentSet.number}: {currentSet.scoreA} — {currentSet.scoreB}</b> : null}
          <small>{venue}</small>
        </div>
        <div className={`team-side align-right${aDefinirB ? ' team-side-a-definir' : ''}`}>
          <TeamMark initial={aDefinirB ? '?' : teamB[0]} tone={aDefinirB ? 'neutral' : 'pink'} logo={aDefinirB ? undefined : teamBLogo} />
          <strong>{teamB}</strong>
        </div>
      </div>
    </>
  );

  const cssClass = `next-match-card next-match-link match-score-card ${className}`.trim();
  const ariaLabel = `${teamA} contra ${teamB}, ${status}`;

  if (!href) {
    return (
      <div className={cssClass} aria-label={ariaLabel}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={href} className={cssClass} aria-label={ariaLabel}>
      {inner}
    </Link>
  );
}
