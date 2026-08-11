'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from './AppShell';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { canManageDiscipline, useFrontendSession } from '../lib/frontend-session';
import { disciplineHref, listDisciplines } from '../lib/edition-catalog';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';
import { createId } from '../lib/create-id';

export function CategoryCreationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, dispatch } = useFrontendState();
  const { session, hydrated } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  const disciplines = listDisciplines(state, activeEdition?.id).filter((item) => item.enabled && canManageDiscipline(session, item.name));
  const requested = searchParams.get('modalidade') ?? '';
  // A lista depende da sessão, que hidrata depois do primeiro render: por isso a
  // modalidade escolhida é derivada, e não congelada num estado inicial vazio.
  const [chosen, setChosen] = useState('');
  const discipline = disciplines.some((item) => item.name === chosen) ? chosen
    : disciplines.some((item) => item.name === requested) ? requested
      : disciplines[0]?.name ?? '';
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(name) && !submitting);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const label = name.trim();
    if (!activeEdition || !discipline || label.length < 3) { setError('Escolha a modalidade e dê um nome à categoria.'); return; }
    const duplicate = Object.values(state.tournaments).some((item) => item.editionId === activeEdition.id && item.discipline === discipline && item.name?.toLocaleLowerCase('pt-BR') === label.toLocaleLowerCase('pt-BR'));
    if (duplicate) { setError('Já existe uma categoria com esse nome nesta modalidade.'); return; }
    setSubmitting(true);
    const id = createId('category');
    const saved = await dispatch({
      type: 'category/create',
      payload: {
        id,
        category: {
          created: true, editionId: activeEdition.id, name: label, discipline,
          status: 'Rascunho', participants: [], seeds: {}, assignments: {}, generated: false,
          phases: [
            { id: 'groups', name: 'Fase de grupos', format: 'Grupos', groups: ['Grupo A', 'Grupo B'], qualifiers: 2 },
            { id: 'knockout', name: 'Mata-mata', format: 'Mata-mata', groups: [], qualifiers: 1 },
          ],
        },
      },
      audit: { action: 'Categoria criada', entity: label, after: discipline },
    });
    if (saved.ok) { router.push(`/tournaments/${id}?aba=regras`); router.refresh(); } else setSubmitting(false);
  }

  if (hydrated && !disciplines.length) {
    return <AppShell active="tournaments" eyebrow="NOVA CATEGORIA" title="SEM MODALIDADE" subtitle="Habilite uma modalidade antes de criar categorias">
      <div className="info-banner"><Info size={18} /><p>Nenhuma modalidade habilitada que você possa gerenciar. <Link href="/disciplines/new">Adicione uma modalidade</Link> primeiro.</p></div>
    </AppShell>;
  }

  return (
    <AppShell active="tournaments" eyebrow="NOVA CATEGORIA" title="CRIAR CATEGORIA" subtitle="A disputa dentro de uma modalidade">
      <form className="entity-form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="form-contract-note"><Info size={18} /><p>A categoria nasce como <strong>rascunho</strong>: inscreva participantes, defina fases e gere os confrontos na aba Regras antes de publicar.</p></div>
        <label><span>Modalidade</span><select value={discipline} onChange={(event) => { setChosen(event.target.value); setError(''); }} required>{disciplines.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
        <label><span>Nome da categoria</span><input value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Ex.: Futsal Masculino" autoFocus required /></label>
        {error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}
        <div className="form-actions">
          <Link href={discipline ? disciplineHref(discipline) : '/disciplines'} className="secondary-button">Cancelar</Link>
          <button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Criando…' : 'Criar categoria'}</button>
        </div>
      </form>
    </AppShell>
  );
}
