import Link from 'next/link';
import { Home, Medal, Radio, Shield, UserRound } from 'lucide-react';

type BottomNavProps = {
  active: 'home' | 'tournaments' | 'matches' | 'teams' | 'profile';
};

const items = [
  { key: 'home', label: 'Início', href: '/dashboard', icon: Home },
  { key: 'tournaments', label: 'Torneios', href: '/tournaments', icon: Medal },
  { key: 'matches', label: 'Jogos', href: '/matches/live', icon: Radio },
  { key: 'teams', label: 'Equipes', href: '/teams', icon: Shield },
  { key: 'profile', label: 'Perfil', href: '/profile', icon: UserRound },
] as const;

export function BottomNav({ active }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.key;

        return (
          <Link key={item.key} href={item.href} className={isActive ? 'nav-item active' : 'nav-item'}>
            <span className="nav-icon"><Icon size={21} strokeWidth={2.2} /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
