import Link from 'next/link';
import { ChevronDown, Cloud, Plus } from 'lucide-react';
import { BottomNav } from './BottomNav';
import { CreationFeedback } from './CreationFeedback';
import { currentContext } from '../lib/mock-data';

type NavKey = 'home' | 'tournaments' | 'matches' | 'teams' | 'profile';

type AppShellProps = {
  active: NavKey;
  eyebrow: string;
  title: string;
  subtitle: string;
  actionHref?: string;
  actionLabel?: string;
  children: React.ReactNode;
};

export function AppShell({ active, eyebrow, title, subtitle, actionHref, actionLabel, children }: AppShellProps) {
  return (
    <main className={`app-screen management-screen theme-${active}`}>
      <div className="context-bar">
        <Link href="/competitions" className="context-copy">
          <span className="context-mark">26</span>
          <span><small>{currentContext.competition}</small><strong>{currentContext.edition}</strong></span>
          <ChevronDown size={16} />
        </Link>
        <span className="sync-state"><Cloud size={15} /> Sincronizado</span>
      </div>

      <header className="mobile-header page-heading">
        <div>
          <p className="eyebrow orange">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {actionHref && actionLabel ? (
          <Link href={actionHref} className="header-action" aria-label={actionLabel}><Plus size={23} /></Link>
        ) : null}
      </header>

      <CreationFeedback />
      {children}
      <BottomNav active={active} />
    </main>
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
