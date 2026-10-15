'use client';

import Link from 'next/link';
import { CalendarDays, ChevronRight, Trophy } from 'lucide-react';
import { PublicAppShell } from './PublicAppShell';
import { PublicMatchCollection } from './PublicMatchCollection';
import { MatchCard } from './MatchCard';
import { SectionTitle, TeamMark } from './AppShell';
import { editionHeading, getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { listCategories, listMatches } from '../lib/edition-catalog';
import { isPublicMatch, isPublicTournamentStatus } from '../lib/publication';
import { isLive, isOfficialResult, isPendingMatch } from '../lib/status';
import { categoryPodium } from '../lib/podium';
import { findTeamByName } from '../lib/eligibility';

const when = (match: { date: string; time: string }) => `${match.date} ${match.time}`;

/**
 * O que está acontecendo agora, em todas as modalidades. Não filtra por
 * modalidade de propósito: quem abre "ao vivo" quer ver o que está rolando.
 *
 * Sem jogo ao vivo, a tela não fica só com "nenhum jogo": mostra o que vem a
 * seguir, o que acabou de terminar e quem já foi campeã. É a primeira tela da
 * área pública, e no intervalo entre jogos ela era uma página vazia.
 */
export function PublicLiveView() {
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const matches = listMatches(state, activeEdition?.id).filter((match) => isPublicMatch(state, match));
  const anyLive = matches.some((match) => isLive(match.status));
  // Jogo em quadra vence o rótulo da edição: se houver bola rolando, é "ao vivo".
  const finished = !anyLive && (activeEdition?.status === 'Finalizada' || activeEdition?.status === 'Arquivada');
  const next = matches.filter((match) => isPendingMatch(match.status)).sort((a, b) => when(a).localeCompare(when(b))).slice(0, 3);
  const latest = matches.filter((match) => isOfficialResult(match.status)).sort((a, b) => when(b).localeCompare(when(a))).slice(0, 3);
  const champions = listCategories(state, activeEdition?.id)
    .filter((category) => isPublicTournamentStatus(category.status))
    .map((category) => ({ category, podium: categoryPodium(state, category.id) }))
    .filter((item): item is { category: typeof item.category; podium: NonNullable<typeof item.podium> } => Boolean(item.podium));

  return (
    <PublicAppShell active="live" eyebrow={editionHeading(state)} title={finished ? 'EDIÇÃO ENCERRADA' : 'AO VIVO'} subtitle={finished ? 'Campeãs e resultados finais' : anyLive ? 'Placares oficiais acontecendo agora' : 'Nenhum jogo em quadra agora'}>
      {anyLive ? <PublicMatchCollection mode="live" /> : null}

      {!anyLive && next.length ? <section className="section-block public-priority-section">
        <SectionTitle eyebrow="A seguir" title="PRÓXIMOS JOGOS" />
        <div className="match-list public-readonly-list">{next.map((match) => <MatchCard key={match.id} className="public-upcoming-score" href={`/public/matches/${match.id}`} match={match} />)}</div>
        <Link href="/public/matches" className="wide-action"><CalendarDays size={18} /> AGENDA COMPLETA <span>›</span></Link>
      </section> : null}

      {champions.length ? <section className="section-block public-priority-section">
        <SectionTitle eyebrow={`${champions.length} ${champions.length === 1 ? 'categoria decidida' : 'categorias decididas'}`} title="CAMPEÃS" />
        <ul className="champions-list">
          {champions.map(({ category, podium }) => (
            <li key={category.id}>
              <Link href={`/public/tournaments/${category.id}`}>
                <TeamMark initial={podium.champion[0]} tone="blue" logo={findTeamByName(state, podium.champion)?.logo} />
                <span><small>{category.name}</small><strong>{podium.champion}</strong></span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section> : null}

      {!anyLive && latest.length ? <section className="section-block public-priority-section">
        <SectionTitle eyebrow="Encerrados" title="ÚLTIMOS RESULTADOS" />
        <div className="match-list public-readonly-list">{latest.map((match) => <MatchCard key={match.id} className="public-result-score" href={`/public/matches/${match.id}`} match={match} />)}</div>
      </section> : null}

      {!anyLive && !next.length && !latest.length ? <p className="match-filter-empty">A agenda desta edição ainda não foi publicada.</p> : null}

      <Link href="/public/tournaments" className="wide-action"><Trophy size={18} /> TODAS AS MODALIDADES <span>›</span></Link>
    </PublicAppShell>
  );
}
