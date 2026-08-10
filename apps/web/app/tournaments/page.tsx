'use client';

import Link from 'next/link';
import { ListOrdered } from 'lucide-react';
import { useState } from 'react';
import { AppShell, EmptyState } from '../components/AppShell';
import { TournamentCard } from '../components/TournamentCard';
import { tournaments } from '../lib/repositories/catalog-repository';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';

export default function TournamentsPage() {
  const [filter, setFilter] = useState<'active' | 'finished'>('active');
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const seeded = tournaments.filter((tournament) => tournament.editionId === activeEdition?.id).map((tournament) => { const stored = state.tournaments[tournament.id]; return { ...tournament, status: stored?.status ?? tournament.status, entries: stored?.participants.length ?? tournament.entries, phase: stored?.phases[0]?.name ?? tournament.phase }; });
  const created = Object.entries(state.tournaments).filter(([, item]) => item.created && item.editionId === activeEdition?.id).map(([id, item], index) => ({ id, editionId: item.editionId, name: item.name ?? 'Nova categoria', discipline: item.discipline ?? 'Modalidade', status: item.status, entries: item.participants.length, phase: item.phases[0]?.name ?? 'Configuração', progress: item.generated ? 25 : 5, tone: item.tone ?? (index % 2 ? 'pink' : 'blue'), created: true }));
  const allTournaments = [...seeded.map((item) => ({ ...item, created: false })), ...created];
  const filteredTournaments = allTournaments.filter((tournament) => filter === 'finished' ? tournament.status === 'Encerrado' : tournament.status !== 'Encerrado');

  return (
    <AppShell active="tournaments" eyebrow="MODALIDADES DO INTERENG" title="DISPUTAS" subtitle={`${allTournaments.length} categorias em ${new Set(allTournaments.map((tournament) => tournament.discipline)).size} modalidades`} actionHref="/disciplines/new" actionLabel="Adicionar modalidade">
      <Link href="/standings" className="wide-action ranking-entry-action"><ListOrdered size={18} /> CLASSIFICAÇÃO GERAL DO INTERENG <span>›</span></Link>
      <div className="filter-strip" aria-label="Filtrar modalidades">
        <button type="button" className={`filter-chip${filter === 'active' ? ' active' : ''}`} onClick={() => setFilter('active')} aria-pressed={filter === 'active'}>Em andamento</button>
        <button type="button" className={`filter-chip${filter === 'finished' ? ' active' : ''}`} onClick={() => setFilter('finished')} aria-pressed={filter === 'finished'}>Encerrados</button>
      </div>

      <section className="tournament-list">
        {filteredTournaments.map((tournament) => {
          const index = allTournaments.findIndex((item) => item.id === tournament.id);
          const detailHref = tournament.created ? `/tournaments/${tournament.id}/manage` : `/tournaments/${tournament.id}`;
          return <TournamentCard tournament={tournament} index={index} detailHref={detailHref} resultsHref={tournament.created ? detailHref : `/tournaments/${tournament.id}#results`} key={tournament.id} />;
        })}
        {!filteredTournaments.length ? <EmptyState title="SEM DISPUTAS ENCERRADAS" copy="As modalidades finalizadas aparecerão aqui." /> : null}
      </section>
    </AppShell>
  );
}
