'use client';

import Link from 'next/link';
import { CalendarRange, Check, ChevronRight, Pencil, Plus, Save, Trophy } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { AppShell, EmptyState, SectionTitle, StatusBadge } from '../components/AppShell';
import { EditionState, useFrontendState } from '../lib/repositories/browser-repository';
import { listDisciplines, createId } from '@atletica-incinera/intereng-contract/rules';
import { useUi } from '../components/UiProvider';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';

export default function CompetitionsPage() {
  const { state, dispatch } = useFrontendState();
  const { confirm, toast } = useUi();
  const activeCompetition = state.competitions.find((item) => item.active) ?? state.competitions[0];
  const staff = Object.values(state.staff).filter((member) => !member.revoked);
  const enabledDisciplines = listDisciplines(state, state.editions.find((item) => item.active)?.id).filter((item) => item.enabled);
  const editions = state.editions.filter((item) => (item.competitionId ?? 'jogos-engenharia') === activeCompetition.id);
  const activeEdition = editions.find((item) => item.active) ?? editions[0];
  const [creating, setCreating] = useState(false); const [editing, setEditing] = useState<string | null>(null); const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState({ year: String(new Date().getFullYear() + 1), start: '', end: '' }); const [dates, setDates] = useState({ start: '', end: '' });
  useUnsavedChanges((creating && Boolean(draft.start || draft.end)) || Boolean(editing && dates.start));

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

  return <AppShell active="profile" eyebrow="CONTEXTO" title="INTERENG" subtitle="Configure o torneio e escolha o ano da edição ativa" actionHref="/competitions/new" actionLabel="Novo torneio">
    <div className="competition-switcher" aria-label="Torneio ativo">{state.competitions.map((item) => <button type="button" className={item.id === activeCompetition.id ? 'active' : ''} aria-pressed={item.id === activeCompetition.id} onClick={() => void selectCompetition(item.id)} key={item.id}>{item.name}</button>)}<button type="button" className="competition-rename" onClick={() => setRenaming(renaming === null ? activeCompetition.name : null)} aria-label={`Renomear ${activeCompetition.name}`}><Pencil size={16} /></button></div>{renaming !== null ? <form className="entity-form inline-management-form" onSubmit={renameCompetition}><label><span>Nome do torneio</span><input value={renaming} onChange={(event) => setRenaming(event.target.value)} autoFocus required /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setRenaming(null)}>Cancelar</button><button type="submit" className="primary-button"><Save size={16} /> Salvar nome</button></div></form> : null}
    {activeEdition ? <section className="featured-context"><div className="context-number">{String(activeEdition.year).slice(-2)}</div><div><StatusBadge tone="orange">{activeEdition.status}</StatusBadge><p>TORNEIO · {activeCompetition.name}</p><h2>EDIÇÃO {activeEdition.year}</h2><span><CalendarRange size={16} /> {activeEdition.start} — {activeEdition.end}</span></div><Check className="context-check" size={22} /></section> : <EmptyState title="SEM EDIÇÕES" copy="Crie a primeira edição deste torneio." />}
    <section className="section-block"><SectionTitle eyebrow="HISTÓRICO" title="EDIÇÕES" /><button type="button" className="wide-action button-reset" onClick={() => setCreating(!creating)}><Plus size={18} /> NOVA EDIÇÃO <span>›</span></button>
      {creating ? <form className="entity-form inline-management-form" onSubmit={createEdition}><label><span>Ano da edição</span><input type="number" value={draft.year} onChange={(event) => setDraft({ ...draft, year: event.target.value })} /></label><label><span>Início</span><input type="date" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label><label><span>Encerramento</span><input type="date" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setCreating(false)}>Cancelar</button><button type="submit" className="primary-button">Criar edição</button></div></form> : null}
      <div className="stack-list edition-management-list">{editions.map((edition) => <article className="list-row edition-management-row" key={edition.id}><span className={`year-tile${edition.active ? '' : ' muted'}`}>{String(edition.year).slice(-2)}</span><span><strong>Edição {edition.year}</strong><small>{edition.start} — {edition.end}</small></span><StatusBadge tone={edition.active ? 'orange' : 'neutral'}>{edition.active ? 'Ativa' : edition.status}</StatusBadge><button type="button" className="row-action" onClick={() => { setEditing(editing === edition.id ? null : edition.id); setDates({ start: edition.start, end: edition.end }); }}><ChevronRight size={18} /></button>{editing === edition.id ? <div className="edition-inline-actions"><label><span>Início</span><input type="date" value={dates.start} onChange={(event) => setDates({ ...dates, start: event.target.value })} /></label><label><span>Fim</span><input type="date" value={dates.end} onChange={(event) => setDates({ ...dates, end: event.target.value })} /></label><button type="button" onClick={() => saveDates(edition)}><Save size={16} /> Datas</button>{!edition.active ? <button type="button" onClick={() => activate(edition)}>Tornar ativa</button> : null}<select value={edition.status} onChange={(event) => changeStatus(edition, event.target.value as EditionState['status'])}><option>Planejamento</option><option>Em andamento</option><option>Finalizada</option><option>Arquivada</option></select></div> : null}</article>)}</div>
    </section>
    <section className="section-block"><SectionTitle eyebrow="CONFIGURAÇÃO" title="DESTA EDIÇÃO" /><div className="menu-grid"><Link href="/disciplines" className="menu-card"><Trophy size={22} /><strong>Modalidades</strong><span>{enabledDisciplines.length} habilitadas</span></Link><Link href="/staff" className="menu-card"><span className="menu-symbol">@</span><strong>Staff e papéis</strong><span>{staff.length} pessoas</span></Link></div></section>
  </AppShell>;
}
