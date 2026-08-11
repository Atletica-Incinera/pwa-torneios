'use client';

import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { StatefulMatchCard } from './StatefulMatchCard';
import { EmptyState } from './AppShell';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { formatAgendaDate, moveDateKey, resolveMatchDate, toDateKey } from '../lib/date-utils';
import { isPublicMatch } from '../lib/publication';
import { listMatches } from '../lib/edition-catalog';


export function MatchSchedule({ discipline, hrefBase = '/matches', allowedStatuses, publicView = false, tournamentId }: { discipline: string; hrefBase?: string; allowedStatuses?: readonly string[]; publicView?: boolean; tournamentId?: string }) {
  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const day = formatAgendaDate(selectedDate, today);
  const visibleMatches = listMatches(state, activeEdition?.id, { discipline, tournamentId })
    // Na área pública, só entram jogos de disputas publicadas.
    .filter((match) => !publicView || isPublicMatch(state, match))
    .filter((match) => resolveMatchDate(match.date) === selectedDate && (!allowedStatuses || allowedStatuses.includes(match.status)))
    .sort((a, b) => a.time.localeCompare(b.time));

  return (
    <>
      <div className="date-switcher">
        <button type="button" onClick={() => setSelectedDate((value) => moveDateKey(value, -1))} aria-label="Dia anterior">‹</button>
        <label className="date-switcher-current" title="Abrir calendário">
          <CalendarDays size={18} /><span><strong>{day.label}</strong><small>{day.short}</small></span>
          <input type="date" value={selectedDate} onChange={(event) => event.target.value && setSelectedDate(event.target.value)} aria-label="Escolher data da agenda" />
        </label>
        <button type="button" onClick={() => setSelectedDate((value) => moveDateKey(value, 1))} aria-label="Próximo dia">›</button>
      </div>
      <section className="match-list" aria-label="Jogos filtrados por modalidade e data">
        {visibleMatches.map((match) => <StatefulMatchCard key={match.id} match={{ ...match, phase: '' }} href={`${hrefBase}/${match.id}`} />)}
        {!visibleMatches.length ? <EmptyState title="SEM JOGOS NESTA DATA" copy={`${day.long}. Navegue pelos dias ou abra o calendário para consultar a agenda de ${discipline}.`} /> : null}
      </section>
    </>
  );
}
