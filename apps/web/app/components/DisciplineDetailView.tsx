'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { AppShell, EmptyState, SectionTitle, StatusBadge } from './AppShell';
import { DisciplineManager } from './DisciplineManager';
import { TournamentCard } from './TournamentCard';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { findDiscipline, listDisciplines } from '../lib/edition-catalog';
import { canManageDiscipline, useFrontendSession } from '../lib/frontend-session';

export function DisciplineDetailView({ id }: { id: string }) {
  const { state } = useFrontendState();
  const { session } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  const discipline = findDiscipline(state, id, activeEdition?.id);

  if (!discipline) {
    return <AppShell active="tournaments" eyebrow="MODALIDADE" title="NÃO ENCONTRADA" subtitle="Selecione uma modalidade cadastrada">
      <EmptyState title="SEM DADOS" copy="Esta modalidade não existe na edição ativa." />
    </AppShell>;
  }

  const index = listDisciplines(state, activeEdition?.id).findIndex((item) => item.name === discipline.name);
  const canManage = canManageDiscipline(session, discipline.name);
  const newCategoryHref = `/tournaments/new?modalidade=${encodeURIComponent(discipline.name)}`;

  return (
    <AppShell
      active="tournaments"
      eyebrow="MODALIDADE"
      title={discipline.name.toUpperCase()}
      subtitle={`${discipline.categories.length} ${discipline.categories.length === 1 ? 'categoria' : 'categorias'} na edição ${activeEdition?.year ?? ''}`}
      actionHref={canManage ? newCategoryHref : undefined}
      actionLabel={`Criar categoria de ${discipline.name}`}
      actionShortLabel="Categoria"
      actionPermission="discipline"
      actionDiscipline={discipline.name}
    >
      <section className="discipline-hero">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <div><StatusBadge tone={discipline.tone}>{discipline.mode}</StatusBadge><h2>{discipline.name}</h2><p>{discipline.config}</p></div>
      </section>

      <section className="section-block">
        <SectionTitle eyebrow="DISPUTAS DESTA MODALIDADE" title="CATEGORIAS" />
        {discipline.categories.length ? (
          <div className="tournament-list">
            {discipline.categories.map((category, position) => (
              <TournamentCard
                key={category.id}
                tournament={category}
                index={position}
                detailHref={`/tournaments/${category.id}`}
                resultsHref={`/tournaments/${category.id}`}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="SEM CATEGORIAS" copy={canManage ? 'Crie a primeira categoria desta modalidade para inscrever equipes e gerar confrontos.' : 'Nenhuma categoria foi criada nesta modalidade.'} />
        )}
        {canManage ? <Link href={newCategoryHref} className="wide-action"><Plus size={18} /> CRIAR CATEGORIA <span>›</span></Link> : null}
      </section>

      <section className="section-block">
        <SectionTitle eyebrow="REGULAMENTO" title="REGRAS DA MODALIDADE" />
        <DisciplineManager name={discipline.name} mode={discipline.mode} initialConfig={discipline.config} tournaments={discipline.categories.length} />
      </section>
    </AppShell>
  );
}
