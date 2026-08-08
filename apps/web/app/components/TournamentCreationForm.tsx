'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { disciplines } from '../lib/mock-data';
import { TournamentState, useFrontendState } from '../lib/frontend-state';

function slugify(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
export function TournamentCreationForm() {
  const router = useRouter(); const { state, commit } = useFrontendState();
  const available = [...new Set([...disciplines.filter((item) => state.disciplines[item.name]?.enabled !== false).map((item) => item.name), ...Object.values(state.disciplines).filter((item) => item.created && item.enabled !== false).map((item) => item.name ?? '')])].filter(Boolean);
  const [name, setName] = useState(''); const [discipline, setDiscipline] = useState(''); const [format, setFormat] = useState('Grupos + mata-mata'); const [error, setError] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (!name.trim() || !discipline) { setError('Informe o nome e selecione a modalidade.'); return; } const base = slugify(name); const id = state.tournaments[base] ? `${base}-${Date.now()}` : base; const phaseFormat = format === 'Liga' ? 'Liga' : format.includes('Grupos') ? 'Grupos' : 'Mata-mata'; const setup: TournamentState = { status: 'Rascunho', participants: [], seeds: {}, phases: [{ id: 'phase-1', name: phaseFormat === 'Grupos' ? 'Fase de grupos' : phaseFormat, format: phaseFormat, groups: phaseFormat === 'Grupos' ? ['Grupo A', 'Grupo B'] : [], qualifiers: 2 }], assignments: {}, generated: false, created: true, name: name.trim(), discipline, format, tone: 'blue' }; commit((current) => ({ ...current, tournaments: { ...current.tournaments, [id]: setup } }), { action: 'Torneio criado', entity: name.trim(), after: 'Rascunho' }); router.push(`/tournaments/${id}/manage`); }
  return <AppShell active="tournaments" eyebrow="INTERENG 2026" title="NOVO TORNEIO" subtitle="Crie o rascunho e configure suas fases"><form className="entity-form" onSubmit={submit}><label><span>Nome</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Futsal Masculino" autoFocus /></label><label><span>Modalidade</span><select value={discipline} onChange={(event) => setDiscipline(event.target.value)}><option value="">Selecione</option>{available.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Formato inicial</span><select value={format} onChange={(event) => setFormat(event.target.value)}><option>Grupos + mata-mata</option><option>Eliminação simples</option><option>Liga + mata-mata</option><option>Liga</option></select></label>{error ? <p className="form-feedback form-feedback-error">{error}</p> : null}<div className="form-actions"><Link href="/tournaments" className="secondary-button">Cancelar</Link><button type="submit" className="primary-button">Criar rascunho</button></div></form></AppShell>;
}
