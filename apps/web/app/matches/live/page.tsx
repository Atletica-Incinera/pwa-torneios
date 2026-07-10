import { CircleDot, Clock3, Flag, Goal, Pause, RotateCcw, Square, TimerReset } from 'lucide-react';
import { BottomNav } from '../../components/BottomNav';

const events = [
  { minute: "72'", title: 'Gol', detail: 'Fúria FC • Lucas M.', tone: 'blue' },
  { minute: "65'", title: 'Gol', detail: 'Aliança EC • Pedro H.', tone: 'pink' },
  { minute: "58'", title: 'Cartão amarelo', detail: 'Aliança EC • Rafael S.', tone: 'orange' }
];

export default function LiveMatchPage() {
  return (
    <main className="app-screen live-screen">
      <header className="live-topbar">
        <div>
          <p className="eyebrow orange">CAMPEONATO INTERLIGAS</p>
          <h1>SEMIFINAL</h1>
        </div>
        <span className="live-status"><i /> AO VIVO</span>
      </header>

      <section className="score-hero">
        <div className="score-team score-team-blue">
          <span className="shield-shape blue-shield">F</span>
          <strong>Fúria FC</strong>
        </div>
        <div className="score-center">
          <div className="score-numbers"><strong className="score-blue">2</strong><span>—</span><strong className="score-pink">1</strong></div>
          <div className="game-clock"><Clock3 size={19} />72:45</div>
        </div>
        <div className="score-team score-team-pink">
          <span className="shield-shape pink-shield">A</span>
          <strong>Aliança EC</strong>
        </div>
      </section>

      <section className="event-actions" aria-label="Ações rápidas">
        <button className="event-btn blue"><Goal size={25} /><span>Gol</span></button>
        <button className="event-btn pink"><CircleDot size={25} /><span>Ponto</span></button>
        <button className="event-btn orange"><Flag size={25} /><span>Falta</span></button>
        <button className="event-btn neutral"><Square size={24} /><span>Cartão</span></button>
      </section>

      <section className="match-controls">
        <button><Pause size={19} />Pausar</button>
        <button><RotateCcw size={19} />Desfazer</button>
        <button className="finish"><TimerReset size={19} />Encerrar</button>
      </section>

      <section className="timeline-block">
        <div className="section-title-row"><div><p className="eyebrow">PARTIDA</p><h2>EVENTOS</h2></div></div>
        <div className="event-timeline">
          {events.map((event) => (
            <article className="timeline-item" key={event.minute + event.title}>
              <span className={'timeline-minute minute-' + event.tone}>{event.minute}</span>
              <div><strong>{event.title}</strong><p>{event.detail}</p></div>
            </article>
          ))}
        </div>
      </section>

      <BottomNav active="matches" />
    </main>
  );
}
