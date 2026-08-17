'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { activeScopeOf, canReadAudit, canSwitchScope, clearFrontendSession, useFrontendSession } from '../lib/frontend-session';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { ErrorScreen } from './ErrorScreen';

// O gestor cria e edita dentro da sua modalidade — inclusive categoria.
// Fica de fora o que pertence à edição inteira: contexto, cadastro de equipe e
// atleta, staff e a criação de uma nova modalidade.
const editionAdminPrefixes = ['/competitions', '/disciplines/new', '/staff', '/athletes', '/teams/new'];
export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const pathname = usePathname(); const { session, hydrated, expired } = useFrontendSession(); const { state, hydrated: stateHydrated, status, error, refresh } = useFrontendState();
  const revoked = Boolean(session?.email && state.staff[session.email]?.revoked);
  const rosterCreation = /^\/teams\/[^/]+\/athletes\/new$/.test(pathname);
  /**
   * Quem decide a rota é o **escopo em uso**, não a soma dos acessos.
   *
   * Quem é admin de uma edição e gestor de uma modalidade de outra não pode
   * entrar em /staff enquanto está atuando como gestor: a tela mostraria a
   * edição que está aberta, e o servidor recusaria cada escrita. Por isso a
   * restrição também oferece a troca, em vez de só barrar.
   */
  const escopo = activeScopeOf(session);
  const gestorDeModalidade = escopo?.role === 'DISCIPLINE_MANAGER';
  const forbidden = (gestorDeModalidade && (rosterCreation || editionAdminPrefixes.some((prefix) => pathname.startsWith(prefix))))
    // A auditoria é do super admin: nem o organizador entra.
    || (pathname.startsWith('/audit') && Boolean(session) && !canReadAudit(session));
  // Quem decide o acesso é a sessão, e ela não depende dos dados chegarem: uma
  // sessão vencida precisa levar ao login mesmo que a edição não tenha carregado
  // — foi justamente ela que fez o servidor recusar a requisição.
  useEffect(() => {
    if (!hydrated) return;
    // Prazo vencido ou 401: quem estava dentro precisa saber por quê.
    if (expired) { router.replace('/?access=expired'); return; }
    if (!session) { router.replace(`/?redirect=${encodeURIComponent(pathname)}`); return; }
    if (stateHydrated && revoked) { clearFrontendSession(); router.replace('/?access=revoked'); }
  }, [expired, hydrated, pathname, revoked, router, session, stateHydrated]);
  if (!hydrated || expired || !session || revoked) return <main className="app-screen global-state-screen" aria-busy="true"><span className="loading-mark">26</span><p>VALIDANDO ACESSO</p><span className="loading-line" /></main>;
  // Com acesso em ordem, o que falta são os dados: a tela oferece nova tentativa.
  if (status === 'error') return <ErrorScreen message={error} onRetry={() => void refresh()} />;
  if (!stateHydrated) return <main className="app-screen global-state-screen" aria-busy="true"><span className="loading-mark">26</span><p>VALIDANDO ACESSO</p><span className="loading-line" /></main>;
  if (forbidden) return <main className="app-screen global-state-screen"><ShieldAlert size={44} /><h1>ACESSO RESTRITO</h1><p>{gestorDeModalidade ? `O acesso em uso permite operar apenas a modalidade ${escopo?.discipline ?? session.scope}.` : 'Esta área é exclusiva do super administrador do app.'}</p><div className="form-actions"><button type="button" className="primary-button" onClick={() => router.replace(gestorDeModalidade ? `/matches?modalidade=${encodeURIComponent(escopo?.discipline ?? session.scope ?? 'Futsal')}` : '/dashboard')}>{gestorDeModalidade ? 'Ir para minha modalidade' : 'Voltar ao início'}</button>{canSwitchScope(session) ? <button type="button" className="secondary-button" onClick={() => router.push('/profile')}>Trocar de acesso</button> : null}</div></main>;
  return children;
}
