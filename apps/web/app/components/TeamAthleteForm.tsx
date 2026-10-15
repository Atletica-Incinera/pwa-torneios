'use client';

import Link from 'next/link';
import { ClipboardList, UserPlus } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { useUi } from './UiProvider';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { findTeam, listDisciplines } from '../lib/edition-catalog';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';
import { useFrontendSession } from '../lib/frontend-session';
import { createId } from '../lib/create-id';
import { parseAthleteList } from '../lib/athlete-list';

type Mode = 'one' | 'list';

/**
 * Cadastro de atleta numa tela só: nome e modalidades juntos.
 *
 * Eram duas telas, e o botão da primeira dizia "Cadastrar e continuar" sem
 * cadastrar nada. Pior: cada atleta custava abrir o formulário de novo, e um
 * elenco de quinze virava setenta toques — em 2026 nenhuma atlética cadastrou
 * elenco. Agora dá para colar a lista inteira, um nome por linha.
 */
export function TeamAthleteForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const { state, dispatch } = useFrontendState();
  const { toast } = useUi();
  const displayTeamName = findTeam(state, teamId)?.name ?? 'Equipe cadastrada';
  const { session } = useFrontendSession();
  // O gestor cadastra atleta apenas na própria modalidade — e o servidor
  // recusa qualquer outra. Mostrar a lista inteira aqui seria oferecer uma
  // escolha que termina em erro depois de preencher o formulário todo.
  const managerScope = session?.role === 'DISCIPLINE_MANAGER' ? session.scope : undefined;
  const disciplines = listDisciplines(state, getActiveEdition(state)?.id)
    .filter((item) => item.enabled && (!managerScope || item.name === managerScope))
    .map((item) => item.name);
  const existingNames = useMemo(() => Object.values(state.athletes)
    .filter((athlete) => athlete.teamId === teamId && !athlete.removed)
    .map((athlete) => athlete.name ?? ''), [state.athletes, teamId]);
  const futevoleiAthletes = Object.values(state.athletes).filter((athlete) => athlete.teamId === teamId && !athlete.removed && athlete.modalities?.includes('Futevôlei')).length;

  const [mode, setMode] = useState<Mode>('one');
  const [name, setName] = useState('');
  const [list, setList] = useState('');
  const [selected, setSelected] = useState<string[]>(managerScope ? [managerScope] : disciplines.length === 1 ? disciplines : []);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const submitting = progress !== null;
  const parsed = useMemo(() => parseAthleteList(list, existingNames), [list, existingNames]);
  useUnsavedChanges((Boolean(name) || Boolean(list.trim())) && !submitting);

  function toggle(discipline: string) {
    if (discipline === 'Futevôlei' && !selected.includes(discipline) && futevoleiAthletes >= 4) {
      setError('Esta atlética já inscreveu o limite de duas duplas no Futevôlei.');
      return;
    }
    setError('');
    setSelected((current) => current.includes(discipline) ? current.filter((item) => item !== discipline) : [...current, discipline]);
  }

  async function create(names: string[]) {
    let created = 0;
    const failures: string[] = [];
    setProgress({ done: 0, total: names.length });
    for (const athleteName of names) {
      const saved = await dispatch({
        type: 'athlete/create',
        payload: { id: createId('athlete'), athlete: { name: athleteName, teamId, modalities: selected, created: true } },
        audit: { action: 'Atleta cadastrado', entity: athleteName, after: displayTeamName },
      }, { silent: names.length > 1 });
      if (saved.ok) created += 1;
      else failures.push(`${athleteName}: ${saved.error ?? 'não foi possível cadastrar'}`);
      setProgress({ done: created + failures.length, total: names.length });
    }
    setProgress(null);
    return { created, failures };
  }

  async function submit(event: FormEvent<HTMLFormElement>, another = false) {
    event.preventDefault();
    if (submitting) return;
    if (mode === 'one') {
      const clean = name.trim().replace(/\s+/g, ' ');
      if (clean.length < 3) { setError('Informe o nome completo do atleta.'); return; }
      if (existingNames.some((item) => item.toLocaleLowerCase('pt-BR') === clean.toLocaleLowerCase('pt-BR'))) { setError('Este atleta já está cadastrado nesta equipe.'); return; }
      setError('');
      const { created } = await create([clean]);
      if (!created) return;
      if (another) { setName(''); return; }
      router.push(`/teams/${teamId}`);
      return;
    }
    if (!parsed.names.length) { setError('Cole pelo menos um nome, um por linha.'); return; }
    setError('');
    const { created, failures } = await create(parsed.names);
    if (failures.length) {
      setList(failures.map((item) => item.split(':')[0]).join('\n'));
      setError(`${created} cadastrado(s). Não foi possível cadastrar ${failures.length}: ${failures.join('; ')}`);
      return;
    }
    toast(`${created} ${created === 1 ? 'atleta cadastrado' : 'atletas cadastrados'} no ${displayTeamName}.`, 'success');
    router.push(`/teams/${teamId}`);
  }

  const modalityPicker = disciplines.length ? <fieldset className="modality-fieldset">
    <legend>Modalidades {managerScope ? '' : '(pode marcar mais de uma)'}</legend>
    <div className="modality-check-grid">
      {disciplines.map((discipline) => <label className="modality-check" key={discipline}><input type="checkbox" checked={selected.includes(discipline)} onChange={() => toggle(discipline)} disabled={Boolean(managerScope)} /><span>{discipline}</span></label>)}
    </div>
    {disciplines.includes('Futevôlei') ? <p className="form-hint">Futevôlei: {futevoleiAthletes} de 4 atletas inscritos nesta atlética (até duas duplas).</p> : null}
  </fieldset> : null;

  return <AppShell active="teams" eyebrow={displayTeamName.toUpperCase()} title={mode === 'one' ? 'NOVO ATLETA' : 'COLAR ELENCO'} subtitle={`Elenco do ${displayTeamName} nesta edição`}>
    <section className="team-athlete-flow">
      <div className="segmented-control" role="tablist" aria-label="Como cadastrar">
        <button type="button" role="tab" aria-selected={mode === 'one'} className={mode === 'one' ? 'active' : ''} onClick={() => { setMode('one'); setError(''); }}><UserPlus size={16} aria-hidden="true" />Um atleta</button>
        <button type="button" role="tab" aria-selected={mode === 'list'} className={mode === 'list' ? 'active' : ''} onClick={() => { setMode('list'); setError(''); }}><ClipboardList size={16} aria-hidden="true" />Colar lista</button>
      </div>
      <form className="entity-form form-step-enter" onSubmit={(event) => void submit(event)} noValidate>
        {mode === 'one'
          ? <label><span>Nome completo</span><input value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Nome do atleta" autoComplete="off" autoFocus required /></label>
          : <label><span>Um nome por linha</span><textarea value={list} onChange={(event) => { setList(event.target.value); setError(''); }} rows={8} placeholder={'Ana Souza\nBruno Lima\nCarla Mendes'} autoFocus /></label>}
        {mode === 'list' && list.trim()
          ? <p className="form-hint" role="status">{parsed.names.length} {parsed.names.length === 1 ? 'nome novo' : 'nomes novos'}{parsed.skipped.length ? ` · ${parsed.skipped.length} ignorado(s): ${parsed.skipped.join(', ')}` : ''}</p>
          : null}
        {modalityPicker}
        {error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}
        {progress ? <p className="form-hint" role="status">Cadastrando {progress.done} de {progress.total}…</p> : null}
        <div className="form-actions">
          <Link href={`/teams/${teamId}`} className="secondary-button">Cancelar</Link>
          {mode === 'one'
            ? <button type="button" className="secondary-button" disabled={submitting} onClick={(event) => void submit(event as unknown as FormEvent<HTMLFormElement>, true)}>Cadastrar e adicionar outro</button>
            : null}
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Salvando…' : mode === 'one' ? 'Cadastrar' : `Cadastrar ${parsed.names.length || ''} ${parsed.names.length === 1 ? 'atleta' : 'atletas'}`.replace(/\s+/g, ' ')}
          </button>
        </div>
      </form>
    </section>
  </AppShell>;
}
