import Link from 'next/link';
import { Home, Medal, Radio, Shield, Menu } from 'lucide-react';

type BottomNavProps = {
  active: 'home' | 'tournaments' | 'matches' | 'teams' | 'profile';
};

const items = [
  { key: 'home', label: 'Início', href: '/dashboard', icon: Home, tone: 'orange' },
  { key: 'tournaments', label: 'Torneios', href: '/tournaments', icon: Medal, tone: 'blue' },
  { key: 'matches', label: 'Jogos', href: '/matches?modalidade=Futsal', icon: Radio, tone: 'pink' },
  { key: 'teams', label: 'Equipes', href: '/teams', icon: Shield, tone: 'green' },
  { key: 'profile', label: 'Mais', href: '/more', icon: Menu, tone: 'cream' },
] as const;

export function BottomNav({ active }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
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
            <span className="nav-icon"><Icon size={21} strokeWidth={2.2} /></span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
