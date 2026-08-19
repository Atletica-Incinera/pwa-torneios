import Link from 'next/link';
import { Users } from 'lucide-react';
import { StatusBadge } from './AppShell';
import { tournamentStatus } from '../lib/status';

type TournamentCardProps = { tournament: { id: string; name: string; discipline: string; status?: string; phase: string; entries: number | null; progress: number; tone: 'blue' | 'pink' | 'orange' }; index: number; detailHref: string; resultsHref: string; publicView?: boolean };

/**
 * O selo do card mostrava sempre `phases[0].name`, que é a primeira fase
 * configurada e não muda nunca: rascunho, publicada e encerrada ficavam
 * idênticas na lista. Quem organiza precisa ver, daqui, o que falta publicar e
 * o que já acabou — é a tela onde a progressão deveria estar visível.
 *
 * Na área pública o status não é assunto do espectador: lá vale a fase.
 */
const statusTone: Record<string, 'blue' | 'pink' | 'orange'> = {
  [tournamentStatus.draft]: 'blue',
  [tournamentStatus.published]: 'orange',
  [tournamentStatus.running]: 'pink',
  [tournamentStatus.closed]: 'blue',
  [tournamentStatus.archived]: 'blue',
};

export function TournamentCard({ tournament, index, detailHref, resultsHref, publicView = false }: TournamentCardProps) {
  const showStatus = !publicView && Boolean(tournament.status);
  return <article className={`tournament-card tournament-${tournament.tone}${publicView ? ' public-static-card' : ''}`}><Link href={detailHref} className={`tournament-card-link${publicView ? ' public-competition-link' : ''}`}><span className="tournament-number">{String(index + 1).padStart(2, '0')}</span><div className="tournament-main"><div className="tournament-meta"><span>{tournament.discipline}</span>{showStatus ? <StatusBadge tone={statusTone[tournament.status!] ?? 'blue'}>{tournament.status}</StatusBadge> : null}<StatusBadge tone={tournament.tone}>{tournament.phase}</StatusBadge></div><h2>{tournament.name}</h2><div className="tournament-facts"><span><Users size={15} /> {tournament.entries === null ? 'Inscrição pendente' : `${tournament.entries} ${tournament.entries === 1 ? 'inscrita' : 'inscritas'}`}</span></div><div className="progress-track"><i style={{ width: `${tournament.progress}%` }} /></div></div><span className="poster-arrow" aria-hidden="true">→</span></Link><Link href={resultsHref} className="tournament-results-link">Acompanhar resultados <span aria-hidden="true">→</span></Link></article>;
}
