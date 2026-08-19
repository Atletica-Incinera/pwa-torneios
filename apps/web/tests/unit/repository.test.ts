import assert from 'node:assert/strict';
import test from 'node:test';
import { seededFrontendState } from '../../app/lib/frontend-state.ts';
import { listCategories, listDisciplines, listMatches, listTeams } from '../../app/lib/edition-catalog.ts';
import { getMatchStatusLabel } from '../../app/lib/status.ts';

const editionId = 'intereng-2026';

test('o snapshot inicial já traz a edição inteira, sem catálogo à parte', () => {
  assert.ok(listTeams(seededFrontendState).length >= 16);
  assert.ok(listDisciplines(seededFrontendState, editionId).some((item) => item.name === 'Futsal'));
  assert.ok(listMatches(seededFrontendState, editionId).every((match) => match.discipline));
  assert.equal(getMatchStatusLabel('Agendada'), 'Próximo');
});

test('as listas leem só do estado: o que não está no snapshot não aparece', () => {
  const vazio = { ...seededFrontendState, teams: {}, athletes: {}, matches: {}, tournaments: {}, disciplines: {} };

  assert.deepEqual(listTeams(vazio), []);
  assert.deepEqual(listMatches(vazio, editionId), []);
  assert.deepEqual(listCategories(vazio, editionId), []);
  assert.deepEqual(listDisciplines(vazio, editionId), []);
});

test('categoria sem inscritos não inventa total e a partida herda os defaults', () => {
  // A semente só deixa sem inscritos a categoria em rascunho: publicada ou em
  // andamento sem ninguém inscrito é estado que o servidor recusa.
  const categorias = listCategories(seededFrontendState, editionId);
  const semInscritos = categorias.find((item) => item.status === 'Rascunho');
  assert.ok(semInscritos, 'a semente precisa manter uma categoria em rascunho');
  assert.equal(semInscritos.entries, null);
  assert.ok(categorias.filter((item) => item.status !== 'Rascunho').every((item) => (item.entries ?? 0) >= 2));

  const parcial = { ...seededFrontendState, matches: { avulsa: { editionId } } };
  const [match] = listMatches(parcial, editionId);
  assert.equal(match.entryA, 'Equipe A');
  assert.equal(match.status, 'Agendada');
  assert.equal(match.venue, 'A definir');
});
