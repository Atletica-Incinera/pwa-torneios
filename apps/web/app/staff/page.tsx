'use client';

import { KeyRound, Mail, ShieldCheck, Trash2, UserX, UserCheck } from 'lucide-react';
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
  // Só quem tem permissão global mexe em Admin da edição. Entradas marcadas
  // internamente como acesso global não pertencem ao produto e ficam fora da UI.
  const canEdit = (member: StaffState) => !member.superAdmin && canGrantRole(session, member.role);
  const [editing, setEditing] = useState<string | null>(null);
  const members = useMemo(() => Object.entries(state.staff)
    .filter(([, member]) => member.email && !member.superAdmin)
    .map(([key, member]) => ({ key, member })), [state.staff]);
  // Quem teve o acesso revogado sai da lista principal. Antes ficava no meio de
  // quem tem acesso, com uma tarja "REVOGADO" — a tela dizia "estes sao os
  // acessos" e mostrava justamente os que nao sao. O grupo recolhido abaixo e o
  // caminho para restaurar, que so existia pelo proprio cartao.
  const ativos = members.filter(({ member }) => !member.revoked);
  const revogados = members.filter(({ member }) => member.revoked);
  const disciplines = listDisciplines(state, getActiveEdition(state)?.id).filter((item) => item.enabled);

  function save(member: StaffState, patch: Partial<StaffState>, action = 'Permissão alterada') {
    const next = { ...member, ...patch };
    if (!canEdit(member) || !canGrantRole(session, next.role)) { toast('Você não tem permissão para alterar acessos de admin da edição.', 'error'); return; }
    // O escopo do admin é a edição em que ele foi promovido, não um texto fixo:
    // gravado à mão, ele congelava "InterEng 2026" em qualquer edição futura.
    if (next.role === 'Admin da edição') next.scope = getActiveEdition(state)?.name ?? 'Edição ativa';
    void dispatch({
      type: 'staff/upsert',
      payload: { email: member.email, member: next },
      audit: { action, entity: member.name, before: `${member.role} · ${member.scope}`, after: `${next.role} · ${next.scope}` },
    });
  }

  async function remover(member: StaffState) {
    if (!canEdit(member)) { toast('Você não tem permissão para alterar acessos de admin da edição.', 'error'); return; }
    if (!(await confirm({
      title: `Excluir o acesso de ${member.name}?`,
      message: 'A atribuição é apagada, não fica marcada como revogada. Se essa conta nunca operou um jogo nem deixou registro na auditoria, ela também é apagada. Não dá para desfazer.',
      confirmLabel: 'Excluir',
      danger: true,
    }))) return;
    void dispatch({
      type: 'staff/remove',
      payload: { email: member.email },
      audit: { action: 'Acesso excluído', entity: member.name, before: `${member.role} · ${member.scope}`, after: 'Sem acesso' },
    });
  }

  async function toggleRevoked(member: StaffState) {
    const verb = member.revoked ? 'Restaurar' : 'Revogar';
    if (!(await confirm({ title: `${verb} acesso?`, message: member.revoked ? `${member.name} poderá entrar novamente com o papel configurado.` : `${member.name} perderá imediatamente o acesso nesta sessão local.`, confirmLabel: verb, danger: !member.revoked }))) return;
    save(member, { revoked: !member.revoked }, member.revoked ? 'Acesso restaurado' : 'Acesso revogado');
  }

  function cartao(key: string, member: StaffState, index: number) {
    return <article className={`staff-card${member.revoked ? ' is-revoked' : ''}`} key={key}>
      <span className={`avatar-frame avatar-${index % 3}`}>{member.initials}</span>
      <div><h2>{member.name}</h2><p><Mail size={14} /> {member.email}</p><div className="staff-role"><StatusBadge tone={member.revoked ? 'pink' : index === 0 ? 'orange' : 'blue'}>{member.revoked ? 'Revogado' : member.role}</StatusBadge><span>{member.scope}</span></div>
        {editing === key ? <div className="inline-role-editor"><select value={member.role} onChange={(event) => save(member, { role: event.target.value as StaffState['role'] })}>{isSuperAdmin(session) ? <option>Admin da edição</option> : null}<option>Gestor de modalidade</option></select>{member.role === 'Gestor de modalidade' ? <select value={member.scope} onChange={(event) => save(member, { scope: event.target.value })}>{disciplines.map((item) => <option key={item.name}>{item.name}</option>)}</select> : null}<button type="button" onClick={() => setEditing(null)}>Concluir</button></div> : null}
      </div>
      <div className="staff-card-actions">{canEdit(member) ? <>
        <button type="button" onClick={() => setEditing(editing === key ? null : key)} aria-label={`Editar acesso de ${member.name}`} title="Editar papel e escopo" aria-expanded={editing === key}><KeyRound size={18} aria-hidden="true" /></button>
        <button type="button" className={member.revoked ? undefined : 'staff-revoke-button'} onClick={() => toggleRevoked(member)} aria-label={`${member.revoked ? 'Restaurar' : 'Revogar'} acesso de ${member.name}`} title={member.revoked ? 'Restaurar acesso' : 'Revogar acesso'}>{member.revoked ? <UserCheck size={18} aria-hidden="true" /> : <UserX size={18} aria-hidden="true" />}</button>
        <button type="button" className="staff-revoke-button" onClick={() => remover(member)} aria-label={`Excluir acesso de ${member.name}`} title="Excluir acesso"><Trash2 size={18} aria-hidden="true" /></button>
      </> : <span className="staff-locked" title="Edição bloqueada para seu papel"><ShieldCheck size={16} /></span>}</div>
    </article>;
  }

  return <AppShell active="profile" eyebrow="ACESSO" title="STAFF" subtitle="Papéis e permissões da edição" actionHref="/staff/new" actionLabel="Convidar membro para o staff" actionShortLabel="Membro">
    <div className="info-banner"><ShieldCheck size={20} /><p>Administradores controlam a edição. Gestores atuam somente na modalidade atribuída.</p></div>
    <section className="section-block no-top"><SectionTitle eyebrow="EQUIPE" title="ACESSOS" /><div className="staff-list">
      {ativos.length ? ativos.map(({ key, member }, index) => cartao(key, member, index)) : <p className="empty-inline">Ninguém com acesso nesta edição.</p>}
    </div></section>
    {/* Recolhido e no fim: quem foi revogado nao e um acesso da edicao, mas o
        restaurar mora aqui — sem este grupo, revogar seria irreversivel pela
        tela. */}
    {revogados.length ? <details className="grupo-inativos">
      <summary>Acesso revogado ({revogados.length})</summary>
      <div className="staff-list">
        {revogados.map(({ key, member }, index) => cartao(key, member, index))}
      </div>
    </details> : null}
  </AppShell>;
}
