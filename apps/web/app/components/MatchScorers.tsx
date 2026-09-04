'use client';

import { useState } from 'react';
import { Goal } from 'lucide-react';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { useUi } from './UiProvider';
import { eligibleAthletes, findTeamByName } from '../lib/eligibility';
import type { MatchView } from '../lib/edition-catalog';
import type { MatchEventState } from '../lib/frontend-state';

/**
 * Quem marcou, informado depois do jogo.
 *
 * No ginásio a mesa não tem tempo de escolher o autor no meio da partida: o
 * gol entra na hora, e um seletor no caminho do botão de gol vira placar
 * errado toda vez que alguém se distrai. Por isso o gol já entrava sem autor —
 * e ficava sem autor para sempre, porque não havia onde informá-lo depois.
 *
 * Aqui a mesa acerta a artilharia com o jogo terminado e o apito guardado,
 * olhando a lista de lances na ordem em que aconteceram.
 *
 * Só aparece com o jogo encerrado: enquanto está ao vivo, quem atribui é a
 * própria tela do placar, que tem a trava de operador.
 */
export function MatchScorers({ match }: { match: MatchView }) {
  const { state, dispatch } = useFrontendState();
  const { toast } = useUi();
  const [salvando, setSalvando] = useState<string | null>(null);

  const eventos = (state.matches[match.id]?.events ?? []).filter(
    (evento) => (evento.points ?? 0) > 0 && evento.side !== 'neutral',
  );
  if (!eventos.length) return null;

  const elencoDoLado = (side: MatchEventState['side']) => {
    const nomeDaEquipe = side === 'home' ? match.entryA : match.entryB;
    const equipe = findTeamByName(state, nomeDaEquipe ?? '');
    return equipe ? eligibleAthletes(state, equipe.id, match.discipline) : [];
  };

  async function atribuir(evento: MatchEventState, athleteId: string) {
    setSalvando(evento.id);
    try {
      await dispatch({
        type: 'match/attributeEvent',
        payload: { id: match.id, eventId: evento.id, athleteId: athleteId || null },
        audit: {
          action: athleteId ? 'Autor do lance informado' : 'Autor do lance removido',
          entity: `${match.entryA} × ${match.entryB}`,
          after: athleteId ? (state.athletes[athleteId]?.name ?? athleteId) : 'sem autor',
        },
      });
    } catch (falha) {
      toast(falha instanceof Error ? falha.message : 'Não foi possível informar o autor.', 'error');
    } finally {
      setSalvando(null);
    }
  }

  // Em ordem cronológica: é assim que quem estava na mesa lembra do jogo.
  const emOrdem = [...eventos].reverse();
  const semAutor = emOrdem.filter((evento) => !evento.athleteId).length;

  return (
    <section className="section-block match-scorers">
      <div className="info-banner">
        <Goal size={20} aria-hidden="true" />
        <p>
          {semAutor
            ? `${semAutor} ${semAutor === 1 ? 'lance ainda está' : 'lances ainda estão'} sem autor. Informe quem marcou para a artilharia contar.`
            : 'Todos os lances deste jogo já têm autor.'}
        </p>
      </div>
      <ul className="match-scorers-list">
        {emOrdem.map((evento) => {
          const elenco = elencoDoLado(evento.side);
          const equipe = evento.side === 'home' ? match.entryA : match.entryB;
          return (
            <li key={evento.id}>
              <div className="match-scorers-event">
                <strong>{evento.type}</strong>
                <small>
                  {equipe}
                  {evento.points && evento.points > 1 ? ` · ${evento.points} pontos` : ''}
                </small>
              </div>
              <label>
                <span className="sr-only">{`Quem marcou o ${evento.type} de ${equipe}`}</span>
                <select
                  value={evento.athleteId ?? ''}
                  disabled={salvando === evento.id || !elenco.length}
                  onChange={(campo) => void atribuir(evento, campo.target.value)}
                >
                  <option value="">Sem autor</option>
                  {elenco.map((atleta) => (
                    <option key={atleta.id} value={atleta.id}>
                      {atleta.name}
                    </option>
                  ))}
                </select>
              </label>
              {/* Elenco vazio é o caso mais provável de dar errado no dia, e o
                  seletor sozinho não diz o que fazer. */}
              {!elenco.length ? (
                <p className="form-hint">
                  Nenhum atleta do {equipe} está inscrito em {match.discipline}. Inscreva o elenco na
                  tela da equipe para poder creditar o lance.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
