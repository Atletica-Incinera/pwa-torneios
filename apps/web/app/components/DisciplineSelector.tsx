'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { selectEditionRole, useFrontendSession } from '../lib/frontend-session';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';

type DisciplineSelectorProps = {
  options: readonly string[];
  onScopeChange?: () => void | Promise<void>;
};

export const allDisciplinesOption = 'Todas as modalidades';

export function DisciplineSelector({ options, onScopeChange }: DisciplineSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, setPreference } = useFrontendState();
  const { session } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  const requested = searchParams.get('modalidade') ?? '';
  const preferred = state.preferences.selectedDiscipline;
  // Super admin enxerga a edição inteira, como o admin dela: os dois têm a
  // opção "Todas as modalidades" e nenhum fica preso a um escopo.
  const seesEveryDiscipline = session?.role === 'EDITION_ADMIN' || session?.role === 'SUPER_ADMIN';
  const selected = seesEveryDiscipline && options.includes(requested) && requested !== allDisciplinesOption
    ? requested
    : seesEveryDiscipline && options.includes(allDisciplinesOption)
      ? allDisciplinesOption
      : session?.role === 'DISCIPLINE_MANAGER' && session.scope && options.includes(session.scope)
        ? session.scope
        : options.includes(requested) ? requested : options.includes(preferred) ? preferred : (options[0] ?? '');

  function handleChange(value: string) {
    const adminRole = session?.editionRoles.find((role) => role.role === 'EDITION_ADMIN' && role.editionId === activeEdition?.id);
    const editionRole = session?.editionRoles.find((role) => (
      role.role === 'DISCIPLINE_MANAGER'
      && role.editionId === activeEdition?.id
      && role.disciplineName === value
    ));
    // Super admin não seleciona papel de edição: ele já enxerga tudo. Sem esta
    // guarda o ramo abaixo abortava a navegação dele (ele normalmente não tem
    // atribuição de edição nenhuma, então `adminRole` é undefined e o botão
    // simplesmente não fazia nada).
    if (session?.role === 'SUPER_ADMIN') { /* segue direto */ }
    else if (value === allDisciplinesOption) {
      if (!adminRole || !selectEditionRole(adminRole.roleAssignmentId)) return;
    } else if (editionRole) {
      if (!selectEditionRole(editionRole.roleAssignmentId)) return;
    } else if (session?.role === 'DISCIPLINE_MANAGER') {
      if (!adminRole || !selectEditionRole(adminRole.roleAssignmentId)) return;
    }
    void onScopeChange?.();
    if (value !== allDisciplinesOption) void setPreference({ selectedDiscipline: value });
    const params = new URLSearchParams(searchParams.toString());
    if (value === allDisciplinesOption) params.delete('modalidade');
    else params.set('modalidade', value);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="discipline-selector" role="group" aria-label="Filtrar por modalidade">
      <span className="discipline-selector-label">MODALIDADE</span>
      <div className="discipline-selector-track">
        {options.map((option) => (
          <button type="button" className={`discipline-option${selected === option ? ' active' : ''}`} onClick={() => handleChange(option)} key={option} aria-pressed={selected === option}>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
