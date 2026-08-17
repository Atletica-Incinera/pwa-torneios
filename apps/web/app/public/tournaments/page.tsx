'use client';

import Link from 'next/link';
import { ListOrdered } from 'lucide-react';
import { PublicAppShell } from '../../components/PublicAppShell';
import { TournamentCard } from '../../components/TournamentCard';
import { EmptyState } from '../../components/AppShell';
import { getActiveEdition, useFrontendState } from '../../lib/repositories/browser-repository';
import { listCategories, isPublicTournamentStatus } from '@atletica-incinera/intereng-contract/rules';
import { hasOverallRanking } from '../../lib/source-capabilities';

export default function PublicCategoriesPage() {
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const visible = listCategories(state, activeEdition?.id).filter((item) => isPublicTournamentStatus(item.status));

  return (
    <PublicAppShell active="disciplines" eyebrow={`INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`} title="MODALIDADES" subtitle="Categorias, fases e resultados desta edição">
      {/* O espectador não vê a promessa de um ranking que a origem não guarda. */}
      {hasOverallRanking() ? <Link href="/public/standings/general" className="wide-action ranking-entry-action"><ListOrdered size={18} /> CLASSIFICAÇÃO GERAL DO INTERENG <span>›</span></Link> : null}
      <section className="tournament-list" aria-label="Categorias da edição">
        {visible.map((item, index) => <TournamentCard tournament={item} index={index} detailHref={`/public/tournaments/${item.id}`} resultsHref={`/public/tournaments/${item.id}?aba=jogos`} publicView key={item.id} />)}
        {!visible.length ? <EmptyState title="SEM MODALIDADES PUBLICADAS" copy="As categorias aparecem aqui quando forem publicadas." /> : null}
      </section>
    </PublicAppShell>
  );
}
