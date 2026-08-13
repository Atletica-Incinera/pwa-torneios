/**
 * A versão do contrato, gravada no código para que um consumidor possa
 * conferir em tempo de execução com o que está falando.
 *
 * Precisa acompanhar o `version` do `package.json` — é o único lugar duplicado
 * do pacote, e a suíte confere os dois.
 */
export const contractVersion = '0.1.0';

/** Os pontos de entrada publicados, na ordem em que o `exports` os declara. */
export const contractSubpaths = ['.', './state', './rules', './actions', './seed'] as const;

export type ContractSubpath = (typeof contractSubpaths)[number];
