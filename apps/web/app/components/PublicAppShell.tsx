'use client';

import Link from 'next/link';
import { CalendarDays, Medal, Radio, Shield } from 'lucide-react';
import { useFrontendState } from '../lib/frontend-state';

type PublicNavKey = 'live' | 'matches' | 'teams' | 'tournaments';

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
  teams: 'theme-teams',
  tournaments: 'theme-tournaments',
};

const navItems = [
  { key: 'live', label: 'Ao vivo', href: '/public', icon: Radio },
  { key: 'matches', label: 'Próximos', href: '/public/matches', icon: CalendarDays },
  { key: 'teams', label: 'Equipes', href: '/public/teams', icon: Shield },
  { key: 'tournaments', label: 'Torneios', href: '/public/tournaments', icon: Medal },
] as const;

export function PublicAppShell({ active, eyebrow, title, subtitle, children }: PublicAppShellProps) {
  const { state } = useFrontendState();
  const competition = state.competitions.find((item) => item.active) ?? state.competitions[0];
  const editions = state.editions.filter((item) => (item.competitionId ?? 'jogos-engenharia') === competition.id);
  const edition = editions.find((item) => item.active) ?? editions[0] ?? state.editions[0];
  return (
    <main id="app-main" className={`app-screen management-screen public-readonly-screen ${themes[active]} motion-page`}>
      <div className="context-bar public-context-bar">
        <Link href="/public" className="context-copy" aria-label="InterEng 2026">
          <span className="context-mark">{String(edition.year).slice(-2)}</span>
          <span><small>{competition.name}</small><strong>{edition.name}</strong></span>
        </Link>
        <span className="sync-state"><Radio size={15} /> Resultados oficiais</span>
      </div>

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
        const href = item.key === 'live' || item.key === 'matches' ? `${item.href}?modalidade=${encodeURIComponent(state.preferences.selectedDiscipline)}` : item.href;
        return (
          <Link key={item.key} href={href} className={`nav-item${isActive ? ' active' : ''}`} aria-current={isActive ? 'page' : undefined}>
            <span className="nav-icon"><Icon size={21} strokeWidth={2.2} /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
