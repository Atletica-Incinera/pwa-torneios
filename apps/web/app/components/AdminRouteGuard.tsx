'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { clearFrontendSession, useFrontendSession } from '../lib/frontend-session';
import { useFrontendState } from '../lib/frontend-state';

const editionAdminPrefixes = ['/competitions', '/disciplines', '/staff', '/audit', '/athletes', '/teams/new', '/tournaments/new'];
export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const pathname = usePathname(); const { session, hydrated } = useFrontendSession(); const { state, hydrated: stateHydrated } = useFrontendState();
  const revoked = Boolean(session?.email && state.staff[session.email]?.revoked);
  const rosterCreation = /^\/teams\/[^/]+\/athletes\/new$/.test(pathname);
  const forbidden = session?.role === 'DISCIPLINE_MANAGER' && (rosterCreation || editionAdminPrefixes.some((prefix) => pathname.startsWith(prefix)));
  useEffect(() => {
    if (!hydrated || !stateHydrated) return;
    if (revoked) { clearFrontendSession(); router.replace('/?access=revoked'); return; }
    if (!session) router.replace(`/?redirect=${encodeURIComponent(pathname)}`);
  }, [hydrated, pathname, revoked, router, session, stateHydrated]);
  if (!hydrated || !stateHydrated || !session || revoked) return <main className="app-screen global-state-screen" aria-busy="true"><span className="loading-mark">26</span><p>VALIDANDO ACESSO</p><span className="loading-line" /></main>;
  if (forbidden) return <main className="app-screen global-state-screen"><ShieldAlert size={44} /><h1>ACESSO RESTRITO</h1><p>Seu papel permite operar apenas a modalidade {session.scope}.</p><button type="button" className="primary-button" onClick={() => router.replace(`/matches?modalidade=${encodeURIComponent(session.scope ?? 'Futsal')}`)}>Ir para minha modalidade</button></main>;
  return children;
}
