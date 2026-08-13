'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { getActiveEdition, StaffState, useFrontendState } from '../lib/repositories/browser-repository';
import { listDisciplines } from '@atletica-incinera/intereng-contract/rules';
import { canGrantRole, useFrontendSession } from '../lib/frontend-session';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';

function initialsFrom(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(''); }
export function StaffAccessForm() {
  const router = useRouter(); const { state, dispatch } = useFrontendState();
  const { session } = useFrontendSession();
  const grantableRoles = (['Admin da edição', 'Gestor de modalidade'] as const).filter((item) => canGrantRole(session, item));
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState<StaffState['role']>('Gestor de modalidade'); const [scope, setScope] = useState<string>(''); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(name || email) && !submitting);
  const options = listDisciplines(state, getActiveEdition(state)?.id).filter((item) => item.enabled).map((item) => item.name);
  // A lista chega com o estado: a modalidade escolhida é derivada, não congelada.
  const chosenScope = options.includes(scope) ? scope : options.includes(state.preferences.selectedDiscipline) ? state.preferences.selectedDiscipline : options[0] ?? '';
  async function submit(event: FormEvent) { event.preventDefault(); if (submitting) return; const key = email.trim().toLowerCase(); if (!name.trim() || !/^\S+@\S+\.\S+$/.test(key) || (role === 'Gestor de modalidade' && !chosenScope)) { setError('Informe nome, um e-mail válido e o escopo do acesso.'); return; }
    if (!canGrantRole(session, role)) { setError('Somente o super administrador do app pode conceder acesso de admin da edição.'); return; } if (state.staff[key] && !state.staff[key].revoked) { setError('Este e-mail já possui acesso ativo.'); return; } const member: StaffState = { name: name.trim(), email: key, initials: initialsFrom(name), role, scope: role === 'Admin da edição' ? (state.editions.find((edition) => edition.active)?.name ?? 'Edição ativa') : chosenScope }; setSubmitting(true); const saved = await dispatch({ type: 'staff/upsert', payload: { email: key, member }, audit: { action: 'Acesso concedido', entity: member.name, after: `${member.role} · ${member.scope}` } }); if (saved.ok) router.push('/staff'); else setSubmitting(false); }
  return <AppShell active="profile" eyebrow="PERMISSÕES" title="NOVO ACESSO" subtitle="Atribua um único papel na edição"><form className="entity-form" onSubmit={(event) => void submit(event)} noValidate><label><span>Nome</span><input value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Nome do membro" autoFocus required /></label><label><span>E-mail de acesso</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="staff@ufpe.br" required /></label><label><span>Papel</span><select value={role} onChange={(event) => setRole(event.target.value as StaffState['role'])}>{grantableRoles.map((item) => <option key={item}>{item}</option>)}</select></label>{role === 'Gestor de modalidade' ? <label><span>Modalidade obrigatória</span><select value={chosenScope} onChange={(event) => setScope(event.target.value)}>{options.map((item) => <option key={item}>{item}</option>)}</select></label> : <div className="info-banner"><p>O administrador terá acesso a toda a edição ativa.</p></div>}{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => router.push('/staff')}>Cancelar</button><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Concedendo…' : 'Conceder acesso'}</button></div></form></AppShell>;
}
