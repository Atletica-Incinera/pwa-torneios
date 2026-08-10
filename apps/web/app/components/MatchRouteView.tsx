'use client';

import { AppShell, EmptyState } from './AppShell';
import { PublicAppShell } from './PublicAppShell';
import { MatchDetailClient } from './MatchDetailClient';
import { MatchManager } from './MatchManager';
import { useFrontendState } from '../lib/repositories/browser-repository';

type Base = { id: string; discipline: string; phase: string; status: string; entryA: string; logoA: string; entryB: string; logoB: string; scoreA: number | null; scoreB: number | null; date: string; time: string; venue: string };
export function MatchRouteView({ id, initial, mode }: { id: string; initial?: Base; mode: 'admin' | 'manage' | 'public' }) {
  const { state } = useFrontendState(); const stored = state.matches[id];
  const match = initial ?? (stored?.created ? { id, discipline: stored.discipline ?? 'Modalidade', phase: stored.phase ?? 'Fase atual', status: stored.status ?? 'Agendada', entryA: stored.entryA ?? 'Equipe A', logoA: stored.logoA ?? '', entryB: stored.entryB ?? 'Equipe B', logoB: stored.logoB ?? '', scoreA: stored.scoreA ?? null, scoreB: stored.scoreB ?? null, date: stored.date ?? 'A definir', time: stored.time ?? '--:--', venue: stored.venue ?? 'A definir' } : null);
  if (!match) { const content = <EmptyState title="PARTIDA NÃO ENCONTRADA" copy="Volte à agenda e selecione uma partida válida." />; return mode === 'public' ? <PublicAppShell active="matches" eyebrow="AGENDA" title="PARTIDA" subtitle="Dados indisponíveis">{content}</PublicAppShell> : <AppShell active="matches" eyebrow="AGENDA" title="PARTIDA" subtitle="Dados indisponíveis">{content}</AppShell>; }
  if (mode === 'public') return <PublicAppShell active={match.status === 'Ao vivo' ? 'live' : 'matches'} eyebrow={`${match.discipline.toUpperCase()} · ${match.phase}`} title="PARTIDA" subtitle="Detalhes oficiais do confronto"><MatchDetailClient match={match} readOnly /></PublicAppShell>;
  if (mode === 'manage') return <AppShell active="matches" eyebrow={match.discipline.toUpperCase()} title="EDITAR PARTIDA" subtitle={`${match.entryA} × ${match.entryB}`}><MatchManager match={match} /></AppShell>;
  return <AppShell active="matches" eyebrow={`${match.discipline.toUpperCase()} · ${match.phase.toUpperCase()}`} title="PARTIDA" subtitle={`Detalhes e operação somente de ${match.discipline}`}><MatchDetailClient match={match} /></AppShell>;
}
