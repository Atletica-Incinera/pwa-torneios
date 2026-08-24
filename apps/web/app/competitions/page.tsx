'use client';

import Link from 'next/link';
import { CalendarRange, Check, ChevronDown, ListOrdered, Lock, Pencil, Plus, Save, Trophy } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { AppShell, EmptyState, SectionTitle, StatusBadge } from '../components/AppShell';
import { NoCompetitionsYet } from '../components/NoCompetitionsYet';
import { EditionState, useFrontendState } from '../lib/repositories/browser-repository';
import { listDisciplines } from '../lib/edition-catalog';
import { isRankingClosed } from '../lib/overall-ranking';
import { useUi } from '../components/UiProvider';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';
import { createId } from '../lib/create-id';
import { isSuperAdmin, useFrontendSession } from '../lib/frontend-session';

export default function CompetitionsPage() {
  const { state, dispatch } = useFrontendState();
  const { session } = useFrontendSession();
  const { confirm, toast } = useUi();
  const activeCompetition = state.competitions.find((item) => item.active) ?? state.competitions[0];
  const enabledDisciplines = listDisciplines(state, state.editions.find((item) => item.active)?.id).filter((item) => item.enabled);
  const editions = activeCompetition ? state.editions.filter((item) => (item.competitionId ?? 'jogos-engenharia') === activeCompetition.id) : [];
  const activeEdition = editions.find((item) => item.active) ?? editions[0];
  // Hooks sempre chamados, na mesma ordem, em qualquer render — inclusive
  // quando `activeCompetition` ainda não existe. Retornar cedo antes deles
  // violaria as Rules of Hooks assim que a primeira competição fosse criada e
  // o componente ganhasse hooks a mais numa renderização que antes tinha menos.
  const [creating, setCreating] = useState(false); const [editing, setEditing] = useState<string | null>(null); const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState({ year: String(new Date().getFullYear() + 1), start: '', end: '' }); const [dates, setDates] = useState({ start: '', end: '' });
  useUnsavedChanges((creating && Boolean(draft.start || draft.end)) || Boolean(editing && dates.start));
  // Todas as mutações desta tela (competition/*, edition/*) são ações globais no
  // servidor: exclusivas do super administrador. O admin da edição via a tela
  // inteira e cada botão terminava em 403 com aviso genérico — ela agora é
  // legível para ele, e editável só para quem o servidor deixa editar.
  const canConfigure = isSuperAdmin(session);

  // A partir daqui o resto da página indexa `activeCompetition.id`/`.name` sem
  // checar de novo — só alcançável desde que o snapshot passou a tratar "sem
  // competição ativa" como estado válido em vez de erro.
  if (!activeCompetition) {
    return <AppShell active="profile" eyebrow="CONTEXTO" title="INTERENG" subtitle="Nenhum torneio configurado ainda">
      <NoCompetitionsYet canCreate={isSuperAdmin(session)} />
    </AppShell>;
  }
  const staff = Object.values(state.staff).filter((member) => !member.revoked);

  function createEdition(event: FormEvent) { event.preventDefault(); if (!draft.year || !draft.start || !draft.end) { toast('Preencha ano e período da edição.', 'error'); return; } if (draft.end < draft.start) { toast('A data final deve ser posterior ao início.', 'error'); return; } if (editions.some((edition) => edition.year === Number(draft.year))) { toast('Já existe uma edição neste ano.', 'error'); return; } const edition: EditionState = { id: createId('edition'), name: draft.year, year: Number(draft.year), start: draft.start, end: draft.end, status: 'Planejamento', active: false, competitionId: activeCompetition.id }; void dispatch({ type: 'edition/create', payload: { edition }, audit: { action: 'Edição criada', entity: `${activeCompetition.name} ${edition.year}`, after: 'Planejamento' } }); setCreating(false); setDraft({ year: String(new Date().getFullYear() + 1), start: '', end: '' }); }
  /** Corrigir o nome do torneio: sem isso, um erro de digitação fica para sempre. */
  function renameCompetition(event: FormEvent) {
    event.preventDefault();
    const next = (renaming ?? '').trim();
    if (next.length < 2) { toast('Informe um nome válido para o torneio.', 'error'); return; }
    if (next === activeCompetition.name) { setRenaming(null); return; }
    void dispatch({ type: 'competition/rename', payload: { id: activeCompetition.id, name: next }, audit: { action: 'Torneio renomeado', entity: activeCompetition.name, before: activeCompetition.name, after: next } });
    setRenaming(null);
  }

  async function selectCompetition(id: string) { if (id === activeCompetition.id) return; const selected = state.competitions.find((item) => item.id === id); if (!(await confirm({ title: 'Mudar torneio ativo?', message: `O contexto do aplicativo passará para ${selected?.name ?? id}.`, confirmLabel: 'Mudar contexto' }))) return; await dispatch({ type: 'competition/activate', payload: { id }, audit: { action: 'Torneio ativo alterado', entity: selected?.name ?? id, after: 'Ativo' } }); }
  async function activate(edition: EditionState) { if (!(await confirm({ title: 'Mudar edição ativa?', message: `Cadastros e agendas passarão a usar a edição ${edition.year}.`, confirmLabel: 'Ativar edição' }))) return; await dispatch({ type: 'edition/activate', payload: { id: edition.id }, audit: { action: 'Edição ativa alterada', entity: `${activeCompetition.name} ${edition.year}`, after: 'Ativa' } }); }
  function changeStatus(edition: EditionState, status: EditionState['status']) { void dispatch({ type: 'edition/update', payload: { id: edition.id, patch: { status } }, audit: { action: 'Status da edição alterado', entity: edition.name, before: edition.status, after: status } }); }
  function saveDates(edition: EditionState) { if (!dates.start || !dates.end || dates.end < dates.start) { toast('Informe um período válido.', 'error'); return; } void dispatch({ type: 'edition/update', payload: { id: edition.id, patch: { ...dates } }, audit: { action: 'Período da edição alterado', entity: edition.name, before: `${edition.start} a ${edition.end}`, after: `${dates.start} a ${dates.end}` } }); setEditing(null); }

  return <AppShell active="profile" eyebrow="CONTEXTO" title="INTERENG" subtitle={canConfigure ? 'Configure o torneio e escolha o ano da edição ativa' : 'Torneio e edição em vigor no aplicativo'} actionHref={canConfigure ? '/competitions/new' : undefined} actionLabel="Criar novo torneio" actionShortLabel="Torneio">
    {!canConfigure ? <div className="info-banner"><Lock size={20} aria-hidden="true" /><p>Torneio e edição são definidos pelo super administrador do app. Aqui você confere o contexto em vigor; a gestão da edição fica em Modalidades, Staff e Classificação geral.</p></div> : null}
    <div className="competition-switcher" aria-label="Torneio ativo">{state.competitions.map((item) => <button type="button" className={item.id === activeCompetition.id ? 'active' : ''} aria-pressed={item.id === activeCompetition.id} onClick={() => void selectCompetition(item.id)} key={item.id} disabled={!canConfigure}>{item.name}</button>)}{canConfigure ? <button type="button" className="competition-rename" onClick={() => setRenaming(renaming === null ? activeCompetition.name : null)} aria-label={`Renomear ${activeCompetition.name}`} title="Renomear torneio"><Pencil size={16} aria-hidden="true" /></button> : null}</div>{renaming !== null ? <form className="entity-form inline-management-form" onSubmit={renameCompetition}><label><span>Nome do torneio</span><input value={renaming} onChange={(event) => setRenaming(event.target.value)} autoFocus required /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setRenaming(null)}>Cancelar</button><button type="submit" className="primary-button"><Save size={16} aria-hidden="true" /> Salvar nome</button></div></form> : null}
    {activeEdition ? <section className="featured-context"><div className="context-number">{String(activeEdition.year).slice(-2)}</div><div><StatusBadge tone="orange">{activeEdition.status}</StatusBadge><p>TORNEIO · {activeCompetition.name}</p><h2>EDIÇÃO {activeEdition.year}</h2><span><CalendarRange size={16} /> {activeEdition.start} — {activeEdition.end}</span></div><Check className="context-check" size={22} /></section> : <EmptyState title="SEM EDIÇÕES" copy="Crie a primeira edição deste torneio." />}
    <section className="section-block"><SectionTitle eyebrow="HISTÓRICO" title="EDIÇÕES" />{canConfigure ? <button type="button" className="wide-action button-reset" onClick={() => setCreating(!creating)} aria-expanded={creating}><Plus size={18} aria-hidden="true" /> NOVA EDIÇÃO <span aria-hidden="true">›</span></button> : null}
      {creating ? <form className="entity-form inline-management-form" onSubmit={createEdition}><label><span>Ano da edição</span><input type="number" value={draft.year} onChange={(event) => setDraft({ ...draft, year: event.target.value })} /></label><label><span>Início</span><input type="date" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label><label><span>Encerramento</span><input type="date" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setCreating(false)}>Cancelar</button><button type="submit" className="primary-button">Criar edição</button></div></form> : null}
      <div className="stack-list edition-management-list">{editions.map((edition) => <article className="list-row edition-management-row" key={edition.id}><span className={`year-tile${edition.active ? '' : ' muted'}`}>{String(edition.year).slice(-2)}</span><span><strong>Edição {edition.year}</strong><small>{edition.start} — {edition.end}</small></span><StatusBadge tone={edition.active ? 'orange' : 'neutral'}>{edition.active ? 'Ativa' : edition.status}</StatusBadge>{canConfigure ? <button type="button" className="row-action" aria-expanded={editing === edition.id} aria-controls={`edicao-acoes-${edition.id}`} aria-label={`Gerenciar edição ${edition.year}`} title="Editar datas, status e ativação" onClick={() => { setEditing(editing === edition.id ? null : edition.id); setDates({ start: edition.start, end: edition.end }); }}>{editing === edition.id ? <ChevronDown size={18} aria-hidden="true" /> : <Pencil size={18} aria-hidden="true" />}</button> : null}{editing === edition.id ? <div className="edition-inline-actions" id={`edicao-acoes-${edition.id}`}><label><span>Início</span><input type="date" value={dates.start} onChange={(event) => setDates({ ...dates, start: event.target.value })} /></label><label><span>Fim</span><input type="date" value={dates.end} onChange={(event) => setDates({ ...dates, end: event.target.value })} /></label><button type="button" onClick={() => saveDates(edition)}><Save size={16} aria-hidden="true" /> Salvar datas</button>{!edition.active ? <button type="button" onClick={() => activate(edition)}>Tornar ativa</button> : null}<label className="edition-status-field"><span>Rótulo no histórico</span><select value={edition.status} onChange={(event) => changeStatus(edition, event.target.value as EditionState['status'])}><option>Planejamento</option><option>Em andamento</option><option>Finalizada</option><option>Arquivada</option></select></label></div> : null}</article>)}</div>
      {/* O seletor acima é só um rótulo de histórico: quem oficializa a edição é
          o fechamento do ranking geral, e não havia daqui nenhuma menção a ele.
          O link só aparece na edição ativa porque /standings sempre opera sobre
          ela — apontá-lo numa linha antiga fecharia o ranking errado. */}
      {activeEdition ? <p className="form-hint">{isRankingClosed(state, activeEdition.id) ? 'Classificação final desta edição já foi fechada.' : 'A classificação final desta edição ainda não foi fechada.'}</p> : null}
      <Link href="/standings" className="wide-action"><ListOrdered size={18} aria-hidden="true" /> CLASSIFICAÇÃO GERAL <span aria-hidden="true">›</span></Link>
    </section>
    <section className="section-block"><SectionTitle eyebrow="CONFIGURAÇÃO" title="DESTA EDIÇÃO" /><div className="menu-grid"><Link href="/disciplines" className="menu-card"><Trophy size={22} /><strong>Modalidades</strong><span>{enabledDisciplines.length} habilitadas</span></Link><Link href="/staff" className="menu-card"><span className="menu-symbol">@</span><strong>Staff e papéis</strong><span>{staff.length} pessoas</span></Link></div></section>
  </AppShell>;
}
