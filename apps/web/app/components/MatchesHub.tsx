'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from './AppShell';
import { allDisciplinesOption, DisciplineSelector, resolveSelectedDiscipline } from './DisciplineSelector';
import { MatchSchedule } from './MatchSchedule';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { useFrontendSession } from '../lib/frontend-session';
import { disciplineHref, listDisciplines } from '../lib/edition-catalog';

/**
 * Agenda administrativa da edição. A classificação não vive mais aqui: ela é
 * uma aba da categoria, para existir num lugar só.
 */
export function MatchesHub() {
  const searchParams = useSearchParams();
  const { state, refresh } = useFrontendState();
  const { session } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  const disciplines = listDisciplines(state, activeEdition?.id).filter((item) => item.enabled);
  const editionRoles = session?.editionRoles.filter((role) => role.editionId === activeEdition?.id) ?? [];
  const scopedDisciplines = editionRoles
    .filter((role) => role.role === 'DISCIPLINE_MANAGER' && role.editionId === activeEdition?.id)
    .map((role) => role.disciplineName)
    .filter((name): name is string => Boolean(name));
  const canSeeAllDisciplines = session?.role === 'SUPER_ADMIN' || session?.role === 'EDITION_ADMIN' || editionRoles.some((role) => role.role === 'EDITION_ADMIN');
  const availableDisciplines = [...new Set([...disciplines.map((item) => item.name), ...scopedDisciplines])];
  const options = canSeeAllDisciplines
    ? [allDisciplinesOption, ...availableDisciplines]
    : scopedDisciplines.length > 0 ? scopedDisciplines : availableDisciplines;
  const requested = searchParams.get('modalidade') ?? '';
  const preferred = state.preferences.selectedDiscipline;
  const managerScope = session?.role === 'DISCIPLINE_MANAGER' ? session.scope : undefined;
  const selected = resolveSelectedDiscipline(options, requested, preferred, managerScope);
  const showingAll = selected === allDisciplinesOption;

  return (
    <AppShell
      active="matches"
      eyebrow={`AGENDA · ${showingAll ? 'TODAS' : selected.toUpperCase()}`}
      title="JOGOS"
      subtitle={showingAll ? 'Jogos e resultados de todas as modalidades' : `Jogos e resultados somente de ${selected}`}
      actionHref={showingAll ? '/matches/new' : `/matches/new?modalidade=${encodeURIComponent(selected)}`}
      actionLabel={showingAll ? 'Agendar jogo' : `Agendar jogo de ${selected}`}
      actionShortLabel="Jogo"
      actionPermission="discipline"
      actionDiscipline={selected}
    >
      <DisciplineSelector options={options} onScopeChange={refresh} />
      <MatchSchedule discipline={showingAll ? '' : selected} />
      <Link href={showingAll ? '/disciplines' : disciplineHref(selected)} className="wide-action">{showingAll ? 'VER MODALIDADES' : `TABELA DE ${selected.toUpperCase()}`} <span>›</span></Link>
    </AppShell>
  );
}
