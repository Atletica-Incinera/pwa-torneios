'use client';

import Link from 'next/link';
import { History, ListOrdered, ShieldCheck, Trophy, UserRound, Users } from 'lucide-react';
import { AppShell, SectionTitle } from '../components/AppShell';
import { canManageEdition, canReadAudit, useFrontendSession, type FrontendSession } from '../lib/frontend-session';
import { hasOverallRanking } from '../lib/source-capabilities';

const sections = [
  { href: '/competitions', label: 'Competições e edições', meta: 'Contexto ativo e histórico', icon: Trophy },
  { href: '/standings', label: 'Classificação geral', meta: 'Métricas e pontos por equipe', icon: ListOrdered },
  { href: '/staff', label: 'Staff e permissões', meta: 'Papéis por edição', icon: ShieldCheck },
  { href: '/athletes', label: 'Consulta de atletas', meta: 'Busca global e histórico', icon: Users },
  { href: '/audit', label: 'Auditoria', meta: 'Histórico de alterações', icon: History },
];

/**
 * Duas razões diferentes tiram um módulo daqui, e vale distingui-las: papel de
 * quem entrou, e ausência na origem dos dados. A auditoria some para quem não
 * é super admin; o ranking geral some quando a origem é a API, que não o tem.
 */
function isAvailable(href: string, session: FrontendSession | null) {
  if (href === '/audit') return canReadAudit(session);
  if (href === '/standings') return hasOverallRanking();
  return true;
}

export default function MorePage() {
  const { session } = useFrontendSession();
  const visibleSections = canManageEdition(session) ? sections.filter((item) => isAvailable(item.href, session)) : [];
  return (
    <AppShell active="profile" eyebrow="GESTÃO" title="MAIS" subtitle="Configurações e ferramentas da edição">
      <Link href="/profile" className="account-strip"><span className="avatar-frame avatar-0"><UserRound size={24} /></span><span><strong>{session?.name ?? 'Usuário'}</strong><small>Perfil, acessos e preferências</small></span><span>›</span></Link>
      {visibleSections.length ? <section className="section-block"><SectionTitle eyebrow="ADMINISTRAÇÃO" title="MÓDULOS" /><div className="module-list">{visibleSections.map(({ href, label, meta, icon: Icon }) => <Link href={href} key={href}><span><Icon size={21} /></span><div><strong>{label}</strong><small>{meta}</small></div><b>›</b></Link>)}</div></section> : <section className="section-block"><SectionTitle eyebrow="MEU ESCOPO" title={session?.scope?.toUpperCase() ?? 'MODALIDADE'} /><div className="module-list"><Link href={`/matches?modalidade=${encodeURIComponent(session?.scope ?? 'Futsal')}`}><span><Trophy size={21} /></span><div><strong>Operar minha modalidade</strong><small>Jogos e placares autorizados</small></div><b>›</b></Link></div></section>}
      <section className="section-block"><SectionTitle eyebrow="VISUALIZAÇÃO" title="ÁREA PÚBLICA" /><div className="module-list"><Link href="/public"><span><Trophy size={21} /></span><div><strong>Visualizar como espectador</strong><small>App público sem ações administrativas</small></div><b>›</b></Link></div></section>
    </AppShell>
  );
}
