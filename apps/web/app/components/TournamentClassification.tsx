'use client';

import Link from 'next/link';
import { ArrowUp, Trophy } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { StatusBadge } from './AppShell';
import { resolveStandings, TournamentMatch, describeTiebreakers, resolveRegulation, defaultAdvancement, describeAdvancement, listMatches, isOfficialResult } from '@atletica-incinera/intereng-contract/rules';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { useTablistKeys } from '../lib/use-tablist-keys';

type ClassificationHeading = { eyebrow?: string; title?: string; phase?: string };

type TournamentClassificationProps = {
  tournamentId?: string;
  discipline?: string;
  fallbackParticipants?: readonly string[];
  heading?: ClassificationHeading;
  detailsHref?: string;
  generalRankingHref?: string;
  managementAction?: ReactNode;
  className?: string;
};

export function TournamentClassification({ tournamentId, discipline = 'Futsal', fallbackParticipants, heading, detailsHref, generalRankingHref, managementAction, className = '' }: TournamentClassificationProps) {
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const setup = tournamentId ? state.tournaments[tournamentId] : undefined;
  const phases = setup?.phases ?? [];
  const groupNames = phases.find((phase) => phase.format === 'Grupos')?.groups ?? ['Grupo A', 'Grupo B'];
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
  // Aba vazia porque o servidor não informou quem está no grupo, não porque
  // ninguém foi distribuído. As duas se parecem na tela, e mandar o organizador
  // distribuir o que ele já distribuiu é o que faz ele desfazer o próprio
  // trabalho achando que o perdeu.
  const alocacaoNaoInformada = (setup?.unknownAssignments ?? []).includes(activeView);
  // A tabela oficial é a do servidor quando o modo `http` trouxe uma para esta
  // aba; sem servidor, é calculada aqui pelo regulamento da modalidade.
  const table = resolveStandings(setup?.standings?.[activeView], groupParticipants, allMatches.filter((match) => activeView === 'Chaveamento' ? false : match.group === activeView || match.phase === activeView), regulation.standings);
  const knockout = allMatches.filter((match) => /semi|quart|final/i.test(match.phase ?? ''));
  const classificationPhase = phases.find((phase) => phase.format !== 'Mata-mata' && (phase.format === 'Liga' || phase.groups.includes(activeView))) ?? phases.find((phase) => phase.format !== 'Mata-mata');
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
          {table.map((entry) => <article className={`standing-row rank-${entry.rank}`} key={entry.name}><span className="rank-block">{entry.rank}</span><div><strong>{entry.name}</strong><small>Saldo {entry.balance > 0 ? '+' : ''}{entry.balance}{entry.tiebreak ? ` · desempate por ${entry.tiebreak.toLocaleLowerCase('pt-BR')}` : ''}</small></div><span>{entry.played}</span><span>{entry.won}</span><span>{entry.drawn}</span><span>{entry.lost}</span><strong>{entry.points}</strong></article>)}
        </div>
        {!table.length ? <p className="match-filter-empty">{alocacaoNaoInformada ? 'O servidor só publica quem está neste grupo depois do primeiro resultado encerrado — daqui não dá para saber se o grupo está vazio ou se a alocação existe e não aparece.' : participants.length ? 'Distribua equipes neste grupo para calcular a classificação.' : 'A tabela aparece depois que as equipes forem inscritas nesta categoria.'}</p> : null}
        <div className="qualification-note"><Trophy size={20} /><div><strong>{advancementLabel}</strong><p>Vitória {regulation.standings.win} · empate {regulation.standings.draw} · derrota {regulation.standings.loss}. Desempate: {describeTiebreakers(regulation.standings)}.</p>{setup ? <p>{describeAdvancement(setup.advancement ?? { ...defaultAdvancement, perGroup: qualifierCount ?? defaultAdvancement.perGroup }, availableGroups.length)}</p> : null}</div><StatusBadge tone="orange"><ArrowUp size={12} /> {nextPhase?.name ?? 'Próxima fase'}</StatusBadge></div>
      </> : <div className="phase-timeline" aria-label="Chaveamento">{knockout.length ? knockout.map((match, index) => <article key={match.id}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{match.phase ?? 'MATA-MATA'}</small><h3>{match.entryA} × {match.entryB}</h3><p>{isOfficialResult(match.status) ? `${match.scoreA} × ${match.scoreB}` : match.status}</p></div><Trophy size={20} /></article>) : <p className="match-filter-empty">O chaveamento será exibido quando os confrontos eliminatórios forem gerados.</p>}</div>}
    </div>
    {(detailsHref || generalRankingHref || managementAction) ? <footer className="tournament-classification-actions">
      {detailsHref ? <Link href={detailsHref} className="wide-action">VER FASES E DETALHES <span>›</span></Link> : null}
      {generalRankingHref ? <Link href={generalRankingHref} className="wide-action ranking-general-link">VER CLASSIFICAÇÃO GERAL <span>›</span></Link> : null}
      {managementAction}
    </footer> : null}
  </section>;
}
