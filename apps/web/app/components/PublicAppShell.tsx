import Link from 'next/link';
import { CalendarDays, Medal, Radio, Shield } from 'lucide-react';
import { currentContext } from '../lib/mock-data';

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
  { key: 'live', label: 'Ao vivo', href: '/public?modalidade=Futsal', icon: Radio },
  { key: 'matches', label: 'Próximos', href: '/public/matches?modalidade=Futsal', icon: CalendarDays },
  { key: 'teams', label: 'Equipes', href: '/public/teams', icon: Shield },
  { key: 'tournaments', label: 'Torneios', href: '/public/tournaments', icon: Medal },
] as const;

export function PublicAppShell({ active, eyebrow, title, subtitle, children }: PublicAppShellProps) {
  return (
    <main className={`app-screen management-screen public-readonly-screen ${themes[active]}`}>
      <div className="context-bar public-context-bar">
        <Link href="/public" className="context-copy" aria-label="InterEng 2026">
          <span className="context-mark">26</span>
          <span><small>{currentContext.competition}</small><strong>{currentContext.edition}</strong></span>
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
