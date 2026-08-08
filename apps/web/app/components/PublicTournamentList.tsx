'use client';

import { TournamentCard } from './TournamentCard';
import { useFrontendState } from '../lib/frontend-state';

type Item = { id: string; name: string; discipline: string; status: string; entries: number; phase: string; progress: number; tone: 'blue' | 'pink' | 'orange' };
export function PublicTournamentList({ tournaments }: { tournaments: readonly Item[] }) {
  const { state } = useFrontendState();
  const seeded = tournaments.map((item) => { const stored = state.tournaments[item.id]; return { ...item, status: stored?.status ?? item.status, entries: stored?.participants.length ?? item.entries, phase: stored?.phases[0]?.name ?? item.phase }; });
  const created = Object.entries(state.tournaments).filter(([, item]) => item.created).map(([id, item], index) => ({ id, name: item.name ?? 'Torneio', discipline: item.discipline ?? 'Modalidade', status: item.status, entries: item.participants.length, phase: item.phases[0]?.name ?? 'Configuração', progress: item.generated ? 25 : 5, tone: item.tone ?? (index % 2 ? 'pink' : 'blue') }));
  const visible = [...seeded, ...created].filter((item) => !['Rascunho'].includes(item.status));
  return <section className="tournament-list" aria-label="Torneios da edição">{visible.map((item, index) => <TournamentCard tournament={item} index={index} detailHref={`/public/tournaments/${item.id}`} resultsHref={`/public/tournaments/${item.id}#results`} publicView key={item.id} />)}</section>;
}
