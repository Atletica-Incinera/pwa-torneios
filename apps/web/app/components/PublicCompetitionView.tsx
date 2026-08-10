'use client';

import Link from 'next/link';
import { Flag, Shield } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { PublicAppShell } from './PublicAppShell';
import { DisciplineSelector } from './DisciplineSelector';
import { SectionTitle } from './AppShell';
import { TournamentResults } from './TournamentResults';
import { StatefulMatchCard } from './StatefulMatchCard';
import { matches, standings, tournaments } from '../lib/repositories/catalog-repository';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';

type View = 'standings' | 'results' | 'phases';

export function PublicCompetitionView({ view }: { view: View }) {
  const searchParams = useSearchParams();
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const options = [...new Set([
    ...tournaments.filter((item) => item.editionId === activeEdition?.id).map((item) => item.discipline),
    ...matches.filter((item) => item.editionId === activeEdition?.id).map((item) => item.discipline),
    ...Object.values(state.disciplines).filter((item) => item.enabled !== false).map((item) => item.name ?? '').filter(Boolean),
  ])];
  const requested = searchParams.get('modalidade') ?? '';
  const preferred = state.preferences.selectedDiscipline;
  const selected = options.includes(requested) ? requested : options.includes(preferred) ? preferred : options[0] ?? 'Futsal';
  const createdTournament = Object.entries(state.tournaments).find(([, item]) => item.created && item.editionId === activeEdition?.id && item.discipline === selected && item.status !== 'Rascunho');
  const activeTournament = createdTournament ? { id: createdTournament[0], name: createdTournament[1].name ?? selected } : tournaments.find((item) => item.editionId === activeEdition?.id && item.discipline === selected);
  const setup = activeTournament ? state.tournaments[activeTournament.id] : undefined;
  const phases = setup?.phases ?? [
    { id: 'groups', name: 'Fase de grupos', format: 'Grupos', groups: ['Grupo A', 'Grupo B'] },
    { id: 'knockout', name: activeTournament && 'phase' in activeTournament ? activeTournament.phase : 'Mata-mata', format: 'Mata-mata', groups: [] },
  ];
  const createdMatches = Object.entries(state.matches).filter(([, item]) => item.created && item.editionId === activeEdition?.id && item.discipline === selected).map(([id, item]) => ({ id, editionId: item.editionId, time: item.time ?? '--:--', date: item.date ?? 'A definir', discipline: item.discipline ?? selected, entryA: item.entryA ?? 'Equipe A', logoA: item.logoA ?? '', entryB: item.entryB ?? 'Equipe B', logoB: item.logoB ?? '', scoreA: item.scoreA ?? null, scoreB: item.scoreB ?? null, venue: item.venue ?? 'A definir', phase: item.phase ?? 'Fase atual', status: item.status ?? 'Agendada' }));
  const completed = [...matches.filter((item) => item.editionId === activeEdition?.id && item.discipline === selected), ...createdMatches].filter((match) => (state.matches[match.id]?.status ?? match.status) === 'Encerrada');

  const shell = view === 'standings'
    ? { active: 'standings' as const, eyebrow: `INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`, title: 'CLASSIFICAÇÃO', subtitle: `Tabela oficial de ${selected}` }
    : view === 'results'
      ? { active: 'results' as const, eyebrow: `INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`, title: 'RESULTADOS', subtitle: `Partidas encerradas de ${selected}` }
      : { active: 'phases' as const, eyebrow: `INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`, title: 'FASES', subtitle: `Caminho da modalidade ${selected}` };

  return <PublicAppShell {...shell}>
    {view === 'standings' ? <nav className="content-view-tabs ranking-scope-tabs" aria-label="Escopo da classificação"><span className="active" aria-current="page">Por modalidade</span><Link href="/public/standings/general">Classificação geral</Link></nav> : null}
    <DisciplineSelector options={options} />
    {view === 'standings' ? <section className="section-block public-priority-section"><SectionTitle eyebrow={activeTournament?.name ?? selected} title="TABELA E CHAVEAMENTO" /><TournamentResults tournamentId={activeTournament?.id} discipline={selected} fallbackParticipants={setup?.participants ?? standings.map((item) => item.name)} /></section> : null}
    {view === 'results' ? <section className="section-block public-priority-section"><SectionTitle eyebrow={activeTournament?.name ?? selected} title="JOGOS ENCERRADOS" /><div className="match-list public-readonly-list">{completed.length ? completed.map((match) => <StatefulMatchCard key={match.id} className="public-result-score" href={`/public/matches/${match.id}`} match={match} />) : <p className="match-filter-empty">Ainda não há resultados encerrados nesta modalidade.</p>}</div></section> : null}
    {view === 'phases' ? <section className="section-block public-priority-section"><SectionTitle eyebrow={activeTournament?.name ?? selected} title="ETAPAS DA DISPUTA" /><div className="phase-timeline public-phase-timeline">{phases.map((phase, index) => <article key={phase.id}><span>{String(index + 1).padStart(2, '0')}</span><div><small>{index === 0 ? 'ETAPA INICIAL' : 'ETAPA SEGUINTE'}</small><h3>{phase.name}</h3><p>{phase.format}{phase.groups.length ? ` · ${phase.groups.join(', ')}` : ''}</p></div><Flag size={18} /></article>)}</div></section> : null}
    <Link href="/public/teams" className="wide-action public-secondary-link"><Shield size={18} /> VER EQUIPES E ELENCOS <span>›</span></Link>
  </PublicAppShell>;
}
