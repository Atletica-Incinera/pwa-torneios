'use client';

import { AppShell, EmptyState } from './AppShell';
import { TournamentManager } from './TournamentManager';
import { useFrontendState } from '../lib/frontend-state';

type Base = { id: string; name: string; discipline: string; status: string };
export function TournamentManageView({ id, initial, teamNames }: { id: string; initial?: Base; teamNames: string[] }) {
  const { state } = useFrontendState(); const stored = state.tournaments[id];
  const tournament = initial ?? (stored?.created ? { id, name: stored.name ?? 'Torneio', discipline: stored.discipline ?? 'Modalidade', status: stored.status } : null);
  if (!tournament) return <AppShell active="tournaments" eyebrow="TORNEIO" title="NÃO ENCONTRADO" subtitle="Volte à lista de torneios"><EmptyState title="SEM DADOS" copy="Este torneio não existe na edição ativa." /></AppShell>;
  return <AppShell active="tournaments" eyebrow={tournament.discipline.toUpperCase()} title="GESTÃO DO TORNEIO" subtitle={tournament.name}><TournamentManager id={id} name={tournament.name} discipline={tournament.discipline} initialStatus={tournament.status} teamNames={teamNames} /></AppShell>;
}
