'use client';

import Link from 'next/link';
import { Check, ChevronRight, UserPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFrontendState } from '../lib/frontend-state';

type AthleteDraft = {
  name: string;
};

const storageKey = 'intereng:team-athletes';

export function TeamAthleteForm({ teamId, teamName, disciplines, initialAthletes = 0 }: { teamId: string; teamName: string; disciplines: string[]; initialAthletes?: number }) {
  const router = useRouter();
  const { state, commit } = useFrontendState();
  const displayTeamName = state.teams[teamId]?.name ?? teamName;
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<AthleteDraft>({ name: '' });
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [error, setError] = useState('');

  function continueToDisciplines(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError('Preencha o nome do atleta.');
      return;
    }
    setError('');
    setStep(2);
  }

  function toggleDiscipline(discipline: string) {
    setSelectedDisciplines((current) => current.includes(discipline) ? current.filter((item) => item !== discipline) : [...current, discipline]);
  }

  function saveAthlete(modalities: string[]) {
    const current = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]') as unknown[];
    const athlete = { id: `local-athlete-${Date.now()}`, teamId, ...draft, modalities, createdAt: new Date().toISOString() };
    window.localStorage.setItem(storageKey, JSON.stringify([...current, athlete]));
    commit((app) => ({ ...app, teams: { ...app.teams, [teamId]: { ...app.teams[teamId], athletes: (app.teams[teamId]?.athletes ?? initialAthletes) + 1 } }, athletes: { ...app.athletes, [athlete.id]: { name: athlete.name, teamId, modalities, created: true } } }), { action: 'Atleta cadastrado', entity: athlete.name, after: displayTeamName });
    router.push(`/teams/${teamId}?created=1`);
    router.refresh();
  }

  return (
    <section className="team-athlete-flow">
      <div className="flow-steps" aria-label="Etapas do cadastro">
        <span className="active"><i>1</i> Cadastro</span><ChevronRight size={16} /><span className={step === 2 ? 'active' : ''}><i>2</i> Modalidades</span>
      </div>

      {step === 1 ? (
        <form className="entity-form" onSubmit={continueToDisciplines} noValidate>
          <div className="form-contract-note"><UserPlus size={19} /><p>O atleta será cadastrado diretamente na equipe <strong>{displayTeamName}</strong>.</p></div>
          <label><span>Nome completo</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Nome do atleta" required /></label>
          {error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}
          <div className="form-actions"><Link href={`/teams/${teamId}`} className="secondary-button">Cancelar</Link><button type="submit" className="primary-button">Cadastrar e continuar</button></div>
        </form>
      ) : (
        <div className="entity-form modality-association-step">
          <div className="form-contract-note"><Check size={19} /><p><strong>{draft.name}</strong> está pronto para ser cadastrado. A associação com modalidades é opcional e pode ser feita depois.</p></div>
          <fieldset><legend>Associar agora</legend>{disciplines.map((discipline) => <label className="modality-check" key={discipline}><input type="checkbox" checked={selectedDisciplines.includes(discipline)} onChange={() => toggleDiscipline(discipline)} /><span>{discipline}</span></label>)}</fieldset>
          <div className="form-actions"><button type="button" className="secondary-button" onClick={() => saveAthlete([])}>Pular por enquanto</button><button type="button" className="primary-button" onClick={() => saveAthlete(selectedDisciplines)}>Concluir cadastro</button></div>
        </div>
      )}
    </section>
  );
}
