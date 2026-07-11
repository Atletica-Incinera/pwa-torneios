'use client';

import { useMemo, useState } from 'react';
import { CircleDot, Clock3, Flag, Goal, Pause, Play, RotateCcw, Square, TimerReset } from 'lucide-react';
import { BottomNav } from '../../components/BottomNav';

type EventTone = 'blue' | 'pink' | 'orange';
type MatchEvent = { minute: string; title: string; detail: string; tone: EventTone };

const initialEvents: MatchEvent[] = [
  { minute: "72'", title: 'Gol', detail: 'Fúria FC • Lucas M.', tone: 'blue' },
  { minute: "65'", title: 'Gol', detail: 'Aliança EC • Pedro H.', tone: 'pink' },
  { minute: "58'", title: 'Cartão amarelo', detail: 'Aliança EC • Rafael S.', tone: 'orange' },
];

export default function LiveMatchPage() {
  const [homeScore, setHomeScore] = useState(2);
  const [awayScore, setAwayScore] = useState(1);
  const [paused, setPaused] = useState(false);
  const [events, setEvents] = useState<MatchEvent[]>(initialEvents);
  const [impact, setImpact] = useState<EventTone | null>(null);
  const [toast, setToast] = useState('');

  const statusLabel = paused ? 'PAUSADA' : 'AO VIVO';
  const latestMinute = useMemo(() => "73'", []);

  function triggerImpact(tone: EventTone, message: string) {
    setImpact(tone);
    setToast(message);
    window.setTimeout(() => setImpact(null), 650);
    window.setTimeout(() => setToast(''), 1800);
  }

  function registerEvent(title: string, detail: string, tone: EventTone) {
    const event = { minute: latestMinute, title, detail, tone };
    setEvents((current) => [event, ...current]);
    triggerImpact(tone, `${title.toUpperCase()} REGISTRADO`);
  }

  function registerHomeGoal() {
    setHomeScore((score) => score + 1);
    registerEvent('Gol', 'Fúria FC • Novo evento', 'blue');
  }

  function registerAwayPoint() {
    setAwayScore((score) => score + 1);
    registerEvent('Ponto', 'Aliança EC • Novo evento', 'pink');
  }

  return (
    <main className={`app-screen live-screen ${paused ? 'is-paused' : ''}`}>
      <div className={`diagonal-impact impact-${impact ?? 'none'}`} aria-hidden="true" />
      {toast && <div className={`sport-toast toast-${impact ?? 'blue'}`}>{toast}</div>}

      <header className="live-topbar motion-enter motion-delay-1">
        <div>
          <p className="eyebrow orange">CAMPEONATO INTERLIGAS</p>
          <h1>SEMIFINAL</h1>
        </div>
        <span className={`live-status ${paused ? 'paused' : ''}`}><i /> {statusLabel}</span>
      </header>

      <section className={`score-hero motion-enter motion-delay-2 ${impact ? `score-impact-${impact}` : ''}`}>
        <div className="score-team score-team-blue">
          <span className="shield-shape blue-shield">F</span>
          <strong>Fúria FC</strong>
        </div>
        <div className="score-center">
          <div className="score-numbers">
            <strong className={`score-blue ${impact === 'blue' ? 'score-pop' : ''}`}>{homeScore}</strong>
            <span>—</span>
            <strong className={`score-pink ${impact === 'pink' ? 'score-pop' : ''}`}>{awayScore}</strong>
          </div>
          <div className="game-clock"><Clock3 size={19} />72:45</div>
        </div>
        <div className="score-team score-team-pink">
          <span className="shield-shape pink-shield">A</span>
          <strong>Aliança EC</strong>
        </div>
      </section>

      <section className="event-actions motion-enter motion-delay-3" aria-label="Ações rápidas">
        <button className="event-btn blue sport-press" onClick={registerHomeGoal} disabled={paused}><Goal size={25} /><span>Gol</span></button>
        <button className="event-btn pink sport-press" onClick={registerAwayPoint} disabled={paused}><CircleDot size={25} /><span>Ponto</span></button>
        <button className="event-btn orange sport-press" onClick={() => registerEvent('Falta', 'Fúria FC • Novo evento', 'orange')} disabled={paused}><Flag size={25} /><span>Falta</span></button>
        <button className="event-btn neutral sport-press" onClick={() => registerEvent('Cartão', 'Aliança EC • Novo evento', 'orange')} disabled={paused}><Square size={24} /><span>Cartão</span></button>
      </section>

      <section className="match-controls motion-enter motion-delay-4">
        <button className="sport-press" onClick={() => setPaused((value) => !value)}>{paused ? <Play size={19} /> : <Pause size={19} />}{paused ? 'Retomar' : 'Pausar'}</button>
        <button className="sport-press"><RotateCcw size={19} />Desfazer</button>
        <button className="finish sport-press"><TimerReset size={19} />Encerrar</button>
      </section>

      <section className="timeline-block motion-enter motion-delay-5">
        <div className="section-title-row"><div><p className="eyebrow">PARTIDA</p><h2>EVENTOS</h2></div></div>
        <div className="event-timeline">
          {events.map((event, index) => (
            <article className={`timeline-item ${index === 0 ? 'timeline-new' : ''}`} key={`${event.minute}-${event.title}-${index}`}>
              <span className={`timeline-minute minute-${event.tone}`}>{event.minute}</span>
              <div><strong>{event.title}</strong><p>{event.detail}</p></div>
            </article>
          ))}
        </div>
      </section>

      <BottomNav active="matches" />
    </main>
  );
}
