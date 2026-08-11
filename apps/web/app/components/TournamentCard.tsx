import Link from 'next/link';
import { Users } from 'lucide-react';
import { StatusBadge } from './AppShell';

type TournamentCardProps = { tournament: { id: string; name: string; discipline: string; phase: string; entries: number | null; progress: number; tone: 'blue' | 'pink' | 'orange' }; index: number; detailHref: string; resultsHref: string; publicView?: boolean };

export function TournamentCard({ tournament, index, detailHref, resultsHref, publicView = false }: TournamentCardProps) {
  return <article className={`tournament-card tournament-${tournament.tone}${publicView ? ' public-static-card' : ''}`}><Link href={detailHref} className={`tournament-card-link${publicView ? ' public-competition-link' : ''}`}><span className="tournament-number">{String(index + 1).padStart(2, '0')}</span><div className="tournament-main"><div className="tournament-meta"><span>{tournament.discipline}</span><StatusBadge tone={tournament.tone}>{tournament.phase}</StatusBadge></div><h2>{tournament.name}</h2><div className="tournament-facts"><span><Users size={15} /> {tournament.entries === null ? 'Inscrição pendente' : `${tournament.entries} ${tournament.entries === 1 ? 'inscrita' : 'inscritas'}`}</span></div><div className="progress-track"><i style={{ width: `${tournament.progress}%` }} /></div></div><span className="poster-arrow" aria-hidden="true">→</span></Link><Link href={resultsHref} className="tournament-results-link">Acompanhar resultados <span aria-hidden="true">→</span></Link></article>;
}
