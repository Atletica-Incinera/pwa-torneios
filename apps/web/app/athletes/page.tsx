'use client';

import Link from 'next/link';
import { Search, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppShell, EmptyState } from '../components/AppShell';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { findTeam, listAthletes } from '../lib/edition-catalog';
import { casaComBusca } from '../lib/busca';

export default function AthletesPage() {
  const [query, setQuery] = useState('');
  const { state } = useFrontendState();
  const total = useMemo(() => listAthletes(state).length, [state]);
  // Sem acento na comparacao: "joao" nao encontrava o Joao Pedro.
  const filteredAthletes = useMemo(() => listAthletes(state).filter((athlete) => {
    const team = findTeam(state, athlete.teamId)?.name ?? 'Sem equipe';
    return casaComBusca(query, [athlete.name, team, ...athlete.modalities]);
  }), [query, state]);

  return (
    <AppShell active="teams" eyebrow="CATÁLOGO GLOBAL" title="ATLETAS" subtitle={`${filteredAthletes.length} pessoas encontradas`}>
      <label className="search-field cut-field"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar atleta, equipe ou modalidade" aria-label="Buscar atleta" /></label>
      <section className="athlete-list">
        {filteredAthletes.map((athlete, index) => {
          const team = findTeam(state, athlete.teamId)?.name ?? 'Sem equipe';
          return <Link href={`/athletes/${athlete.id}`} className="athlete-card" key={athlete.id}>
            <span className={`avatar-frame avatar-${index % 3}`}><UserRound size={24} /></span>
            <div><h2>{athlete.name}</h2><p>{team} • {athlete.modalities.length ? athlete.modalities.join(', ') : 'Sem modalidade'}</p></div>
            <span className="athlete-open" aria-hidden="true">→</span>
          </Link>
        })}
        {!filteredAthletes.length && total ? <EmptyState title="NENHUM ATLETA ENCONTRADO" copy="Não há atletas correspondentes à busca." /> : null}
        {/* O atleta é cadastrado dentro da equipe, não aqui: sem dizer isso, a
            tela vazia sugere que o cadastro deveria existir nela. */}
        {!total ? <div className="empty-state">
          <strong>NENHUM ATLETA CADASTRADO</strong>
          <p>Os atletas são cadastrados no elenco de cada equipe. Abra uma equipe para montar o elenco dela.</p>
          <Link href="/teams" className="secondary-button">Ir para equipes</Link>
        </div> : null}
      </section>
    </AppShell>
  );
}
