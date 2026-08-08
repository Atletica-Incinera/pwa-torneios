'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { useFrontendState } from '../lib/frontend-state';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';

function slugify(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

export function CompetitionCreationForm() {
  const router = useRouter();
  const { state, commit } = useFrontendState();
  const [form, setForm] = useState({ name: '', slug: '', editionName: '', year: String(new Date().getFullYear() + 1), start: '', end: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(form.name || form.editionName || form.start || form.end) && !submitting);

  function update(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); setError(''); }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const finalSlug = slugify(form.slug || form.name);
    if (!form.name.trim() || !finalSlug || !form.editionName.trim() || !form.year || !form.start || !form.end) { setError('Preencha a competição e os dados da primeira edição.'); return; }
    if (form.end < form.start) { setError('O encerramento deve acontecer depois do início.'); return; }
    if (state.competitions.some((item) => item.slug === finalSlug)) { setError('Este identificador público já está em uso.'); return; }
    setSubmitting(true);
    const id = `competition-${Date.now()}`; const editionId = `edition-${Date.now()}`;
    if (commit((current) => ({ ...current, competitions: [...current.competitions, { id, name: form.name.trim(), slug: finalSlug, active: false }], editions: [{ id: editionId, name: form.editionName.trim(), year: Number(form.year), start: form.start, end: form.end, status: 'Planejamento', active: false, competitionId: id }, ...current.editions] }), { action: 'Competição criada', entity: form.name.trim(), after: form.editionName.trim() })) router.push('/competitions'); else setSubmitting(false);
  }

  return <AppShell active="profile" eyebrow="SUPER ADMIN" title="NOVA COMPETIÇÃO" subtitle="Crie o evento e sua primeira edição"><form className="entity-form" onSubmit={submit} noValidate><label><span>Nome</span><input value={form.name} onChange={(event) => { update('name', event.target.value); if (!form.slug) update('slug', slugify(event.target.value)); }} placeholder="Ex.: Jogos de Engenharia" autoFocus required /></label><label><span>Identificador público</span><input value={form.slug} onChange={(event) => update('slug', slugify(event.target.value))} placeholder="jogos-de-engenharia" required /></label><label><span>Nome da primeira edição</span><input value={form.editionName} onChange={(event) => update('editionName', event.target.value)} placeholder="InterEng 2027" required /></label><label><span>Ano</span><input type="number" min={new Date().getFullYear() - 1} max={new Date().getFullYear() + 10} value={form.year} onChange={(event) => update('year', event.target.value)} required /></label><label><span>Início</span><input type="date" value={form.start} onChange={(event) => update('start', event.target.value)} required /></label><label><span>Encerramento</span><input type="date" min={form.start} value={form.end} onChange={(event) => update('end', event.target.value)} required /></label>{error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}<div className="form-actions"><Link href="/competitions" className="secondary-button">Cancelar</Link><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Criando…' : 'Criar competição'}</button></div></form></AppShell>;
}
