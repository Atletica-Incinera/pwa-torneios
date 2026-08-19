'use client';

import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { MatchCard } from './MatchCard';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { formatAgendaDate, moveDateKey, resolveMatchDate, toDateKey } from '../lib/date-utils';
import { isPublicMatch } from '../lib/publication';
import { listMatches } from '../lib/edition-catalog';


export function MatchSchedule({ discipline, hrefBase = '/matches', allowedStatuses, publicView = false, tournamentId }: { discipline: string; hrefBase?: string; allowedStatuses?: readonly string[]; publicView?: boolean; tournamentId?: string }) {
  const today = toDateKey(new Date());
  // `null` significa "ainda não escolhi um dia": só então a agenda pode se
  // mover sozinha. Depois do primeiro clique quem manda é o usuário, mesmo que
  // ele escolha um dia vazio.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const disciplineLabel = discipline || 'todas as modalidades';
  const scheduled = listMatches(state, activeEdition?.id, { discipline, tournamentId })
    // Na área pública, só entram jogos de categorias publicadas.
    .filter((match) => !publicView || isPublicMatch(state, match))
    .filter((match) => !allowedStatuses || allowedStatuses.includes(match.status));
  const dates = [...new Set(scheduled.map((match) => resolveMatchDate(match.date)))].sort();
  // Os confrontos gerados nascem na data de início da edição, quase nunca hoje.
  // Abrir sempre em "hoje" mostrava "SEM JOGOS NESTA DATA" logo depois de gerar
  // vinte partidas — como se o trabalho tivesse se perdido.
  const currentDate = selectedDate ?? (dates.includes(today) ? today : dates.find((date) => date >= today) ?? dates[dates.length - 1] ?? today);
  const day = formatAgendaDate(currentDate, today);
  const visibleMatches = scheduled
    .filter((match) => resolveMatchDate(match.date) === currentDate)
    .sort((a, b) => a.time.localeCompare(b.time));
  const nextDate = dates.find((date) => date > currentDate) ?? dates.find((date) => date < currentDate);

  return (
    <>
      <div className="date-switcher">
        <button type="button" onClick={() => setSelectedDate(moveDateKey(currentDate, -1))} aria-label="Dia anterior">‹</button>
        <label className="date-switcher-current" title="Abrir calendário">
          <CalendarDays size={18} /><span><strong>{day.label}</strong><small>{day.short}</small></span>
          <input type="date" value={currentDate} onChange={(event) => event.target.value && setSelectedDate(event.target.value)} aria-label="Escolher data da agenda" />
        </label>
        <button type="button" onClick={() => setSelectedDate(moveDateKey(currentDate, 1))} aria-label="Próximo dia">›</button>
      </div>
      <section className="match-list" aria-label="Jogos filtrados por modalidade e data">
        {visibleMatches.map((match) => <MatchCard key={match.id} match={{ ...match, phase: '' }} href={`${hrefBase}/${match.id}`} />)}
        {!visibleMatches.length ? <div className="empty-state"><strong>SEM JOGOS NESTA DATA</strong>
          <p>{day.long}. {scheduled.length ? `A agenda de ${disciplineLabel} tem ${scheduled.length} ${scheduled.length === 1 ? 'jogo' : 'jogos'}${nextDate ? ` — o mais próximo em ${formatAgendaDate(nextDate, today).short}.` : '.'}` : `Nenhum jogo agendado em ${disciplineLabel} nesta edição.`}</p>
          {nextDate ? <button type="button" className="secondary-button" onClick={() => setSelectedDate(nextDate)}>Ir para {formatAgendaDate(nextDate, today).short}</button> : null}
        </div> : null}
      </section>
    </>
  );
}
