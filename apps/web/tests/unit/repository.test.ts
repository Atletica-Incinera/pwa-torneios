import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogRepository } from '../../app/lib/repositories/catalog-repository.ts';

test('repositório centraliza o catálogo inicial sem duplicar fontes', () => {
  assert.ok(catalogRepository.teams.length >= 16);
  assert.ok(catalogRepository.disciplines.some((item) => item.name === 'Futsal'));
  assert.ok(catalogRepository.matches.every((match) => match.discipline));
  assert.equal(catalogRepository.getMatchStatusLabel('Agendada'), 'Próximo');
});
