'use client';

import { useSearchParams } from 'next/navigation';
import { AppShell } from './AppShell';
import { DisciplineSelector } from './DisciplineSelector';
import { MatchSchedule } from './MatchSchedule';
import { PublicAppShell } from './PublicAppShell';
import { PublicMatchCollection } from './PublicMatchCollection';
import { matches } from '../lib/mock-data';
import { useFrontendState } from '../lib/frontend-state';

export function MatchesHub({ area, mode = 'upcoming' }: { area: 'admin' | 'public'; mode?: 'live' | 'upcoming' }) {
  const searchParams = useSearchParams();
  const { state } = useFrontendState();
  const options = [...new Set([
    ...matches.map((match) => match.discipline),
    ...Object.values(state.matches).map((match) => match.discipline).filter((value): value is string => Boolean(value)),
    ...Object.values(state.disciplines).filter((item) => item.enabled !== false).map((item) => item.name).filter((value): value is string => Boolean(value)),
  ])];
  const requested = searchParams.get('modalidade') ?? '';
  const preferred = state.preferences.selectedDiscipline;
  const selected = options.includes(requested) ? requested : options.includes(preferred) ? preferred : options[0] ?? 'Futsal';
  const staticMatches = matches.filter((match) => match.discipline === selected);

  if (area === 'admin') {
    return <AppShell active="matches" eyebrow={`AGENDA · ${selected.toUpperCase()}`} title="JOGOS" subtitle={`Jogos e resultados somente de ${selected}`} actionHref={`/matches/new?modalidade=${encodeURIComponent(selected)}`} actionLabel={`Agendar jogo de ${selected}`} actionPermission="discipline" actionDiscipline={selected}><DisciplineSelector options={options} /><MatchSchedule matches={staticMatches} discipline={selected} /></AppShell>;
  }

  if (mode === 'live') {
    return <PublicAppShell active="live" eyebrow={`AO VIVO · ${selected.toUpperCase()}`} title="AO VIVO" subtitle={`Placares oficiais somente de ${selected}`}><DisciplineSelector options={options} /><PublicMatchCollection matches={staticMatches} discipline={selected} mode="live" /></PublicAppShell>;
  }

  return <PublicAppShell active="matches" eyebrow={`AGENDA · ${selected.toUpperCase()}`} title="PRÓXIMOS" subtitle={`Partidas confirmadas de ${selected}`}><DisciplineSelector options={options} /><MatchSchedule matches={staticMatches} discipline={selected} hrefBase="/public/matches" allowedStatuses={['Agendada']} /></PublicAppShell>;
}
