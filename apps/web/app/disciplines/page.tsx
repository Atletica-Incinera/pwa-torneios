'use client';

import Link from 'next/link';
import { ChevronRight, ListOrdered, Users } from 'lucide-react';
import { AppShell, StatusBadge } from '../components/AppShell';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { listDisciplines } from '@atletica-incinera/intereng-contract/rules';
import { disciplineHref } from '../lib/discipline-href';
import { canManageDiscipline, canManageEdition, useFrontendSession } from '../lib/frontend-session';
import { hasOverallRanking } from '../lib/source-capabilities';

export default function DisciplinesPage() {
  const { state } = useFrontendState();
  const { session } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  // O gestor de modalidade só enxerga a modalidade do seu escopo.
  const disciplines = listDisciplines(state, activeEdition?.id).filter((item) => canManageDiscipline(session, item.name));
  const enabled = disciplines.filter((item) => item.enabled);

  return (
    <AppShell
      active="tournaments"
      eyebrow={`INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`}
      title="MODALIDADES"
      subtitle={`${enabled.length} modalidades habilitadas · ${enabled.reduce((total, item) => total + item.categories.length, 0)} categorias`}
      actionHref={canManageEdition(session) ? "/disciplines/new" : undefined}
      actionLabel="Adicionar modalidade"
    >
      {/* Sem ranking geral na origem, o atalho some: ele levaria a uma tela que só sabe dizer que não existe. */}
      {hasOverallRanking() ? <Link href="/standings" className="wide-action ranking-entry-action"><ListOrdered size={18} /> CLASSIFICAÇÃO GERAL DO INTERENG <span>›</span></Link> : null}
      <section className="poster-list">
        {disciplines.map((discipline, index) => (
          <Link href={disciplineHref(discipline.name)} className={`discipline-card accent-${discipline.tone}${discipline.enabled ? '' : ' is-disabled'}`} key={discipline.name}>
            <span className="discipline-index">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <StatusBadge tone={discipline.enabled ? discipline.tone : 'neutral'}>{discipline.enabled ? discipline.mode : 'Removida'}</StatusBadge>
              <h2>{discipline.name}</h2>
              <p>{discipline.config}</p>
              <small><Users size={14} /> {discipline.categories.length} {discipline.categories.length === 1 ? 'categoria' : 'categorias'}</small>
            </div>
            <ChevronRight size={22} />
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
