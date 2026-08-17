import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFrontendState, seededFrontendState } from '@atletica-incinera/intereng-contract/state';
import { listCategories, listDisciplines, listMatches, listTeams, editionStatuses, getEditionStatusLabel, getMatchStatusLabel } from '@atletica-incinera/intereng-contract/rules';

const editionId = 'intereng-2026';

test('a edição guarda o enum da API e só a exibição fala português', () => {
  assert.deepEqual(seededFrontendState.editions.map((edition) => edition.status), ['ONGOING', 'FINISHED', 'ARCHIVED']);
  assert.deepEqual(editionStatuses.map(getEditionStatusLabel), ['Planejamento', 'Em andamento', 'Finalizada', 'Arquivada']);
});

test('estado de edição que este pacote não conhece aparece como veio, não em branco', () => {
  assert.equal(getEditionStatusLabel('SUSPENDED'), 'SUSPENDED');
});

test('snapshot gravado com o rótulo antigo é lido já no enum', () => {
  // Sem a conversão o seletor não acharia a opção e mostraria a primeira da
  // lista: a tela diria `Planejamento` sobre uma edição em andamento.
  const gravado = JSON.stringify({ editions: [{ id: 'intereng-2026', name: '2026', year: 2026, start: '2026-10-12', end: '2026-10-19', status: 'Em andamento', active: true }] });

  const state = parseFrontendState(gravado, seededFrontendState);

  assert.equal(state.editions[0].status, 'ONGOING');
});

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
  const [categoria] = listCategories(seededFrontendState, editionId);
  assert.equal(categoria.entries, null);

  const parcial = { ...seededFrontendState, matches: { avulsa: { editionId } } };
  const [match] = listMatches(parcial, editionId);
  assert.equal(match.entryA, 'Equipe A');
  assert.equal(match.status, 'Agendada');
  assert.equal(match.venue, 'A definir');
});
