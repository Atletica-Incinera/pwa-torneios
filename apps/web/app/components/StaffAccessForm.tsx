'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { disciplines } from '../lib/mock-data';
import { StaffState, useFrontendState } from '../lib/frontend-state';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';

function initialsFrom(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join(''); }
export function StaffAccessForm() {
  const router = useRouter(); const { state, commit } = useFrontendState();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [role, setRole] = useState<StaffState['role']>('Gestor de modalidade'); const [scope, setScope] = useState<string>(state.preferences.selectedDiscipline || disciplines[0].name); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(name || email) && !submitting);
  const options = [...new Set([...disciplines.map((item) => item.name), ...Object.values(state.disciplines).map((item) => item.name).filter((value): value is string => Boolean(value))])];
  function submit(event: FormEvent) { event.preventDefault(); if (submitting) return; const key = email.trim().toLowerCase(); if (!name.trim() || !/^\S+@\S+\.\S+$/.test(key) || (role === 'Gestor de modalidade' && !scope)) { setError('Informe nome, um e-mail válido e o escopo do acesso.'); return; } if (state.staff[key] && !state.staff[key].revoked) { setError('Este e-mail já possui acesso ativo.'); return; } const member: StaffState = { name: name.trim(), email: key, initials: initialsFrom(name), role, scope: role === 'Admin da edição' ? (state.editions.find((edition) => edition.active)?.name ?? 'Edição ativa') : scope }; setSubmitting(true); if (commit((current) => ({ ...current, staff: { ...current.staff, [key]: member } }), { action: 'Acesso concedido', entity: member.name, after: `${member.role} · ${member.scope}` })) router.push('/staff'); else setSubmitting(false); }
  return <AppShell active="profile" eyebrow="PERMISSÕES" title="NOVO ACESSO" subtitle="Atribua um único papel na edição"><form className="entity-form" onSubmit={submit} noValidate><label><span>Nome</span><input value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Nome do membro" autoFocus required /></label><label><span>E-mail de acesso</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="staff@ufpe.br" required /></label><label><span>Papel</span><select value={role} onChange={(event) => setRole(event.target.value as StaffState['role'])}><option>Admin da edição</option><option>Gestor de modalidade</option></select></label>{role === 'Gestor de modalidade' ? <label><span>Modalidade obrigatória</span><select value={scope} onChange={(event) => setScope(event.target.value)}>{options.map((item) => <option key={item}>{item}</option>)}</select></label> : <div className="info-banner"><p>O administrador terá acesso a toda a edição ativa.</p></div>}{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => router.push('/staff')}>Cancelar</button><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Concedendo…' : 'Conceder acesso'}</button></div></form></AppShell>;
}
