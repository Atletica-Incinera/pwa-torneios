'use client';

import { AppShell, EmptyState, SectionTitle, StatusBadge } from './AppShell';
import { DisciplineManager } from './DisciplineManager';
import { useFrontendState } from '../lib/frontend-state';

type DisciplineBase = { name: string; mode: string; config: string; tournaments: number; tone: 'blue' | 'pink' | 'orange' };
export function DisciplineDetailView({ id, initial, index }: { id: string; initial?: DisciplineBase; index: number }) {
  const { state } = useFrontendState();
  const storedEntry = Object.entries(state.disciplines).find(([key]) => key.toLocaleLowerCase('pt-BR') === decodeURIComponent(id).toLocaleLowerCase('pt-BR'));
  const stored = storedEntry?.[1];
  const discipline = initial ?? (stored?.created ? { name: stored.name ?? storedEntry?.[0] ?? 'Modalidade', mode: stored.mode ?? 'Coletiva', config: stored.config ?? 'A definir', tournaments: stored.tournaments ?? 0, tone: stored.tone ?? 'blue' } : null);
  if (!discipline) return <AppShell active="profile" eyebrow="MODALIDADE" title="NÃO ENCONTRADA" subtitle="Selecione uma modalidade cadastrada"><EmptyState title="SEM DADOS" copy="Esta modalidade não existe na edição ativa." /></AppShell>;
  return <AppShell active="profile" eyebrow="MODALIDADE" title={discipline.name.toUpperCase()} subtitle="Configuração da InterEng 2026"><section className="discipline-hero"><span>{String(index + 1).padStart(2, '0')}</span><div><StatusBadge tone={discipline.tone}>{discipline.mode}</StatusBadge><h2>{discipline.name}</h2><p>{discipline.tournaments} torneios nesta edição</p></div></section><section className="section-block"><SectionTitle eyebrow="REGRAS" title="CONFIGURAÇÃO" /><DisciplineManager name={discipline.name} mode={discipline.mode} initialConfig={discipline.config} tournaments={discipline.tournaments} /></section></AppShell>;
}
