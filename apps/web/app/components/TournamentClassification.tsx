'use client';

import { ArrowUp, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { StatusBadge } from './AppShell';
import { calculateStandings, type Standing, type TournamentMatch } from '../lib/tournament-engine';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { describeTiebreakers, resolveRegulation } from '../lib/regulation';
import { defaultAdvancement, describeAdvancement } from '../lib/bracket-rules';
import { listMatches } from '../lib/edition-catalog';
import { isOfficialResult } from '../lib/status';
import { useTablistKeys } from '../lib/use-tablist-keys';

type ClassificationHeading = { eyebrow?: string; title?: string; phase?: string };

type TournamentClassificationProps = {
  tournamentId?: string;
  discipline?: string;
  fallbackParticipants?: readonly string[];
  heading?: ClassificationHeading;
  className?: string;
};

export function TournamentClassification({ tournamentId, discipline = 'Futsal', fallbackParticipants, heading, className = '' }: TournamentClassificationProps) {
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const setup = tournamentId ? state.tournaments[tournamentId] : undefined;
  const phases = setup?.phases ?? [];
  // Sem fase de grupos a categoria tem uma tabela só. Inventar 'Grupo A'/'Grupo
  // B' criava duas abas que nenhuma equipe podia ocupar — a classificação de
  // uma Liga ou de um mata-mata puro nunca preenchia, e a mensagem pedia uma
  // distribuição em grupos que não existia para ser feita.
  const knockoutPhases = phases.filter((phase) => phase.format === 'Mata-mata').map((phase) => phase.name);
  const groupNames = phases.find((phase) => phase.format === 'Grupos')?.groups?.length
    ? phases.find((phase) => phase.format === 'Grupos')!.groups
    : phases.filter((phase) => phase.format !== 'Mata-mata').map((phase) => phase.name);
  // Sem inscrição configurada a tabela fica vazia: listar equipes quaisquer
  // daria a impressão de uma classificação que não existe.
  const participants = setup?.participants.length ? setup.participants : [...(fallbackParticipants ?? [])];
  const assignments = setup?.assignments ?? Object.fromEntries(participants.map((team, index) => [team, groupNames[index % Math.max(1, groupNames.length)]]));
  const regulation = useMemo(() => resolveRegulation(discipline, state.disciplines[discipline]), [discipline, state.disciplines]);
  /** Pontos de fair play da partida, conforme os eventos declarados na modalidade. */
  const disciplinaryOf = useMemo(() => (matchId: string) => {
    const events = state.matches[matchId]?.events ?? [];
    const weight = (label: string) => regulation.secondary.find((item) => item.label === label)?.fairPlayPoints ?? 0;
    return events.reduce((totals, event) => {
      const points = weight(event.type);
      if (!points) return totals;
      if (event.side === 'home') return { ...totals, a: totals.a + points };
      if (event.side === 'away') return { ...totals, b: totals.b + points };
      return totals;
    }, { a: 0, b: 0 });
  }, [regulation.secondary, state.matches]);
  const allMatches = useMemo<TournamentMatch[]>(() => listMatches(state, activeEdition?.id, { discipline, tournamentId }).map((match) => {
    const fairPlay = disciplinaryOf(match.id);
    return { id: match.id, entryA: match.entryA, entryB: match.entryB, scoreA: match.scoreA, scoreB: match.scoreB, status: match.status, phase: match.phase, group: match.phase, disciplinaryA: fairPlay.a, disciplinaryB: fairPlay.b };
  }), [activeEdition?.id, disciplinaryOf, discipline, state, tournamentId]);
  const availableGroups = groupNames.length ? groupNames : ['Classificação'];
  const [view, setView] = useState(availableGroups[0]);
  const activeView = view === 'Chaveamento' || availableGroups.includes(view) ? view : availableGroups[0];
  const groupParticipants = activeView === 'Chaveamento' ? [] : participants.filter((team) => assignments[team] === activeView || availableGroups.length === 1);
  const classificationPhase = phases.find((phase) => phase.format !== 'Mata-mata' && (phase.format === 'Liga' || phase.groups.includes(activeView))) ?? phases.find((phase) => phase.format !== 'Mata-mata');
  const officialEntries = classificationPhase?.standings
    ?.filter((entry) => availableGroups.length === 1 || groupParticipants.includes(entry.entryName));
  const officialTable: Standing[] | undefined = officialEntries?.length
    ? officialEntries
    .sort((left, right) => (left.rank ?? Number.MAX_SAFE_INTEGER) - (right.rank ?? Number.MAX_SAFE_INTEGER))
    .map((entry, index) => ({
      rank: entry.rank ?? index + 1,
      name: entry.entryName,
      played: entry.played,
      won: entry.won,
      drawn: entry.drawn,
      lost: entry.lost,
      goalsFor: entry.scoreFor,
      goalsAgainst: entry.scoreAgainst,
      balance: entry.scoreFor - entry.scoreAgainst,
      points: entry.points,
      disciplinary: 0,
    }))
    : undefined;
  // Com uma tabela só, todo jogo da categoria conta — menos o mata-mata, que
  // tem chave própria. Casar pelo nome da aba deixava de fora justamente os
  // jogos agendados à mão, cuja fase é o nome da fase e não o de um grupo.
  const singleTable = availableGroups.length === 1;
  const usesFairPlay = regulation.standings.tiebreakers.includes('fair-play') && regulation.secondary.some((item) => item.fairPlayPoints > 0);
  const table = officialTable ?? calculateStandings(groupParticipants, allMatches.filter((match) => {
    if (activeView === 'Chaveamento') return false;
    if (singleTable) return !knockoutPhases.includes(match.phase ?? '');
    return match.group === activeView || match.phase === activeView;
  }), regulation.standings);
  const knockout = allMatches.filter((match) => /semi|quart|final/i.test(match.phase ?? ''));
  const qualifierCount = classificationPhase?.qualifiers;
  const advancementLabel = qualifierCount ? `${qualifierCount} ${qualifierCount === 1 ? 'equipe avança' : 'equipes avançam'}` : 'Avanço ainda não configurado';
  const phaseIndex = classificationPhase ? phases.findIndex((phase) => phase.id === classificationPhase.id) : -1;
  const nextPhase = phaseIndex >= 0 ? phases[phaseIndex + 1] : undefined;
  const title = heading?.title ?? 'CLASSIFICAÇÃO E FASES';
  const onViewKeys = useTablistKeys([...availableGroups, 'Chaveamento'], activeView, setView);

  return <section className={`tournament-classification ${className}`.trim()} aria-label={`Classificação de ${discipline}`}>
    <header className="tournament-classification-head">
      <div><p className="eyebrow">{heading?.eyebrow ?? 'ACOMPANHAMENTO'}</p><h2>{title}</h2></div>
      {heading?.phase ? <StatusBadge tone="pink">{heading.phase}</StatusBadge> : null}
    </header>
    <div className="tournament-results-view">
      <div className="filter-strip" role="tablist" aria-label="Etapas da classificação" onKeyDown={onViewKeys}>
        {availableGroups.map((group) => <button role="tab" aria-selected={activeView === group} tabIndex={activeView === group ? 0 : -1} type="button" className={`filter-chip${activeView === group ? ' active' : ''}`} onClick={() => setView(group)} key={group}>{group}</button>)}
        <button role="tab" aria-selected={activeView === 'Chaveamento'} tabIndex={activeView === 'Chaveamento' ? 0 : -1} type="button" className={`filter-chip${activeView === 'Chaveamento' ? ' active' : ''}`} onClick={() => setView('Chaveamento')}>Chaveamento</button>
      </div>
      {activeView !== 'Chaveamento' ? <>
        <div className="standings-list" aria-label={`Classificação de ${activeView}`}>
          <div className="standings-head"><span>#</span><span>Equipe</span><span>J</span><span>V</span><span>E</span><span>D</span><span>PTS</span></div>
          {/* Sem mostrar o acumulado disciplinar, o peso configurado no
              regulamento agia sobre a ordem sem deixar rastro na tela. */}
          {table.map((entry) => <article className={`standing-row rank-${entry.rank}`} key={entry.name}><span className="rank-block">{entry.rank}</span><div><strong>{entry.name}</strong><small>Saldo {entry.balance > 0 ? '+' : ''}{entry.balance}{usesFairPlay ? ` · fair play ${entry.disciplinary}` : ''}{entry.tiebreak ? ` · desempate por ${entry.tiebreak.toLocaleLowerCase('pt-BR')}` : ''}</small></div><span>{entry.played}</span><span>{entry.won}</span><span>{entry.drawn}</span><span>{entry.lost}</span><strong>{entry.points}</strong></article>)}
        </div>
        {!table.length ? <p className="match-filter-empty">{!participants.length ? 'A tabela aparece depois que as equipes forem inscritas nesta categoria.' : singleTable ? 'Nenhuma equipe nesta fase ainda.' : `Distribua equipes em ${activeView} para calcular a classificação.`}</p> : null}
        <div className="qualification-note"><Trophy size={20} /><div><strong>{advancementLabel}</strong><p>Vitória {regulation.standings.win} · empate {regulation.standings.draw} · derrota {regulation.standings.loss}. Desempate: {describeTiebreakers(regulation.standings)}.</p>{setup ? <p>{describeAdvancement(setup.advancement ?? { ...defaultAdvancement, perGroup: qualifierCount ?? defaultAdvancement.perGroup }, availableGroups.length)}</p> : null}</div><StatusBadge tone="orange"><ArrowUp size={12} /> {nextPhase?.name ?? 'Próxima fase'}</StatusBadge></div>
      </> : <div className="phase-timeline" aria-label="Chaveamento">{knockout.length ? knockout.map((match, index) => <article key={match.id}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{match.phase ?? 'MATA-MATA'}</small><h3>{match.entryA} × {match.entryB}</h3><p>{isOfficialResult(match.status) ? `${match.scoreA} × ${match.scoreB}` : match.status}</p></div><Trophy size={20} /></article>) : <p className="match-filter-empty">O chaveamento será exibido quando os confrontos eliminatórios forem gerados.</p>}</div>}
    </div>
  </section>;
}
