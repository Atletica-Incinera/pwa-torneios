'use client';

import { Pencil, Save, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useFrontendState } from '../lib/frontend-state';

export function AthleteManager({ id, initialName, teamName }: { id: string; initialName: string; teamName: string }) {
  const { state, commit } = useFrontendState();
  const name = state.athletes[id]?.name ?? initialName;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    commit((current) => ({ ...current, athletes: { ...current.athletes, [id]: { ...current.athletes[id], name: draft.trim() } } }), { action: 'Nome do atleta alterado', entity: initialName, before: name, after: draft.trim() });
    setEditing(false);
  }

  return <>{editing ? <form className="entity-form inline-management-form" onSubmit={save}><label><span>Nome do atleta</span><input value={draft} onChange={(event) => setDraft(event.target.value)} required /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancelar</button><button type="submit" className="primary-button"><Save size={17} /> Salvar</button></div></form> : <section className="profile-hero"><span className="profile-avatar"><UserRound size={42} /></span><div><h2>{name}</h2><p>Atleta da {teamName}</p></div><button type="button" className="row-action" onClick={() => { setDraft(name); setEditing(true); }} aria-label="Editar nome do atleta"><Pencil size={17} /></button></section>}</>;
}
