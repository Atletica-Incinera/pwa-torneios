import type { MatchState, TournamentState } from './frontend-state.ts';
import { roundName } from './bracket-view.ts';

const settled: ReadonlyArray<MatchState['status']> = ['Encerrada', 'W.O.', 'Cancelada'];

/**
 * Em que ponto a categoria está, para o selo do card e o subtítulo da página.
 *
 * Antes era sempre o nome da primeira fase: uma categoria com campeã definida
 * continuava dizendo "Fase de grupos". A fase atual é a do primeiro jogo ainda
 * pendente, na ordem das fases; no mata-mata, o nome da rodada.
 */
export function currentPhaseLabel(
  setup: Pick<TournamentState, 'status' | 'phases' | 'generated'>,
  matches: ReadonlyArray<[string, Pick<MatchState, 'status' | 'phase'>]>,
) {
  if (setup.status === 'Encerrado') return 'Encerrada';
  if (setup.status === 'Arquivado') return 'Arquivada';
  // Os jogos decidem, não a marca de "gerado": em 2026 várias categorias tiveram
  // a agenda montada jogo a jogo, sem passar pela geração, e o selo dizia
  // "Jogos a gerar" sobre dezenas de jogos já disputados.
  if (!matches.length) return setup.phases.length ? 'Jogos a gerar' : 'Configuração';
  const pending = matches.filter(([, match]) => !settled.includes(match.status ?? 'Agendada'));
  if (!pending.length) return 'Jogos encerrados';
  const knockout = pending.filter(([id]) => id.includes('-advanced-'));
  const regular = pending.filter(([id]) => !id.includes('-advanced-'));
  if (regular.length) {
    const order = (name?: string) => {
      const index = setup.phases.findIndex((phase) => phase.name === name);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    const first = [...regular].sort(([, a], [, b]) => order(a.phase) - order(b.phase))[0][1];
    return first.phase ?? setup.phases[0]?.name ?? 'Fase atual';
  }
  const rounds = knockout.map(([id]) => Number(id.match(/-advanced-r(\d+)-/)?.[1] ?? 0)).filter(Boolean);
  if (!rounds.length) return 'Disputa de 3º lugar';
  const round = Math.min(...rounds);
  const size = matches.filter(([id]) => new RegExp(`-advanced-r${round}-\\d+$`).test(id)).length;
  return roundName(size);
}

/**
 * Uma linha que descreve a fase: como se joga e quantas avançam.
 * Liga não tem grupos e não é "eliminação simples"; e "avançam N" só faz
 * sentido quando existe uma fase depois desta.
 */
export function phaseSummary(phase: Pick<TournamentState['phases'][number], 'format' | 'groups' | 'qualifiers'>, hasNext: boolean) {
  const how = phase.format === 'Mata-mata'
    ? 'Eliminação simples'
    : phase.format === 'Liga'
      ? 'Todos contra todos'
      : phase.groups.length === 1 ? `Grupo único · ${phase.groups[0]}` : `${phase.groups.length} grupos · ${phase.groups.join(', ')}`;
  const advance = hasNext && phase.format !== 'Mata-mata' && phase.qualifiers > 0
    ? ` · ${phase.qualifiers === 1 ? 'avança 1' : `avançam ${phase.qualifiers}`}${phase.format === 'Grupos' && phase.groups.length > 1 ? ' por grupo' : ''}`
    : '';
  return how + advance;
}
