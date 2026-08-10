'use client';

import { KeyRound, Mail, ShieldCheck, UserX, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppShell, SectionTitle, StatusBadge } from '../components/AppShell';
import { disciplines, staff as seedStaff } from '../lib/repositories/catalog-repository';
import { StaffState, useFrontendState } from '../lib/repositories/browser-repository';
import { useUi } from '../components/UiProvider';

export default function StaffPage() {
  const { state, commit } = useFrontendState();
  const { confirm } = useUi();
  const [editing, setEditing] = useState<string | null>(null);
  const members = useMemo(() => {
    const seeded = seedStaff.map((member) => {
      const role: StaffState['role'] = member.role.startsWith('Admin') ? 'Admin da edição' : 'Gestor de modalidade';
      const override = state.staff[member.email];
      return { ...member, ...override, role: override?.role ?? role, name: override?.name ?? member.name, email: member.email, initials: override?.initials ?? member.initials };
    });
    const seedEmails = new Set<string>(seedStaff.map((member) => member.email));
    return [...seeded, ...Object.values(state.staff).filter((member) => member.email && !seedEmails.has(member.email))];
  }, [state.staff]);

  function save(member: StaffState, patch: Partial<StaffState>, action = 'Permissão alterada') {
    const next = { ...member, ...patch };
    if (next.role === 'Admin da edição') next.scope = 'InterEng 2026';
    commit((current) => ({ ...current, staff: { ...current.staff, [member.email]: next } }), {
      action, entity: member.name, before: `${member.role} · ${member.scope}`, after: `${next.role} · ${next.scope}`,
    });
  }

  async function toggleRevoked(member: StaffState) {
    const verb = member.revoked ? 'Restaurar' : 'Revogar';
    if (!(await confirm({ title: `${verb} acesso?`, message: member.revoked ? `${member.name} poderá entrar novamente com o papel configurado.` : `${member.name} perderá imediatamente o acesso nesta sessão local.`, confirmLabel: verb, danger: !member.revoked }))) return;
    save(member, { revoked: !member.revoked }, member.revoked ? 'Acesso restaurado' : 'Acesso revogado');
  }

  return <AppShell active="profile" eyebrow="ACESSO" title="STAFF" subtitle="Papéis e permissões da edição" actionHref="/staff/new" actionLabel="Convidar membro">
    <div className="info-banner"><ShieldCheck size={20} /><p>Administradores controlam a edição. Gestores atuam somente na modalidade atribuída.</p></div>
    <section className="section-block no-top"><SectionTitle eyebrow="EQUIPE" title="ACESSOS" /><div className="staff-list">
      {members.map((member, index) => <article className={`staff-card${member.revoked ? ' is-revoked' : ''}`} key={member.email}>
        <span className={`avatar-frame avatar-${index % 3}`}>{member.initials}</span>
        <div><h2>{member.name}</h2><p><Mail size={14} /> {member.email}</p><div className="staff-role"><StatusBadge tone={member.revoked ? 'pink' : index === 0 ? 'orange' : 'blue'}>{member.revoked ? 'Revogado' : member.role}</StatusBadge><span>{member.scope}</span></div>
          {editing === member.email ? <div className="inline-role-editor"><select value={member.role} onChange={(event) => save(member, { role: event.target.value as StaffState['role'] })}><option>Admin da edição</option><option>Gestor de modalidade</option></select>{member.role === 'Gestor de modalidade' ? <select value={member.scope} onChange={(event) => save(member, { scope: event.target.value })}>{disciplines.map((item) => <option key={item.name}>{item.name}</option>)}</select> : null}<button type="button" onClick={() => setEditing(null)}>Concluir</button></div> : null}
        </div>
        <div className="staff-card-actions"><button type="button" onClick={() => setEditing(editing === member.email ? null : member.email)} aria-label={`Editar acesso de ${member.name}`}><KeyRound size={18} /></button><button type="button" onClick={() => toggleRevoked(member)} aria-label={`${member.revoked ? 'Restaurar' : 'Revogar'} acesso de ${member.name}`}>{member.revoked ? <UserCheck size={18} /> : <UserX size={18} />}</button></div>
      </article>)}
    </div></section>
  </AppShell>;
}
