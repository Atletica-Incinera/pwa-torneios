'use client';

import { Pencil, Save, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { canManageEdition, useFrontendSession } from '../lib/frontend-session';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';

export function AthleteManager({ id, initialName, teamName }: { id: string; initialName: string; teamName: string }) {
  const { state, dispatch } = useFrontendState(); const { session } = useFrontendSession();
  const name = state.athletes[id]?.name ?? initialName; const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(name); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState('');
  const allowed = canManageEdition(session); const dirty = draft.trim() !== name;
  useUnsavedChanges(editing && dirty && !submitting);
  function save(event: FormEvent) { event.preventDefault(); if (!allowed || submitting || !dirty) return; if (draft.trim().length < 3) { setError('Informe o nome completo do atleta.'); return; } setSubmitting(true); void dispatch({ type: 'athlete/update', payload: { id, patch: { name: draft.trim() } }, audit: { action: 'Nome do atleta alterado', entity: initialName, before: name, after: draft.trim() } }).then((saved) => { setSubmitting(false); if (saved.ok) setEditing(false); else setError(saved.error ?? 'Não foi possível salvar o nome do atleta.'); }); }
  return <>{editing ? <form className="entity-form inline-management-form form-step-enter" onSubmit={save} noValidate><label><span>Nome do atleta</span><input value={draft} onChange={(event) => { setDraft(event.target.value); setError(''); }} required /></label>{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="form-actions"><button type="button" className="secondary-button" onClick={() => { setDraft(name); setEditing(false); }}>Cancelar</button><button type="submit" className="primary-button" disabled={!dirty || submitting}><Save size={17} /> {submitting ? 'Salvando…' : 'Salvar'}</button></div></form> : <section className="profile-hero"><span className="profile-avatar"><UserRound size={42} /></span><div><h2>{name}</h2><p>Atleta da {teamName}</p></div>{allowed ? <button type="button" className="row-action" onClick={() => { setDraft(name); setEditing(true); }} aria-label="Editar nome do atleta"><Pencil size={17} /></button> : null}</section>}</>;
}
