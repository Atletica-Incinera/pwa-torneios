'use client';

import Link from 'next/link';
import { ChevronRight, Settings2, Users } from 'lucide-react';
import { AppShell, StatusBadge } from '../components/AppShell';
import { disciplines } from '../lib/repositories/catalog-repository';
import { useFrontendState } from '../lib/repositories/browser-repository';

export default function DisciplinesPage() {
  const { state } = useFrontendState();
  const created = Object.values(state.disciplines).filter((item) => item.created).map((item, index) => ({ name: item.name ?? 'Modalidade', mode: item.mode ?? 'Coletiva', config: item.config ?? 'A definir', tournaments: item.tournaments ?? 0, tone: item.tone ?? (index % 2 ? 'pink' : 'blue') }));
  const allDisciplines = [...disciplines, ...created];
  const enabledCount = allDisciplines.filter((item) => state.disciplines[item.name]?.enabled !== false).length;
  return <AppShell active="profile" eyebrow="INTERENG · EDIÇÃO 2026" title="MODALIDADES" subtitle={`${enabledCount} modalidades habilitadas nesta edição`} actionHref="/disciplines/new" actionLabel="Adicionar modalidade"><div className="info-banner"><Settings2 size={20} /><p>Regras, duração e pontuação são configuradas por modalidade.</p></div><section className="poster-list">{allDisciplines.map((discipline, index) => { const stored = state.disciplines[discipline.name]; const enabled = stored?.enabled !== false; return <Link href={`/disciplines/${encodeURIComponent(discipline.name.toLowerCase())}`} className={`discipline-card accent-${discipline.tone}${enabled ? '' : ' is-disabled'}`} key={discipline.name}><span className="discipline-index">{String(index + 1).padStart(2, '0')}</span><div><StatusBadge tone={enabled ? discipline.tone : 'neutral'}>{enabled ? discipline.mode : 'Removida'}</StatusBadge><h2>{discipline.name}</h2><p>{stored?.config ?? discipline.config}</p><small><Users size={14} /> {discipline.tournaments} categorias</small></div><ChevronRight size={22} /></Link>; })}</section></AppShell>;
}
