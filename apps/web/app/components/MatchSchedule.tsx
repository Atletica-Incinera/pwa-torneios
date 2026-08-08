'use client';

import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { StatefulMatchCard } from './StatefulMatchCard';
import { EmptyState } from './AppShell';
import { useFrontendState } from '../lib/frontend-state';
import { formatAgendaDate, moveDateKey, resolveMatchDate, toDateKey } from '../lib/date-utils';

type ScheduleMatch = {
  id: string;
  time: string;
  date: string;
  discipline: string;
  entryA: string;
  logoA: string;
  entryB: string;
  logoB: string;
  scoreA: number | null;
  scoreB: number | null;
  venue: string;
  status: string;
};

export function MatchSchedule({ matches, discipline, hrefBase = '/matches', allowedStatuses }: { matches: readonly ScheduleMatch[]; discipline: string; hrefBase?: string; allowedStatuses?: readonly string[] }) {
  const today = toDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState(today);
  const { state } = useFrontendState();
  const day = formatAgendaDate(selectedDate, today);
  const created = Object.entries(state.matches).filter(([, item]) => item.created && item.discipline === discipline).map(([id, item]) => ({ id, time: item.time ?? '--:--', date: item.date ?? 'Hoje', discipline: item.discipline ?? discipline, entryA: item.entryA ?? 'Equipe A', logoA: item.logoA ?? '', entryB: item.entryB ?? 'Equipe B', logoB: item.logoB ?? '', scoreA: item.scoreA ?? null, scoreB: item.scoreB ?? null, venue: item.venue ?? 'A definir', status: item.status ?? 'Agendada' }));
  const visibleMatches = [...matches, ...created].filter((match) => resolveMatchDate(match.date) === selectedDate && (!allowedStatuses || allowedStatuses.includes(state.matches[match.id]?.status ?? match.status))).sort((a, b) => a.time.localeCompare(b.time));

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
