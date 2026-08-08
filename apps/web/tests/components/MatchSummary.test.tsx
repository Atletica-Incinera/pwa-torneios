import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MatchSummary } from '../../app/components/MatchSummary';

describe('MatchSummary', () => {
  it('apresenta modalidade visual, placar, equipes, data e local', () => {
    render(<MatchSummary match={{ phase: 'Semifinal', status: 'Encerrada', entryA: 'Alcateia', logoA: '/teams/alcateia.webp', entryB: 'Cangaceiros', logoB: '/teams/cangaceiros.webp', scoreA: 2, scoreB: 1, date: '2026-10-13', time: '20:00', venue: 'Ginásio CIn' }} />);
    expect(screen.getByRole('region', { name: /resumo da partida/i })).toBeInTheDocument();
    expect(screen.getByText('Alcateia')).toBeInTheDocument();
    expect(screen.getByText('Cangaceiros')).toBeInTheDocument();
    expect(screen.getByText('2 — 1')).toBeInTheDocument();
    expect(screen.getByText('Ginásio CIn')).toBeInTheDocument();
    expect(screen.getByText('Encerrado')).toBeInTheDocument();
  });

  it('usa confronto sem placar quando a partida ainda não começou', () => {
    render(<MatchSummary match={{ phase: 'Grupo A', status: 'Agendada', entryA: 'Equipe com nome extenso', logoA: '', entryB: 'Outra equipe', logoB: '', scoreA: null, scoreB: null, date: '2026-10-14', time: '09:00', venue: 'Quadra 1' }} />);
    expect(screen.getByText('×')).toBeInTheDocument();
    expect(screen.getByText('Próximo')).toBeInTheDocument();
  });
});
