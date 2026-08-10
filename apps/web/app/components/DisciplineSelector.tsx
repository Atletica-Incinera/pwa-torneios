'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFrontendState } from '../lib/repositories/browser-repository';

type DisciplineSelectorProps = {
  options: readonly string[];
};

export function DisciplineSelector({ options }: DisciplineSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state, commit } = useFrontendState();
  const requested = searchParams.get('modalidade') ?? '';
  const preferred = state.preferences.selectedDiscipline;
  const selected = options.includes(requested) ? requested : options.includes(preferred) ? preferred : (options[0] ?? '');

  function handleChange(value: string) {
    commit((current) => ({ ...current, preferences: { ...current.preferences, selectedDiscipline: value } }));
    const params = new URLSearchParams(searchParams.toString());
    params.set('modalidade', value);
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
