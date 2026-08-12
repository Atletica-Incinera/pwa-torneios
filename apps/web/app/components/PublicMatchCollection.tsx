'use client';

import { Radio } from 'lucide-react';
import { StatusBadge } from './AppShell';
import { MatchCard } from './MatchCard';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { isPublicMatch } from '../lib/publication';
import { listMatches } from '../lib/edition-catalog';
import { isLive, isPendingMatch } from '../lib/status';

export function PublicMatchCollection({ discipline, mode }: { discipline?: string; mode: 'live' | 'upcoming' }) {
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const visible = listMatches(state, activeEdition?.id, { discipline })
    // A área pública só mostra jogos de disputas publicadas.
    .filter((match) => isPublicMatch(state, match))
    .filter((match) => (mode === 'live' ? isLive(match.status) : isPendingMatch(match.status)));

  return <>
    {mode === 'live' ? <div className="public-readonly-summary"><Radio size={18} /><strong>{visible.length} {visible.length === 1 ? 'partida' : 'partidas'} ao vivo</strong><StatusBadge tone="orange">AGORA</StatusBadge></div> : null}
    <section className="match-list public-readonly-list" aria-label={mode === 'live' ? 'Partidas ao vivo' : 'Próximas partidas'}>
      {visible.length
        ? visible.map((match) => <MatchCard key={match.id} className={mode === 'live' ? 'public-live-score' : 'public-upcoming-score'} href={`/public/matches/${match.id}`} match={match} />)
        : <p className="match-filter-empty">Nenhum jogo {mode === 'live' ? 'ao vivo' : 'programado'} no momento.</p>}
    </section>
  </>;
}
