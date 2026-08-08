'use client';

import { useState } from 'react';
import { AppShell, EmptyState } from '../components/AppShell';
import { TournamentCard } from '../components/TournamentCard';
import { tournaments } from '../lib/mock-data';
import { useFrontendState } from '../lib/frontend-state';

export default function TournamentsPage() {
  const [filter, setFilter] = useState<'active' | 'finished'>('active');
  const { state } = useFrontendState();
  const seeded = tournaments.map((tournament) => { const stored = state.tournaments[tournament.id]; return { ...tournament, status: stored?.status ?? tournament.status, entries: stored?.participants.length ?? tournament.entries, phase: stored?.phases[0]?.name ?? tournament.phase }; });
  const created = Object.entries(state.tournaments).filter(([, item]) => item.created).map(([id, item], index) => ({ id, name: item.name ?? 'Novo torneio', discipline: item.discipline ?? 'Modalidade', status: item.status, entries: item.participants.length, phase: item.phases[0]?.name ?? 'Configuração', progress: item.generated ? 25 : 5, tone: item.tone ?? (index % 2 ? 'pink' : 'blue'), created: true }));
  const allTournaments = [...seeded.map((item) => ({ ...item, created: false })), ...created];
  const filteredTournaments = allTournaments.filter((tournament) => filter === 'finished' ? tournament.status === 'Encerrado' : tournament.status !== 'Encerrado');

  return (
    <AppShell active="tournaments" eyebrow="INTERENG 2026" title="TORNEIOS" subtitle={`${allTournaments.length} disputas em ${new Set(allTournaments.map((tournament) => tournament.discipline)).size} modalidades`} actionHref="/tournaments/new" actionLabel="Criar torneio">
      <div className="filter-strip" aria-label="Filtrar torneios">
        <button type="button" className={`filter-chip${filter === 'active' ? ' active' : ''}`} onClick={() => setFilter('active')} aria-pressed={filter === 'active'}>Em andamento</button>
        <button type="button" className={`filter-chip${filter === 'finished' ? ' active' : ''}`} onClick={() => setFilter('finished')} aria-pressed={filter === 'finished'}>Encerrados</button>
      </div>

      <section className="tournament-list">
        {filteredTournaments.map((tournament) => {
          const index = allTournaments.findIndex((item) => item.id === tournament.id);
          const detailHref = tournament.created ? `/tournaments/${tournament.id}/manage` : `/tournaments/${tournament.id}`;
          return <TournamentCard tournament={tournament} index={index} detailHref={detailHref} resultsHref={tournament.created ? detailHref : `/tournaments/${tournament.id}#results`} key={tournament.id} />;
        })}
        {!filteredTournaments.length ? <EmptyState title="SEM TORNEIOS ENCERRADOS" copy="Os torneios finalizados aparecerão aqui." /> : null}
      </section>
    </AppShell>
  );
}
