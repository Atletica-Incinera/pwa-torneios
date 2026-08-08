'use client';

import Link from 'next/link';
import { Pencil, Radio } from 'lucide-react';
import { MatchSummary } from './MatchSummary';
import { useFrontendState } from '../lib/frontend-state';

type MatchBase = { id: string; phase: string; status: string; entryA: string; logoA: string; entryB: string; logoB: string; scoreA: number | null; scoreB: number | null; date: string; time: string; venue: string };

export function MatchDetailClient({ match, readOnly = false }: { match: MatchBase; readOnly?: boolean }) {
  const { state } = useFrontendState();
  const override = state.matches[match.id] ?? {};
  const current = { ...match, ...override, scoreA: override.scoreA ?? match.scoreA, scoreB: override.scoreB ?? match.scoreB };
  const operable = !['Encerrada', 'Cancelada', 'W.O.'].includes(current.status);
  return <><MatchSummary match={current} />{!readOnly ? <div className="form-actions match-detail-actions"><Link href={`/matches/${match.id}/manage`} className="secondary-button"><Pencil size={17} /> Editar partida</Link>{operable ? <Link href={`/matches/live?partida=${match.id}`} className="primary-button"><Radio size={17} /> {current.status === 'Ao vivo' ? 'Continuar placar' : 'Iniciar partida'}</Link> : null}</div> : null}{override.reason ? <div className="info-banner"><p><strong>Motivo:</strong> {override.reason}</p></div> : null}</>;
}
