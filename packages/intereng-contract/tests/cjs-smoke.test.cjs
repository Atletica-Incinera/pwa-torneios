const assert = require('node:assert/strict');
const test = require('node:test');

/**
 * A prova contínua de que o Nest vai conseguir importar o pacote.
 *
 * O consumidor é CommonJS com TypeScript 5.7. Um `dist/cjs` que na verdade
 * seja ESM não falha aqui por engano: `require()` de um módulo ESM estoura.
 * Este teste roda contra o artefato compilado, atravessando o mapa `exports`,
 * e não contra o `src`.
 */
test('o pacote importa em CommonJS por todos os subcaminhos', () => {
  const contract = require('@atletica-incinera/intereng-contract');
  assert.equal(typeof contract.contractVersion, 'string');

  for (const subpath of contract.contractSubpaths.filter((entry) => entry !== '.')) {
    const loaded = require(`@atletica-incinera/intereng-contract/${subpath.replace('./', '')}`);
    assert.ok(loaded, `${subpath} não resolveu`);
  }
});

test('a versão do código acompanha a do manifesto', () => {
  const { contractVersion } = require('@atletica-incinera/intereng-contract');
  const { version } = require('../package.json');
  assert.equal(contractVersion, version);
});
