'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { PublicAppShell } from './PublicAppShell';
import { allDisciplinesOption, DisciplineSelector, resolveSelectedDiscipline } from './DisciplineSelector';
import { MatchSchedule } from './MatchSchedule';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { disciplineHref, listDisciplines } from '../lib/edition-catalog';

export function PublicMatchesHub() {
  const searchParams = useSearchParams();
  const { state, refresh } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const disciplines = listDisciplines(state, activeEdition?.id).filter((item) => item.enabled);
  const options = [allDisciplinesOption, ...new Set(disciplines.map((item) => item.name))];
  const requested = searchParams.get('modalidade') ?? '';
  const selected = resolveSelectedDiscipline(options, requested);
  const showingAll = selected === allDisciplinesOption;

  return (
    <PublicAppShell
      active="matches"
      eyebrow={`AGENDA • ${showingAll ? 'TODAS' : selected.toUpperCase()}`}
      title="JOGOS"
      subtitle={showingAll ? 'Jogos e resultados de todas as modalidades' : `Jogos e resultados somente de ${selected}`}
    >
      <DisciplineSelector options={options} onScopeChange={refresh} />
      <MatchSchedule discipline={showingAll ? '' : selected} hrefBase="/public/matches" publicView />
      <Link href={showingAll ? '/public/tournaments' : disciplineHref(selected)} className="wide-action">{showingAll ? 'VER MODALIDADES' : `TABELA DE ${selected.toUpperCase()}`} <span>›</span></Link>
    </PublicAppShell>
  );
}
