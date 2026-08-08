'use client';

import Link from 'next/link';
import { ChevronDown, Plus, Save, UserRound, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from './AppShell';
import { useFrontendState } from '../lib/frontend-state';

type ExistingAthlete = { id: string; name: string; modalities: readonly string[] };
type LocalAthlete = { id: string; teamId: string; name: string; modalities: string[] };
type ManagedAthlete = { id: string; name: string; modalities: string[]; local: boolean };

const localAthletesKey = 'intereng:team-athletes';
const associationsKey = 'intereng:athlete-modalities';
const tones = ['blue', 'pink', 'orange'] as const;

export function TeamRosterManager({ teamId, existingAthletes, disciplines, readOnly = false }: { teamId: string; existingAthletes: ExistingAthlete[]; disciplines: string[]; readOnly?: boolean }) {
  const [localAthletes, setLocalAthletes] = useState<LocalAthlete[]>([]);
  const [overrides, setOverrides] = useState<Record<string, string[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const { state: appState, commit } = useFrontendState();

  useEffect(() => {
    const local = JSON.parse(window.localStorage.getItem(localAthletesKey) ?? '[]') as LocalAthlete[];
    const savedAssociations = JSON.parse(window.localStorage.getItem(associationsKey) ?? '{}') as Record<string, string[]>;
    setLocalAthletes(local.filter((athlete) => athlete.teamId === teamId));
    setOverrides(savedAssociations);
  }, [teamId]);

  const athletes = useMemo<ManagedAthlete[]>(() => [
    ...existingAthletes.map((athlete) => ({ ...athlete, name: appState.athletes[athlete.id]?.name ?? athlete.name, modalities: overrides[athlete.id] ?? [...athlete.modalities], local: false })),
    ...localAthletes.map((athlete) => ({ ...athlete, name: appState.athletes[athlete.id]?.name ?? athlete.name, modalities: overrides[athlete.id] ?? appState.athletes[athlete.id]?.modalities ?? athlete.modalities, local: true })),
  ], [existingAthletes, localAthletes, overrides, appState.athletes]);

  const groups = [
    ...disciplines.filter((discipline) => athletes.some((athlete) => athlete.modalities.includes(discipline))).map((name) => ({ name, athletes: athletes.filter((athlete) => athlete.modalities.includes(name)) })),
    ...(athletes.some((athlete) => !athlete.modalities.length) ? [{ name: 'Sem modalidade', athletes: athletes.filter((athlete) => !athlete.modalities.length) }] : []),
  ];

  function startAssociation(athlete: ManagedAthlete) {
    setEditingId(athlete.id);
    setSelection(athlete.modalities);
  }

  function toggle(discipline: string) {
    setSelection((current) => current.includes(discipline) ? current.filter((item) => item !== discipline) : [...current, discipline]);
  }

  function saveAssociation(id: string) {
    const athleteName = athletes.find((athlete) => athlete.id === id)?.name ?? id;
    const next = { ...overrides, [id]: selection };
    setOverrides(next);
    window.localStorage.setItem(associationsKey, JSON.stringify(next));

    const stored = JSON.parse(window.localStorage.getItem(localAthletesKey) ?? '[]') as LocalAthlete[];
    if (stored.some((athlete) => athlete.id === id)) {
      const updated = stored.map((athlete) => athlete.id === id ? { ...athlete, modalities: selection } : athlete);
      window.localStorage.setItem(localAthletesKey, JSON.stringify(updated));
      setLocalAthletes(updated.filter((athlete) => athlete.teamId === teamId));
    }
    commit((current) => ({ ...current, athletes: { ...current.athletes, [id]: { ...current.athletes[id], modalities: selection } } }), { action: 'Modalidades do atleta alteradas', entity: athleteName, before: (overrides[id] ?? []).join(', ') || 'Sem modalidade', after: selection.join(', ') || 'Sem modalidade' });
    setEditingId(null);
  }

  function renderAthlete(athlete: ManagedAthlete) {
    return (
      <article className="roster-manage-row" key={athlete.id}>
        <span className="jersey-number"><UserRound size={16} /></span>
        <span className="roster-athlete-copy">{athlete.local || readOnly ? <strong>{athlete.name}</strong> : <Link href={`/athletes/${athlete.id}`}><strong>{athlete.name}</strong></Link>}<small>{athlete.local && !readOnly ? 'Cadastro local' : 'Atleta da equipe'}</small></span>
        {!readOnly ? <button type="button" className="roster-associate-button" onClick={() => editingId === athlete.id ? setEditingId(null) : startAssociation(athlete)} aria-label={`Editar modalidades de ${athlete.name}`} aria-expanded={editingId === athlete.id}><Plus size={17} /></button> : null}
        {editingId === athlete.id && !readOnly ? <div className="local-athlete-editor"><div>{disciplines.map((discipline) => <label key={discipline}><input type="checkbox" checked={selection.includes(discipline)} onChange={() => toggle(discipline)} /><span>{discipline}</span></label>)}</div><div className="local-athlete-editor-actions"><button type="button" onClick={() => setEditingId(null)}><X size={16} />Cancelar</button><button type="button" onClick={() => saveAssociation(athlete.id)}><Save size={16} />Salvar</button></div></div> : null}
      </article>
    );
  }

  if (!athletes.length) return <EmptyState title="SEM ATLETAS" copy={readOnly ? 'Esta equipe ainda não possui elenco publicado.' : 'Cadastre o primeiro atleta desta equipe pelo botão superior.'} />;

  return <div className="team-modality-list">{groups.map((group, index) => { const tone = tones[index % tones.length]; return <details className={`team-modality team-modality-${tone}`} key={group.name} open={index === 0}><summary><span className={`team-modality-mark mark-${tone}`}>{String(index + 1).padStart(2, '0')}</span><span className="team-modality-copy"><strong>{group.name}</strong><small>{group.athletes.length} atletas</small></span><ChevronDown size={21} aria-hidden="true" /></summary><div className="team-modality-roster"><div className="stack-list">{group.athletes.map(renderAthlete)}</div></div></details>; })}</div>;
}
