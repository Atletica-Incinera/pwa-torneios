'use client';

import Link from 'next/link';
import { KeyRound, Mail, ShieldAlert, ShieldCheck, UserX, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppShell, SectionTitle, StatusBadge } from '../components/AppShell';
import { getActiveEdition, StaffState, useFrontendState } from '../lib/repositories/browser-repository';
import { listDisciplines } from '../lib/edition-catalog';
import { useUi } from '../components/UiProvider';
import { canGrantRole, isSuperAdmin, useFrontendSession } from '../lib/frontend-session';

export default function StaffPage() {
  const { state, dispatch } = useFrontendState();
  const { confirm, toast } = useUi();
  const { session } = useFrontendSession();
  // Só o super admin mexe em quem é (ou vira) Admin da edição.
  const canEdit = (member: StaffState) => canGrantRole(session, member.role);
  const [editing, setEditing] = useState<string | null>(null);
  const members = useMemo(() => Object.entries(state.staff)
    .filter(([, member]) => member.email)
    .map(([key, member]) => ({ key, member })), [state.staff]);
  const disciplines = listDisciplines(state, getActiveEdition(state)?.id).filter((item) => item.enabled);

  function save(member: StaffState, patch: Partial<StaffState>, action = 'Permissão alterada') {
    const next = { ...member, ...patch };
    if (!canEdit(member) || !canGrantRole(session, next.role)) { toast('Somente o super administrador do app altera acessos de admin da edição.', 'error'); return; }
    if (next.role === 'Admin da edição') next.scope = 'InterEng 2026';
    void dispatch({
      type: 'staff/upsert',
      payload: { email: member.email, member: next },
      audit: { action, entity: member.name, before: `${member.role} · ${member.scope}`, after: `${next.role} · ${next.scope}` },
    });
  }

  async function toggleRevoked(member: StaffState) {
    const verb = member.revoked ? 'Restaurar' : 'Revogar';
    if (!(await confirm({ title: `${verb} acesso?`, message: member.revoked ? `${member.name} poderá entrar novamente com o papel configurado.` : `${member.name} perderá imediatamente o acesso nesta sessão local.`, confirmLabel: verb, danger: !member.revoked }))) return;
    save(member, { revoked: !member.revoked }, member.revoked ? 'Acesso restaurado' : 'Acesso revogado');
  }

  return <AppShell active="profile" eyebrow="ACESSO" title="STAFF" subtitle="Papéis e permissões da edição" actionHref="/staff/new" actionLabel="Convidar membro">
    <div className="info-banner"><ShieldCheck size={20} /><p>Administradores controlam a edição. Gestores atuam somente na modalidade atribuída.</p></div>
    {isSuperAdmin(session) ? <Link href="/staff/promote" className="secondary-button"><ShieldAlert size={17} aria-hidden="true" /> Conceder super admin</Link> : null}
    <section className="section-block no-top"><SectionTitle eyebrow="EQUIPE" title="ACESSOS" /><div className="staff-list">
      {members.map(({ key, member }, index) => <article className={`staff-card${member.revoked ? ' is-revoked' : ''}`} key={key}>
        <span className={`avatar-frame avatar-${index % 3}`}>{member.initials}</span>
        <div><h2>{member.name}</h2><p><Mail size={14} /> {member.email}</p><div className="staff-role"><StatusBadge tone={member.revoked ? 'pink' : index === 0 ? 'orange' : 'blue'}>{member.revoked ? 'Revogado' : member.role}</StatusBadge><span>{member.scope}</span></div>
          {editing === key ? <div className="inline-role-editor"><select value={member.role} onChange={(event) => save(member, { role: event.target.value as StaffState['role'] })}>{isSuperAdmin(session) ? <option>Admin da edição</option> : null}<option>Gestor de modalidade</option></select>{member.role === 'Gestor de modalidade' ? <select value={member.scope} onChange={(event) => save(member, { scope: event.target.value })}>{disciplines.map((item) => <option key={item.name}>{item.name}</option>)}</select> : null}<button type="button" onClick={() => setEditing(null)}>Concluir</button></div> : null}
        </div>
        <div className="staff-card-actions">{canEdit(member) ? <><button type="button" onClick={() => setEditing(editing === key ? null : key)} aria-label={`Editar acesso de ${member.name}`}><KeyRound size={18} /></button><button type="button" onClick={() => toggleRevoked(member)} aria-label={`${member.revoked ? 'Restaurar' : 'Revogar'} acesso de ${member.name}`}>{member.revoked ? <UserCheck size={18} /> : <UserX size={18} />}</button></> : <span className="staff-locked" title="Somente o super administrador do app"><ShieldCheck size={16} /></span>}</div>
      </article>)}
    </div></section>
  </AppShell>;
}
