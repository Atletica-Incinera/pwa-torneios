import test from 'node:test';
import assert from 'node:assert/strict';
import { seededFrontendState, type FrontendState } from '../../app/lib/frontend-state.ts';
import { athletesOfTeam, checkMatchEligibility, checkRoster, checkRosterLock, eligibleAthletes, findTeamByName, isTeamRegistered, teamDirectory } from '../../app/lib/eligibility.ts';
import { resolveRegulation } from '../../app/lib/regulation.ts';

const futsal = resolveRegulation('Futsal');
const xadrez = resolveRegulation('Xadrez');

function withRoster(teamId: string, count: number, discipline: string): FrontendState {
  const athletes = Object.fromEntries(Array.from({ length: count }, (_, index) => [`${teamId}-atleta-${index}`, { name: `Atleta ${index}`, teamId, modalities: [discipline], created: true }]));
  return { ...seededFrontendState, athletes: { ...seededFrontendState.athletes, ...athletes } };
}

test('o diretório de equipes junta catálogo e equipes criadas', () => {
  const directory = teamDirectory(seededFrontendState);

  assert.equal(directory.some((team) => team.name === 'Alcateia'), true);
  assert.equal(findTeamByName(seededFrontendState, 'Alcateia')?.id, 'alcateia');
});

test('o contador de atletas da equipe vem do elenco, não de um número fixo', () => {
  const directory = teamDirectory(seededFrontendState);

  // O catálogo dizia 18 para a Alcateia, que tem 2 atletas de fato.
  assert.equal(directory.find((team) => team.id === 'alcateia')?.athletes, 2);
  assert.equal(directory.find((team) => team.id === 'energizada')?.athletes, 0);

  const comNovato = { ...seededFrontendState, athletes: { ...seededFrontendState.athletes, novato: { name: 'Novato', teamId: 'energizada', modalities: ['Futsal'], created: true } } };
  assert.equal(teamDirectory(comNovato).find((team) => team.id === 'energizada')?.athletes, 1);
});

test('atleta removido sai do elenco sem apagar o cadastro', () => {
  const removido = { ...seededFrontendState, athletes: { ...seededFrontendState.athletes, 'ana-lima': { name: 'Ana Lima', teamId: 'alcateia', modalities: ['Futsal', 'Vôlei'], removed: true } } };

  assert.equal(athletesOfTeam(removido, 'alcateia').some((athlete) => athlete.id === 'ana-lima'), false);
  assert.equal(athletesOfTeam(removido, 'alcateia').length, 1);
  assert.equal(eligibleAthletes(removido, 'alcateia', 'Futsal').length, 0);
  // O registro continua no estado, para o histórico da edição.
  assert.equal(removido.athletes['ana-lima'].name, 'Ana Lima');
});

test('só entra na súmula quem está associado à modalidade', () => {
  const state = withRoster('alcateia', 3, 'Vôlei');

  assert.equal(eligibleAthletes(state, 'alcateia', 'Vôlei').length, 5);
  assert.equal(eligibleAthletes(state, 'alcateia', 'Futsal').length, 1);
});

test('aplica mínimo e máximo de atletas da modalidade', () => {
  assert.equal(checkRoster(futsal, 0).ok, false);
  assert.match(checkRoster(futsal, 0).message, /exige elenco/);
  assert.equal(checkRoster(futsal, 4).ok, false);
  assert.equal(checkRoster(futsal, 5).ok, true);
  assert.equal(checkRoster(futsal, 13).ok, false);
});

test('modalidade sem exigência de elenco não bloqueia a operação', () => {
  assert.equal(checkRoster(xadrez, 0).ok, true);
});

test('a equipe precisa estar inscrita na categoria para ser escalada', () => {
  const tournament = { participants: ['Alcateia', 'Cangaceiros'] };

  assert.equal(isTeamRegistered(tournament, 'Alcateia'), true);
  assert.equal(isTeamRegistered(tournament, 'Caótica'), false);
  assert.equal(isTeamRegistered(undefined, 'Alcateia'), false);
});

test('equipe fora da categoria bloqueia; elenco incompleto apenas avisa', () => {
  const state = withRoster('alcateia', 5, 'Futsal');
  const semInscricao = checkMatchEligibility(state, futsal, { participants: ['Alcateia'] }, 'Alcateia', 'Caótica');

  assert.equal(semInscricao.ok, false);
  assert.match(semInscricao.blocking[0], /Caótica não está inscrita/);

  // Elenco incompleto não impede o agendamento: vira aviso.
  const semElenco = checkMatchEligibility(state, futsal, { participants: ['Alcateia', 'Caótica'] }, 'Alcateia', 'Caótica');
  assert.equal(semElenco.ok, true);
  assert.deepEqual(semElenco.blocking, []);
  assert.match(semElenco.warnings[0], /Caótica: Futsal exige elenco/);

  const completo = checkMatchEligibility(withRoster('caotica', 5, 'Futsal'), futsal, { participants: ['Caótica', 'Alcateia'] }, 'Caótica', 'Caótica');
  assert.deepEqual(completo.warnings, []);
});

test('o elenco trava conforme a fase definida no regulamento', () => {
  const parado: Pick<FrontendState, 'matches' | 'tournaments'> = { matches: {}, tournaments: {} };
  assert.equal(checkRosterLock(parado, futsal).allowed, true);

  /*
   * Este caso mudou de resposta, e a premissa e que mudou.
   *
   * Quando o teste foi escrito, partida de mata-mata so existia DEPOIS de a
   * fase de grupos acabar -- entao uma semifinal "Agendada" implicava que os
   * grupos ja tinham terminado, e travar o elenco ali estava certo.
   *
   * Hoje a chave inteira entra na agenda antes de existir resultado. Uma
   * semifinal agendada nao diz mais nada sobre a fase de grupos, e travar por
   * causa dela deixaria o elenco fechado desde o primeiro dia.
   */
  const soAgendada = { matches: { jogo: { discipline: 'Futsal', phase: 'Semifinal', status: 'Agendada' as const } }, tournaments: {} };
  assert.equal(checkRosterLock(soAgendada, futsal).allowed, true);

  const emJogo = { matches: { jogo: { discipline: 'Futsal', phase: 'Semifinal', status: 'Ao vivo' as const } }, tournaments: {} };
  assert.equal(checkRosterLock(emJogo, futsal).allowed, false);

  assert.equal(checkRosterLock(emJogo, xadrez).allowed, true);
});

/*
 * A trava de elenco existe para impedir que uma equipe reforce o time entre a
 * fase de grupos e o mata-mata. Quando a chave passou a entrar na agenda antes
 * de existir resultado, "existe partida de mata-mata" deixou de significar
 * "o mata-mata começou" — e o elenco de toda modalidade com chave publicada
 * nascia trancado.
 *
 * O efeito era pior do que parece: sem poder inscrever atleta em modalidade,
 * não há a quem creditar um gol, e a artilharia ficaria vazia o evento inteiro.
 */
test('chave apenas agendada não tranca o elenco', async () => {
  const { checkRosterLock } = await import('../../app/lib/eligibility.ts');
  const { resolveRegulation } = await import('../../app/lib/regulation.ts');
  const regulamento = resolveRegulation('Futsal');
  assert.equal(regulamento.roster.lock, 'knockout');

  const agendada = {
    matches: {
      m1: { discipline: 'Futsal', phase: 'Mata-mata', status: 'Agendada' },
    },
    tournaments: {},
  } as never;

  assert.equal(checkRosterLock(agendada, regulamento).allowed, true);
});

test('o apito do primeiro jogo do mata-mata tranca o elenco', async () => {
  const { checkRosterLock } = await import('../../app/lib/eligibility.ts');
  const { resolveRegulation } = await import('../../app/lib/regulation.ts');
  const regulamento = resolveRegulation('Futsal');

  for (const status of ['Ao vivo', 'Encerrada']) {
    const emJogo = {
      matches: { m1: { discipline: 'Futsal', phase: 'Mata-mata', status } },
      tournaments: {},
    } as never;
    assert.equal(checkRosterLock(emJogo, regulamento).allowed, false, status);
  }
});

test('jogo de outra modalidade não tranca o elenco desta', async () => {
  const { checkRosterLock } = await import('../../app/lib/eligibility.ts');
  const { resolveRegulation } = await import('../../app/lib/regulation.ts');
  const outra = {
    matches: { m1: { discipline: 'Vôlei', phase: 'Mata-mata', status: 'Ao vivo' } },
    tournaments: {},
  } as never;

  assert.equal(checkRosterLock(outra, resolveRegulation('Futsal')).allowed, true);
});
