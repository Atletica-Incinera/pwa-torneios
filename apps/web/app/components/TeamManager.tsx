'use client';

import { Archive, Pencil, Save } from 'lucide-react';
import { ChangeEvent, FormEvent, useState } from 'react';
import { TeamMark } from './AppShell';
import { useFrontendState } from '../lib/frontend-state';

type TeamBase = { id: string; name: string; initial: string; tone: string; logo: string; athletes: number };

export function TeamManager({ team, readOnly = false }: { team: TeamBase; readOnly?: boolean }) {
  const { state, commit } = useFrontendState();
  const override = state.teams[team.id] ?? {};
  const current = { name: override.name ?? team.name, initials: override.initials ?? team.initial, responsible: override.responsible ?? '', logo: override.logo ?? team.logo, archived: override.archived ?? false };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  function chooseLogo(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setDraft((value) => ({ ...value, logo: String(reader.result) })); reader.readAsDataURL(file); }
  function save(event: FormEvent) { event.preventDefault(); commit((value) => ({ ...value, teams: { ...value.teams, [team.id]: { ...value.teams[team.id], ...draft } } }), { action: 'Equipe alterada', entity: current.name, before: current.name, after: draft.name }); setEditing(false); }
  function toggleArchive() { const archived = !current.archived; commit((value) => ({ ...value, teams: { ...value.teams, [team.id]: { ...value.teams[team.id], archived } } }), { action: archived ? 'Equipe arquivada' : 'Equipe restaurada', entity: current.name, after: archived ? 'Arquivada' : 'Ativa' }); }
  return <><section className={`team-hero team-detail-heading${current.archived ? ' is-archived' : ''}`}><TeamMark initial={current.initials[0] ?? team.initial} tone={team.tone} logo={current.logo} /><div><h2>{current.name}</h2><p>{current.archived ? 'Equipe arquivada' : `${override.athletes ?? team.athletes} atletas cadastrados na edição`}</p></div></section>{!readOnly && editing ? <form className="entity-form inline-management-form" onSubmit={save}><label><span>Nome da equipe</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label><label><span>Sigla</span><input value={draft.initials} onChange={(event) => setDraft({ ...draft, initials: event.target.value })} required /></label><label><span>Responsável</span><input value={draft.responsible} onChange={(event) => setDraft({ ...draft, responsible: event.target.value })} placeholder="Nome do responsável" /></label><label><span>Logotipo</span><input type="file" accept="image/*" onChange={chooseLogo} /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancelar</button><button type="submit" className="primary-button"><Save size={17} /> Salvar</button></div></form> : !readOnly ? <div className="form-actions team-management-actions"><button type="button" className="secondary-button" onClick={toggleArchive}><Archive size={17} /> {current.archived ? 'Restaurar' : 'Arquivar'}</button><button type="button" className="primary-button" onClick={() => { setDraft(current); setEditing(true); }}><Pencil size={17} /> Editar equipe</button></div> : null}</>;
}
