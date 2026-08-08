'use client';

import { FormEvent, useState } from 'react';
import { MatchState, useFrontendState } from '../lib/frontend-state';

type MatchBase = { id: string; entryA: string; entryB: string; date: string; time: string; venue: string; status: string };
type MatchStatus = NonNullable<MatchState['status']>;

export function MatchManager({ match }: { match: MatchBase }) {
  const { state, commit } = useFrontendState();
  const override = state.matches[match.id] ?? {};
  const currentStatus = (override.status ?? match.status) as MatchStatus;
  const [draft, setDraft] = useState({ date: override.date ?? '2026-10-13', time: override.time ?? match.time, venue: override.venue ?? match.venue, status: currentStatus ?? 'Agendada', reason: override.reason ?? '' });
  const needsReason = ['Adiada', 'Cancelada', 'W.O.'].includes(draft.status);

  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.date || !draft.time || !draft.venue || (needsReason && !draft.reason.trim())) return;
    commit((current) => ({ ...current, matches: { ...current.matches, [match.id]: { ...current.matches[match.id], ...draft } } }), { action: 'Partida alterada', entity: `${match.entryA} × ${match.entryB}`, before: currentStatus, after: draft.status });
  }

  return <form className="entity-form" onSubmit={save}><div className="form-contract-note"><p>O estado controla quais ações ficam disponíveis no placar e na área pública.</p></div><label><span>Data</span><input type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} required /></label><label><span>Horário</span><input type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} required /></label><label><span>Local</span><input value={draft.venue} onChange={(event) => setDraft({ ...draft, venue: event.target.value })} required /></label><label><span>Estado da partida</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as MatchStatus })}><option>Agendada</option><option>Ao vivo</option><option>Encerrada</option><option>Adiada</option><option>Cancelada</option><option>W.O.</option></select></label>{needsReason ? <label><span>Motivo</span><input value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="Informe o motivo" required /></label> : null}<div className="form-actions"><button type="submit" className="primary-button">Salvar alterações</button></div></form>;
}
