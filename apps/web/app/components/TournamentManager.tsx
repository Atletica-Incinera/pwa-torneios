'use client';

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, WandSparkles } from 'lucide-react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { getActiveEdition, TournamentAdvancement, TournamentPhase, TournamentState, useFrontendState } from '../lib/repositories/browser-repository';
import { distributeGroups, generateRoundRobin } from '../lib/tournament-engine';
import { useUi } from './UiProvider';
import { canManageDiscipline, useFrontendSession } from '../lib/frontend-session';
import { resolveDisciplineRule } from '../lib/discipline-rules';
import { resolveRegulation } from '../lib/regulation';
import { defaultAdvancement, describeAdvancement } from '../lib/bracket-rules';
import { checkRoster, eligibleAthletes, findTeamByName } from '../lib/eligibility';
import { isTournamentStarted, matchStatus, tournamentStatus } from '../lib/status';
import { createId } from '../lib/create-id';

export function TournamentManager({ id, name, discipline, initialStatus, teamNames }: { id: string; name: string; discipline: string; initialStatus: string; teamNames: string[] }) {
  const { state, dispatch } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const { confirm, prompt, toast } = useUi();
  const { session } = useFrontendSession();
  const regulation = useMemo(() => resolveRegulation(discipline, state.disciplines[discipline]), [discipline, state.disciplines]);
  const fallback = useMemo<TournamentState>(() => ({ status: initialStatus === 'Em andamento' ? 'Em andamento' : initialStatus === 'Rascunho' ? 'Rascunho' : 'Publicado', editionId: activeEdition?.id, participants: [], seeds: {}, phases: [{ id: 'groups', name: 'Fase de grupos', format: 'Grupos', groups: ['Grupo A', 'Grupo B'], qualifiers: 2 }, { id: 'knockout', name: 'Mata-mata', format: 'Mata-mata', groups: [], qualifiers: 1 }], assignments: {}, generated: false }), [activeEdition?.id, initialStatus]);
  const setup = state.tournaments[id] ?? fallback;
  const [phaseName, setPhaseName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const generationLock = useRef(false);
  const locked = isTournamentStarted(setup.status);
  const groupOptions = setup.phases.find((phase) => phase.format === 'Grupos')?.groups ?? [];
  const allowed = canManageDiscipline(session, discipline);
  const advancement = setup.advancement ?? { ...defaultAdvancement, perGroup: setup.phases.find((phase) => phase.format === 'Grupos')?.qualifiers ?? defaultAdvancement.perGroup, thirdPlaceMatch: regulation.knockout.thirdPlaceMatch };
  // Confrontos já gerados que saíram do estado "Agendada" não podem ser
  // simplesmente substituídos: exigem anulação explícita e auditada.
  const generatedMatches = useMemo(() => Object.entries(state.matches).filter(([matchId]) => matchId.startsWith(`${id}-generated-`)), [id, state.matches]);
  const generatedWithResults = generatedMatches.filter(([, item]) => (item.status ?? matchStatus.scheduled) !== matchStatus.scheduled);
  const rosterIssues = useMemo(() => setup.participants.map((team) => {
    const ref = findTeamByName(state, team);
    const check = checkRoster(regulation, ref ? eligibleAthletes(state, ref.id, discipline).length : 0);
    return check.ok ? null : `${team}: ${check.message}`;
  }).filter((item): item is string => Boolean(item)), [discipline, regulation, setup.participants, state]);

  function update(next: TournamentState, action: string, before?: string, after?: string, silent = false) {
    const noAudit = silent || action === 'Seed alterado' || action === 'Grupo da equipe alterado';
    void dispatch({ type: 'category/update', payload: { id, setup: { ...next, editionId: next.editionId ?? activeEdition?.id } }, audit: noAudit ? undefined : { action, entity: name, before, after } });
  }

  /** Corrigir o nome da categoria não é estrutura: vale mesmo depois do início. */
  function renameCategory(event: FormEvent) {
    event.preventDefault();
    const next = (renaming ?? '').trim();
    if (next.length < 3) { toast('O nome da categoria precisa de ao menos 3 caracteres.', 'error'); return; }
    if (next === name) { setRenaming(null); return; }
    update({ ...setup, name: next, discipline: setup.discipline ?? discipline }, 'Categoria renomeada', name, next);
    setRenaming(null);
  }

  function updateAdvancement(patch: Partial<TournamentAdvancement>) {
    if (locked) return;
    update({ ...setup, advancement: { ...advancement, ...patch }, generated: false }, 'Critério de avanço alterado', describeAdvancement(advancement, groupOptions.length || 1), describeAdvancement({ ...advancement, ...patch }, groupOptions.length || 1));
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
    const phase: TournamentPhase = { id: createId('phase'), name: phaseName.trim(), format: 'Grupos', groups: ['Grupo A'], qualifiers: 2 };
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

  const statusOrder: TournamentState['status'][] = [tournamentStatus.draft, tournamentStatus.published, tournamentStatus.running, tournamentStatus.closed, tournamentStatus.archived];

  async function setStatus(status: TournamentState['status']) {
    if (status === setup.status) return;
    if (statusOrder.indexOf(status) < statusOrder.indexOf(setup.status)) { toast('A disputa não pode voltar para uma etapa anterior.', 'error'); return; }
    if (status !== 'Rascunho' && (setup.participants.length < 2 || !setup.phases.length || !setup.generated)) { toast('Gere os confrontos antes de publicar a disputa.', 'error'); return; }
    // Elenco incompleto é aviso: não impede a disputa de começar.
    if (status === 'Em andamento' && rosterIssues.length) toast(`${rosterIssues.length} equipe(s) com elenco fora do regulamento.`, 'info');
    const messages: Record<string, string> = {
      Publicado: 'A disputa passa a aparecer na área pública com a estrutura atual.',
      'Em andamento': 'Participantes, seeds e fases ficarão bloqueados após o início.',
      Encerrado: 'A estrutura e as partidas serão bloqueadas para edição.',
      Arquivado: 'A disputa sai das listagens ativas e fica apenas no histórico.',
    };
    if (status !== 'Rascunho' && !(await confirm({ title: `Mudar para ${status}?`, message: messages[status], confirmLabel: 'Confirmar', danger: ['Encerrado', 'Arquivado'].includes(status) }))) return;
    update({ ...setup, status }, 'Status da disputa alterado', setup.status, status);
  }

  async function generateConfrontations() {
    if (generationLock.current) return;
    generationLock.current = true;
    let annulmentReason: string | undefined;
    if (generatedWithResults.length) {
      const answer = await prompt({
        title: 'Anular resultados para regerar?',
        message: `${generatedWithResults.length} confronto(s) já saíram do estado agendado (${generatedWithResults.map(([, item]) => `${item.entryA} × ${item.entryB}`).join(', ')}). Regerar apaga esses jogos e seus resultados.`,
        label: 'Motivo da anulação',
        placeholder: 'Ex.: chave montada com equipe errada',
        confirmLabel: 'Anular e regerar',
        minLength: 5,
        danger: true,
      });
      if (!answer) { generationLock.current = false; return; }
      annulmentReason = answer;
    } else if (setup.generated && !(await confirm({ title: 'Regerar confrontos?', message: 'Os jogos gerados anteriormente serão substituídos.', confirmLabel: 'Regerar', danger: true }))) { generationLock.current = false; return; }
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
    const logoFor = (team: string) => findTeamByName(state, team)?.logo ?? '';
    const createdMatches = Object.fromEntries(pairs.map(({ pair: [entryA, entryB], phase }, index) => [`${id}-generated-${index + 1}`, { created: true as const, editionId: activeEdition?.id, tournamentId: id, discipline, entryA, entryB, logoA: logoFor(entryA), logoB: logoFor(entryB), date: startDate, time: `${String(8 + (index % 10)).padStart(2, '0')}:00`, venue: 'A definir', phase, status: 'Agendada' as const, rules: resolveDisciplineRule(discipline, state.disciplines[discipline]), currentPeriod: 1, clockSeconds: 0, paused: true, events: [], periodScoreA: 0, periodScoreB: 0, periodResults: [] }]));
    const next = { ...setup, editionId: setup.editionId ?? activeEdition?.id, assignments, generated: true, advancement, byes: undefined };
    await dispatch({
      type: 'category/generateMatches',
      payload: { id, setup: next, matches: createdMatches },
      audit: { action: setup.generated ? 'Confrontos regerados' : 'Confrontos gerados', entity: name, before: setup.generated ? `${generatedMatches.length} partidas` : undefined, after: `${pairs.length} partidas`, reason: annulmentReason },
    });
    setGenerating(false);
    generationLock.current = false;
  }

  if (!allowed) return <div className="info-banner"><p>Seu perfil não pode configurar disputas de {discipline}.</p></div>;

  return <div className="tournament-manager"><section className="management-panel" id="publication"><div className="management-panel-head"><div><small>SITUAÇÃO</small><h2>PUBLICAÇÃO</h2></div><select value={setup.status} onChange={(event) => setStatus(event.target.value as TournamentState['status'])}>{statusOrder.map((item) => <option key={item}>{item}</option>)}</select></div><p>{locked ? 'A estrutura está bloqueada porque a disputa já começou.' : 'Participantes e fases podem ser alterados antes do início.'}</p>{renaming === null ? <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setRenaming(name)}><Pencil size={16} /> Renomear categoria</button></div> : <form className="entity-form inline-management-form" onSubmit={renameCategory}><label><span>Nome da categoria</span><input value={renaming} onChange={(event) => setRenaming(event.target.value)} autoFocus required /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setRenaming(null)}>Cancelar</button><button type="submit" className="primary-button">Salvar nome</button></div></form>}{rosterIssues.length ? <ul className="form-feedback" role="status">{rosterIssues.map((item) => <li key={item}>{item}</li>)}</ul> : null}</section>
    <section className="management-panel" id="participants"><div className="management-panel-head"><div><small>ETAPA 1</small><h2>PARTICIPANTES E SEEDS</h2></div><strong>{setup.participants.length}</strong></div><div className="participant-selector">{teamNames.map((team) => <label key={team}><input type="checkbox" checked={setup.participants.includes(team)} onChange={() => toggleParticipant(team)} disabled={locked} /><span>{team}</span>{setup.participants.includes(team) ? <input type="number" min="1" value={setup.seeds[team] ?? 1} onChange={(event) => update({ ...setup, seeds: { ...setup.seeds, [team]: Number(event.target.value) }, generated: false }, 'Seed alterado', team, event.target.value)} disabled={locked} aria-label={`Seed de ${team}`} /> : null}</label>)}</div></section>
    <section className="management-panel" id="phases"><div className="management-panel-head"><div><small>ETAPA 2</small><h2>FASES E GRUPOS</h2></div><strong>{setup.phases.length}</strong></div><div className="phase-editor-list">{setup.phases.map((phase, index) => <article key={phase.id}><span className="phase-order">{String(index + 1).padStart(2, '0')}</span><div><input value={phase.name} onChange={(event) => updatePhase(phase.id, { name: event.target.value })} disabled={locked} aria-label="Nome da fase" /><div className="phase-fields"><label><span>Formato</span><select value={phase.format} onChange={(event) => updatePhase(phase.id, { format: event.target.value as TournamentPhase['format'] })} disabled={locked}><option>Grupos</option><option>Mata-mata</option><option>Liga</option></select></label><label><span>{phase.format === 'Mata-mata' ? 'Avançam por jogo' : 'Classificados'}</span><input type="number" min="1" max={Math.max(1, setup.participants.length)} value={phase.qualifiers} onChange={(event) => updatePhase(phase.id, { qualifiers: Math.max(1, Number(event.target.value)) })} disabled={locked || phase.format === 'Mata-mata'} aria-label="Quantidade de classificados" /></label>{phase.format === 'Grupos' ? <label><span>Grupos</span><input value={phase.groups.join(', ')} onChange={(event) => updatePhase(phase.id, { groups: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} disabled={locked} aria-label="Grupos separados por vírgula" /></label> : null}</div></div><div className="phase-editor-actions"><button type="button" onClick={() => movePhase(index, -1)} disabled={locked || index === 0}><ArrowUp size={15} /></button><button type="button" onClick={() => movePhase(index, 1)} disabled={locked || index === setup.phases.length - 1}><ArrowDown size={15} /></button><button type="button" onClick={() => removePhase(phase.id)} disabled={locked}><Trash2 size={15} /></button></div></article>)}</div><form className="phase-add-form" onSubmit={addPhase}><input value={phaseName} onChange={(event) => setPhaseName(event.target.value)} placeholder="Nome da nova fase" disabled={locked} /><button type="submit" disabled={locked}><Plus size={17} /> Adicionar fase</button></form>{groupOptions.length ? <div className="group-assignment"><h3>DISTRIBUIÇÃO NOS GRUPOS</h3>{setup.participants.map((team) => <label key={team}><span>{team}</span><select value={setup.assignments[team] ?? ''} onChange={(event) => update({ ...setup, assignments: { ...setup.assignments, [team]: event.target.value }, generated: false }, 'Grupo da equipe alterado', team, event.target.value)} disabled={locked}><option value="">Definir grupo</option>{groupOptions.map((group) => <option key={group}>{group}</option>)}</select></label>)}</div> : null}</section>
    <section className="management-panel" id="advancement"><div className="management-panel-head"><div><small>ETAPA 3</small><h2>CRITÉRIO DE AVANÇO</h2></div></div>
      <p>{describeAdvancement(advancement, groupOptions.length || 1)}</p>
      <div className="rule-fields">
        <label><span>Classificados por grupo</span><input type="number" min="1" max={Math.max(1, setup.participants.length)} value={advancement.perGroup} onChange={(event) => updateAdvancement({ perGroup: Math.max(1, Number(event.target.value)) })} disabled={locked} /></label>
        <label><span>Melhores terceiros</span><input type="number" min="0" max={Math.max(0, groupOptions.length)} value={advancement.bestThirds} onChange={(event) => updateAdvancement({ bestThirds: Math.max(0, Number(event.target.value)) })} disabled={locked || groupOptions.length < 2} /></label>
        <label><span>Cruzamento das chaves</span><select value={advancement.crossing} onChange={(event) => updateAdvancement({ crossing: event.target.value as TournamentAdvancement['crossing'] })} disabled={locked}><option value="padrao">Olímpico (1º × último seed)</option><option value="sequencial">Sequencial (vizinhos)</option></select></label>
      </div>
      <label className="checkbox-field"><input type="checkbox" checked={advancement.thirdPlaceMatch} onChange={(event) => updateAdvancement({ thirdPlaceMatch: event.target.checked })} disabled={locked} /><span>Gerar disputa de terceiro lugar após as semifinais</span></label>
    </section>
    <section className="management-panel" id="generate"><div className="management-panel-head"><div><small>ETAPA 4</small><h2>GERAR CONFRONTOS</h2></div></div><p>{setup.generated ? `Confrontos gerados para ${setup.participants.length} participantes em ${setup.phases.length} fases.` : 'Revise participantes, seeds, grupos e fases antes de gerar.'}</p><button type="button" className="wide-action button-reset" onClick={generateConfrontations} disabled={locked || setup.participants.length < 2 || !setup.phases.length}><WandSparkles size={18} /> {setup.generated ? 'REGERAR CONFRONTOS' : 'GERAR CONFRONTOS'} <span>›</span></button></section>
  </div>;
}
