'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';
import { createId } from '../lib/create-id';

function slugify(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }

export function CompetitionCreationForm() {
  const router = useRouter();
  const { state, dispatch } = useFrontendState();
  const [form, setForm] = useState({ name: '', slug: '', year: String(new Date().getFullYear() + 1), start: '', end: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(form.name || form.start || form.end) && !submitting);

  function update(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); setError(''); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const finalSlug = slugify(form.slug || form.name);
    if (!form.name.trim() || !finalSlug || !form.year || !form.start || !form.end) { setError('Preencha o torneio e os dados da primeira edição.'); return; }
    if (form.end < form.start) { setError('O encerramento deve acontecer depois do início.'); return; }
    if (state.competitions.some((item) => item.slug === finalSlug)) { setError('Este identificador público já está em uso.'); return; }
    setSubmitting(true);
    const id = createId('competition'); const editionId = createId('edition');
    const saved = await dispatch({
      type: 'competition/create',
      payload: {
        competition: { id, name: form.name.trim(), slug: finalSlug, active: false },
        edition: { id: editionId, name: form.year, year: Number(form.year), start: form.start, end: form.end, status: 'Planejamento', active: false, competitionId: id },
      },
      audit: { action: 'Torneio criado', entity: form.name.trim(), after: `Edição ${form.year}` },
    });
    if (saved.ok) router.push('/competitions'); else setSubmitting(false);
  }

  return <AppShell active="profile" eyebrow="ORGANIZAÇÃO" title="NOVO TORNEIO" subtitle="Crie o torneio e defina o ano da primeira edição"><form className="entity-form" onSubmit={(event) => void submit(event)} noValidate><label><span>Nome do torneio</span><input value={form.name} onChange={(event) => { update('name', event.target.value); if (!form.slug) update('slug', slugify(event.target.value)); }} placeholder="Ex.: InterEng" autoFocus required /></label><label><span>Identificador público</span><input value={form.slug} onChange={(event) => update('slug', slugify(event.target.value))} placeholder="intereng" required /></label><label><span>Ano da primeira edição</span><input type="number" min={new Date().getFullYear() - 1} max={new Date().getFullYear() + 10} value={form.year} onChange={(event) => update('year', event.target.value)} required /></label><label><span>Início</span><input type="date" value={form.start} onChange={(event) => update('start', event.target.value)} required /></label><label><span>Encerramento</span><input type="date" min={form.start} value={form.end} onChange={(event) => update('end', event.target.value)} required /></label>{error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}<div className="form-actions"><Link href="/competitions" className="secondary-button">Cancelar</Link><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Criando…' : 'Criar torneio'}</button></div></form></AppShell>;
}
