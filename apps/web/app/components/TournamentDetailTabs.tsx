'use client';

import Link from 'next/link';
import { Brackets, ListChecks } from 'lucide-react';
import { useId, useState } from 'react';
import { SectionTitle, StatusBadge, TeamMark } from './AppShell';
import { TournamentManageLink } from './TournamentManageLink';
import { TournamentClassification } from './TournamentClassification';

type Tournament = { id: string; name: string; discipline: string };
type Entry = { name: string; logo?: string };
type Tab = 'classification' | 'phases' | 'participants';

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'classification', label: 'Classificação' },
  { id: 'phases', label: 'Fases' },
  { id: 'participants', label: 'Participantes' },
];

export function TournamentDetailTabs({ tournament, entries }: { tournament: Tournament; entries: readonly Entry[] }) {
  const [activeTab, setActiveTab] = useState<Tab>('classification');
  const tabId = useId();
  const panelId = `${tabId}-${activeTab}-panel`;

  return <section className="tournament-detail-tabs" aria-label="Informações da modalidade">
    <nav className="tournament-tab-list" aria-label="Seções da modalidade">
      {tabs.map((tab) => {
        const selected = activeTab === tab.id;
        return <button key={tab.id} type="button" role="tab" id={`${tabId}-${tab.id}`} aria-selected={selected} aria-controls={selected ? panelId : undefined} className={selected ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>;
      })}
      <Link href={`/matches?modalidade=${encodeURIComponent(tournament.discipline)}`} className="tournament-games-link">Jogos</Link>
    </nav>

    <div className="tournament-tab-panel" id={panelId} role="tabpanel" aria-labelledby={`${tabId}-${activeTab}`}>
      {activeTab === 'classification' ? <TournamentClassification tournamentId={tournament.id} discipline={tournament.discipline} fallbackParticipants={entries.map((entry) => entry.name)} managementAction={<TournamentManageLink id={tournament.id} discipline={tournament.discipline} />} /> : null}
      {activeTab === 'phases' ? <section><SectionTitle eyebrow="FORMATO" title="FASES E GRUPOS" /><div className="phase-timeline"><article><span>01</span><div><StatusBadge tone="blue">Concluída</StatusBadge><h3>Fase de grupos</h3><p>2 grupos · 4 participantes · avançam 2</p></div><ListChecks size={22} /></article><article><span>02</span><div><StatusBadge tone="orange">Atual</StatusBadge><h3>Mata-mata</h3><p>Semifinais e final · eliminação simples</p></div><Brackets size={22} /></article></div></section> : null}
      {activeTab === 'participants' ? <section><SectionTitle eyebrow="PARTICIPANTES" title="INSCRITOS" /><div className="entry-grid">{entries.map((entry, index) => <div className="entry-chip" key={entry.name}><TeamMark initial={entry.name[0]} tone={index % 2 ? 'pink' : 'blue'} logo={entry.logo} small /><strong>{entry.name}</strong><span>Seed {index + 1}</span></div>)}</div></section> : null}
    </div>
  </section>;
}
