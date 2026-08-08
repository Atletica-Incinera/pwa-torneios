'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { disciplines } from '../lib/mock-data';
import { useFrontendState } from '../lib/frontend-state';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';

const catalog = ['Futsal', 'Vôlei', 'Handebol', 'Xadrez', 'Natação', 'Basquete'];
export function DisciplineCreationForm() {
  const router = useRouter(); const { state, commit } = useFrontendState();
  const [name, setName] = useState(''); const [mode, setMode] = useState<'Coletiva' | 'Individual'>('Coletiva'); const [config, setConfig] = useState(''); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(name || config) && !submitting);
  function submit(event: FormEvent) { event.preventDefault(); if (submitting) return; if (!name || config.trim().length < 3) { setError('Selecione a modalidade e informe sua regra principal.'); return; } const exists = disciplines.some((item) => item.name === name) || state.disciplines[name]?.created; if (exists && state.disciplines[name]?.enabled !== false) { setError('Esta modalidade já está habilitada na edição.'); return; } setSubmitting(true); const saved = commit((current) => ({ ...current, disciplines: { ...current.disciplines, [name]: { ...current.disciplines[name], name, mode, config: config.trim(), enabled: true, created: !disciplines.some((item) => item.name === name), tournaments: 0, tone: 'blue' } } }), { action: 'Modalidade adicionada à edição', entity: name, after: config.trim() }); if (saved) router.push(`/disciplines/${encodeURIComponent(name.toLowerCase())}`); else setSubmitting(false); }
  return <AppShell active="profile" eyebrow="INTERENG 2026" title="ADICIONAR MODALIDADE" subtitle="Associe e configure a modalidade nesta edição"><form className="entity-form" onSubmit={submit} noValidate><label><span>Modalidade do catálogo</span><select value={name} onChange={(event) => { setName(event.target.value); setError(''); }} required><option value="">Selecione</option>{catalog.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Tipo</span><select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option>Coletiva</option><option>Individual</option></select></label><label><span>Regra principal</span><input value={config} onChange={(event) => { setConfig(event.target.value); setError(''); }} placeholder="Ex.: 2 × 20 min" required /></label>{error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}<div className="form-actions"><Link href="/disciplines" className="secondary-button">Cancelar</Link><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Adicionando…' : 'Adicionar à edição'}</button></div></form></AppShell>;
}
