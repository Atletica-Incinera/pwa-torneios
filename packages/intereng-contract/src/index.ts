/**
 * O contrato do InterEng.
 *
 * Este ponto de entrada carrega a identidade do pacote e os tipos da edição.
 * O que executa mora nos subcaminhos, para o consumidor CommonJS não arrastar
 * a semente da edição só por pedir uma regra:
 *
 *   `@atletica-incinera/intereng-contract/state`    o formato da edição
 *   `@atletica-incinera/intereng-contract/rules`    as regras puras
 *   `@atletica-incinera/intereng-contract/actions`  as ações e o redutor
 *   `@atletica-incinera/intereng-contract/seed`     a edição de exemplo
 */
export { contractSubpaths, contractVersion } from './internal/version.js';
export type { ContractSubpath } from './internal/version.js';
export type * from './modules/frontend-state.js';
export type * from './modules/actions.js';
