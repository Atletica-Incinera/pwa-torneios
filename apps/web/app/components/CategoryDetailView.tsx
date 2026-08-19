'use client';

import Link from 'next/link';
import { Brackets, CalendarPlus, Flag, Trophy, Users } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AppShell, EmptyState, SectionTitle, StatusBadge, TeamMark } from './AppShell';
import { MatchSchedule } from './MatchSchedule';
import { TournamentClassification } from './TournamentClassification';
import { TournamentManager } from './TournamentManager';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { findCategory, disciplineHref, listTeams } from '../lib/edition-catalog';
import { canManageDiscipline, canManageEdition, useFrontendSession } from '../lib/frontend-session';
import { isTournamentDecided } from '../lib/status';
import { defaultAdvancement, describeAdvancement } from '../lib/bracket-rules';
import { useTablistKeys } from '../lib/use-tablist-keys';

type Tab = 'tabela' | 'jogos' | 'fases' | 'participantes' | 'regras';

// A aba `regras` é onde moram inscrição, fases, geração de confrontos e
// publicação — gestão, não regulamento (esse é da modalidade). O rótulo dizia
// "Regras" e mandava o organizador procurar no lugar errado; o parâmetro da URL
// continua `regras` para não quebrar links já compartilhados.
const tabs: Array<{ id: Tab; label: string; adminOnly?: boolean }> = [
  { id: 'tabela', label: 'Tabela' },
  { id: 'jogos', label: 'Jogos' },
  { id: 'fases', label: 'Fases' },
  { id: 'participantes', label: 'Participantes' },
  { id: 'regras', label: 'Gestão', adminOnly: true },
];

export function CategoryDetailView({ id }: { id: string }) {
  const { state } = useFrontendState();
  const { session } = useFrontendSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeEdition = getActiveEdition(state);
  const category = findCategory(state, id, activeEdition?.id);
  const canManage = canManageDiscipline(session, category?.discipline ?? '');
  const visibleTabs = useMemo(() => tabs.filter((tab) => !tab.adminOnly || canManage), [canManage]);
  const requested = (searchParams.get('aba') ?? '') as Tab;
  const activeTab: Tab = visibleTabs.some((tab) => tab.id === requested) ? requested : 'tabela';

  const openTab = useCallback((tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('aba', tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);
  const tabIds = useMemo(() => visibleTabs.map((tab) => tab.id), [visibleTabs]);
  const onTabKeys = useTablistKeys(tabIds, activeTab, openTab);

  if (!category) {
    return <AppShell active="tournaments" eyebrow="CATEGORIA" title="NÃO ENCONTRADA" subtitle="Volte à lista de modalidades">
      <EmptyState title="SEM DADOS" copy="Esta categoria não existe na edição ativa." />
    </AppShell>;
  }

  const setup = state.tournaments[id];
  const advancement = setup?.advancement ?? { ...defaultAdvancement, perGroup: setup?.phases.find((phase) => phase.format === 'Grupos')?.qualifiers ?? defaultAdvancement.perGroup };
  const groupCount = setup?.phases.find((phase) => phase.format === 'Grupos')?.groups.length ?? 0;
  const teams = listTeams(state);
  const teamNames = teams.map((team) => team.name);

  return (
    <AppShell
      active="tournaments"
      eyebrow={`${category.discipline.toUpperCase()} · EDIÇÃO ${activeEdition?.year ?? ''}`}
      title={category.name.toUpperCase()}
      subtitle={`${category.entries === null ? 'Inscrição pendente' : `${category.entries} inscritas`} · ${category.status}`}
      actionHref={`/matches/new?modalidade=${encodeURIComponent(category.discipline)}`}
      actionLabel={`Agendar jogo de ${category.discipline}`}
      actionShortLabel="Agendar jogo"
      actionPermission="discipline"
      actionDiscipline={category.discipline}
    >
      <Link href={disciplineHref(category.discipline)} className="breadcrumb-link">‹ {category.discipline}</Link>

      <div className="tournament-tab-list" role="tablist" aria-label="Seções da categoria" onKeyDown={onTabKeys}>
        {visibleTabs.map((tab) => (
          <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1} className={activeTab === tab.id ? 'active' : ''} onClick={() => openTab(tab.id)}>{tab.label}</button>
        ))}
      </div>

      <div className="tournament-tab-panel" role="tabpanel" aria-label={visibleTabs.find((tab) => tab.id === activeTab)?.label}>
        {activeTab === 'tabela' ? <TournamentClassification tournamentId={id} discipline={category.discipline} fallbackParticipants={setup?.participants} /> : null}

        {activeTab === 'jogos' ? <section className="section-block no-top">
          <SectionTitle eyebrow={category.name} title="AGENDA DA CATEGORIA" />
          <MatchSchedule discipline={category.discipline} tournamentId={id} />
          {canManage ? <Link href={`/matches/new?modalidade=${encodeURIComponent(category.discipline)}`} className="wide-action"><CalendarPlus size={18} /> AGENDAR JOGO <span>›</span></Link> : null}
        </section> : null}

        {activeTab === 'fases' ? <section className="section-block no-top">
          <SectionTitle eyebrow="FORMATO" title="FASES E GRUPOS" />
          {setup?.phases.length ? <>
            <div className="phase-timeline">
              {setup.phases.map((phase, index) => (
                <article key={phase.id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <StatusBadge tone={phase.format === 'Mata-mata' ? 'orange' : 'blue'}>{phase.format}</StatusBadge>
                    <h3>{phase.name}</h3>
                    <p>{phase.groups.length ? `${phase.groups.length} grupos · ${phase.groups.join(', ')}` : 'Eliminação simples'}{phase.format !== 'Mata-mata' ? ` · avançam ${phase.qualifiers}` : ''}</p>
                  </div>
                  {phase.format === 'Mata-mata' ? <Brackets size={22} /> : <Flag size={22} />}
                </article>
              ))}
            </div>
            <p className="form-hint">{describeAdvancement(advancement, groupCount || 1)}</p>
          </> : <EmptyState title="FASES NÃO CONFIGURADAS" copy={canManage ? 'Defina as fases na aba Gestão para gerar os confrontos.' : 'As fases desta categoria ainda não foram publicadas.'} />}
        </section> : null}

        {activeTab === 'participantes' ? <section className="section-block no-top">
          <SectionTitle eyebrow="INSCRITOS" title={`${setup?.participants.length ?? 0} EQUIPES`} />
          {setup?.participants.length ? <div className="entry-grid">
            {[...setup.participants].sort((a, b) => (setup.seeds[a] ?? 999) - (setup.seeds[b] ?? 999)).map((team) => (
              <div className="entry-chip" key={team}>
                <TeamMark initial={team[0]} tone={(setup.seeds[team] ?? 1) % 2 ? 'blue' : 'pink'} logo={teams.find((item) => item.name === team)?.logo} small />
                <strong>{team}</strong>
                <span>Seed {setup.seeds[team] ?? '—'}{setup.assignments[team] ? ` · ${setup.assignments[team]}` : ''}</span>
              </div>
            ))}
          </div> : <EmptyState title="SEM INSCRITOS" copy={canManage ? 'Inscreva as equipes na aba Gestão para liberar a agenda desta categoria.' : 'Nenhuma equipe inscrita nesta categoria.'} />}
        </section> : null}

        {activeTab === 'regras' && canManage ? <div className="section-block no-top">
          <TournamentManager id={id} name={category.name} discipline={category.discipline} initialStatus={category.status} teamNames={teamNames} />
        </div> : null}
      </div>

      {/* O passo seguinte a encerrar uma categoria é lançar as bonificações do
          pódio no ranking geral, e não havia daqui nenhum caminho até lá — o
          espectador se orientava melhor que o organizador. */}
      {canManageEdition(session) ? <div className="public-secondary-actions">
        {isTournamentDecided(category.status) ? <p className="form-hint">Categoria encerrada. Lance as bonificações do pódio no ranking geral da edição.</p> : null}
        <Link href="/standings" className="wide-action"><Trophy size={18} aria-hidden="true" /> CLASSIFICAÇÃO GERAL <span aria-hidden="true">›</span></Link>
      </div> : null}
    </AppShell>
  );
}
