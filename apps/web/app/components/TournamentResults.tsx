'use client';

import { ArrowUp, Trophy } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from './AppShell';
import { standings } from '../lib/mock-data';

export function TournamentResults() {
  const [view, setView] = useState<'a' | 'b' | 'bracket'>('a');
  const table = view === 'b' ? [...standings].reverse().map((entry, index) => ({ ...entry, rank: index + 1 })) : standings;

  return (
    <div className="tournament-results-view">
      <div className="filter-strip">
        <button type="button" className={`filter-chip${view === 'a' ? ' active' : ''}`} onClick={() => setView('a')}>Grupo A</button>
        <button type="button" className={`filter-chip${view === 'b' ? ' active' : ''}`} onClick={() => setView('b')}>Grupo B</button>
        <button type="button" className={`filter-chip${view === 'bracket' ? ' active' : ''}`} onClick={() => setView('bracket')}>Chaveamento</button>
      </div>
      {view !== 'bracket' ? <><div className="standings-list" aria-label={`Classificação do Grupo ${view.toUpperCase()}`}><div className="standings-head"><span>#</span><span>Equipe</span><span>J</span><span>V</span><span>E</span><span>D</span><span>PTS</span></div>{table.map((entry) => <article className={`standing-row rank-${entry.rank}`} key={entry.name}><span className="rank-block">{entry.rank}</span><div><strong>{entry.name}</strong><small>{entry.won}V • {entry.drawn}E • {entry.lost}D</small></div><span>{entry.played}</span><span>{entry.won}</span><span>{entry.drawn}</span><span>{entry.lost}</span><strong>{entry.points}</strong></article>)}</div><div className="qualification-note"><Trophy size={20} /><div><strong>2 melhores avançam</strong><p>Desempate: pontos, confronto direto e saldo.</p></div><StatusBadge tone="orange"><ArrowUp size={12} /> Mata-mata</StatusBadge></div></> : <div className="phase-timeline" aria-label="Chaveamento"><article><span>SF1</span><div><small>SEMIFINAL</small><h3>Alcateia × Cangaceiros</h3><p>Hoje • 20:00</p></div><Trophy size={20} /></article><article><span>SF2</span><div><small>SEMIFINAL</small><h3>Caótica × Energizada</h3><p>Hoje • 21:30</p></div><Trophy size={20} /></article><article><span>F</span><div><small>FINAL</small><h3>Vencedor SF1 × Vencedor SF2</h3><p>A definir</p></div><Trophy size={20} /></article></div>}
    </div>
  );
}
