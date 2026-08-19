'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { canReadAudit, clearFrontendSession, isSuperAdmin, mustChangePassword, useFrontendSession } from '../lib/frontend-session';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { ErrorScreen } from './ErrorScreen';
import { PasswordChangeScreen } from './PasswordChangeForm';

// O gestor cria e edita dentro da sua modalidade — inclusive categoria.
// Fica de fora o que pertence à edição inteira: contexto, cadastro de equipe e
// atleta, staff e a criação de uma nova modalidade.
const editionAdminPrefixes = ['/competitions', '/disciplines/new', '/staff', '/athletes', '/teams/new'];
// Super admin é flag global da conta, sem escopo de edição — nem o admin da
// edição concede. O backend já recusa (staff/promoteSuperAdmin é ação
// global), mas sem bloquear aqui a pessoa preenche o formulário inteiro só
// para receber um erro genérico no fim.
const superAdminOnlyPrefixes = ['/staff/promote'];
export function AdminRouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter(); const pathname = usePathname(); const { session, hydrated, expired } = useFrontendSession(); const { state, hydrated: stateHydrated, status, error, refresh } = useFrontendState();
  const matchingStaffRoles = session?.email ? Object.values(state.staff).filter((member) => (
    member.email === session.email
    && (session.role === 'DISCIPLINE_MANAGER' ? member.role === 'Gestor de modalidade' && member.scope === session.scope : member.role === 'Admin da edição')
  )) : [];
  // Revogação é estado de papel de edição e não alcança a flag global da conta:
  // um super admin que também tem um card "Admin da edição" revogado era
  // expulso do app inteiro por ele.
  const revoked = !isSuperAdmin(session) && matchingStaffRoles.length > 0 && matchingStaffRoles.every((member) => member.revoked);
  const rosterCreation = /^\/teams\/[^/]+\/athletes\/new$/.test(pathname);
  const forbidden = (session?.role === 'DISCIPLINE_MANAGER' && (rosterCreation || editionAdminPrefixes.some((prefix) => pathname.startsWith(prefix))))
    // A auditoria é do super admin: nem o organizador entra.
    || (pathname.startsWith('/audit') && Boolean(session) && !canReadAudit(session))
    || (superAdminOnlyPrefixes.some((prefix) => pathname.startsWith(prefix)) && Boolean(session) && !isSuperAdmin(session));
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
  // Antes de qualquer checagem que dependa dos dados: com a senha inicial ainda
  // em uso a API recusa o snapshot com 403, e a tela de erro de carregamento
  // esconderia o único caminho que a pessoa tem — trocar a senha.
  if (mustChangePassword(session)) return <PasswordChangeScreen email={session.email} />;
  // Com acesso em ordem, o que falta são os dados: a tela oferece nova tentativa.
  if (status === 'error') return <ErrorScreen message={error} onRetry={() => void refresh()} />;
  if (!stateHydrated) return <main className="app-screen global-state-screen" aria-busy="true"><span className="loading-mark">26</span><p>VALIDANDO ACESSO</p><span className="loading-line" /></main>;
  if (forbidden) return <main className="app-screen global-state-screen"><ShieldAlert size={44} /><h1>ACESSO RESTRITO</h1><p>{session.role === 'DISCIPLINE_MANAGER' ? `Seu papel permite operar apenas a modalidade ${session.scope}.` : 'Esta área é exclusiva do super administrador do app.'}</p><button type="button" className="primary-button" onClick={() => router.replace(session.role === 'DISCIPLINE_MANAGER' ? `/matches?modalidade=${encodeURIComponent(session.scope ?? 'Futsal')}` : '/dashboard')}>{session.role === 'DISCIPLINE_MANAGER' ? 'Ir para minha modalidade' : 'Voltar ao início'}</button></main>;
  return children;
}
