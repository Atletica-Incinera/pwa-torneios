'use client';

import { Filter, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppShell, EmptyState } from '../components/AppShell';
import { TeamCard } from '../components/TeamCard';
import { teams } from '../lib/mock-data';
import { useFrontendState } from '../lib/frontend-state';

export default function TeamsPage() {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const { state } = useFrontendState();
  const allTeams = useMemo(() => {
    const seeded = teams.map((team) => { const override = state.teams[team.id] ?? {}; return { ...team, name: override.name ?? team.name, initial: override.initials?.[0] ?? team.initial, logo: override.logo ?? team.logo, athletes: override.athletes ?? team.athletes, tone: override.tone ?? team.tone, archived: override.archived ?? false }; });
    const created = Object.entries(state.teams).filter(([, item]) => item.created).map(([id, item], index) => ({ id, name: item.name ?? 'Nova equipe', initial: item.initials?.[0] ?? 'E', logo: item.logo ?? '', athletes: item.athletes ?? 0, tone: item.tone ?? (index % 2 ? 'pink' : 'blue'), archived: item.archived ?? false }));
    return [...seeded, ...created];
  }, [state.teams]);
  const filteredTeams = useMemo(() => allTeams.filter((team) => {
    const matchesQuery = team.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
    return matchesQuery && (showArchived || !team.archived);
  }), [query, showArchived, allTeams]);

  return (
    <AppShell active="teams" eyebrow="INTERENG 2026 • ATLÉTICAS" title="EQUIPES" subtitle={`${allTeams.length} equipes cadastradas`} actionHref="/teams/new" actionLabel="Adicionar equipe">
      <div className="toolbar-row">
        <label className="search-field cut-field"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar equipe" aria-label="Buscar equipe" /></label>
        <button type="button" className={`square-filter${showArchived ? ' active' : ''}`} onClick={() => setShowArchived((value) => !value)} aria-pressed={showArchived} aria-label="Mostrar equipes arquivadas"><Filter size={21} /></button>
      </div>

      <section className="team-list" aria-label="Lista de equipes">
        {filteredTeams.map((team) => <TeamCard team={team} href={`/teams/${team.id}`} key={team.id} />)}
        {!filteredTeams.length ? <EmptyState title="NENHUMA EQUIPE" copy="Ajuste a busca ou remova o filtro aplicado." /> : null}
      </section>
    </AppShell>
  );
}
