'use client';

import Link from 'next/link';
import { Flag, Trophy, Users } from 'lucide-react';
import { PublicAppShell } from './PublicAppShell';
import { EmptyState, SectionTitle, StatusBadge } from './AppShell';
import { TournamentResults } from './TournamentResults';
import { StatefulMatchCard } from './StatefulMatchCard';
import { useFrontendState } from '../lib/frontend-state';

type TournamentBase = { id: string; name: string; discipline: string; status: string; entries: number; phase: string; progress: number; tone: 'blue' | 'pink' | 'orange' };
type MatchBase = { id: string; time: string; date: string; discipline: string; entryA: string; logoA: string; entryB: string; logoB: string; scoreA: number | null; scoreB: number | null; venue: string; phase: string; status: string };
export function PublicTournamentDetailView({ id, initial, matches, index }: { id: string; initial?: TournamentBase; matches: readonly MatchBase[]; index: number }) {
  const { state } = useFrontendState(); const stored = state.tournaments[id];
  const tournament = initial ? { ...initial, status: stored?.status ?? initial.status, entries: stored?.participants.length ?? initial.entries, phase: stored?.phases[0]?.name ?? initial.phase } : stored?.created ? { id, name: stored.name ?? 'Torneio', discipline: stored.discipline ?? 'Modalidade', status: stored.status, entries: stored.participants.length, phase: stored.phases[0]?.name ?? 'Configuração', progress: stored.generated ? 25 : 5, tone: stored.tone ?? 'blue' } : null;
  if (!tournament || tournament.status === 'Rascunho') return <PublicAppShell active="tournaments" eyebrow="INTERENG 2026" title="TORNEIO" subtitle="Conteúdo ainda não publicado"><EmptyState title="INDISPONÍVEL" copy="Este torneio ainda não foi publicado para o público." /></PublicAppShell>;
  const phases = stored?.phases ?? [{ id: 'phase-1', name: 'Fase de grupos', format: 'Grupos' as const, groups: ['Grupo A', 'Grupo B'], qualifiers: 2 }, { id: 'phase-2', name: tournament.phase, format: 'Mata-mata' as const, groups: [], qualifiers: 1 }];
  const results = matches.filter((match) => match.discipline === tournament.discipline && (state.matches[match.id]?.status ?? match.status) === 'Encerrada');
  return <PublicAppShell active="tournaments" eyebrow={`${tournament.discipline.toUpperCase()} · INTERENG 2026`} title={tournament.name} subtitle="Acompanhe fases, classificação e resultados"><Link href="/public/tournaments" className="public-back-link">‹ TORNEIOS</Link><section className="tournament-hero public-competition-hero"><div><Trophy size={28} /><strong>{String(index + 1).padStart(2, '0')}</strong></div><div><StatusBadge tone={tournament.tone}>{tournament.status}</StatusBadge><h2>{tournament.name}</h2><p><Users size={15} /> {tournament.entries} inscritos · {tournament.phase}</p></div></section><section className="section-block"><SectionTitle eyebrow="CLASSIFICAÇÃO" title="GRUPOS E CHAVEAMENTO" /><TournamentResults /></section><section className="section-block"><SectionTitle eyebrow="CAMINHO DA COMPETIÇÃO" title="ETAPAS" /><div className="phase-timeline public-phase-timeline">{phases.map((phase, phaseIndex) => <article key={phase.id}><span>{String(phaseIndex + 1).padStart(2, '0')}</span><div><small>{phaseIndex === 0 ? 'ETAPA INICIAL' : 'PRÓXIMA ETAPA'}</small><h3>{phase.name}</h3><p>{phase.format}{phase.groups.length ? ` · ${phase.groups.join(', ')}` : ''}</p></div><Flag size={18} /></article>)}</div></section><section className="section-block" id="results"><SectionTitle eyebrow="HISTÓRICO" title="RESULTADOS" /><div className="public-result-list">{results.length ? results.map((match) => <StatefulMatchCard key={match.id} className="public-result-score" href={`/public/matches/${match.id}`} match={match} />) : <p className="match-filter-empty">Ainda não há resultados encerrados nesta modalidade.</p>}</div></section></PublicAppShell>;
}
