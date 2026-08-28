import type { FrontendState } from './frontend-state';
import { findTeamByName, listMatches } from './edition-catalog';

/**
 * Artilharia da edição, a partir dos lances já registrados.
 *
 * Somar aqui, e não guardar um contador, é o que mantém a conta certa quando a
 * mesa desfaz um lance ou a organização retifica um resultado: o evento some
 * da partida e o artilheiro perde o gol junto, sem ninguém precisar lembrar de
 * decrementar nada.
 *
 * Só conta lance que pontua e que tem autor. Gol sem autor informado não vira
 * um artilheiro "Desconhecido" na lista — vira a diferença entre o total de
 * gols da modalidade e a soma da artilharia, que é exatamente o que se quer
 * enxergar para saber se a mesa está anotando.
 */
export type Artilheiro = {
  athleteId: string;
  nome: string;
  teamId: string;
  equipe: string;
  logo?: string;
  gols: number;
  partidas: number;
  modalidade: string;
};

export type ArtilhariaDaModalidade = {
  modalidade: string;
  /** Nome do evento que pontua, conforme o regulamento: "Gol", "Ponto", "Cesta". */
  rotuloDoLance: string;
  artilheiros: Artilheiro[];
  /** Lances que pontuaram sem autor informado. A lacuna fica visível de propósito. */
  semAutor: number;
  totalDeLances: number;
};

type EstadoNecessario = Pick<FrontendState, 'matches' | 'athletes' | 'teams' | 'disciplines'>;

/**
 * Um lance conta como "gol" quando alterou o placar. `points` vem do
 * regulamento, então uma cesta de 3 no basquete conta como um lance de 3
 * pontos — e a artilharia soma PONTOS, não ocorrências, para não empatar um
 * jogador de 3 com um de 1.
 */
export function artilhariaPorModalidade(
  state: EstadoNecessario,
  opcoes: { editionId?: string; modalidades?: string[] } = {},
): ArtilhariaDaModalidade[] {
  const partidas = listMatches(state, opcoes.editionId);
  const porModalidade = new Map<string, ArtilhariaDaModalidade>();
  const partidasPorAtleta = new Map<string, Set<string>>();

  for (const partida of partidas) {
    const modalidade = partida.discipline;
    if (!modalidade) continue;
    if (opcoes.modalidades?.length && !opcoes.modalidades.includes(modalidade)) continue;

    const eventos = state.matches[partida.id]?.events ?? [];
    for (const evento of eventos) {
      const pontos = evento.points ?? 0;
      if (pontos <= 0) continue;

      const agregado = porModalidade.get(modalidade) ?? {
        modalidade,
        rotuloDoLance: evento.type,
        artilheiros: [],
        semAutor: 0,
        totalDeLances: 0,
      };
      agregado.totalDeLances += pontos;

      if (!evento.athleteId) {
        agregado.semAutor += pontos;
        porModalidade.set(modalidade, agregado);
        continue;
      }

      const atleta = state.athletes[evento.athleteId];
      // Atleta apagado depois do jogo: o lance continua no placar, mas não há
      // a quem creditar. Cai na mesma vala do lance sem autor.
      if (!atleta) {
        agregado.semAutor += pontos;
        porModalidade.set(modalidade, agregado);
        continue;
      }

      const nomeDaEquipe = evento.side === 'home' ? partida.entryA : partida.entryB;
      const equipe = findTeamByName(state, nomeDaEquipe ?? '');
      const chave = `${modalidade}:${evento.athleteId}`;
      const jogos = partidasPorAtleta.get(chave) ?? new Set<string>();
      jogos.add(partida.id);
      partidasPorAtleta.set(chave, jogos);

      const existente = agregado.artilheiros.find((item) => item.athleteId === evento.athleteId);
      if (existente) {
        existente.gols += pontos;
        existente.partidas = jogos.size;
      } else {
        agregado.artilheiros.push({
          athleteId: evento.athleteId,
          nome: atleta.name ?? 'Atleta',
          teamId: equipe?.id ?? atleta.teamId ?? '',
          equipe: equipe?.name ?? nomeDaEquipe ?? 'Equipe',
          ...(equipe?.logo ? { logo: equipe.logo } : {}),
          gols: pontos,
          partidas: jogos.size,
          modalidade,
        });
      }
      porModalidade.set(modalidade, agregado);
    }
  }

  for (const agregado of porModalidade.values()) {
    // Mais gols primeiro; empate desempata por quem precisou de menos jogos, e
    // depois por nome, para a ordem não dançar a cada recarga.
    agregado.artilheiros.sort(
      (a, b) =>
        b.gols - a.gols ||
        a.partidas - b.partidas ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    );
  }

  return [...porModalidade.values()].sort((a, b) =>
    a.modalidade.localeCompare(b.modalidade, 'pt-BR'),
  );
}

/** Posição na artilharia, com empate ocupando a mesma colocação. */
export function colocacoes(artilheiros: Artilheiro[]): number[] {
  const posicoes: number[] = [];
  artilheiros.forEach((atleta, indice) => {
    if (indice > 0 && atleta.gols === artilheiros[indice - 1].gols) {
      posicoes.push(posicoes[indice - 1]);
      return;
    }
    posicoes.push(indice + 1);
  });
  return posicoes;
}
