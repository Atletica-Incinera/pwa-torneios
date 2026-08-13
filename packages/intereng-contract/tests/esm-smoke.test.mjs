import assert from 'node:assert/strict';
import test from 'node:test';

import { contractSubpaths, contractVersion } from '@atletica-incinera/intereng-contract';

/** O outro lado do pacote duplo: o que o front consome, importado como ESM. */
test('o pacote importa em ESM por todos os subcaminhos', async () => {
  assert.equal(typeof contractVersion, 'string');

  for (const subpath of contractSubpaths.filter((entry) => entry !== '.')) {
    const loaded = await import(`@atletica-incinera/intereng-contract/${subpath.replace('./', '')}`);
    assert.ok(loaded, `${subpath} não resolveu`);
  }
});
