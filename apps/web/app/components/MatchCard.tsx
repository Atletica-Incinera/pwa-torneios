'use client';

import { MatchScoreCard } from './MatchScoreCard';
import type { MatchView } from '../lib/edition-catalog';
import { isLive } from '../lib/status';
import { formatMatchDateLabel } from '../lib/date-utils';

import { useFrontendState } from '../lib/repositories/browser-repository';

/**
 * Cartão de partida das listas.
 *
 * Recebe a partida já resolvida pelo catálogo — não relê o estado por conta
 * própria. Era isso que fazia duas listas discordarem antes de `listMatches`
 * existir.
 */
export function MatchCard({ match, href, className }: { match: MatchView; href?: string; className?: string }) {
  const { state } = useFrontendState();
  const categoryName = match.tournamentId ? state.tournaments[match.tournamentId]?.name : undefined;
  const currentSet = isLive(match.status) && match.isSetBased
    ? { number: match.currentPeriod ?? 1, scoreA: match.periodScoreA ?? 0, scoreB: match.periodScoreB ?? 0 }
    : undefined;
  return <MatchScoreCard className={className} href={href} dateLabel={`${formatMatchDateLabel(match.date)} • ${match.time}`} status={match.status} statusLabel={match.situation.label} statusTone={match.situation.tone} discipline={categoryName && categoryName.toLocaleLowerCase('pt-BR').includes(match.discipline.toLocaleLowerCase('pt-BR')) ? match.stage : match.discipline} categoryLabel={categoryName} teamA={match.entryA} teamALogo={match.logoA} teamB={match.entryB} teamBLogo={match.logoB} aDefinirA={match.aDefinirA} aDefinirB={match.aDefinirB} scoreA={match.scoreA} scoreB={match.scoreB} currentSet={currentSet} venue={match.venue} />;
}
