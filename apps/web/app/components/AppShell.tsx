'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronRight, Cloud, Plus } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { BottomNav } from './BottomNav';
import { AdminRouteGuard } from './AdminRouteGuard';
import { canManageDiscipline, canManageEdition, useFrontendSession } from '../lib/frontend-session';
import { useFrontendState } from '../lib/repositories/browser-repository';

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
        <Link href={canManageEdition(session) ? '/competitions' : `/matches?modalidade=${encodeURIComponent(session?.scope ?? state.preferences.selectedDiscipline)}`} className="context-copy" aria-label={`${competition.name}, edição ${edition.year}, contexto ativo`}>
          <span className="context-mark">{String(edition.year).slice(-2)}</span>
          <span><small>TORNEIO · {competition.name}</small><strong>EDIÇÃO {edition.year}</strong></span>
          <ChevronDown size={16} />
        </Link>
        <span className="sync-state"><Cloud size={15} /> Modo local</span>
      </div>

      <PageNavigation title={title} />

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

const routeLabels: Record<string, string> = {
  athletes: 'Atletas', audit: 'Auditoria', competitions: 'Competições', disciplines: 'Modalidades', matches: 'Jogos', more: 'Mais', profile: 'Perfil', public: 'Início', standings: 'Classificação', general: 'Geral', staff: 'Staff', teams: 'Equipes', tournaments: 'Modalidades', new: 'Novo', manage: 'Gestão', live: 'Ao vivo', phases: 'Fases', results: 'Resultados',
};

/**
 * Na área pública, agenda e classificação viraram abas dentro da categoria.
 * A migalha aponta para onde o clique realmente leva, e não para o nome antigo.
 */
const publicRouteLabels: Record<string, string> = { matches: 'Modalidades', standings: 'Modalidades' };

export function PageNavigation({ title, publicMode = false }: { title: string; publicMode?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split('/').filter(Boolean);
  const contentSegments = publicMode && segments[0] === 'public' ? segments.slice(1) : segments;
  if (contentSegments.length < 2) return null;
  const rootHref = publicMode ? '/public' : '/dashboard';
  const rootLabel = publicMode ? 'Início' : 'Dashboard';
  const crumbs = contentSegments.map((segment, index) => {
    const sourceSegments = publicMode ? ['public', ...contentSegments.slice(0, index + 1)] : contentSegments.slice(0, index + 1);
    const label = index === contentSegments.length - 1 ? title : (publicMode ? publicRouteLabels[segment] : undefined) ?? routeLabels[segment] ?? 'Detalhes';
    return { href: `/${sourceSegments.join('/')}`, label };
  });
  const parentHref = crumbs.length > 1 ? crumbs[crumbs.length - 2].href : rootHref;
  return <div className="page-navigation"><button type="button" className="back-button" onClick={() => router.push(parentHref)} aria-label="Voltar"><ArrowLeft size={18} /><span>Voltar</span></button><nav className="breadcrumbs" aria-label="Caminho da página"><Link href={rootHref}>{rootLabel}</Link>{crumbs.map((crumb, index) => <span key={`${crumb.href}-${index}`}><ChevronRight size={13} />{index === crumbs.length - 1 ? <b aria-current="page">{crumb.label}</b> : <Link href={crumb.href}>{crumb.label}</Link>}</span>)}</nav></div>;
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
