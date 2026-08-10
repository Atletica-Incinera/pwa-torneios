'use client';

import { FormEvent, useMemo, useState } from 'react';
import { MatchState, useFrontendState } from '../lib/repositories/browser-repository';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';
import { useUi } from './UiProvider';
import { canManageDiscipline, useFrontendSession } from '../lib/frontend-session';

type MatchBase = { id: string; discipline: string; entryA: string; entryB: string; date: string; time: string; venue: string; status: string };
type MatchStatus = NonNullable<MatchState['status']>;
const transitions: Record<MatchStatus, MatchStatus[]> = { Agendada: ['Agendada', 'Ao vivo', 'Adiada', 'Cancelada', 'W.O.'], 'Ao vivo': ['Ao vivo', 'Encerrada', 'Adiada'], Encerrada: ['Encerrada'], Adiada: ['Adiada', 'Agendada', 'Cancelada'], Cancelada: ['Cancelada'], 'W.O.': ['W.O.'] };

export function MatchManager({ match }: { match: MatchBase }) {
  const { state, commit } = useFrontendState(); const { confirm } = useUi(); const { session } = useFrontendSession();
  const override = state.matches[match.id] ?? {}; const currentStatus = (override.status ?? match.status) as MatchStatus;
  const initial = useMemo(() => ({ date: override.date ?? match.date, time: override.time ?? match.time, venue: override.venue ?? match.venue, status: currentStatus, reason: override.reason ?? '' }), [currentStatus, match.date, match.time, match.venue, override.date, override.reason, override.time, override.venue]);
  const [draft, setDraft] = useState(initial); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  const needsReason = ['Adiada', 'Cancelada', 'W.O.'].includes(draft.status); const dirty = JSON.stringify(draft) !== JSON.stringify(initial); const allowed = canManageDiscipline(session, match.discipline); const locked = ['Encerrada', 'Cancelada', 'W.O.'].includes(currentStatus);
  useUnsavedChanges(dirty && !submitting);
  function update(field: keyof typeof draft, value: string) { setDraft((current) => ({ ...current, [field]: value })); setError(''); }
  async function save(event: FormEvent) { event.preventDefault(); if (!allowed || locked || submitting || !dirty) return; if (!draft.date || !draft.time || draft.venue.trim().length < 2 || (needsReason && draft.reason.trim().length < 3)) { setError('Preencha data, horário, local e o motivo da alteração.'); return; } if (['Cancelada', 'W.O.'].includes(draft.status) && !(await confirm({ title: `${draft.status === 'W.O.' ? 'Registrar W.O.' : 'Cancelar partida'}?`, message: 'Essa mudança bloqueia a operação do placar e será exibida na área pública.', confirmLabel: 'Confirmar', danger: true }))) return; setSubmitting(true); const saved = commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], ...draft, venue: draft.venue.trim(), reason: needsReason ? draft.reason.trim() : undefined } } }), { action: 'Partida alterada', entity: `${match.entryA} × ${match.entryB}`, before: currentStatus, after: draft.status }); setSubmitting(false); if (!saved) setError('Não foi possível salvar as alterações.'); }
  if (!allowed) return <div className="info-banner"><p>Seu perfil não pode editar partidas de {match.discipline}.</p></div>;
  return <form className="entity-form" onSubmit={save} noValidate><div className="form-contract-note"><p>{locked ? 'Esta partida está em um estado final e não pode mais ser alterada.' : 'O estado controla as ações do placar e a exibição pública.'}</p></div><label><span>Data</span><input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} required disabled={locked} /></label><label><span>Horário</span><input type="time" value={draft.time} onChange={(event) => update('time', event.target.value)} required disabled={locked} /></label><label><span>Local</span><input value={draft.venue} onChange={(event) => update('venue', event.target.value)} required disabled={locked} /></label><label><span>Estado da partida</span><select value={draft.status} onChange={(event) => update('status', event.target.value)} disabled={locked}>{transitions[currentStatus].map((status) => <option key={status}>{status}</option>)}</select></label>{needsReason ? <label><span>Motivo</span><input value={draft.reason} onChange={(event) => update('reason', event.target.value)} placeholder="Informe o motivo" required disabled={locked} /></label> : null}{error ? <p className="form-error" role="alert">{error}</p> : null}<div className="form-actions"><button type="submit" className="primary-button" disabled={!dirty || submitting || locked}>{submitting ? 'Salvando…' : 'Salvar alterações'}</button></div></form>;
}
