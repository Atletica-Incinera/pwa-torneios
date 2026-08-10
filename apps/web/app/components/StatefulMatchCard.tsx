'use client';

import { MatchScoreCard } from './MatchScoreCard';
import { useFrontendState } from '../lib/repositories/browser-repository';

type MatchCardData = { id: string; time: string; date: string; discipline: string; entryA: string; logoA: string; entryB: string; logoB: string; scoreA: number | null; scoreB: number | null; venue: string; phase: string; status: string };

export function StatefulMatchCard({ match, href, className }: { match: MatchCardData; href: string; className?: string }) {
  const { state } = useFrontendState();
  const override = state.matches[match.id] ?? {};
  const current = { ...match, ...override, scoreA: override.scoreA ?? match.scoreA, scoreB: override.scoreB ?? match.scoreB };
  const tone = current.status === 'Ao vivo' ? 'orange' : current.status === 'Encerrada' ? 'neutral' : current.status === 'Cancelada' ? 'pink' : 'blue';
  return <MatchScoreCard className={className} href={href} dateLabel={`${current.date} · ${current.time}`} status={current.status} statusTone={tone} discipline={current.discipline} teamA={current.entryA} teamALogo={current.logoA} teamB={current.entryB} teamBLogo={current.logoB} scoreA={current.scoreA} scoreB={current.scoreB} venue={current.venue} />;
}
