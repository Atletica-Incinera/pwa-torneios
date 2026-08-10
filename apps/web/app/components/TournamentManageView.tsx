'use client';

import { AppShell, EmptyState } from './AppShell';
import { TournamentManager } from './TournamentManager';
import { TournamentClassification } from './TournamentClassification';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';

type Base = { id: string; editionId?: string; name: string; discipline: string; status: string };

export function TournamentManageView({ id, initial, teamNames }: { id: string; initial?: Base; teamNames: string[] }) {
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const stored = state.tournaments[id];
  const initialInEdition = initial?.editionId === activeEdition?.id ? initial : null;
  const tournament = initialInEdition ?? (stored?.created && stored.editionId === activeEdition?.id ? { id, editionId: stored.editionId, name: stored.name ?? 'Categoria', discipline: stored.discipline ?? 'Modalidade', status: stored.status } : null);

  if (!tournament) {
    return <AppShell active="tournaments" eyebrow="MODALIDADE" title="NÃO ENCONTRADA" subtitle="Volte à lista de modalidades"><EmptyState title="SEM DADOS" copy="Esta disputa não existe na edição ativa." /></AppShell>;
  }

  return (
    <AppShell active="tournaments" eyebrow={`INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`} title="GESTÃO DA MODALIDADE" subtitle={`${tournament.discipline} · ${tournament.name}`}>
      <section className="management-panel tournament-live-overview" id="tournament-overview">
        <TournamentClassification tournamentId={id} discipline={tournament.discipline} fallbackParticipants={teamNames} />
      </section>
      <nav className="detail-tabs management-tabs" aria-label="Seções da modalidade">
        <a href="#tournament-overview">Classificação</a>
        <a href="#participants">Participantes</a>
        <a href="#phases">Fases</a>
        <a href="#generate">Confrontos</a>
      </nav>
      <TournamentManager id={id} name={tournament.name} discipline={tournament.discipline} initialStatus={tournament.status} teamNames={teamNames} />
    </AppShell>
  );
}
