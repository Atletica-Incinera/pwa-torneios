'use client';

import { ArrowDown, ArrowUp, Plus, Trash2, WandSparkles } from 'lucide-react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { getActiveEdition, TournamentPhase, TournamentState, useFrontendState } from '../lib/repositories/browser-repository';
import { distributeGroups, generateRoundRobin } from '../lib/tournament-engine';
import { useUi } from './UiProvider';
import { canManageDiscipline, useFrontendSession } from '../lib/frontend-session';
import { teams as teamCatalog } from '../lib/repositories/catalog-repository';
import { resolveDisciplineRule } from '../lib/discipline-rules';

export function TournamentManager({ id, name, discipline, initialStatus, teamNames }: { id: string; name: string; discipline: string; initialStatus: string; teamNames: string[] }) {
  const { state, commit } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const { confirm } = useUi();
  const { session } = useFrontendSession();
  const fallback = useMemo<TournamentState>(() => ({ status: initialStatus === 'Em andamento' ? 'Em andamento' : initialStatus === 'Rascunho' ? 'Rascunho' : 'Publicado', editionId: activeEdition?.id, participants: teamNames.slice(0, 8), seeds: Object.fromEntries(teamNames.slice(0, 8).map((team, index) => [team, index + 1])), phases: [{ id: 'groups', name: 'Fase de grupos', format: 'Grupos', groups: ['Grupo A', 'Grupo B'], qualifiers: 2 }, { id: 'knockout', name: 'Mata-mata', format: 'Mata-mata', groups: [], qualifiers: 1 }], assignments: {}, generated: false }), [activeEdition?.id, initialStatus, teamNames]);
  const setup = state.tournaments[id] ?? fallback;
  const [phaseName, setPhaseName] = useState('');
  const [generating, setGenerating] = useState(false);
  const generationLock = useRef(false);
  const locked = setup.status === 'Em andamento' || setup.status === 'Encerrado';
  const groupOptions = setup.phases.find((phase) => phase.format === 'Grupos')?.groups ?? [];
  const allowed = canManageDiscipline(session, discipline);

  function update(next: TournamentState, action: string, before?: string, after?: string, silent = false) {
    const noAudit = silent || action === 'Seed alterado' || action === 'Grupo da equipe alterado';
    commit((current) => ({ ...current, tournaments: { ...current.tournaments, [id]: { ...next, editionId: next.editionId ?? activeEdition?.id } } }), noAudit ? undefined : { action, entity: name, before, after });
  }

  function toggleParticipant(team: string) {
    if (locked) return;
    const participants = setup.participants.includes(team) ? setup.participants.filter((item) => item !== team) : [...setup.participants, team];
    const seeds = Object.fromEntries(participants.map((item, index) => [item, setup.seeds[item] ?? index + 1]));
    const assignments = Object.fromEntries(Object.entries(setup.assignments).filter(([item]) => participants.includes(item)));
    update({ ...setup, participants, seeds, assignments, generated: false }, 'Participantes da disputa alterados', undefined, `${participants.length} participantes`);
  }

  function addPhase(event: FormEvent) {
    event.preventDefault();
    if (!phaseName.trim() || locked) return;
    const phase: TournamentPhase = { id: `phase-${Date.now()}`, name: phaseName.trim(), format: 'Grupos', groups: ['Grupo A'], qualifiers: 2 };
    update({ ...setup, phases: [...setup.phases, phase], generated: false }, 'Fase criada', undefined, phase.name);
    setPhaseName('');
  }

  function updatePhase(phaseId: string, patch: Partial<TournamentPhase>) {
    const normalizedPatch = patch.format === 'Mata-mata' ? { ...patch, qualifiers: 1 } : patch;
    update({ ...setup, phases: setup.phases.map((phase) => phase.id === phaseId ? { ...phase, ...normalizedPatch } : phase), generated: false }, 'Fase configurada', phaseId, JSON.stringify(normalizedPatch), true);
  }

  function movePhase(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= setup.phases.length || locked) return;
    const phases = [...setup.phases];
    [phases[index], phases[target]] = [phases[target], phases[index]];
    update({ ...setup, phases, generated: false }, 'Ordem das fases alterada');
  }

  async function removePhase(phaseId: string) {
    if (locked || !(await confirm({ title: 'Remover fase?', message: 'A configuração desta fase será descartada. Os confrontos deverão ser gerados novamente.', confirmLabel: 'Remover', danger: true }))) return;
    update({ ...setup, phases: setup.phases.filter((phase) => phase.id !== phaseId), generated: false }, 'Fase removida', phaseId);
  }

  async function setStatus(status: TournamentState['status']) {
    if (status === setup.status) return;
    if (setup.status === 'Encerrado' || (setup.status === 'Em andamento' && status !== 'Encerrado')) { window.dispatchEvent(new CustomEvent('intereng:toast', { detail: { message: 'A disputa não pode voltar para uma etapa anterior.', tone: 'error' } })); return; }
    if (status !== 'Rascunho' && (setup.participants.length < 2 || !setup.phases.length || !setup.generated)) { window.dispatchEvent(new CustomEvent('intereng:toast', { detail: { message: 'Gere os confrontos antes de publicar a disputa.', tone: 'error' } })); return; }
    if ((status === 'Em andamento' || status === 'Encerrado') && !(await confirm({ title: status === 'Encerrado' ? 'Encerrar disputa?' : 'Iniciar disputa?', message: status === 'Encerrado' ? 'A estrutura e as partidas serão bloqueadas para edição.' : 'Participantes, seeds e fases ficarão bloqueados após o início.', confirmLabel: status === 'Encerrado' ? 'Encerrar' : 'Iniciar', danger: status === 'Encerrado' }))) return;
    update({ ...setup, status }, 'Status da disputa alterado', setup.status, status);
  }

  async function generateConfrontations() {
    if (generationLock.current) return;
    generationLock.current = true;
    if (setup.generated && !(await confirm({ title: 'Regerar confrontos?', message: 'Os jogos gerados anteriormente serão substituídos. Resultados não vinculados serão preservados.', confirmLabel: 'Regerar', danger: true }))) { generationLock.current = false; return; }
    setGenerating(true);
    const ordered = [...setup.participants].sort((a, b) => (setup.seeds[a] ?? 999) - (setup.seeds[b] ?? 999));
    const assignments = { ...distributeGroups(ordered, groupOptions, setup.seeds), ...setup.assignments };
    const buckets = groupOptions.length ? groupOptions.map((group) => ({ name: group, teams: ordered.filter((team) => assignments[team] === group) })) : [{ name: setup.phases[0]?.name ?? 'Fase inicial', teams: ordered }];
    const classificationPhase = setup.phases.find((phase) => phase.format !== 'Mata-mata');
    if (classificationPhase && buckets.some((bucket) => classificationPhase.qualifiers > bucket.teams.length)) {
      window.dispatchEvent(new CustomEvent('intereng:toast', { detail: { message: 'A quantidade de classificados não pode ser maior que as equipes do grupo.', tone: 'error' } }));
      setGenerating(false);
      generationLock.current = false;
      return;
    }
    const pairs = buckets.flatMap((bucket) => generateRoundRobin(bucket.teams).map((pair) => ({ pair, phase: bucket.name })));
    const startDate = activeEdition?.start ?? new Date().toISOString().slice(0, 10);
    const logoFor = (team: string) => teamCatalog.find((item) => item.name === team)?.logo ?? Object.values(state.teams).find((item) => item.name === team)?.logo ?? '';
    const generatedMatches = Object.fromEntries(pairs.map(({ pair: [entryA, entryB], phase }, index) => [`${id}-generated-${index + 1}`, { created: true as const, editionId: activeEdition?.id, tournamentId: id, discipline, entryA, entryB, logoA: logoFor(entryA), logoB: logoFor(entryB), date: startDate, time: `${String(8 + (index % 10)).padStart(2, '0')}:00`, venue: 'A definir', phase, status: 'Agendada' as const, rules: resolveDisciplineRule(discipline, state.disciplines[discipline]), currentPeriod: 1, clockSeconds: 0, paused: true, events: [] }]));
    const next = { ...setup, editionId: setup.editionId ?? activeEdition?.id, assignments, generated: true };
    commit((current) => { const retainedMatches = Object.fromEntries(Object.entries(current.matches).filter(([matchId]) => !matchId.startsWith(`${id}-generated-`))); return { ...current, tournaments: { ...current.tournaments, [id]: next }, matches: { ...retainedMatches, ...generatedMatches } }; }, { action: setup.generated ? 'Confrontos regerados' : 'Confrontos gerados', entity: name, after: `${pairs.length} partidas` });
    setGenerating(false);
    generationLock.current = false;
  }

  if (!allowed) return <div className="info-banner"><p>Seu perfil não pode configurar disputas de {discipline}.</p></div>;

  return <div className="tournament-manager"><section className="management-panel" id="publication"><div className="management-panel-head"><div><small>SITUAÇÃO</small><h2>PUBLICAÇÃO</h2></div><select value={setup.status} onChange={(event) => setStatus(event.target.value as TournamentState['status'])}><option>Rascunho</option><option>Publicado</option><option>Em andamento</option><option>Encerrado</option></select></div><p>{locked ? 'A estrutura está bloqueada porque a disputa já começou.' : 'Participantes e fases podem ser alterados antes do início.'}</p></section>
    <section className="management-panel" id="participants"><div className="management-panel-head"><div><small>ETAPA 1</small><h2>PARTICIPANTES E SEEDS</h2></div><strong>{setup.participants.length}</strong></div><div className="participant-selector">{teamNames.map((team) => <label key={team}><input type="checkbox" checked={setup.participants.includes(team)} onChange={() => toggleParticipant(team)} disabled={locked} /><span>{team}</span>{setup.participants.includes(team) ? <input type="number" min="1" value={setup.seeds[team] ?? 1} onChange={(event) => update({ ...setup, seeds: { ...setup.seeds, [team]: Number(event.target.value) }, generated: false }, 'Seed alterado', team, event.target.value)} disabled={locked} aria-label={`Seed de ${team}`} /> : null}</label>)}</div></section>
    <section className="management-panel" id="phases"><div className="management-panel-head"><div><small>ETAPA 2</small><h2>FASES E GRUPOS</h2></div><strong>{setup.phases.length}</strong></div><div className="phase-editor-list">{setup.phases.map((phase, index) => <article key={phase.id}><span className="phase-order">{String(index + 1).padStart(2, '0')}</span><div><input value={phase.name} onChange={(event) => updatePhase(phase.id, { name: event.target.value })} disabled={locked} aria-label="Nome da fase" /><div className="phase-fields"><label><span>Formato</span><select value={phase.format} onChange={(event) => updatePhase(phase.id, { format: event.target.value as TournamentPhase['format'] })} disabled={locked}><option>Grupos</option><option>Mata-mata</option><option>Liga</option></select></label><label><span>{phase.format === 'Mata-mata' ? 'Avançam por jogo' : 'Classificados'}</span><input type="number" min="1" max={Math.max(1, setup.participants.length)} value={phase.qualifiers} onChange={(event) => updatePhase(phase.id, { qualifiers: Math.max(1, Number(event.target.value)) })} disabled={locked || phase.format === 'Mata-mata'} aria-label="Quantidade de classificados" /></label>{phase.format === 'Grupos' ? <label><span>Grupos</span><input value={phase.groups.join(', ')} onChange={(event) => updatePhase(phase.id, { groups: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} disabled={locked} aria-label="Grupos separados por vírgula" /></label> : null}</div></div><div className="phase-editor-actions"><button type="button" onClick={() => movePhase(index, -1)} disabled={locked || index === 0}><ArrowUp size={15} /></button><button type="button" onClick={() => movePhase(index, 1)} disabled={locked || index === setup.phases.length - 1}><ArrowDown size={15} /></button><button type="button" onClick={() => removePhase(phase.id)} disabled={locked}><Trash2 size={15} /></button></div></article>)}</div><form className="phase-add-form" onSubmit={addPhase}><input value={phaseName} onChange={(event) => setPhaseName(event.target.value)} placeholder="Nome da nova fase" disabled={locked} /><button type="submit" disabled={locked}><Plus size={17} /> Adicionar fase</button></form>{groupOptions.length ? <div className="group-assignment"><h3>DISTRIBUIÇÃO NOS GRUPOS</h3>{setup.participants.map((team) => <label key={team}><span>{team}</span><select value={setup.assignments[team] ?? ''} onChange={(event) => update({ ...setup, assignments: { ...setup.assignments, [team]: event.target.value }, generated: false }, 'Grupo da equipe alterado', team, event.target.value)} disabled={locked}><option value="">Definir grupo</option>{groupOptions.map((group) => <option key={group}>{group}</option>)}</select></label>)}</div> : null}</section>
    <section className="management-panel" id="generate"><div className="management-panel-head"><div><small>ETAPA 3</small><h2>GERAR CONFRONTOS</h2></div></div><p>{setup.generated ? `Confrontos gerados para ${setup.participants.length} participantes em ${setup.phases.length} fases.` : 'Revise participantes, seeds, grupos e fases antes de gerar.'}</p><button type="button" className="wide-action button-reset" onClick={generateConfrontations} disabled={locked || setup.participants.length < 2 || !setup.phases.length}><WandSparkles size={18} /> {setup.generated ? 'REGERAR CONFRONTOS' : 'GERAR CONFRONTOS'} <span>›</span></button></section>
  </div>;
}
