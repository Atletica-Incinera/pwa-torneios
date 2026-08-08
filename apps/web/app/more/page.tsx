import Link from 'next/link';
import { Dumbbell, History, ShieldCheck, Trophy, UserRound, Users } from 'lucide-react';
import { AppShell, SectionTitle } from '../components/AppShell';

const sections = [
  { href: '/competitions', label: 'Competições e edições', meta: 'Contexto ativo e histórico', icon: Trophy },
  { href: '/disciplines', label: 'Modalidades', meta: 'Regras e configurações', icon: Dumbbell },
  { href: '/staff', label: 'Staff e permissões', meta: 'Papéis por edição', icon: ShieldCheck },
  { href: '/athletes', label: 'Consulta de atletas', meta: 'Busca global e histórico', icon: Users },
  { href: '/audit', label: 'Auditoria', meta: 'Histórico de alterações', icon: History },
];

export default function MorePage() {
  return (
    <AppShell active="profile" eyebrow="GESTÃO" title="MAIS" subtitle="Configurações e ferramentas da edição">
      <Link href="/profile" className="account-strip"><span className="avatar-frame avatar-0"><UserRound size={24} /></span><span><strong>Ana Coordenadora</strong><small>Perfil, acessos e preferências</small></span><span>›</span></Link>
      <section className="section-block"><SectionTitle eyebrow="ADMINISTRAÇÃO" title="MÓDULOS" /><div className="module-list">{sections.map(({ href, label, meta, icon: Icon }) => <Link href={href} key={href}><span><Icon size={21} /></span><div><strong>{label}</strong><small>{meta}</small></div><b>›</b></Link>)}</div></section>
      <section className="section-block"><SectionTitle eyebrow="VISUALIZAÇÃO" title="ÁREA PÚBLICA" /><div className="module-list"><Link href="/public"><span><Trophy size={21} /></span><div><strong>Visualizar como espectador</strong><small>App público sem ações administrativas</small></div><b>›</b></Link></div></section>
    </AppShell>
  );
}
