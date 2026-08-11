'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from './AppShell';
import { DisciplineSelector } from './DisciplineSelector';
import { MatchSchedule } from './MatchSchedule';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { disciplineHref, listDisciplines } from '../lib/edition-catalog';

/**
 * Agenda administrativa da edição. A classificação não vive mais aqui: ela é
 * uma aba da categoria, para existir num lugar só.
 */
export function MatchesHub() {
  const searchParams = useSearchParams();
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const disciplines = listDisciplines(state, activeEdition?.id).filter((item) => item.enabled);
  const options = disciplines.map((item) => item.name);
  const requested = searchParams.get('modalidade') ?? '';
  const preferred = state.preferences.selectedDiscipline;
  const selected = options.includes(requested) ? requested : options.includes(preferred) ? preferred : options[0] ?? 'Futsal';

  return (
    <AppShell
      active="matches"
      eyebrow={`AGENDA · ${selected.toUpperCase()}`}
      title="JOGOS"
      subtitle={`Jogos e resultados somente de ${selected}`}
      actionHref={`/matches/new?modalidade=${encodeURIComponent(selected)}`}
      actionLabel={`Agendar jogo de ${selected}`}
      actionPermission="discipline"
      actionDiscipline={selected}
    >
      <DisciplineSelector options={options} />
      <MatchSchedule discipline={selected} />
      <Link href={disciplineHref(selected)} className="wide-action">VER TABELA E CATEGORIAS DE {selected.toUpperCase()} <span>›</span></Link>
    </AppShell>
  );
}
