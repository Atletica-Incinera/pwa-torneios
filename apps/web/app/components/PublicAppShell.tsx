'use client';

import Link from 'next/link';
import { Radio, Shield, Trophy } from 'lucide-react';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { PageNavigation } from './AppShell';
import { ErrorScreen } from './ErrorScreen';
import { LoadingScreen } from './LoadingScreen';

/** Três destinos: o que acontece agora, as modalidades e as equipes. */
type PublicNavKey = 'live' | 'disciplines' | 'teams';

type PublicAppShellProps = {
  active: PublicNavKey;
  eyebrow: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

const themes: Record<PublicNavKey, string> = {
  live: 'theme-matches public-live-readonly',
  disciplines: 'theme-tournaments',
  teams: 'theme-teams',
};

const navItems = [
  { key: 'live', label: 'Ao vivo', href: '/public', icon: Radio },
  { key: 'disciplines', label: 'Modalidades', href: '/public/tournaments', icon: Trophy },
  { key: 'teams', label: 'Equipes', href: '/public/teams', icon: Shield },
] as const;

export function PublicAppShell({ active, eyebrow, title, subtitle, children }: PublicAppShellProps) {
  const { state, status, error, refresh } = useFrontendState();
  const competition = state.competitions.find((item) => item.active) ?? state.competitions[0];
  const editions = state.editions.filter((item) => (item.competitionId ?? 'jogos-engenharia') === competition.id);
  const edition = editions.find((item) => item.active) ?? editions[0] ?? state.editions[0];
  // O espectador só vê resultado oficial: enquanto o snapshot não chega, nada é
  // mostrado como se fosse definitivo.
  if (status === 'loading') return <LoadingScreen message="Carregando a edição..." />;
  if (status === 'error') return <ErrorScreen message={error} onRetry={() => void refresh()} />;
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
  return (
    <nav className="bottom-nav public-bottom-nav" aria-label="Navegação pública">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <Link key={item.key} href={item.href} className={`nav-item${isActive ? ' active' : ''}`} aria-current={isActive ? 'page' : undefined}>
            <span className="nav-icon"><Icon size={21} strokeWidth={2.2} /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
