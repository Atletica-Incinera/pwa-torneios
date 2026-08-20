'use client';

import Link from 'next/link';
import { ListOrdered } from 'lucide-react';
import { PublicAppShell } from '../../components/PublicAppShell';
import { TournamentCard } from '../../components/TournamentCard';
import { EmptyState } from '../../components/AppShell';
import { getActiveEdition, useFrontendState } from '../../lib/repositories/browser-repository';
import { listCategories } from '../../lib/edition-catalog';
import { isPublicTournamentStatus } from '../../lib/publication';

export default function PublicCategoriesPage() {
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const visible = listCategories(state, activeEdition?.id).filter((item) => isPublicTournamentStatus(item.status));

  return (
    <PublicAppShell active="disciplines" eyebrow={`INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`} title="MODALIDADES" subtitle="Categorias, fases e resultados desta edição">
      <Link href="/public/standings/general" className="wide-action ranking-entry-action"><ListOrdered size={18} /> CLASSIFICAÇÃO GERAL <span>›</span></Link>
      <section className="tournament-list" aria-label="Categorias da edição">
        {visible.map((item, index) => <TournamentCard tournament={item} index={index} detailHref={`/public/tournaments/${item.id}`} resultsHref={`/public/tournaments/${item.id}?aba=jogos`} publicView key={item.id} />)}
        {!visible.length ? <EmptyState title="SEM MODALIDADES PUBLICADAS" copy="As categorias aparecem aqui quando forem publicadas." /> : null}
      </section>
    </PublicAppShell>
  );
}
