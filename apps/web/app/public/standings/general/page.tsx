'use client';

import Link from 'next/link';
import { ListOrdered } from 'lucide-react';
import { EmptyState } from '../../../components/AppShell';
import { OverallStandings } from '../../../components/OverallStandings';
import { PublicAppShell } from '../../../components/PublicAppShell';
import { hasOverallRanking } from '../../../lib/source-capabilities';

/** Mesma decisão da rota administrativa: a URL responde, e responde a verdade. */
export default function PublicOverallStandingsPage() {
  if (!hasOverallRanking()) {
    return <PublicAppShell active="disciplines" eyebrow="TODAS AS MODALIDADES" title="CLASSIFICAÇÃO GERAL" subtitle="Não existe nesta edição">
      <section className="section-block no-top"><EmptyState title="SEM RANKING GERAL" copy="Esta edição não tem pontuação acumulada entre modalidades. O que existe é a classificação de cada categoria, dentro dela." /></section>
      <div className="info-banner"><ListOrdered size={19} /><p>Cada categoria tem a própria tabela. <Link href="/public/tournaments">Ver modalidades</Link>.</p></div>
    </PublicAppShell>;
  }
  return <PublicAppShell active="disciplines" eyebrow="TODAS AS MODALIDADES" title="CLASSIFICAÇÃO GERAL" subtitle="Ranking oficial das equipes na edição"><OverallStandings readOnly /></PublicAppShell>;
}
