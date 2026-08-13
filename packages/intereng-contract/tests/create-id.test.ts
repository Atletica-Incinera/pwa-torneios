import test from 'node:test';
import assert from 'node:assert/strict';
import { createId } from '@atletica-incinera/intereng-contract/rules';

test('ids criados no mesmo milissegundo não colidem', () => {
  const ids = Array.from({ length: 500 }, () => createId('audit'));

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.every((id) => id.startsWith('audit-')), true);
});
