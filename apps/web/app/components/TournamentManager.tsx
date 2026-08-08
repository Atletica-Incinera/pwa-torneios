'use client';

import { ArrowDown, ArrowUp, Plus, Trash2, WandSparkles } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { TournamentPhase, TournamentState, useFrontendState } from '../lib/frontend-state';

export function TournamentManager({ id, name, discipline, initialStatus, teamNames }: { id: string; name: string; discipline: string; initialStatus: string; teamNames: string[] }) {
  const { state, commit } = useFrontendState();
  const fallback = useMemo<TournamentState>(() => ({ status: initialStatus === 'Em andamento' ? 'Em andamento' : initialStatus === 'Rascunho' ? 'Rascunho' : 'Publicado', participants: teamNames.slice(0, 8), seeds: Object.fromEntries(teamNames.slice(0, 8).map((team, index) => [team, index + 1])), phases: [{ id: 'groups', name: 'Fase de grupos', format: 'Grupos', groups: ['Grupo A', 'Grupo B'], qualifiers: 2 }, { id: 'knockout', name: 'Mata-mata', format: 'Mata-mata', groups: [], qualifiers: 1 }], assignments: {}, generated: false }), [initialStatus, teamNames]);
  const setup = state.tournaments[id] ?? fallback;
  const [phaseName, setPhaseName] = useState('');
  const locked = setup.status === 'Em andamento' || setup.status === 'Encerrado';
  const groupOptions = setup.phases.find((phase) => phase.format === 'Grupos')?.groups ?? [];

  function update(next: TournamentState, action: string, before?: string, after?: string) {
    commit((current) => ({ ...current, tournaments: { ...current.tournaments, [id]: next } }), { action, entity: name, before, after });
  }

  function toggleParticipant(team: string) {
    if (locked) return;
    const participants = setup.participants.includes(team) ? setup.participants.filter((item) => item !== team) : [...setup.participants, team];
    const seeds = Object.fromEntries(participants.map((item, index) => [item, setup.seeds[item] ?? index + 1]));
    const assignments = Object.fromEntries(Object.entries(setup.assignments).filter(([item]) => participants.includes(item)));
    update({ ...setup, participants, seeds, assignments, generated: false }, 'Participantes do torneio alterados', undefined, `${participants.length} participantes`);
  }

  function addPhase(event: FormEvent) {
    event.preventDefault();
    if (!phaseName.trim() || locked) return;
    const phase: TournamentPhase = { id: `phase-${Date.now()}`, name: phaseName.trim(), format: 'Grupos', groups: ['Grupo A'], qualifiers: 2 };
    update({ ...setup, phases: [...setup.phases, phase], generated: false }, 'Fase criada', undefined, phase.name);
    setPhaseName('');
  }

  function updatePhase(phaseId: string, patch: Partial<TournamentPhase>) {
    update({ ...setup, phases: setup.phases.map((phase) => phase.id === phaseId ? { ...phase, ...patch } : phase), generated: false }, 'Fase configurada', phaseId, JSON.stringify(patch));
  }

  function movePhase(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= setup.phases.length || locked) return;
    const phases = [...setup.phases];
    [phases[index], phases[target]] = [phases[target], phases[index]];
    update({ ...setup, phases, generated: false }, 'Ordem das fases alterada');
  }

  function removePhase(phaseId: string) {
    if (locked || !window.confirm('Remover esta fase da estrutura?')) return;
    update({ ...setup, phases: setup.phases.filter((phase) => phase.id !== phaseId), generated: false }, 'Fase removida', phaseId);
  }

  function setStatus(status: TournamentState['status']) {
    update({ ...setup, status }, 'Status do torneio alterado', setup.status, status);
  }

  function generateConfrontations() {
    const ordered = [...setup.participants].sort((a, b) => (setup.seeds[a] ?? 999) - (setup.seeds[b] ?? 999));
    const grouped = groupOptions.map((group) => ordered.filter((team) => setup.assignments[team] === group));
    const unassigned = ordered.filter((team) => !setup.assignments[team] || !groupOptions.includes(setup.assignments[team]));
    const buckets = groupOptions.length ? [...grouped, ...(unassigned.length ? [unassigned] : [])] : [ordered];
    const pairs = buckets.flatMap((bucket) => bucket.reduce<Array<[string, string]>>((result, team, index) => { if (index % 2 === 0 && bucket[index + 1]) result.push([team, bucket[index + 1]]); return result; }, []));
    const generatedMatches = Object.fromEntries(pairs.map(([entryA, entryB], index) => [`${id}-generated-${index + 1}`, { created: true as const, discipline, entryA, entryB, logoA: '', logoB: '', date: '2026-10-14', time: `${String(8 + index).padStart(2, '0')}:00`, venue: 'A definir', phase: setup.phases[0]?.name ?? 'Fase inicial', status: 'Agendada' as const }]));
    const next = { ...setup, generated: true };
    commit((current) => { const retainedMatches = Object.fromEntries(Object.entries(current.matches).filter(([matchId]) => !matchId.startsWith(`${id}-generated-`))); return { ...current, tournaments: { ...current.tournaments, [id]: next }, matches: { ...retainedMatches, ...generatedMatches } }; }, { action: setup.generated ? 'Confrontos regerados' : 'Confrontos gerados', entity: name, after: `${pairs.length} partidas` });
  }

  return <div className="tournament-manager"><section className="management-panel"><div className="management-panel-head"><div><small>SITUAÇÃO</small><h2>PUBLICAÇÃO</h2></div><select value={setup.status} onChange={(event) => setStatus(event.target.value as TournamentState['status'])}><option>Rascunho</option><option>Publicado</option><option>Em andamento</option><option>Encerrado</option></select></div><p>{locked ? 'A estrutura está bloqueada porque o torneio já começou.' : 'Participantes e fases podem ser alterados antes do início.'}</p></section>
    <section className="management-panel"><div className="management-panel-head"><div><small>ETAPA 1</small><h2>PARTICIPANTES E SEEDS</h2></div><strong>{setup.participants.length}</strong></div><div className="participant-selector">{teamNames.map((team) => <label key={team}><input type="checkbox" checked={setup.participants.includes(team)} onChange={() => toggleParticipant(team)} disabled={locked} /><span>{team}</span>{setup.participants.includes(team) ? <input type="number" min="1" value={setup.seeds[team] ?? 1} onChange={(event) => update({ ...setup, seeds: { ...setup.seeds, [team]: Number(event.target.value) }, generated: false }, 'Seed alterado', team, event.target.value)} disabled={locked} aria-label={`Seed de ${team}`} /> : null}</label>)}</div></section>
    <section className="management-panel"><div className="management-panel-head"><div><small>ETAPA 2</small><h2>FASES E GRUPOS</h2></div><strong>{setup.phases.length}</strong></div><div className="phase-editor-list">{setup.phases.map((phase, index) => <article key={phase.id}><span className="phase-order">{String(index + 1).padStart(2, '0')}</span><div><input value={phase.name} onChange={(event) => updatePhase(phase.id, { name: event.target.value })} disabled={locked} aria-label="Nome da fase" /><div className="phase-fields"><select value={phase.format} onChange={(event) => updatePhase(phase.id, { format: event.target.value as TournamentPhase['format'] })} disabled={locked}><option>Grupos</option><option>Mata-mata</option><option>Liga</option></select><input type="number" min="1" value={phase.qualifiers} onChange={(event) => updatePhase(phase.id, { qualifiers: Number(event.target.value) })} disabled={locked} aria-label="Quantidade de classificados" />{phase.format === 'Grupos' ? <input value={phase.groups.join(', ')} onChange={(event) => updatePhase(phase.id, { groups: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} disabled={locked} aria-label="Grupos separados por vírgula" /> : null}</div></div><div className="phase-editor-actions"><button type="button" onClick={() => movePhase(index, -1)} disabled={locked || index === 0}><ArrowUp size={15} /></button><button type="button" onClick={() => movePhase(index, 1)} disabled={locked || index === setup.phases.length - 1}><ArrowDown size={15} /></button><button type="button" onClick={() => removePhase(phase.id)} disabled={locked}><Trash2 size={15} /></button></div></article>)}</div><form className="phase-add-form" onSubmit={addPhase}><input value={phaseName} onChange={(event) => setPhaseName(event.target.value)} placeholder="Nome da nova fase" disabled={locked} /><button type="submit" disabled={locked}><Plus size={17} /> Adicionar fase</button></form>{groupOptions.length ? <div className="group-assignment"><h3>DISTRIBUIÇÃO NOS GRUPOS</h3>{setup.participants.map((team) => <label key={team}><span>{team}</span><select value={setup.assignments[team] ?? ''} onChange={(event) => update({ ...setup, assignments: { ...setup.assignments, [team]: event.target.value }, generated: false }, 'Grupo da equipe alterado', team, event.target.value)} disabled={locked}><option value="">Definir grupo</option>{groupOptions.map((group) => <option key={group}>{group}</option>)}</select></label>)}</div> : null}</section>
    <section className="management-panel"><div className="management-panel-head"><div><small>ETAPA 3</small><h2>GERAR CONFRONTOS</h2></div></div><p>{setup.generated ? `Confrontos gerados para ${setup.participants.length} participantes em ${setup.phases.length} fases.` : 'Revise participantes, seeds, grupos e fases antes de gerar.'}</p><button type="button" className="wide-action button-reset" onClick={generateConfrontations} disabled={locked || setup.participants.length < 2 || !setup.phases.length}><WandSparkles size={18} /> {setup.generated ? 'REGERAR CONFRONTOS' : 'GERAR CONFRONTOS'} <span>›</span></button></section>
  </div>;
}
