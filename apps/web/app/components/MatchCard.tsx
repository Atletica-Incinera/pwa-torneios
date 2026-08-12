'use client';

import { MatchScoreCard } from './MatchScoreCard';
import type { MatchView } from '../lib/edition-catalog';
import { isLive, matchStatus } from '../lib/status';

/**
 * Cartão de partida das listas.
 *
 * Recebe a partida já resolvida pelo catálogo — não relê o estado por conta
 * própria. Era isso que fazia duas listas discordarem antes de `listMatches`
 * existir.
 */
export function MatchCard({ match, href, className }: { match: MatchView; href: string; className?: string }) {
  const tone = isLive(match.status) ? 'orange' : match.status === matchStatus.finished ? 'neutral' : match.status === matchStatus.cancelled ? 'pink' : 'blue';
  return <MatchScoreCard className={className} href={href} dateLabel={`${match.date} · ${match.time}`} status={match.status} statusTone={tone} discipline={match.discipline} teamA={match.entryA} teamALogo={match.logoA} teamB={match.entryB} teamBLogo={match.logoB} scoreA={match.scoreA} scoreB={match.scoreB} venue={match.venue} />;
}
