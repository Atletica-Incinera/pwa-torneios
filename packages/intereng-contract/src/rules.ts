/**
 * As regras puras: regulamento, elegibilidade, agenda, ciclo de vida da
 * partida, classificação, chaveamento, progressão e ranking geral.
 *
 * Nada aqui toca rede, navegador ou banco: dado o estado, decidem o que é
 * válido e o que decorre dele.
 */
export * from './modules/bracket-rules.js';
export * from './modules/create-id.js';
export * from './modules/date-utils.js';
export * from './modules/discipline-rules.js';
export * from './modules/edition-catalog.js';
export * from './modules/eligibility.js';
export * from './modules/match-lifecycle.js';
export * from './modules/overall-ranking.js';
export * from './modules/publication.js';
export * from './modules/regulation.js';
export * from './modules/scheduling-rules.js';
export * from './modules/status.js';
export * from './modules/tournament-engine.js';
export * from './modules/tournament-progression.js';
