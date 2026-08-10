'use client';

import Link from 'next/link';
import { Activity, ChevronRight, Medal, Trophy } from 'lucide-react';
import { SectionTitle, StatusBadge } from './AppShell';
import { matches as catalogMatches, tournaments as catalogTournaments, teams as catalogTeams } from '../lib/repositories/catalog-repository';
import { calculateStandings, TournamentMatch } from '../lib/tournament-engine';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';

export function TeamPerformance({ teamId, teamName, publicView = false }: { teamId: string; teamName: string; publicView?: boolean }) {
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const currentName = state.teams[teamId]?.name ?? teamName;
  const categories = [
    ...catalogTournaments.filter((item) => item.editionId === activeEdition?.id).map((item) => ({ id: item.id, name: item.name, discipline: item.discipline, phase: state.tournaments[item.id]?.phases[0]?.name ?? item.phase })),
    ...Object.entries(state.tournaments).filter(([, item]) => item.created && item.editionId === activeEdition?.id).map(([id, item]) => ({ id, name: item.name ?? 'Categoria', discipline: item.discipline ?? 'Modalidade', phase: item.phases[0]?.name ?? 'Fase atual' })),
  ];
  const effectiveMatches = [
    ...catalogMatches.filter((match) => match.editionId === activeEdition?.id).map((match) => {
      const override = state.matches[match.id];
      return { ...match, scoreA: override?.scoreA ?? match.scoreA, scoreB: override?.scoreB ?? match.scoreB, status: override?.status ?? match.status, phase: override?.phase ?? match.phase };
    }),
    ...Object.entries(state.matches).filter(([, match]) => match.created && match.editionId === activeEdition?.id).map(([id, match]) => ({ id, editionId: match.editionId, tournamentId: match.tournamentId ?? '', time: match.time ?? '', date: match.date ?? '', discipline: match.discipline ?? 'Modalidade', entryA: match.entryA ?? 'Equipe A', logoA: match.logoA ?? '', entryB: match.entryB ?? 'Equipe B', logoB: match.logoB ?? '', scoreA: match.scoreA ?? null, scoreB: match.scoreB ?? null, venue: match.venue ?? '', phase: match.phase ?? '', status: match.status ?? 'Agendada' })),
  ];
  const performances = categories.map((category) => {
    const setup = state.tournaments[category.id];
    const categoryMatches = effectiveMatches.filter((match) => match.tournamentId === category.id);
    const participates = setup?.participants.includes(currentName) || categoryMatches.some((match) => match.entryA === currentName || match.entryB === currentName);
    if (!participates) return null;
    const participants = setup?.participants.length ? setup.participants : [...new Set(categoryMatches.flatMap((match) => [match.entryA, match.entryB]))];
    const rows: TournamentMatch[] = categoryMatches.map((match) => ({ id: match.id, entryA: match.entryA, entryB: match.entryB, scoreA: match.scoreA, scoreB: match.scoreB, status: match.status, phase: match.phase, group: match.phase }));
    const standing = calculateStandings(participants, rows).find((row) => row.name === currentName);
    const teamMatches = categoryMatches.filter((match) => match.entryA === currentName || match.entryB === currentName);
    const completed = teamMatches.filter((match) => match.status === 'Encerrada');
    const scored = completed.reduce((total, match) => total + (match.entryA === currentName ? match.scoreA ?? 0 : match.scoreB ?? 0), 0);
    const conceded = completed.reduce((total, match) => total + (match.entryA === currentName ? match.scoreB ?? 0 : match.scoreA ?? 0), 0);
    return { ...category, standing, scheduled: teamMatches.length, scored, conceded };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const editionAwards = state.overallRanking.awards.filter((award) => award.editionId === activeEdition?.id);
  const rankingTeams = [...catalogTeams.map((team) => ({ id: team.id, name: state.teams[team.id]?.name ?? team.name })), ...Object.entries(state.teams).filter(([, team]) => team.created && !team.archived).map(([id, team]) => ({ id, name: team.name ?? 'Equipe' }))];
  const overallRows = rankingTeams.map((team) => ({ ...team, points: editionAwards.filter((award) => award.teamId === team.id).reduce((total, award) => total + award.points, 0) })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'pt-BR'));
  const overallPoints = overallRows.find((team) => team.id === teamId)?.points ?? 0;
  const overallPosition = overallPoints > 0 ? overallRows.findIndex((team) => team.id === teamId) + 1 : 0;

  return <section className="section-block team-performance-section">
    <SectionTitle eyebrow="DESEMPENHO" title="CLASSIFICAÇÕES" />
    <div className="team-overall-summary"><Trophy size={22} /><div><small>Ranking geral do InterEng</small><strong>{overallPosition > 0 ? `${overallPosition}º lugar` : 'Sem posição'} · {overallPoints} pts</strong></div><Link href={publicView ? '/public/standings/general' : '/standings'}>Ver geral <ChevronRight size={17} /></Link></div>
    <div className="team-performance-list">{performances.length ? performances.map((performance) => <article className="team-performance-card" key={performance.id}><div className="team-performance-head"><span><Medal size={20} /></span><div><small>{performance.discipline}</small><h3>{performance.name}</h3></div><StatusBadge tone="orange">{performance.phase}</StatusBadge></div><div className="team-performance-stats"><span><small>POS</small><strong>{performance.standing?.played ? `${performance.standing.rank}º` : '—'}</strong></span><span><small>J</small><strong>{performance.standing?.played ?? 0}</strong></span><span><small>V</small><strong>{performance.standing?.won ?? 0}</strong></span><span><small>E</small><strong>{performance.standing?.drawn ?? 0}</strong></span><span><small>D</small><strong>{performance.standing?.lost ?? 0}</strong></span><span><small>PTS</small><strong>{performance.standing?.points ?? 0}</strong></span></div><p><Activity size={15} /> {performance.scored} marcados · {performance.conceded} sofridos · {performance.scheduled} jogos na agenda</p><Link href={publicView ? `/public/tournaments/${performance.id}` : `/tournaments/${performance.id}#results`}>VER CLASSIFICAÇÃO <ChevronRight size={16} /></Link></article>) : <p className="match-filter-empty">Esta equipe ainda não possui jogos vinculados a uma modalidade nesta edição.</p>}</div>
  </section>;
}
