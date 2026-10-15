'use client';

import Link from 'next/link';
import { Home, Medal, Radio, Shield, Menu, UserRound, Globe } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { useFrontendSession } from '../lib/frontend-session';
import { teamIdForManager } from '../lib/team-manager';

type NavKey = 'home' | 'tournaments' | 'matches' | 'teams' | 'profile';

type BottomNavProps = {
  active: NavKey;
};

type NavItem = { key: NavKey; label: string; href: string; icon: LucideIcon; tone: string };

/**
 * A barra mostra só o que o perfil consegue abrir.
 *
 * Era uma barra única para todos: o responsável da atlética tocava em quatro
 * das cinco abas e caía em "Acesso restrito", e o gestor de modalidade via
 * "Equipes" e "Mais" que não serviam à tarefa dele no dia de jogo.
 */
function itemsFor(role: string | undefined, scope: string | undefined, selectedDiscipline: string, ownTeamId: string | undefined): NavItem[] {
  if (role === 'TEAM_MANAGER') {
    return [
      { key: 'teams', label: 'Meu time', href: ownTeamId ? `/teams/${ownTeamId}` : '/dashboard', icon: Shield, tone: 'green' },
      { key: 'matches', label: 'Jogos', href: '/public/matches', icon: Globe, tone: 'pink' },
      { key: 'profile', label: 'Conta', href: '/profile', icon: UserRound, tone: 'cream' },
    ];
  }
  if (role === 'DISCIPLINE_MANAGER') {
    const discipline = scope ?? selectedDiscipline;
    return [
      { key: 'home', label: 'Início', href: '/dashboard', icon: Home, tone: 'orange' },
      { key: 'matches', label: 'Jogos', href: `/matches?modalidade=${encodeURIComponent(discipline)}`, icon: Radio, tone: 'pink' },
      // Mesmo nome que o admin vê: o destino é o mesmo, e trocar o rótulo por
      // papel só fazia a mesma tela parecer outra.
      { key: 'tournaments', label: 'Modalidades', href: '/disciplines', icon: Medal, tone: 'blue' },
      { key: 'teams', label: 'Equipes', href: '/teams', icon: Shield, tone: 'green' },
      { key: 'profile', label: 'Conta', href: '/more', icon: UserRound, tone: 'cream' },
    ];
  }
  return [
    { key: 'home', label: 'Início', href: '/dashboard', icon: Home, tone: 'orange' },
    { key: 'tournaments', label: 'Modalidades', href: '/disciplines', icon: Medal, tone: 'blue' },
    { key: 'matches', label: 'Jogos', href: `/matches?modalidade=${encodeURIComponent(selectedDiscipline)}`, icon: Radio, tone: 'pink' },
    { key: 'teams', label: 'Equipes', href: '/teams', icon: Shield, tone: 'green' },
    { key: 'profile', label: 'Gestão', href: '/more', icon: Menu, tone: 'cream' },
  ];
}

export function BottomNav({ active }: BottomNavProps) {
  const { state } = useFrontendState();
  const { session } = useFrontendSession();
  const items = itemsFor(session?.role, session?.scope, state.preferences.selectedDiscipline, teamIdForManager(state, session));
  return (
    <nav className="bottom-nav" aria-label="Navegação principal" data-itens={items.length}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`nav-item nav-${item.tone}${isActive ? ' active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true"><Icon size={21} strokeWidth={2.2} /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
