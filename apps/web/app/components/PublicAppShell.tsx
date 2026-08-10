'use client';

import Link from 'next/link';
import { Brackets, CalendarDays, ListOrdered, Radio, Trophy } from 'lucide-react';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { PageNavigation } from './AppShell';

type PublicNavKey = 'live' | 'matches' | 'standings' | 'results' | 'phases' | 'teams' | 'tournaments';

type PublicAppShellProps = {
  active: PublicNavKey;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

const themes: Record<PublicNavKey, string> = {
  live: 'theme-matches public-live-readonly',
  matches: 'theme-matches',
  standings: 'theme-tournaments',
  results: 'theme-matches',
  phases: 'theme-tournaments',
  teams: 'theme-teams',
  tournaments: 'theme-tournaments',
};

const navItems = [
  { key: 'live', label: 'Ao vivo', href: '/public', icon: Radio },
  { key: 'matches', label: 'Jogos', href: '/public/matches', icon: CalendarDays },
  { key: 'standings', label: 'Tabela', ariaLabel: 'Classificação', href: '/public/standings', icon: ListOrdered },
  { key: 'results', label: 'Resultados', href: '/public/results', icon: Trophy },
  { key: 'phases', label: 'Fases', href: '/public/phases', icon: Brackets },
] as const;

export function PublicAppShell({ active, eyebrow, title, subtitle, children }: PublicAppShellProps) {
  const { state } = useFrontendState();
  const competition = state.competitions.find((item) => item.active) ?? state.competitions[0];
  const editions = state.editions.filter((item) => (item.competitionId ?? 'jogos-engenharia') === competition.id);
  const edition = editions.find((item) => item.active) ?? editions[0] ?? state.editions[0];
  return (
    <main id="app-main" className={`app-screen management-screen public-readonly-screen ${themes[active]} motion-page`}>
      <div className="context-bar public-context-bar">
        <Link href="/public" className="context-copy" aria-label={`${competition.name}, edição ${edition.year}`}>
          <span className="context-mark">{String(edition.year).slice(-2)}</span>
          <span><small>TORNEIO · {competition.name}</small><strong>EDIÇÃO {edition.year}</strong></span>
        </Link>
        <span className="sync-state"><Radio size={15} /> Resultados oficiais</span>
      </div>

      <PageNavigation title={title} publicMode />

      <header className="mobile-header page-heading">
        <div><p className="eyebrow orange">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div>
      </header>

      {children}

      <PublicBottomNav active={active} />
    </main>
  );
}

export function PublicBottomNav({ active }: { active: PublicNavKey }) {
  const { state } = useFrontendState();
  return (
    <nav className="bottom-nav public-bottom-nav" aria-label="Navegação pública">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        const href = `${item.href}?modalidade=${encodeURIComponent(state.preferences.selectedDiscipline)}`;
        return (
          <Link key={item.key} href={href} className={`nav-item${isActive ? ' active' : ''}`} aria-label={'ariaLabel' in item ? item.ariaLabel : item.label} aria-current={isActive ? 'page' : undefined}>
            <span className="nav-icon"><Icon size={21} strokeWidth={2.2} /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
