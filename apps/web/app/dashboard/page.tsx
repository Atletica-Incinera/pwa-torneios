import { Bell, CalendarDays, ChevronRight, Radio, Shield, Trophy, Users } from 'lucide-react';
import { BottomNav } from '../components/BottomNav';

const stats = [
  { label: 'Equipes', value: '24', meta: '+2 esta semana', icon: Shield, tone: 'blue' },
  { label: 'Atletas', value: '384', meta: '+18 esta semana', icon: Users, tone: 'pink' },
  { label: 'Torneios', value: '6', meta: '2 em andamento', icon: Trophy, tone: 'orange' },
  { label: 'Jogos ao vivo', value: '3', meta: 'Agora', icon: Radio, tone: 'blue' },
] as const;

export default function DashboardPage() {
  return (
    <main className="app-screen dashboard-screen">
      <header className="mobile-header">
        <div>
          <p className="eyebrow orange">INTERENG 2026</p>
          <h1>DASHBOARD</h1>
          <p>Visão geral da competição</p>
        </div>
        <button className="header-action" aria-label="Notificações"><Bell size={22} /><span /></button>
      </header>

      <section className="stats-grid" aria-label="Resumo da competição">
        {stats.map(({ label, value, meta, icon: Icon, tone }) => (
          <article className={`stat-card stat-${tone}`} key={label}>
            <div className="stat-icon"><Icon size={24} /></div>
            <strong>{value}</strong>
            <span>{label}</span>
            <small>{meta}</small>
          </article>
        ))}
      </section>

      <section className="section-block">
        <div className="section-title-row">
          <div><p className="eyebrow">PRÓXIMO JOGO</p><h2>HOJE EM QUADRA</h2></div>
          <button className="link-action">Ver todos <ChevronRight size={18} /></button>
        </div>

        <article className="next-match-card">
          <div className="match-date"><CalendarDays size={18} /><span>Hoje • 20:00</span></div>
          <div className="versus-row">
            <div className="team-side"><span className="shield-shape blue-shield">F</span><strong>Fúria FC</strong></div>
            <div className="versus-mark"><span>VS</span><small>Campo 2</small></div>
            <div className="team-side align-right"><span className="shield-shape pink-shield">A</span><strong>Aliança EC</strong></div>
          </div>
        </article>
      </section>

      <section className="section-block compact-list">
        <div className="section-title-row"><div><p className="eyebrow orange">OPERAÇÃO</p><h2>AÇÕES RÁPIDAS</h2></div></div>
        <div className="quick-actions">
          <button className="quick-card"><Shield size={22} /><span>Nova equipe</span></button>
          <button className="quick-card"><Trophy size={22} /><span>Novo torneio</span></button>
          <button className="quick-card live"><Radio size={22} /><span>Abrir placar</span></button>
        </div>
      </section>

      <BottomNav active="home" />
    </main>
  );
}
