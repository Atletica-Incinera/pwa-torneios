'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell } from './AppShell';
import { DisciplineSelector } from './DisciplineSelector';
import { MatchSchedule } from './MatchSchedule';
import { PublicAppShell } from './PublicAppShell';
import { PublicMatchCollection } from './PublicMatchCollection';
import { TournamentResults } from './TournamentResults';
import { matches, tournaments } from '../lib/repositories/catalog-repository';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';

export function MatchesHub({ area, mode = 'upcoming' }: { area: 'admin' | 'public'; mode?: 'live' | 'upcoming' }) {
  const searchParams = useSearchParams();
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const options = [...new Set([
    ...matches.filter((match) => match.editionId === activeEdition?.id).map((match) => match.discipline),
    ...Object.values(state.matches).filter((match) => match.editionId === activeEdition?.id).map((match) => match.discipline).filter((value): value is string => Boolean(value)),
    ...Object.values(state.disciplines).filter((item) => item.enabled !== false).map((item) => item.name).filter((value): value is string => Boolean(value)),
  ])];
  const requested = searchParams.get('modalidade') ?? '';
  const preferred = state.preferences.selectedDiscipline;
  const selected = options.includes(requested) ? requested : options.includes(preferred) ? preferred : options[0] ?? 'Futsal';
  const activeView = searchParams.get('visao') === 'classificacao' ? 'classification' : 'games';
  const staticMatches = matches.filter((match) => match.editionId === activeEdition?.id && match.discipline === selected);
  const createdTournament = Object.entries(state.tournaments).find(([, item]) => item.created && item.editionId === activeEdition?.id && item.discipline === selected);
  const activeTournament = createdTournament
    ? { id: createdTournament[0], name: createdTournament[1].name ?? 'Disputa da modalidade', phase: createdTournament[1].status }
    : tournaments.find((tournament) => tournament.editionId === activeEdition?.id && tournament.discipline === selected);
  const overviewHref = area === 'admin' ? `/tournaments/${activeTournament?.id}#results` : `/public/tournaments/${activeTournament?.id}#results`;
  const baseHref = area === 'admin' ? '/matches' : '/public/matches';
  const viewTabs = (
    <nav className="content-view-tabs" aria-label="Visualização dos jogos">
      <Link href={`${baseHref}?modalidade=${encodeURIComponent(selected)}`} className={activeView === 'games' ? 'active' : ''} aria-current={activeView === 'games' ? 'page' : undefined}>Jogos</Link>
      <Link href={`${baseHref}?modalidade=${encodeURIComponent(selected)}&visao=classificacao`} className={activeView === 'classification' ? 'active' : ''} aria-current={activeView === 'classification' ? 'page' : undefined}>Classificação</Link>
    </nav>
  );
  const classificationView = activeTournament ? (
    <section className="section-block matches-tournament-overview" aria-label={`Classificação de ${activeTournament.name}`}>
      <div className="section-title-row"><div><p className="eyebrow">MODALIDADE ESCOLHIDA</p><h2>{activeTournament.name}</h2></div><span className="status-badge status-orange">{activeTournament.phase}</span></div>
      <TournamentResults tournamentId={activeTournament.id} discipline={selected} />
      <a href={overviewHref} className="wide-action">VER FASES E DETALHES <span>›</span></a>
      <Link href={area === 'admin' ? '/standings' : '/public/standings/general'} className="wide-action ranking-general-link">VER CLASSIFICAÇÃO GERAL <span>›</span></Link>
    </section>
  ) : <p className="match-filter-empty">Nenhuma disputa publicada para esta modalidade na edição ativa.</p>;

  if (area === 'admin') {
    return <AppShell active="matches" eyebrow={`${activeView === 'games' ? 'AGENDA' : 'CLASSIFICAÇÃO'} · ${selected.toUpperCase()}`} title="JOGOS" subtitle={`Jogos e resultados somente de ${selected}`} actionHref={`/matches/new?modalidade=${encodeURIComponent(selected)}`} actionLabel={`Agendar jogo de ${selected}`} actionPermission="discipline" actionDiscipline={selected}><DisciplineSelector options={options} />{viewTabs}{activeView === 'classification' ? classificationView : <MatchSchedule matches={staticMatches} discipline={selected} />}</AppShell>;
  }

  if (mode === 'live') {
    return <PublicAppShell active="live" eyebrow={`AO VIVO · ${selected.toUpperCase()}`} title="AO VIVO" subtitle={`Placares oficiais somente de ${selected}`}><DisciplineSelector options={options} /><PublicMatchCollection matches={staticMatches} discipline={selected} mode="live" /></PublicAppShell>;
  }

  return <PublicAppShell active="matches" eyebrow={`${activeView === 'games' ? 'PRÓXIMOS' : 'CLASSIFICAÇÃO'} · ${selected.toUpperCase()}`} title="JOGOS" subtitle={`Agenda confirmada de ${selected}`}><DisciplineSelector options={options} />{viewTabs}{activeView === 'classification' ? classificationView : <MatchSchedule matches={staticMatches} discipline={selected} hrefBase="/public/matches" allowedStatuses={['Agendada']} />}</PublicAppShell>;
}
