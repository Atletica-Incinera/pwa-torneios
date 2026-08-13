/**
 * O contrato do InterEng.
 *
 * Este ponto de entrada carrega a identidade do pacote e os tipos comuns. O
 * conteúdo de verdade mora nos subcaminhos, para o consumidor CommonJS não
 * arrastar a semente da edição só por pedir uma regra:
 *
 *   `@atletica-incinera/intereng-contract/state`    o formato da edição
 *   `@atletica-incinera/intereng-contract/rules`    as regras puras
 *   `@atletica-incinera/intereng-contract/actions`  as ações nomeadas e o redutor
 *   `@atletica-incinera/intereng-contract/seed`     a edição de exemplo
 *
 * Os módulos ainda vivem em `apps/web/app/lib`; o passo seguinte os move para
 * cá deixando reexports de uma linha no lugar antigo, para que nenhum dos 79
 * arquivos importadores mude e a suíte prove a equivalência.
 */
export { contractSubpaths, contractVersion } from './internal/version.js';
export type { ContractSubpath } from './internal/version.js';
