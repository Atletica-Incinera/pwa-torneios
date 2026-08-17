'use client';

import { ShieldCheck } from 'lucide-react';
import { activeScopeOf, canSwitchScope, scopeLabel, sessionScopes, switchScope, useFrontendSession, type SessionScope } from '../lib/frontend-session';

/**
 * Com qual acesso a pessoa está atuando neste aparelho.
 *
 * Fica no perfil, ao lado das notificações, porque é da mesma natureza:
 * preferência do aparelho, não operação da edição — não vai ao servidor e não
 * entra na auditoria. A barra de contexto do topo foi descartada de propósito:
 * lá se escolhe **o que se está vendo** (a edição), e um seletor de identidade
 * no mesmo lugar sugeriria que trocar de papel troca a edição de todo mundo.
 *
 * Com um acesso só não há seletor: a mesma linha de sempre, sem botão que não
 * leva a lugar nenhum.
 */
export function ScopeSwitcher({ editionFallback }: { editionFallback?: string }) {
  const { session } = useFrontendSession();
  const scopes = sessionScopes(session);
  const ativo = activeScopeOf(session);
  if (!session || !ativo) return null;

  const contexto = (scope: SessionScope) => {
    if (scope.role === 'SUPER_ADMIN') return 'Todas as edições';
    return scope.editionName ?? editionFallback ?? 'Edição ativa';
  };

  if (!canSwitchScope(session)) {
    return <div className="detail-card"><div><ShieldCheck size={22} /><span><small>{contexto(ativo)}</small><strong>{scopeLabel(ativo)}</strong></span></div></div>;
  }

  return (
    <div className="module-list" role="group" aria-label="Meus acessos">
      {scopes.map((scope) => {
        const atual = scope.id === ativo.id;
        return (
          <button
            type="button"
            key={scope.id}
            className={`scope-option${atual ? ' active' : ''}`}
            aria-pressed={atual}
            onClick={() => { if (!atual) switchScope(scope.id); }}
          >
            <span><ShieldCheck size={21} /></span>
            <div><strong>{scopeLabel(scope)}</strong><small>{contexto(scope)}{atual ? ' · EM USO' : ''}</small></div>
            <b aria-hidden>{atual ? '✓' : '›'}</b>
          </button>
        );
      })}
    </div>
  );
}
