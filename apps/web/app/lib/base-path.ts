/**
 * O prefixo sob o qual o app é servido.
 *
 * `next/link`, `next/image` e o router já aplicam o `basePath` sozinhos — este
 * módulo existe só para o punhado de URLs que passam por fora deles: o registro
 * do service worker e o escopo dele. Ali o prefixo precisa ser escrito à mão, e
 * esquecê-lo faz o navegador pedir `/sw.js` na raiz do domínio, que em produção
 * pertence a outro site.
 *
 * A leitura é a mesma normalização de `next.config.ts`, e `NEXT_PUBLIC_*` é
 * embutido na compilação, então vale no navegador.
 */
const declared = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const basePath = declared === '/' ? '' : declared;

/** Uma URL absoluta do próprio app, com o prefixo aplicado uma única vez. */
export function appPath(path: string) {
  return `${basePath}${path}`;
}
