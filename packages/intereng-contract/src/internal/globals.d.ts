/**
 * O pacote compila sem a biblioteca `DOM` de propósito: sem ela `window` e
 * `localStorage` não existem, e código de navegador não entra aqui por
 * distração — o compilador recusa antes de a revisão precisar reparar.
 *
 * O que o contrato usa de verdade é `crypto`, que existe nos dois ambientes
 * desde o Node 20. É a única coisa declarada aqui.
 */
declare global {
  // eslint-disable-next-line no-var
  var crypto: {
    randomUUID?: () => string;
    getRandomValues?: <T extends ArrayBufferView | null>(array: T) => T;
  };
}

export {};
