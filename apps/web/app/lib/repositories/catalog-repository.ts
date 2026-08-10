import {
  athletes,
  disciplines,
  getMatchStatusLabel,
  matches,
  staff,
  standings,
  teams,
  tournaments,
} from '../mock-data.ts';

export type CatalogRepository = {
  athletes: typeof athletes;
  disciplines: typeof disciplines;
  matches: typeof matches;
  staff: typeof staff;
  standings: typeof standings;
  teams: typeof teams;
  tournaments: typeof tournaments;
  getMatchStatusLabel: typeof getMatchStatusLabel;
};

/**
 * Ponto único de acesso ao catálogo inicial. Quando a API estiver disponível,
 * este adaptador poderá ser trocado sem alterar páginas e componentes.
 */
export const catalogRepository: CatalogRepository = Object.freeze({
  athletes,
  disciplines,
  matches,
  staff,
  standings,
  teams,
  tournaments,
  getMatchStatusLabel,
});

export {
  athletes,
  disciplines,
  getMatchStatusLabel,
  matches,
  staff,
  standings,
  teams,
  tournaments,
};
