'use client';

import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { StatefulMatchCard } from './StatefulMatchCard';
import { EmptyState } from './AppShell';
import { useFrontendState } from '../lib/frontend-state';

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

const days = [
  { label: 'ONTEM', date: '12 OUT' },
  { label: 'HOJE', date: '13 OUT' },
  { label: 'AMANHÃ', date: '14 OUT' },
];

export function MatchSchedule({ matches, discipline }: { matches: readonly ScheduleMatch[]; discipline: string }) {
  const [dayIndex, setDayIndex] = useState(1);
  const { state } = useFrontendState();
  const day = days[dayIndex];
  const created = Object.entries(state.matches).filter(([, item]) => item.created && item.discipline === discipline).map(([id, item]) => ({ id, time: item.time ?? '--:--', date: item.date ?? 'Hoje', discipline: item.discipline ?? discipline, entryA: item.entryA ?? 'Equipe A', logoA: item.logoA ?? '', entryB: item.entryB ?? 'Equipe B', logoB: item.logoB ?? '', scoreA: item.scoreA ?? null, scoreB: item.scoreB ?? null, venue: item.venue ?? 'A definir', status: item.status ?? 'Agendada' }));
  const visibleMatches = dayIndex === 1 ? [...matches, ...created] : [];

  return (
    <>
      <div className="date-switcher">
        <button type="button" onClick={() => setDayIndex((value) => Math.max(0, value - 1))} disabled={dayIndex === 0} aria-label="Dia anterior">‹</button>
        <span><CalendarDays size={18} /><strong>{day.label}</strong><small>{day.date}</small></span>
        <button type="button" onClick={() => setDayIndex((value) => Math.min(days.length - 1, value + 1))} disabled={dayIndex === days.length - 1} aria-label="Próximo dia">›</button>
      </div>
      <section className="match-list" aria-label="Jogos filtrados por modalidade e data">
        {visibleMatches.map((match) => (
          <StatefulMatchCard key={match.id} match={{ ...match, phase: '' }} href={`/matches/${match.id}`} />
        ))}
        {!visibleMatches.length ? <EmptyState title="SEM JOGOS NESTA DATA" copy="Selecione outro dia para consultar a agenda da modalidade." /> : null}
      </section>
    </>
  );
}
