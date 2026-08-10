'use client';

import { ArrowUp, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatusBadge } from './AppShell';
import { matches as mockMatches, standings as mockStandings, tournaments as mockTournaments } from '../lib/repositories/catalog-repository';
import { calculateStandings, TournamentMatch } from '../lib/tournament-engine';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';

export function TournamentResults({ tournamentId, discipline = 'Futsal', fallbackParticipants }: { tournamentId?: string; discipline?: string; fallbackParticipants?: readonly string[] }) {
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const setup = tournamentId ? state.tournaments[tournamentId] : undefined;
  const phases = setup?.phases ?? [];
  const groupNames = phases.find((phase) => phase.format === 'Grupos')?.groups ?? ['Grupo A', 'Grupo B'];
  const participants = setup?.participants.length ? setup.participants : [...(fallbackParticipants ?? mockStandings.map((item) => item.name))];
  const assignments = setup?.assignments ?? Object.fromEntries(participants.map((team, index) => [team, groupNames[index % Math.max(1, groupNames.length)]]));
  const allMatches = useMemo<TournamentMatch[]>(() => {
    const staticRows = mockMatches.filter((match) => match.editionId === activeEdition?.id && match.discipline === discipline && (!tournamentId || match.tournamentId === tournamentId)).map((match) => { const override = state.matches[match.id] ?? {}; return { id: match.id, entryA: match.entryA, entryB: match.entryB, scoreA: override.scoreA ?? match.scoreA, scoreB: override.scoreB ?? match.scoreB, status: override.status ?? match.status, phase: override.phase ?? match.phase, group: override.phase ?? match.phase }; });
    const createdRows = Object.entries(state.matches).filter(([, match]) => match.created && match.editionId === activeEdition?.id && match.discipline === discipline && (!tournamentId || match.tournamentId === tournamentId)).map(([id, match]) => ({ id, entryA: match.entryA ?? 'Equipe A', entryB: match.entryB ?? 'Equipe B', scoreA: match.scoreA ?? null, scoreB: match.scoreB ?? null, status: match.status ?? 'Agendada', phase: match.phase, group: match.phase }));
    return [...staticRows, ...createdRows];
  }, [activeEdition?.id, discipline, state.matches, tournamentId]);
  const availableGroups = groupNames.length ? groupNames : ['Classificação'];
  const [view, setView] = useState(availableGroups[0]);
  const activeView = view === 'Chaveamento' || availableGroups.includes(view) ? view : availableGroups[0];
  const groupParticipants = activeView === 'Chaveamento' ? [] : participants.filter((team) => assignments[team] === activeView || availableGroups.length === 1);
  const table = calculateStandings(groupParticipants, allMatches.filter((match) => activeView === 'Chaveamento' ? false : match.group === activeView || match.phase === activeView));
  const knockout = allMatches.filter((match) => /semi|quart|final/i.test(match.phase ?? ''));
  const classificationPhase = phases.find((phase) => phase.format !== 'Mata-mata' && (phase.format === 'Liga' || phase.groups.includes(activeView))) ?? phases.find((phase) => phase.format !== 'Mata-mata');
  const fallbackQualifiers = mockTournaments.find((tournament) => tournament.id === tournamentId)?.qualifiers;
  const qualifierCount = classificationPhase?.qualifiers ?? fallbackQualifiers;
  const advancementLabel = qualifierCount ? `${qualifierCount} ${qualifierCount === 1 ? 'equipe avança' : 'equipes avançam'}` : 'Avanço ainda não configurado';
  const phaseIndex = classificationPhase ? phases.findIndex((phase) => phase.id === classificationPhase.id) : -1;
  const nextPhase = phaseIndex >= 0 ? phases[phaseIndex + 1] : undefined;

  return (
    <div className="tournament-results-view">
      <div className="filter-strip" role="tablist" aria-label="Etapas da classificação">
        {availableGroups.map((group) => <button role="tab" aria-selected={activeView === group} type="button" className={`filter-chip${activeView === group ? ' active' : ''}`} onClick={() => setView(group)} key={group}>{group}</button>)}
        <button role="tab" aria-selected={activeView === 'Chaveamento'} type="button" className={`filter-chip${activeView === 'Chaveamento' ? ' active' : ''}`} onClick={() => setView('Chaveamento')}>Chaveamento</button>
      </div>
      {activeView !== 'Chaveamento' ? <>
        <div className="standings-list" aria-label={`Classificação de ${activeView}`}>
          <div className="standings-head"><span>#</span><span>Equipe</span><span>J</span><span>V</span><span>E</span><span>D</span><span>PTS</span></div>
          {table.map((entry) => <article className={`standing-row rank-${entry.rank}`} key={entry.name}><span className="rank-block">{entry.rank}</span><div><strong>{entry.name}</strong><small>Saldo {entry.balance > 0 ? '+' : ''}{entry.balance}</small></div><span>{entry.played}</span><span>{entry.won}</span><span>{entry.drawn}</span><span>{entry.lost}</span><strong>{entry.points}</strong></article>)}
        </div>
        {!table.length ? <p className="match-filter-empty">Distribua equipes neste grupo para calcular a classificação.</p> : null}
        <div className="qualification-note"><Trophy size={20} /><div><strong>{advancementLabel}</strong><p>Desempate: pontos, vitórias, saldo e gols marcados.</p></div><StatusBadge tone="orange"><ArrowUp size={12} /> {nextPhase?.name ?? 'Próxima fase'}</StatusBadge></div>
      </> : <div className="phase-timeline" aria-label="Chaveamento">{knockout.length ? knockout.map((match, index) => <article key={match.id}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{match.phase ?? 'MATA-MATA'}</small><h3>{match.entryA} × {match.entryB}</h3><p>{match.status === 'Encerrada' ? `${match.scoreA} × ${match.scoreB}` : match.status}</p></div><Trophy size={20} /></article>) : <p className="match-filter-empty">O chaveamento será exibido quando os confrontos eliminatórios forem gerados.</p>}</div>}
    </div>
  );
}
