'use client';

import Link from 'next/link';
import { Filter, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppShell, EmptyState } from '../components/AppShell';
import { TeamCard } from '../components/TeamCard';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { listAllTeams } from '../lib/edition-catalog';
import { canManageEdition, useFrontendSession } from '../lib/frontend-session';

export default function TeamsPage() {
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const { state } = useFrontendState();
  const { session } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  const competition = state.competitions.find((item) => item.active) ?? state.competitions[0];
  const allTeams = useMemo(() => listAllTeams(state), [state]);
  const filteredTeams = useMemo(() => allTeams.filter((team) => {
    const matchesQuery = team.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR'));
    return matchesQuery && (showArchived || !team.archived);
  }), [query, showArchived, allTeams]);

  return (
    <AppShell active="teams" eyebrow={`${(competition?.name ?? 'INTERENG').toLocaleUpperCase('pt-BR')} · EDIÇÃO ${activeEdition?.year ?? ''}`} title="EQUIPES" subtitle={`${allTeams.length} equipes cadastradas`} actionHref={canManageEdition(session) ? '/teams/new' : undefined} actionLabel="Cadastrar nova equipe" actionShortLabel="Equipe">
      <div className="toolbar-row">
        <label className="search-field cut-field"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar equipe" aria-label="Buscar equipe" /></label>
        <button type="button" className={`square-filter${showArchived ? ' active' : ''}`} onClick={() => setShowArchived((value) => !value)} aria-pressed={showArchived} aria-label="Mostrar equipes arquivadas"><Filter size={21} /></button>
      </div>

      <section className="team-list" aria-label="Lista de equipes">
        {filteredTeams.map((team) => <TeamCard team={team} href={`/teams/${team.id}`} key={team.id} />)}
        {/* Lista vazia por não haver nada cadastrado é outro estado que lista
            vazia por causa do filtro: mandar ajustar a busca quando não existe
            nenhuma equipe esconde o passo que realmente falta. */}
        {!filteredTeams.length && allTeams.length ? <EmptyState title="NENHUMA EQUIPE ENCONTRADA" copy="Ajuste a busca ou remova o filtro aplicado." /> : null}
        {!allTeams.length ? <div className="empty-state">
          <strong>NENHUMA EQUIPE CADASTRADA</strong>
          <p>As equipes são cadastradas uma vez por edição e depois inscritas em cada categoria.</p>
          {canManageEdition(session) ? <Link href="/teams/new" className="secondary-button"><Plus size={16} aria-hidden="true" /> Cadastrar primeira equipe</Link> : null}
        </div> : null}
      </section>
    </AppShell>
  );
}
