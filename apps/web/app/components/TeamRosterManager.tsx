'use client';

import Link from 'next/link';
import { ChevronDown, Plus, Save, UserMinus, UserRound, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from './AppShell';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { canManageDiscipline, canManageEdition, useFrontendSession } from '../lib/frontend-session';
import { useUi } from './UiProvider';
import { resolveRegulation, checkRoster, checkRosterLock, athletesOfTeam } from '@atletica-incinera/intereng-contract/rules';

type ManagedAthlete = { id: string; name: string; modalities: string[]; created: boolean };
const tones = ['blue', 'pink', 'orange'] as const;

export function TeamRosterManager({ teamId, disciplines, readOnly = false }: { teamId: string; disciplines: string[]; readOnly?: boolean }) {
  const [editingId, setEditingId] = useState<string | null>(null); const [selection, setSelection] = useState<string[]>([]); const [submitting, setSubmitting] = useState(false);
  const { state, dispatch } = useFrontendState(); const { session } = useFrontendSession(); const { confirm, toast } = useUi();
  const activeEdition = getActiveEdition(state);
  /** Regulamento, limites e trava de elenco de cada modalidade. */
  const rules = useMemo(() => Object.fromEntries(disciplines.map((discipline) => {
    const regulation = resolveRegulation(discipline, state.disciplines[discipline]);
    return [discipline, { regulation, lock: checkRosterLock(state, regulation, activeEdition?.id) }];
  })), [activeEdition?.id, disciplines, state]);
  const athletes = useMemo<ManagedAthlete[]>(() => athletesOfTeam(state, teamId), [state, teamId]);
  const groups = [...disciplines.filter((discipline) => athletes.some((athlete) => athlete.modalities.includes(discipline))).map((name) => ({ name, athletes: athletes.filter((athlete) => athlete.modalities.includes(name)) })), ...(athletes.some((athlete) => !athlete.modalities.length) ? [{ name: 'Sem modalidade', athletes: athletes.filter((athlete) => !athlete.modalities.length) }] : [])];
  const canEditAny = canManageEdition(session) || disciplines.some((discipline) => canManageDiscipline(session, discipline));
  function editable(discipline: string) { return canManageDiscipline(session, discipline) && (rules[discipline]?.lock.allowed ?? true); }
  function startAssociation(athlete: ManagedAthlete) { setEditingId(athlete.id); setSelection(athlete.modalities); }

  /**
   * Tirar o atleta da equipe. O registro não é apagado: fica marcado como
   * removido, para o histórico da edição continuar de pé. Modalidade já travada
   * pelo regulamento bloqueia a saída.
   */
  async function removeAthlete(athlete: ManagedAthlete) {
    const locked = athlete.modalities.find((discipline) => rules[discipline] && !rules[discipline].lock.allowed);
    if (locked) { toast(rules[locked].lock.message, 'error'); return; }
    if (!(await confirm({ title: 'Remover da equipe?', message: `${athlete.name} sai do elenco e deixa de contar nas modalidades. O cadastro fica no histórico da edição.`, confirmLabel: 'Remover', danger: true }))) return;
    await dispatch({
      type: 'athlete/update',
      payload: { id: athlete.id, patch: { name: athlete.name, teamId, modalities: athlete.modalities, created: state.athletes[athlete.id]?.created ?? athlete.created, removed: true } },
      audit: { action: 'Atleta removido da equipe', entity: athlete.name, before: athlete.modalities.join(', ') || 'Sem modalidade', after: 'Fora do elenco' },
    });
  }
  function toggle(discipline: string) {
    if (!canManageDiscipline(session, discipline)) return;
    const rule = rules[discipline];
    // A trava por fase é a única que impede: mexer no elenco com a modalidade
    // em andamento muda quem estava apto em jogos já disputados.
    if (rule && !rule.lock.allowed) { toast(rule.lock.message, 'error'); return; }
    if (rule && !selection.includes(discipline)) {
      const next = athletes.filter((athlete) => athlete.modalities.includes(discipline) && athlete.id !== editingId).length + 1;
      if (rule.regulation.roster.required && next > rule.regulation.roster.max) toast(`${discipline} prevê no máximo ${rule.regulation.roster.max} atletas por equipe.`, 'info');
    }
    setSelection((current) => current.includes(discipline) ? current.filter((item) => item !== discipline) : [...current, discipline]);
  }
  function saveAssociation(id: string) { if (submitting) return; setSubmitting(true); const athlete = athletes.find((item) => item.id === id); void dispatch({ type: 'athlete/update', payload: { id, patch: { name: athlete?.name, teamId, modalities: selection, created: state.athletes[id]?.created ?? athlete?.created } }, audit: { action: 'Modalidades do atleta alteradas', entity: athlete?.name ?? id, before: athlete?.modalities.join(', ') || 'Sem modalidade', after: selection.join(', ') || 'Sem modalidade' } }).then((saved) => { setSubmitting(false); if (saved.ok) setEditingId(null); }); }
  function renderAthlete(athlete: ManagedAthlete) { return <article className="roster-manage-row" key={athlete.id}><span className="jersey-number"><UserRound size={16} /></span><span className="roster-athlete-copy">{readOnly ? <strong>{athlete.name}</strong> : <Link href={`/athletes/${athlete.id}`}><strong>{athlete.name}</strong></Link>}<small>{athlete.created && !readOnly ? 'Cadastro desta edição' : 'Atleta da equipe'}</small></span>{!readOnly && canEditAny ? <span className="roster-row-actions"><button type="button" className="roster-associate-button" onClick={() => editingId === athlete.id ? setEditingId(null) : startAssociation(athlete)} aria-label={`Editar modalidades de ${athlete.name}`} aria-expanded={editingId === athlete.id}><Plus size={17} /></button><button type="button" className="roster-remove-button" onClick={() => void removeAthlete(athlete)} aria-label={`Remover ${athlete.name} da equipe`}><UserMinus size={17} /></button></span> : null}{editingId === athlete.id && !readOnly ? <div className="local-athlete-editor form-step-enter"><div>{disciplines.map((discipline) => <label key={discipline} className={!editable(discipline) ? 'is-disabled' : ''} title={rules[discipline]?.lock.allowed ? undefined : rules[discipline]?.lock.message}><input type="checkbox" checked={selection.includes(discipline)} onChange={() => toggle(discipline)} disabled={!editable(discipline)} /><span>{discipline}</span></label>)}</div><div className="local-athlete-editor-actions"><button type="button" onClick={() => setEditingId(null)}><X size={16} />Cancelar</button><button type="button" onClick={() => saveAssociation(athlete.id)} disabled={submitting}><Save size={16} />{submitting ? 'Salvando…' : 'Salvar'}</button></div></div> : null}</article>; }
  if (!athletes.length) return <EmptyState title="SEM ATLETAS" copy={readOnly ? 'Esta equipe ainda não possui elenco publicado.' : 'Cadastre o primeiro atleta desta equipe pelo botão superior.'} />;
  return <div className="team-modality-list">{groups.map((group, index) => {
    const tone = tones[index % tones.length];
    const rule = rules[group.name];
    // A crítica de elenco é operacional: só aparece para quem administra.
    const roster = rule && !readOnly ? checkRoster(rule.regulation, group.athletes.length) : null;
    return <details className={`team-modality team-modality-${tone}`} key={group.name} open={index === 0}>
      <summary><span className={`team-modality-mark mark-${tone}`}>{String(index + 1).padStart(2, '0')}</span><span className="team-modality-copy"><strong>{group.name}</strong><small>{group.athletes.length} atletas</small></span><ChevronDown size={21} aria-hidden="true" /></summary>
      <div className="team-modality-roster">
        {roster && !roster.ok ? <p className="form-feedback form-feedback-error" role="status">{roster.message}</p> : null}
        {rule && !readOnly && !rule.lock.allowed ? <p className="form-hint">{rule.lock.message}</p> : null}
        <div className="stack-list">{group.athletes.map(renderAthlete)}</div>
      </div>
    </details>;
  })}</div>;
}
