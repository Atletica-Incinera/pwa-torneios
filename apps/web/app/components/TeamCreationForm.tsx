'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';
import { teams } from '../lib/repositories/catalog-repository';

function slugify(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
export function TeamCreationForm() {
  const router = useRouter(); const { state, commit } = useFrontendState();
  const [name, setName] = useState(''); const [initials, setInitials] = useState(''); const [responsible, setResponsible] = useState(''); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(name || initials || responsible) && !submitting);
  function submit(event: FormEvent) { event.preventDefault(); if (submitting) return; const base = slugify(name); if (!base || !initials.trim() || !responsible.trim()) { setError('Preencha nome, sigla e responsável.'); return; } const duplicate = [...teams.map((team) => team.name), ...Object.values(state.teams).map((team) => team.name ?? '')].some((item) => item.toLocaleLowerCase('pt-BR') === name.trim().toLocaleLowerCase('pt-BR')); if (duplicate) { setError('Já existe uma equipe com este nome.'); return; } const id = state.teams[base] ? `${base}-${Date.now()}` : base; setSubmitting(true); if (commit((current) => ({ ...current, teams: { ...current.teams, [id]: { name: name.trim(), initials: initials.trim().toUpperCase(), responsible: responsible.trim(), created: true, athletes: 0, tone: 'blue' } } }), { action: 'Equipe cadastrada', entity: name.trim(), after: 'Ativa' })) router.push(`/teams/${id}`); else setSubmitting(false); }
  return <AppShell active="teams" eyebrow="CATÁLOGO GLOBAL" title="NOVA EQUIPE" subtitle="Cadastre a equipe uma única vez"><form className="entity-form team-creation-form" onSubmit={submit} noValidate><label><span>Nome da equipe</span><input value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Ex.: Alcateia" autoFocus required /></label><label><span>Sigla</span><input value={initials} onChange={(event) => { setInitials(event.target.value); setError(''); }} placeholder="ALC" minLength={2} maxLength={8} required /></label><label><span>Responsável</span><input value={responsible} onChange={(event) => { setResponsible(event.target.value); setError(''); }} placeholder="Nome do responsável" required /></label>{error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}<div className="form-actions"><Link href="/teams" className="secondary-button">Cancelar</Link><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Cadastrando…' : 'Cadastrar equipe'}</button></div></form></AppShell>;
}
