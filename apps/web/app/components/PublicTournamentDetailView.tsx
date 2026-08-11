'use client';

import Link from 'next/link';
import { Brackets, Flag, Trophy, Users } from 'lucide-react';
import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PublicAppShell } from './PublicAppShell';
import { EmptyState, SectionTitle, StatusBadge } from './AppShell';
import { TournamentClassification } from './TournamentClassification';
import { StatefulMatchCard } from './StatefulMatchCard';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { findCategory, listMatches } from '../lib/edition-catalog';
import { isPublicTournamentStatus } from '../lib/publication';
import { isLive, isOfficialResult, isPendingMatch } from '../lib/status';
import { useTablistKeys } from '../lib/use-tablist-keys';

type Tab = 'agenda' | 'tabela' | 'resultados' | 'fases';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'tabela', label: 'Tabela' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'fases', label: 'Fases' },
];

const tabIds = tabs.map((tab) => tab.id);

export function PublicTournamentDetailView({ id }: { id: string }) {
  const { state } = useFrontendState();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeEdition = getActiveEdition(state);
  const category = findCategory(state, id, activeEdition?.id);
  const stored = state.tournaments[id];
  const requested = (searchParams.get('aba') ?? '') as Tab;
  const activeTab: Tab = tabs.some((tab) => tab.id === requested) ? requested : 'tabela';

  const openTab = useCallback((tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('aba', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);
  const onTabKeys = useTablistKeys(tabIds, activeTab, openTab);

  if (!category || !isPublicTournamentStatus(category.status)) {
    return <PublicAppShell active="disciplines" eyebrow={`INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`} title="MODALIDADE" subtitle="Conteúdo ainda não publicado">
      <EmptyState title="INDISPONÍVEL" copy="Esta categoria ainda não foi publicada para o público." />
    </PublicAppShell>;
  }

  const all = listMatches(state, activeEdition?.id, { tournamentId: id });
  const upcoming = all.filter((match) => isPendingMatch(match.status) || isLive(match.status));
  const results = all.filter((match) => isOfficialResult(match.status));
  const phases = stored?.phases ?? [];

  return (
    <PublicAppShell active="disciplines" eyebrow={`${category.discipline.toUpperCase()} · EDIÇÃO ${activeEdition?.year ?? ''}`} title={category.name} subtitle={`${category.entries === null ? 'Inscrição pendente' : `${category.entries} inscritas`} · ${category.phase}`}>
      <Link href="/public/tournaments" className="breadcrumb-link">‹ Modalidades</Link>

      <div className="tournament-tab-list" role="tablist" aria-label="Seções da categoria" onKeyDown={onTabKeys}>
        {tabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1} className={activeTab === tab.id ? 'active' : ''} onClick={() => openTab(tab.id)}>{tab.label}</button>
        ))}
      </div>

      <div className="tournament-tab-panel" role="tabpanel" aria-label={tabs.find((tab) => tab.id === activeTab)?.label}>
        {activeTab === 'tabela' ? <TournamentClassification className="section-block public-priority-section" tournamentId={id} discipline={category.discipline} fallbackParticipants={stored?.participants} heading={{ eyebrow: category.name, title: 'TABELA E CHAVEAMENTO' }} /> : null}

        {activeTab === 'agenda' ? <section className="section-block public-priority-section">
          <SectionTitle eyebrow={category.name} title="PRÓXIMOS JOGOS" />
          <div className="match-list public-readonly-list">{upcoming.length ? upcoming.map((match) => <StatefulMatchCard key={match.id} className="public-upcoming-score" href={`/public/matches/${match.id}`} match={match} />) : <p className="match-filter-empty">Nenhum jogo programado nesta categoria.</p>}</div>
        </section> : null}

        {activeTab === 'resultados' ? <section className="section-block public-priority-section">
          <SectionTitle eyebrow={category.name} title="JOGOS ENCERRADOS" />
          <div className="match-list public-readonly-list">{results.length ? results.map((match) => <StatefulMatchCard key={match.id} className="public-result-score" href={`/public/matches/${match.id}`} match={match} />) : <p className="match-filter-empty">Ainda não há resultados oficiais nesta categoria.</p>}</div>
        </section> : null}

        {activeTab === 'fases' ? <section className="section-block public-priority-section">
          <SectionTitle eyebrow={category.name} title="ETAPAS DA DISPUTA" />
          {phases.length ? <div className="phase-timeline public-phase-timeline">{phases.map((phase, index) => (
            <article key={phase.id}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <div><StatusBadge tone={phase.format === 'Mata-mata' ? 'orange' : 'blue'}>{phase.format}</StatusBadge><h3>{phase.name}</h3><p>{phase.groups.length ? phase.groups.join(', ') : 'Eliminação simples'}{phase.format !== 'Mata-mata' ? ` · avançam ${phase.qualifiers}` : ''}</p></div>
              {phase.format === 'Mata-mata' ? <Brackets size={18} /> : <Flag size={18} />}
            </article>
          ))}</div> : <p className="match-filter-empty">As fases desta categoria ainda não foram publicadas.</p>}
        </section> : null}
      </div>

      <div className="public-secondary-actions">
        <Link href="/public/standings/general" className="wide-action"><Trophy size={18} /> CLASSIFICAÇÃO GERAL <span>›</span></Link>
        <Link href="/public/teams" className="wide-action"><Users size={18} /> EQUIPES E ELENCOS <span>›</span></Link>
      </div>
    </PublicAppShell>
  );
}
