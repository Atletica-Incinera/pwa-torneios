import { Filter, Search, Shield, Star, Users } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';

const teams = [
  { name: 'Fúria FC', athletes: 18, tier: 'Elite', tone: 'blue', initial: 'F' },
  { name: 'Aliança EC', athletes: 16, tier: 'Elite', tone: 'pink', initial: 'A' },
  { name: 'Guerreiros SC', athletes: 15, tier: 'Ouro', tone: 'orange', initial: 'G' },
  { name: 'Titãs Futebol', athletes: 14, tier: 'Prata', tone: 'blue', initial: 'T' }
];

export default function TeamsPage() {
  return (
    <main className="app-screen teams-screen">
      <header className="mobile-header">
        <div>
          <p className="eyebrow">GESTÃO ESPORTIVA</p>
          <h1>EQUIPES</h1>
          <p>24 equipes cadastradas</p>
        </div>
        <button className="header-action" aria-label="Filtrar equipes"><Filter size={22} /></button>
      </header>

      <label className="search-field cut-field">
        <Search size={20} />
        <input type="search" placeholder="Buscar equipe" aria-label="Buscar equipe" />
      </label>

      <section className="team-list" aria-label="Lista de equipes">
        {teams.map((team) => (
          <article className={'team-card team-' + team.tone} key={team.name}>
            <div className={'team-emblem emblem-' + team.tone}>
              <Shield size={42} strokeWidth={1.8} />
              <strong>{team.initial}</strong>
            </div>
            <div className="team-copy">
              <div className="team-heading-row"><h2>{team.name}</h2><Star size={19} /></div>
              <p><Users size={16} /> {team.athletes} atletas</p>
              <span className={'tier-badge badge-' + team.tone}>{team.tier}</span>
            </div>
            <button className="team-open" aria-label="Abrir equipe">›</button>
          </article>
        ))}
      </section>

      <button className="floating-add" aria-label="Adicionar equipe">+</button>
      <BottomNav active="teams" />
    </main>
  );
}
