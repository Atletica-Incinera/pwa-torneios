'use client';

import Link from 'next/link';
import { Search, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppShell, EmptyState } from '../components/AppShell';
import { athletes, teams } from '../lib/repositories/catalog-repository';
import { useFrontendState } from '../lib/repositories/browser-repository';

export default function AthletesPage() {
  const [query, setQuery] = useState('');
  const { state } = useFrontendState();
  const filteredAthletes = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('pt-BR');
    const seeded = athletes.map((athlete) => ({ ...athlete, name: state.athletes[athlete.id]?.name ?? athlete.name, modalities: state.athletes[athlete.id]?.modalities ?? [...athlete.modalities] }));
    const created = Object.entries(state.athletes).filter(([, item]) => item.created).map(([id, item]) => ({ id, name: item.name ?? 'Atleta', teamId: item.teamId ?? '', modalities: item.modalities ?? [] }));
    return [...seeded, ...created].filter((athlete) => {
      const team = state.teams[athlete.teamId]?.name ?? teams.find((item) => item.id === athlete.teamId)?.name ?? 'Sem equipe';
      return [athlete.name, team, ...athlete.modalities].some((value) => value.toLocaleLowerCase('pt-BR').includes(normalized));
    });
  }, [query, state.athletes, state.teams]);

  return (
    <AppShell active="teams" eyebrow="CATÁLOGO GLOBAL" title="ATLETAS" subtitle={`${filteredAthletes.length} pessoas encontradas`}>
      <label className="search-field cut-field"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar atleta, equipe ou modalidade" aria-label="Buscar atleta" /></label>
      <section className="athlete-list">
        {filteredAthletes.map((athlete, index) => {
          const team = state.teams[athlete.teamId]?.name ?? teams.find((item) => item.id === athlete.teamId)?.name ?? 'Sem equipe';
          return <Link href={`/athletes/${athlete.id}`} className="athlete-card" key={athlete.id}>
            <span className={`avatar-frame avatar-${index % 3}`}><UserRound size={24} /></span>
            <div><h2>{athlete.name}</h2><p>{team} • {athlete.modalities.length ? athlete.modalities.join(', ') : 'Sem modalidade'}</p></div>
            <span className="athlete-open" aria-hidden="true">→</span>
          </Link>
        })}
        {!filteredAthletes.length ? <EmptyState title="NENHUM ATLETA" copy="Não há atletas correspondentes à busca." /> : null}
      </section>
    </AppShell>
  );
}
