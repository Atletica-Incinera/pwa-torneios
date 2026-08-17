'use client';

import Link from 'next/link';
import { Activity, ChevronRight, Medal, Trophy } from 'lucide-react';
import { SectionTitle, StatusBadge } from './AppShell';
import { listCategories, listMatches, listTeams, isOfficialResult, calculateStandings, findOfficialStanding, TournamentMatch } from '@atletica-incinera/intereng-contract/rules';
import { getActiveEdition, useFrontendState, type FrontendState } from '../lib/repositories/browser-repository';
import { hasOverallRanking } from '../lib/source-capabilities';

export function TeamPerformance({ teamId, teamName, publicView = false }: { teamId: string; teamName: string; publicView?: boolean }) {
  const { state } = useFrontendState();
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
    // A campanha da equipe sai da tabela oficial quando o servidor mandou uma:
    // recalcular aqui daria uma posição que não é a que a classificação exibe.
    const standing = findOfficialStanding(setup?.standings, currentName) ?? calculateStandings(participants, rows).find((row) => row.name === currentName);
    const teamMatches = categoryMatches.filter((match) => match.entryA === currentName || match.entryB === currentName);
    const completed = teamMatches.filter((match) => isOfficialResult(match.status));
    const scored = completed.reduce((total, match) => total + (match.entryA === currentName ? match.scoreA ?? 0 : match.scoreB ?? 0), 0);
    const conceded = completed.reduce((total, match) => total + (match.entryA === currentName ? match.scoreB ?? 0 : match.scoreA ?? 0), 0);
    return { ...category, standing, scheduled: teamMatches.length, scored, conceded };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  const overall = overallSummaryOf(state, activeEdition?.id, teamId);

  return <section className="section-block team-performance-section">
    <SectionTitle eyebrow="DESEMPENHO" title="CLASSIFICAÇÕES" />
    {overall ? <div className="team-overall-summary"><Trophy size={22} /><div><small>Ranking geral do InterEng</small><strong>{overall.position > 0 ? `${overall.position}º lugar` : 'Sem posição'} · {overall.points} pts</strong></div><Link href={publicView ? '/public/standings/general' : '/standings'}>Ver geral <ChevronRight size={17} /></Link></div> : null}
    <div className="team-performance-list">{performances.length ? performances.map((performance) => <article className="team-performance-card" key={performance.id}><div className="team-performance-head"><span><Medal size={20} /></span><div><small>{performance.discipline}</small><h3>{performance.name}</h3></div><StatusBadge tone="orange">{performance.phase}</StatusBadge></div><div className="team-performance-stats"><span><small>POS</small><strong>{performance.standing?.played ? `${performance.standing.rank}º` : '—'}</strong></span><span><small>J</small><strong>{performance.standing?.played ?? 0}</strong></span><span><small>V</small><strong>{performance.standing?.won ?? 0}</strong></span><span><small>E</small><strong>{performance.standing?.drawn ?? 0}</strong></span><span><small>D</small><strong>{performance.standing?.lost ?? 0}</strong></span><span><small>PTS</small><strong>{performance.standing?.points ?? 0}</strong></span></div><p><Activity size={15} /> {performance.scored} marcados · {performance.conceded} sofridos · {performance.scheduled} jogos na agenda</p><Link href={publicView ? `/public/tournaments/${performance.id}` : `/tournaments/${performance.id}#results`}>VER CLASSIFICAÇÃO <ChevronRight size={16} /></Link></article>) : <p className="match-filter-empty">Esta equipe ainda não possui jogos vinculados a uma modalidade nesta edição.</p>}</div>
  </section>;
}

/**
 * Posição e pontos da equipe no ranking geral, ou `null` quando ele não existe.
 *
 * Não existir e não ter pontuado são coisas diferentes, e a faixa não sabe
 * dizer qual das duas está mostrando: "Sem posição · 0 pts" com a origem em
 * http seria lido como uma equipe que ainda não bonificou, quando na verdade
 * não há bonificação nenhuma para ninguém — o servidor não acumula pontos
 * entre modalidades. Sem resposta possível, a faixa inteira sai da tela.
 */
function overallSummaryOf(state: FrontendState, editionId: string | undefined, teamId: string) {
  if (!hasOverallRanking()) return null;
  const awards = state.overallRanking.awards.filter((award) => award.editionId === editionId);
  const rows = listTeams(state)
    .map((team) => ({ ...team, points: awards.filter((award) => award.teamId === team.id).reduce((total, award) => total + award.points, 0) }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'pt-BR'));
  const points = rows.find((team) => team.id === teamId)?.points ?? 0;
  return { points, position: points > 0 ? rows.findIndex((team) => team.id === teamId) + 1 : 0 };
}
