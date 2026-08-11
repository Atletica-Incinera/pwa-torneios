'use client';

import Link from 'next/link';
import { canManageDiscipline, useFrontendSession } from '../lib/frontend-session';

export function TournamentManageLink({ id, discipline }: { id: string; discipline: string }) {
  const { session } = useFrontendSession();
  if (!canManageDiscipline(session, discipline)) return null;
  return <Link href={`/tournaments/${id}?aba=regras`} className="wide-action">GERENCIAR PARTICIPANTES E FASES <span>›</span></Link>;
}
