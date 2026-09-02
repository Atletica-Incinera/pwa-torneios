'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, WandSparkles } from 'lucide-react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { getActiveEdition, TournamentAdvancement, TournamentPhase, TournamentState, useFrontendState } from '../lib/repositories/browser-repository';
import { distributeGroups, generateRoundRobin } from '../lib/tournament-engine';
import { useUi } from './UiProvider';
import { disciplineHref, listMatches } from '../lib/edition-catalog';
import { canManageDiscipline, canManageEdition, useFrontendSession } from '../lib/frontend-session';
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
  const router = useRouter();
  const { session } = useFrontendSession();
  const regulation = useMemo(() => resolveRegulation(discipline, state.disciplines[discipline]), [discipline, state.disciplines]);
  // `name` e `discipline` entram no fallback porque toda gravação manda o setup
  // inteiro de volta: sem eles a primeira alteração de uma categoria ainda não
  // materializada no estado sobe sem identificação e a API recusa com 400.
  const fallback = useMemo<TournamentState>(() => ({ name, discipline, status: initialStatus === 'Em andamento' ? 'Em andamento' : initialStatus === 'Rascunho' ? 'Rascunho' : 'Publicado', editionId: activeEdition?.id, participants: [], seeds: {}, phases: [{ id: 'groups', name: 'Fase de grupos', format: 'Grupos', groups: ['Grupo A', 'Grupo B'], qualifiers: 2 }, { id: 'knockout', name: 'Mata-mata', format: 'Mata-mata', groups: [], qualifiers: 1 }], assignments: {}, generated: false }), [activeEdition?.id, discipline, initialStatus, name]);
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
  /*
   * O que impede excluir esta categoria, na mesma ordem em que a API responde.
   *
   * Conferir aqui nao substitui a trava do servidor -- ela e que vale. Serve
   * para o motivo aparecer ANTES do clique, em vez de o organizador descobrir
   * por um erro depois de confirmar uma acao sem volta.
   *
   * A conta de jogos e por categoria inteira, e nao so os gerados: um jogo
   * agendado a mao conta igual, e no banco ele cascateia da fase junto com o
   * resto.
   */
  const jogosDaCategoria = useMemo(
    () => Object.values(state.matches).filter((item) => item.tournamentId === id).length,
    [id, state.matches],
  );
  const impedimentosParaExcluir = [
    jogosDaCategoria && `${jogosDaCategoria} ${jogosDaCategoria === 1 ? 'jogo agendado' : 'jogos agendados'}`,
    setup.participants.length &&
      `${setup.participants.length} ${setup.participants.length === 1 ? 'equipe inscrita' : 'equipes inscritas'}`,
  ].filter((item): item is string => Boolean(item));
  const emRascunho = setup.status === 'Rascunho';
  const podeExcluir = emRascunho && !impedimentosParaExcluir.length;
  // A tabela pronta é medida pelos jogos que existem de fato, não pelo flag da
  // chave automática: um confronto agendado à mão conta igual.
  const categoryMatches = useMemo(() => listMatches(state, activeEdition?.id, { tournamentId: id }), [activeEdition?.id, id, state]);
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
    update({ ...setup, participants, seeds, assignments, generated: false }, 'Participantes da categoria alterados', undefined, `${participants.length} participantes`);
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

  /**
   * O que falta para a categoria alcançar um estado — na ordem em que o
   * organizador precisa resolver. Vazio significa que a transição está liberada.
   *
   * Publicar não exige tabela: publicar é tornar a categoria visível com a
   * estrutura que ela já tem, e é justamente o que libera o agendamento de jogos
   * (a agenda só enxerga categoria publicada). Exigir confrontos antes invertia
   * a ordem do produto — obrigava a chave automática mesmo para quem monta a
   * tabela à mão, e bloqueava de novo a cada seed corrigido, porque quase toda
   * alteração de estrutura zera `generated`.
   */
  function pendingFor(status: TournamentState['status']): string[] {
    const step = statusOrder.indexOf(status);
    const pending: string[] = [];
    if (step >= statusOrder.indexOf(tournamentStatus.published)) {
      // Publicar NAO exige participantes. A categoria pode ir ao ar anunciada e
      // receber as equipes depois — a area publica ja tem o estado "Inscricao
      // pendente" para isso. Exigir inscricao aqui obrigava a cadastrar todas as
      // equipes antes de conseguir mostrar qualquer coisa, o que inverte a
      // ordem natural: primeiro se anuncia a disputa, depois se inscreve nela.
      //
      // Quem precisa de equipe e o sorteio automatico, e a Etapa 4 ja cobra
      // isso com mensagem propria.
      if (!setup.phases.length) pending.push('configure ao menos uma fase na Etapa 2');
    }
    if (step >= statusOrder.indexOf(tournamentStatus.running)) {
      if (!categoryMatches.length) pending.push('gere os confrontos ou agende ao menos um jogo');
      // Chave automática obsoleta: a estrutura mudou depois de gerar, e começar
      // assim deixaria a tabela discordando dos grupos configurados.
      else if (generatedMatches.length && !setup.generated) pending.push('a estrutura mudou depois da geração: regere os confrontos na Etapa 4');
    }
    return pending;
  }

  async function setStatus(status: TournamentState['status']) {
    if (status === setup.status) return;
    if (statusOrder.indexOf(status) < statusOrder.indexOf(setup.status)) { toast('A categoria não pode voltar para uma etapa anterior.', 'error'); return; }
    const pending = pendingFor(status);
    if (pending.length) { toast(`Para mudar para ${status}: ${pending.join('; ')}.`, 'error'); return; }
    // Elenco incompleto é aviso: não impede a categoria de começar.
    if (status === tournamentStatus.running && rosterIssues.length) toast(`${rosterIssues.length} equipe(s) com elenco fora do regulamento.`, 'info');
    const messages: Record<string, string> = {
      Publicado: 'A categoria passa a aparecer na área pública e a aceitar jogos na agenda. Participantes e fases continuam editáveis.',
      'Em andamento': 'Participantes, seeds e fases ficarão bloqueados após o início.',
      Encerrado: 'A estrutura e as partidas serão bloqueadas para edição.',
      Arquivado: 'A categoria sai das listagens ativas e fica apenas no histórico.',
    };
    if (status !== tournamentStatus.draft && !(await confirm({ title: `Mudar para ${status}?`, message: messages[status], confirmLabel: 'Confirmar', danger: ['Encerrado', 'Arquivado'].includes(status) }))) return;
    update({ ...setup, status }, 'Status da categoria alterado', setup.status, status);
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
      toast('A quantidade de classificados não pode ser maior que as equipes do grupo.', 'error');
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
      // A contagem entra no rótulo porque é ele que vira o aviso de sucesso na
      // tela: sem isso a ação mais pesada do app termina em silêncio.
      audit: { action: setup.generated ? `Confrontos regerados (${pairs.length})` : `Confrontos gerados (${pairs.length})`, entity: name, before: setup.generated ? `${generatedMatches.length} partidas` : undefined, after: `${pairs.length} partidas`, reason: annulmentReason },
    });
    setGenerating(false);
    generationLock.current = false;
  }

  if (!allowed) return <div className="info-banner"><p>Seu perfil não pode configurar categorias de {discipline}.</p></div>;

  const nextStatus = statusOrder[statusOrder.indexOf(setup.status) + 1];
  const pendingNext = nextStatus ? pendingFor(nextStatus) : [];

  /**
   * Excluir de verdade, distinto de arquivar pela situacao.
   *
   * A categoria duplicada por erro de digitacao ficava na lista para sempre:
   * nao dava para apagar por tela nenhuma. Mas apagar categoria em uso e mais
   * grave do que parece -- no banco a partida cascateia da fase, que cascateia
   * da categoria, entao levaria junto lances e resultados sem avisar. Por isso
   * so cai o que nunca foi usado.
   */
  async function excluirCategoria() {
    if (
      !(await confirm({
        title: `Excluir ${setup.name || name}?`,
        message:
          'A categoria é apagada da edição, não fica marcada como removida. Não dá para desfazer.',
        confirmLabel: 'Excluir',
        danger: true,
      }))
    ) {
      return;
    }
    try {
      await dispatch({
        type: 'category/delete',
        payload: { id },
        audit: { action: 'Categoria excluída', entity: setup.name || name, before: discipline },
      });
      toast(`${setup.name || name} foi excluída.`, 'success');
      // A categoria deixou de existir: ficar na tela dela mostraria "nao encontrada".
      router.push(disciplineHref(discipline));
    } catch (falha) {
      toast(falha instanceof Error ? falha.message : 'Não foi possível excluir a categoria.', 'error');
    }
  }

  return <div className="tournament-manager">
    {/* A tela mostra quatro paineis numerados e nenhum texto dizia que eram
        uma sequencia, nem que dava para parar no meio. Quem chegava aqui pela
        primeira vez lia quatro formularios soltos. */}
    <p className="passo-a-passo">
      <strong>Quatro etapas, nesta ordem:</strong> quem disputa, como a disputa se divide, quem avança e, por fim, montar os jogos.
      Dá para preencher aos poucos — nada é perdido ao sair, e só a Etapa 4 exige as anteriores prontas.
    </p>
    <section className="management-panel" id="publication"><div className="management-panel-head"><div><small>SITUAÇÃO</small><h2>PUBLICAÇÃO</h2></div><label className="sr-only" htmlFor="category-status">Situação da categoria</label><select id="category-status" value={setup.status} onChange={(event) => setStatus(event.target.value as TournamentState['status'])}>{statusOrder.map((item, index) => <option key={item} disabled={index < statusOrder.indexOf(setup.status)}>{item}</option>)}</select></div>
    <p>{locked ? 'A estrutura está bloqueada porque a categoria já começou.' : setup.status === tournamentStatus.draft ? 'Rascunho não aparece na área pública nem aceita jogos na agenda. Publique para liberar o agendamento — os confrontos podem ser montados depois.' : 'Publicada: já aparece na área pública e aceita jogos na agenda. Participantes e fases continuam editáveis até o início.'}</p>
    {nextStatus && pendingNext.length ? <ul className="form-feedback" role="status"><li>Para avançar para {nextStatus}: {pendingNext.join('; ')}.</li></ul> : null}
    {renaming === null ? <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setRenaming(name)}><Pencil size={16} aria-hidden="true" /> Renomear categoria</button></div> : <form className="entity-form inline-management-form" onSubmit={renameCategory}><label><span>Nome da categoria</span><input value={renaming} onChange={(event) => setRenaming(event.target.value)} autoFocus required /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setRenaming(null)}>Cancelar</button><button type="submit" className="primary-button">Salvar nome</button></div></form>}{rosterIssues.length ? <ul className="form-feedback" role="status">{rosterIssues.map((item) => <li key={item}>{item}</li>)}</ul> : null}</section>
    <section className="management-panel" id="participants"><div className="management-panel-head"><div><small>ETAPA 1</small><h2>PARTICIPANTES E ORDEM DO SORTEIO</h2></div><strong>{setup.participants.length}</strong></div>
      <p>Marque as equipes que vão disputar <strong>esta categoria</strong> — é aqui, e só aqui, que uma equipe entra ou sai de uma modalidade. O número ao lado de cada marcada é a ordem do sorteio: <strong>1 é o primeiro cabeça de chave</strong>, e ela evita que os favoritos caiam no mesmo grupo. Se não for sortear, pode deixar como está.</p>{teamNames.length ? <div className="participant-selector">{teamNames.map((team) => <label key={team}><input type="checkbox" checked={setup.participants.includes(team)} onChange={() => toggleParticipant(team)} disabled={locked} /><span>{team}</span>{setup.participants.includes(team) ? <input type="number" min="1" value={setup.seeds[team] ?? 1} onChange={(event) => update({ ...setup, seeds: { ...setup.seeds, [team]: Number(event.target.value) }, generated: false }, 'Seed alterado', team, event.target.value)} disabled={locked} aria-label={`Ordem de ${team} no sorteio`} /> : null}</label>)}</div> : <div className="empty-state"><strong>Nenhuma equipe cadastrada nesta edição</strong><p>As equipes são cadastradas uma vez por edição e depois inscritas em cada categoria.</p>{canManageEdition(session) ? <Link href="/teams/new" className="secondary-button"><Plus size={16} aria-hidden="true" /> Cadastrar equipe</Link> : null}</div>}</section>
    <section className="management-panel" id="phases"><div className="management-panel-head"><div><small>ETAPA 2</small><h2>FASES E GRUPOS</h2></div><strong>{setup.phases.length}</strong></div>
      <p>Uma fase é um trecho do torneio. <strong>Grupos</strong> é todos contra todos dentro de cada chave; <strong>Mata-mata</strong> elimina quem perde; <strong>Liga</strong> é turno único entre todos, sem chaves. A categoria já vem com fase de grupos seguida de mata-mata — apague o que não usar. Em Grupos, escreva os nomes das chaves separados por vírgula (<code>Grupo A, Grupo B</code>) e depois distribua as equipes logo abaixo.</p><div className="phase-editor-list">{setup.phases.map((phase, index) => <article key={phase.id}><span className="phase-order">{String(index + 1).padStart(2, '0')}</span><div><input value={phase.name} onChange={(event) => updatePhase(phase.id, { name: event.target.value })} disabled={locked} aria-label="Nome da fase" /><div className="phase-fields"><label><span>Formato</span><select value={phase.format} onChange={(event) => updatePhase(phase.id, { format: event.target.value as TournamentPhase['format'] })} disabled={locked}><option>Grupos</option><option>Mata-mata</option><option>Liga</option></select></label><label><span>{phase.format === 'Mata-mata' ? 'Quantos passam por confronto' : 'Classificados'}</span><input type="number" min="1" max={Math.max(1, setup.participants.length)} value={phase.qualifiers} onChange={(event) => updatePhase(phase.id, { qualifiers: Math.max(1, Number(event.target.value)) })} disabled={locked || phase.format === 'Mata-mata'} aria-label="Quantidade de classificados" /></label>{phase.format === 'Grupos' ? <label><span>Grupos</span><input value={phase.groups.join(', ')} onChange={(event) => updatePhase(phase.id, { groups: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} disabled={locked} aria-label="Grupos separados por vírgula" /></label> : null}</div></div><div className="phase-editor-actions"><button type="button" onClick={() => movePhase(index, -1)} disabled={locked || index === 0} aria-label={`Mover ${phase.name || `fase ${index + 1}`} para cima`} title="Mover fase para cima"><ArrowUp size={15} aria-hidden="true" /></button><button type="button" onClick={() => movePhase(index, 1)} disabled={locked || index === setup.phases.length - 1} aria-label={`Mover ${phase.name || `fase ${index + 1}`} para baixo`} title="Mover fase para baixo"><ArrowDown size={15} aria-hidden="true" /></button><button type="button" className="phase-remove-button" onClick={() => removePhase(phase.id)} disabled={locked} aria-label={`Remover ${phase.name || `fase ${index + 1}`}`} title="Remover fase"><Trash2 size={15} aria-hidden="true" /></button></div></article>)}</div><form className="phase-add-form" onSubmit={addPhase}><label className="sr-only" htmlFor="nova-fase">Nome da nova fase</label><input id="nova-fase" value={phaseName} onChange={(event) => setPhaseName(event.target.value)} placeholder="Nome da nova fase" disabled={locked} /><button type="submit" disabled={locked}><Plus size={17} aria-hidden="true" /> Adicionar fase</button></form>{groupOptions.length ? <div className="group-assignment"><h3>DISTRIBUIÇÃO NOS GRUPOS</h3>{setup.participants.map((team) => <label key={team}><span>{team}</span><select value={setup.assignments[team] ?? ''} onChange={(event) => update({ ...setup, assignments: { ...setup.assignments, [team]: event.target.value }, generated: false }, 'Grupo da equipe alterado', team, event.target.value)} disabled={locked}><option value="">Definir grupo</option>{groupOptions.map((group) => <option key={group}>{group}</option>)}</select></label>)}</div> : null}</section>
    <section className="management-panel" id="advancement"><div className="management-panel-head"><div><small>ETAPA 3</small><h2>QUEM SE CLASSIFICA</h2></div></div>
      <p>{describeAdvancement(advancement, groupOptions.length || 1)}</p>
      <div className="rule-fields">
        <label><span>Classificados por grupo</span><input type="number" min="1" max={Math.max(1, setup.participants.length)} value={advancement.perGroup} onChange={(event) => updateAdvancement({ perGroup: Math.max(1, Number(event.target.value)) })} disabled={locked} /></label>
        <label><span>Melhores terceiros colocados</span><input type="number" min="0" max={Math.max(0, groupOptions.length)} value={advancement.bestThirds} onChange={(event) => updateAdvancement({ bestThirds: Math.max(0, Number(event.target.value)) })} disabled={locked || groupOptions.length < 2} /></label>
        <label><span>Quem enfrenta quem no mata-mata</span><select value={advancement.crossing} onChange={(event) => updateAdvancement({ crossing: event.target.value as TournamentAdvancement['crossing'] })} disabled={locked}><option value="padrao">Olímpico: 1º do grupo contra o último classificado</option><option value="sequencial">Sequencial: grupos vizinhos (A1 × B2)</option></select></label>
      </div>
      <label className="checkbox-field"><input type="checkbox" checked={advancement.thirdPlaceMatch} onChange={(event) => updateAdvancement({ thirdPlaceMatch: event.target.checked })} disabled={locked} /><span>Gerar disputa de terceiro lugar após as semifinais</span></label>
    </section>
    <section className="management-panel" id="generate"><div className="management-panel-head"><div><small>ETAPA 4</small><h2>MONTAR OS JOGOS</h2></div></div>
      <p>{setup.participants.length < 2 ? 'Inscreva ao menos 2 participantes na Etapa 1 para gerar os confrontos.' : !setup.phases.length ? 'Crie ao menos uma fase na Etapa 2 para gerar os confrontos.' : locked ? 'A categoria já começou: os confrontos não podem mais ser regerados.' : setup.generated ? `Confrontos gerados para ${setup.participants.length} participantes em ${setup.phases.length} fases.` : 'Gera todos contra todos dentro de cada grupo. Também dá para agendar jogos um a um pela agenda, depois de publicar.'}</p>
      <button type="button" className="wide-action button-reset" onClick={generateConfrontations} disabled={generating || locked || setup.participants.length < 2 || !setup.phases.length} aria-busy={generating}><WandSparkles size={18} aria-hidden="true" /> {generating ? 'MONTANDO OS JOGOS…' : setup.generated ? 'MONTAR OS JOGOS DE NOVO' : 'MONTAR OS JOGOS'} <span aria-hidden="true">›</span></button></section>
    {canManageEdition(session) ? <section className="management-panel management-panel-danger" id="excluir"><div className="management-panel-head"><div><small>SE FOR PRECISO</small><h2>EXCLUIR ESTA CATEGORIA</h2></div></div>
      {/* A situacao so anda para a frente -- o seletor de Publicacao desabilita
          os estados anteriores. Entao mandar "voltar para rascunho" seria
          mandar por um caminho que nao existe: aqui a saida e arquivar. */}
      <p>{!emRascunho
        ? `Só dá para excluir categoria em rascunho, e esta está como ${setup.status.toLocaleLowerCase('pt-BR')}. A situação não volta atrás: uma categoria que já saiu do rascunho se arquiva em Publicação, não se apaga.`
        : impedimentosParaExcluir.length
          ? `Esta categoria tem ${impedimentosParaExcluir.join(' e ')}. Excluir levaria os jogos e os resultados junto, então primeiro remova isso.`
          : 'Esta categoria nunca foi usada: sem equipe inscrita e sem jogo agendado. Serve para desfazer uma criada por engano.'}</p>
      <div className="form-actions"><button type="button" className="danger-button" onClick={excluirCategoria} disabled={!podeExcluir}><Trash2 size={16} aria-hidden="true" /> Excluir categoria</button></div></section> : null}
  </div>;
}
