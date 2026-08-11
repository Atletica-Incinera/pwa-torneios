'use client';

import Link from 'next/link';
import { Check, ChevronRight, UserPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { findTeam, listDisciplines } from '../lib/edition-catalog';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';
import { createId } from '../lib/create-id';

export function TeamAthleteForm({ teamId }: { teamId: string }) {
  const router = useRouter(); const { state, dispatch } = useFrontendState();
  const displayTeamName = findTeam(state, teamId)?.name ?? 'Equipe cadastrada';
  const disciplines = listDisciplines(state, getActiveEdition(state)?.id).filter((item) => item.enabled).map((item) => item.name);
  const [step, setStep] = useState<1 | 2>(1); const [name, setName] = useState(''); const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(name) && !submitting);
  function continueToDisciplines(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (name.trim().length < 3) { setError('Informe o nome completo do atleta.'); return; } const duplicate = Object.values(state.athletes).some((athlete) => athlete.teamId === teamId && athlete.name?.toLocaleLowerCase('pt-BR') === name.trim().toLocaleLowerCase('pt-BR')); if (duplicate) { setError('Este atleta já está cadastrado nesta equipe.'); return; } setError(''); setStep(2); }
  function toggleDiscipline(discipline: string) { setSelectedDisciplines((current) => current.includes(discipline) ? current.filter((item) => item !== discipline) : [...current, discipline]); }
  function saveAthlete(modalities: string[]) { if (submitting) return; setSubmitting(true); const id = createId('athlete'); void dispatch({ type: 'athlete/create', payload: { id, athlete: { name: name.trim(), teamId, modalities, created: true } }, audit: { action: 'Atleta cadastrado', entity: name.trim(), after: displayTeamName } }).then((saved) => { if (saved.ok) { router.push(`/teams/${teamId}?created=1`); router.refresh(); } else setSubmitting(false); }); }
  return <AppShell active="teams" eyebrow={displayTeamName.toUpperCase()} title="NOVO ATLETA" subtitle="Cadastro vinculado à equipe selecionada"><section className="team-athlete-flow"><div className="flow-steps" aria-label="Etapas do cadastro"><span className="active"><i>1</i> Cadastro</span><ChevronRight size={16} /><span className={step === 2 ? 'active' : ''}><i>2</i> Modalidades</span></div>{step === 1 ? <form className="entity-form form-step-enter" onSubmit={continueToDisciplines} noValidate><div className="form-contract-note"><UserPlus size={19} /><p>O atleta será cadastrado diretamente na equipe <strong>{displayTeamName}</strong>.</p></div><label><span>Nome completo</span><input value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Nome do atleta" autoComplete="name" required /></label>{error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}<div className="form-actions"><Link href={`/teams/${teamId}`} className="secondary-button">Cancelar</Link><button type="submit" className="primary-button">Cadastrar e continuar</button></div></form> : <div className="entity-form modality-association-step form-step-enter"><div className="form-contract-note"><Check size={19} /><p><strong>{name}</strong> está pronto para ser cadastrado. A associação com modalidades é opcional e pode ser alterada depois.</p></div><fieldset><legend>Associar agora</legend>{disciplines.map((discipline) => <label className="modality-check" key={discipline}><input type="checkbox" checked={selectedDisciplines.includes(discipline)} onChange={() => toggleDiscipline(discipline)} /><span>{discipline}</span></label>)}</fieldset><div className="form-actions"><button type="button" className="secondary-button" onClick={() => saveAthlete([])} disabled={submitting}>Pular por enquanto</button><button type="button" className="primary-button" onClick={() => saveAthlete(selectedDisciplines)} disabled={submitting}>{submitting ? 'Salvando…' : 'Concluir cadastro'}</button></div></div>}</section></AppShell>;
}
