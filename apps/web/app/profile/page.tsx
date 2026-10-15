'use client';

import { LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, SectionTitle, StatusBadge } from '../components/AppShell';
import { isSuperAdmin, passwordChangeAvailable, useFrontendSession, visibleSessionEmail, visibleSessionName, type FrontendSession } from '../lib/frontend-session';
import { getActiveCompetition, useFrontendState } from '../lib/repositories/browser-repository';
import { PasswordChangeForm } from '../components/PasswordChangeForm';

/** O papel dito como a pessoa o reconhece: "Gestor de Futsal", "Responsável da Incinera". */
function roleLabel(role: string | undefined, scope?: string | null) {
  if (role === 'SUPER_ADMIN') return 'Super admin';
  if (role === 'EDITION_ADMIN') return 'Admin da edição';
  if (role === 'DISCIPLINE_MANAGER') return scope ? `Gestor de ${scope}` : 'Gestor de modalidade';
  if (role === 'TEAM_MANAGER') return scope ? `Responsável da ${scope}` : 'Responsável da atlética';
  return 'Staff';
}

function accessList(session: FrontendSession | null) {
  if (!session) return [];
  if (isSuperAdmin(session)) return [{ key: 'super', edition: 'Todas as competições', label: 'Super admin' }];
  return session.editionRoles.map((role) => ({
    key: role.roleAssignmentId,
    edition: `Edição ${role.editionName}`,
    label: roleLabel(role.role, role.role === 'DISCIPLINE_MANAGER' ? role.disciplineName : role.role === 'TEAM_MANAGER' ? role.teamName : null),
  }));
}

/**
 * Perfil: quem eu sou, o que posso e a troca de senha.
 *
 * Dizia "Admin da edição" para todo papel que não fosse gestor — inclusive o
 * responsável da atlética — e oferecia "Alertas do app" que nada enviava. O
 * papel agora vem da sessão e a promessa de notificação saiu até existir.
 */
export default function ProfilePage() {
  const router = useRouter();
  const [passwordChanged, setPasswordChanged] = useState(false);
  const { session, logout: clearSession } = useFrontendSession();
  const { state } = useFrontendState();
  const competition = getActiveCompetition(state);
  function logout() { clearSession(); router.replace('/login'); }
  const label = roleLabel(session?.role, session?.scope);
  const email = visibleSessionEmail(session);
  const accesses = accessList(session);
  return <AppShell active="profile" eyebrow="CONTA" title="PERFIL" subtitle="Identidade, acessos e senha">
    <section className="profile-hero"><span className="profile-avatar"><UserRound size={42} /></span><div><StatusBadge tone="orange">{label}</StatusBadge><h2>{visibleSessionName(session)}</h2>{email ? <p><Mail size={14} /> {email}</p> : null}</div></section>
    <section className="section-block"><SectionTitle eyebrow="PERMISSÕES" title="MEUS ACESSOS" /><div className="stack-list">{accesses.map((access) => <div className="detail-card" key={access.key}><div><ShieldCheck size={22} /><span><small>{competition ? `${competition.name} · ${access.edition}` : access.edition}</small><strong>{access.label}</strong></span></div></div>)}</div></section>
    {passwordChangeAvailable() ? <section className="section-block"><SectionTitle eyebrow="SEGURANÇA" title="SENHA" />{passwordChanged ? <div className="info-banner"><p>Senha trocada. As outras sessões desta conta foram encerradas.</p></div> : null}<PasswordChangeForm onDone={() => setPasswordChanged(true)} /></section> : null}
    <button type="button" className="wide-action button-reset logout-action" onClick={logout}><LogOut size={18} /> SAIR DA CONTA <span>›</span></button>
  </AppShell>;
}
