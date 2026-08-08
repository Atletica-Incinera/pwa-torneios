'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { useFrontendState } from '../lib/frontend-state';

function slugify(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

export function TeamCreationForm() {
  const router = useRouter();
  const { state, commit } = useFrontendState();
  const [name, setName] = useState('');
  const [initials, setInitials] = useState('');
  const [responsible, setResponsible] = useState('');
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    const base = slugify(name);
    if (!base || !initials.trim() || !responsible.trim()) { setError('Preencha nome, sigla e responsável.'); return; }
    const id = state.teams[base] ? `${base}-${Date.now()}` : base;
    commit((current) => ({ ...current, teams: { ...current.teams, [id]: { name: name.trim(), initials: initials.trim().toUpperCase(), responsible: responsible.trim(), created: true, athletes: 0, tone: 'blue' } } }), { action: 'Equipe cadastrada', entity: name.trim(), after: 'Ativa' });
    router.push(`/teams/${id}`);
  }
  return <AppShell active="teams" eyebrow="CATÁLOGO GLOBAL" title="NOVA EQUIPE" subtitle="Cadastre a equipe uma única vez"><form className="entity-form" onSubmit={submit}><label><span>Nome da equipe</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Alcateia" autoFocus /></label><label><span>Sigla</span><input value={initials} onChange={(event) => setInitials(event.target.value)} placeholder="ALC" maxLength={8} /></label><label><span>Responsável</span><input value={responsible} onChange={(event) => setResponsible(event.target.value)} placeholder="Nome do responsável" /></label>{error ? <p className="form-feedback form-feedback-error">{error}</p> : null}<div className="form-actions"><Link href="/teams" className="secondary-button">Cancelar</Link><button type="submit" className="primary-button">Cadastrar equipe</button></div></form></AppShell>;
}
