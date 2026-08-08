'use client';

import Link from 'next/link';
import { ChevronDown, Cloud, Plus } from 'lucide-react';
import { BottomNav } from './BottomNav';
import { AdminRouteGuard } from './AdminRouteGuard';
import { canManageDiscipline, canManageEdition, useFrontendSession } from '../lib/frontend-session';
import { useFrontendState } from '../lib/frontend-state';

type NavKey = 'home' | 'tournaments' | 'matches' | 'teams' | 'profile';

type AppShellProps = {
  active: NavKey;
  eyebrow: string;
  title: string;
  subtitle: string;
  actionHref?: string;
  actionLabel?: string;
  actionPermission?: 'edition' | 'discipline';
  actionDiscipline?: string;
  children: React.ReactNode;
};

export function AppShell({ active, eyebrow, title, subtitle, actionHref, actionLabel, actionPermission = 'edition', actionDiscipline, children }: AppShellProps) {
  const { state } = useFrontendState();
  const { session } = useFrontendSession();
  const competition = state.competitions.find((item) => item.active) ?? state.competitions[0];
  const editions = state.editions.filter((item) => (item.competitionId ?? 'jogos-engenharia') === competition.id);
  const edition = editions.find((item) => item.active) ?? editions[0] ?? state.editions[0];
  const canUseAction = actionPermission === 'discipline' ? canManageDiscipline(session, actionDiscipline) : canManageEdition(session);
  return (
    <AdminRouteGuard><main id="app-main" className={`app-screen management-screen theme-${active} motion-page`}>
      <div className="context-bar">
        <Link href={canManageEdition(session) ? '/competitions' : `/matches?modalidade=${encodeURIComponent(session?.scope ?? state.preferences.selectedDiscipline)}`} className="context-copy" aria-label={`${competition.name}, ${edition.name}, contexto ativo`}>
          <span className="context-mark">{String(edition.year).slice(-2)}</span>
          <span><small>{competition.name}</small><strong>{edition.name}</strong></span>
          <ChevronDown size={16} />
        </Link>
        <span className="sync-state"><Cloud size={15} /> Modo local</span>
      </div>

      <header className="mobile-header page-heading">
        <div>
          <p className="eyebrow orange">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {actionHref && actionLabel && canUseAction ? (
          <Link href={actionHref} className="header-action" aria-label={actionLabel}><Plus size={23} /></Link>
        ) : null}
      </header>

      {children}
      <BottomNav active={active} />
    </main></AdminRouteGuard>
  );
}

export function SectionTitle({ eyebrow, title, href, linkLabel = 'Ver tudo' }: { eyebrow?: string; title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="section-title-row">
      <div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h2>{title}</h2></div>
      {href ? <Link href={href} className="link-action">{linkLabel} <span aria-hidden>›</span></Link> : null}
    </div>
  );
}

export function StatusBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'blue' | 'pink' | 'orange' | 'neutral' }) {
  return <span className={`status-badge status-${tone}`}>{children}</span>;
}

export function TeamMark({ initial, tone = 'blue', small = false, logo }: { initial: string; tone?: string; small?: boolean; logo?: string }) {
  return (
    <span className={`team-mark mark-${tone} ${small ? 'team-mark-small' : ''} ${logo ? 'team-mark-logo' : ''}`}>
      {logo ? <img src={logo} alt="" /> : initial}
    </span>
  );
}

export function EmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="empty-state"><strong>{title}</strong><p>{copy}</p></div>;
}
