'use client';

import Link from 'next/link';
import { Activity, ChevronRight, Medal, Trophy } from 'lucide-react';
import { SectionTitle, StatusBadge } from './AppShell';
import { listCategories, listMatches, listTeams } from '../lib/edition-catalog';
import { isOfficialResult } from '../lib/status';
import { calculateStandings, TournamentMatch } from '../lib/tournament-engine';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { categoryPodium } from '../lib/podium';
import { canManageEdition, useFrontendSession } from '../lib/frontend-session';

export function TeamPerformance({ teamId, teamName, publicView = false }: { teamId: string; teamName: string; publicView?: boolean }) {
  const { state } = useFrontendState();
  const { session } = useFrontendSession();
  // O ranking geral é da organização: quem não administra a edição não abre
  // /standings, então o resumo com o link levava a uma porta fechada.
  const showOverall = !publicView && canManageEdition(session);
  const activeEdition = getActiveEdition(state);
  const currentName = state.teams[teamId]?.name ?? teamName;
  const categories = listCategories(state, activeEdition?.id);
  const effectiveMatches = listMatches(state, activeEdition?.id);
  const performances = categories.map((category) => {
    const setup = state.tournaments[category.id];
    const categoryMatches = effectiveMatches.filter((match) => match.tournamentId === category.id);
    const participates = setup?.participants.includes(currentName) || categoryMatches.some((match) => match.entryA === currentName || match.entryB === currentName);
    if (!participates) return null;
    const participants = setup?.participants.length ? setup.participants : [...new Set(categoryMatches.flatMap((match) => [match.entryA, match.entryB]))];
    const rows: TournamentMatch[] = categoryMatches.map((match) => ({ id: match.id, entryA: match.entryA, entryB: match.entryB, scoreA: match.scoreA, scoreB: match.scoreB, status: match.status, phase: match.phase, group: match.phase }));
    // A tabela oficial é a que a API calculou para a fase (com o critério de
    // desempate do regulamento e só os jogos daquele grupo). Recalcular aqui
    // misturava grupos e mata-mata e dava uma posição diferente da tabela.
    const official = setup?.phases.filter((phase) => phase.format !== 'Mata-mata').flatMap((phase) => phase.standings ?? []).find((row) => row.entryName === currentName);
    const standing = official
      ? { rank: official.rank ?? 0, played: official.played, won: official.won, drawn: official.drawn, lost: official.lost, points: official.points }
      : calculateStandings(participants, rows).find((row) => row.name === currentName);
    const podium = categoryPodium(state, category.id);
    const placement = podium?.champion === currentName ? 'Campeã' : podium?.vice === currentName ? '2º lugar' : podium?.third === currentName ? '3º lugar' : null;
    const teamMatches = categoryMatches.filter((match) => match.entryA === currentName || match.entryB === currentName);
    const completed = teamMatches.filter((match) => isOfficialResult(match.status));
    const scored = completed.reduce((total, match) => total + (match.entryA === currentName ? match.scoreA ?? 0 : match.scoreB ?? 0), 0);
    const conceded = completed.reduce((total, match) => total + (match.entryA === currentName ? match.scoreB ?? 0 : match.scoreA ?? 0), 0);
    return { ...category, standing, placement, scheduled: teamMatches.length, scored, conceded };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const editionAwards = state.overallRanking.awards.filter((award) => award.editionId === activeEdition?.id);
  const rankingTeams = listTeams(state);
  const overallRows = rankingTeams.map((team) => ({ ...team, points: editionAwards.filter((award) => award.teamId === team.id).reduce((total, award) => total + award.points, 0) })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'pt-BR'));
  const overallPoints = overallRows.find((team) => team.id === teamId)?.points ?? 0;
  const overallPosition = overallPoints > 0 ? overallRows.findIndex((team) => team.id === teamId) + 1 : 0;

  return <section className="section-block team-performance-section">
    <SectionTitle eyebrow="DESEMPENHO" title="CLASSIFICAÇÕES" />
    {/* A posicao no ranking geral e restrita a organizacao: na visao publica
        nem o resumo aparece, senao a informacao vazaria equipe por equipe. */}
    {!showOverall ? null : <div className="team-overall-summary"><Trophy size={22} /><div><small>Classificação geral da edição</small><strong>{overallPosition > 0 ? `${overallPosition}º lugar` : 'Sem posição'} · {overallPoints} pts</strong></div><Link href="/standings">Ver geral <ChevronRight size={17} /></Link></div>}
    <div className="team-performance-list">{performances.length ? performances.map((performance) => <article className="team-performance-card" key={performance.id}><div className="team-performance-head"><span><Medal size={20} /></span><div><small>{performance.discipline}</small><h3>{performance.name}</h3></div><StatusBadge tone={performance.placement ? 'pink' : 'orange'}>{performance.placement ?? performance.phase}</StatusBadge></div><div className="team-performance-stats"><span><small>POS</small><strong>{performance.standing?.played ? `${performance.standing.rank}º` : '—'}</strong></span><span><small>J</small><strong>{performance.standing?.played ?? 0}</strong></span><span><small>V</small><strong>{performance.standing?.won ?? 0}</strong></span><span><small>E</small><strong>{performance.standing?.drawn ?? 0}</strong></span><span><small>D</small><strong>{performance.standing?.lost ?? 0}</strong></span><span><small>PTS</small><strong>{performance.standing?.points ?? 0}</strong></span></div><p><Activity size={15} /> {performance.scored} marcados · {performance.conceded} sofridos · {performance.scheduled} {performance.scheduled === 1 ? 'jogo' : 'jogos'}</p><Link href={publicView ? `/public/tournaments/${performance.id}` : `/tournaments/${performance.id}#results`}>VER CLASSIFICAÇÃO <ChevronRight size={16} /></Link></article>) : <p className="match-filter-empty">Esta equipe ainda não possui jogos vinculados a uma modalidade nesta edição.</p>}</div>
  </section>;
}
