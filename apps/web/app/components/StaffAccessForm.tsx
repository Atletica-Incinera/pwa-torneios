'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { disciplines } from '../lib/mock-data';
import { StaffState, useFrontendState } from '../lib/frontend-state';

function initialsFrom(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

export function StaffAccessForm() {
  const router = useRouter();
  const { commit } = useFrontendState();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<StaffState['role']>('Gestor de modalidade');
  const [scope, setScope] = useState<string>(disciplines[0].name);
  const [error, setError] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const key = email.trim().toLowerCase();
    if (!name.trim() || !key || (role === 'Gestor de modalidade' && !scope)) {
      setError('Preencha os dados obrigatórios e selecione a modalidade.');
      return;
    }
    const member: StaffState = {
      name: name.trim(), email: key, initials: initialsFrom(name), role,
      scope: role === 'Admin da edição' ? 'InterEng 2026' : scope,
    };
    commit((current) => ({ ...current, staff: { ...current.staff, [key]: member } }), {
      action: 'Acesso concedido', entity: member.name, after: `${member.role} · ${member.scope}`,
    });
    router.push('/staff');
  }

  return <AppShell active="profile" eyebrow="PERMISSÕES" title="NOVO ACESSO" subtitle="Atribua um único papel na edição">
    <form className="entity-form" onSubmit={submit}>
      <label><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do membro" autoFocus /></label>
      <label><span>E-mail de acesso</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="staff@ufpe.br" /></label>
      <label><span>Papel</span><select value={role} onChange={(event) => setRole(event.target.value as StaffState['role'])}><option>Admin da edição</option><option>Gestor de modalidade</option></select></label>
      {role === 'Gestor de modalidade' ? <label><span>Modalidade obrigatória</span><select value={scope} onChange={(event) => setScope(event.target.value)}>{disciplines.map((item) => <option key={item.name}>{item.name}</option>)}</select></label> : <div className="info-banner"><p>O administrador terá acesso a toda a edição InterEng 2026.</p></div>}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="form-actions"><button type="button" onClick={() => router.push('/staff')}>Cancelar</button><button type="submit">Conceder acesso</button></div>
    </form>
  </AppShell>;
}
