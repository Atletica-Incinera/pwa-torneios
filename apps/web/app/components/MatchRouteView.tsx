'use client';

import { AppShell, EmptyState } from './AppShell';
import { PublicAppShell } from './PublicAppShell';
import { MatchDetailClient } from './MatchDetailClient';
import { MatchManager } from './MatchManager';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { findMatch } from '../lib/edition-catalog';
import { isLive } from '../lib/status';

export function MatchRouteView({ id, mode }: { id: string; mode: 'admin' | 'manage' | 'public' }) {
  const { state } = useFrontendState();
  const match = findMatch(state, id);
  if (!match) { const content = <EmptyState title="PARTIDA NÃO ENCONTRADA" copy="Volte à agenda e selecione uma partida válida." />; return mode === 'public' ? <PublicAppShell active="disciplines" eyebrow="AGENDA" title="PARTIDA" subtitle="Dados indisponíveis">{content}</PublicAppShell> : <AppShell active="matches" eyebrow="AGENDA" title="PARTIDA" subtitle="Dados indisponíveis">{content}</AppShell>; }
  if (mode === 'public') return <PublicAppShell active={isLive(match.status) ? 'live' : 'disciplines'} eyebrow={`${match.discipline.toUpperCase()} · ${match.phase}`} title="PARTIDA" subtitle="Detalhes oficiais do confronto"><MatchDetailClient match={match} readOnly /></PublicAppShell>;
  if (mode === 'manage') return <AppShell active="matches" eyebrow={match.discipline.toUpperCase()} title="EDITAR PARTIDA" subtitle={`${match.entryA} × ${match.entryB}`}><MatchManager match={match} /></AppShell>;
  return <AppShell active="matches" eyebrow={`${match.discipline.toUpperCase()} · ${match.phase.toUpperCase()}`} title="PARTIDA" subtitle={`Detalhes e operação somente de ${match.discipline}`}><MatchDetailClient match={match} /></AppShell>;
}
