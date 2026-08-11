import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, evaluateAdvancePeriod, evaluateFinish, evaluateOperatorLock, evaluateStart, isEliminationPhase, officialWinner, operatorLockMs, operatorRenewMs, setWinner, statusRequirements, walkoverScores } from '../../app/lib/match-lifecycle.ts';
import { resolveRegulation } from '../../app/lib/regulation.ts';

test('o fluxo de status só aceita caminhos previstos', () => {
  assert.equal(canTransition('Agendada', 'Ao vivo'), true);
  assert.equal(canTransition('Ao vivo', 'Encerrada'), true);
  assert.equal(canTransition('Encerrada', 'Ao vivo'), false);
  assert.equal(canTransition('Cancelada', 'Agendada'), false);
  assert.equal(canTransition('Adiada', 'Agendada'), true);
});

test('cada exceção declara motivo, consequência e efeito na classificação', () => {
  assert.equal(statusRequirements.Adiada.reason, true);
  assert.equal(statusRequirements.Adiada.reschedule, true);
  assert.equal(statusRequirements.Cancelada.countsForStandings, false);
  assert.equal(statusRequirements['W.O.'].winner, true);
  assert.equal(statusRequirements['W.O.'].countsForStandings, true);
});

test('abrir o placar não inicia: fora da janela exige justificativa', () => {
  const match = { status: 'Agendada' as const, date: '2026-10-13', time: '19:00' };

  assert.equal(evaluateStart(match, new Date(2026, 9, 13, 18, 50)).requiresJustification, false);
  assert.equal(evaluateStart(match, new Date(2026, 9, 13, 17, 0)).reasonCode, 'antecipado');
  assert.equal(evaluateStart(match, new Date(2026, 9, 13, 23, 0)).reasonCode, 'atrasado');
  assert.equal(evaluateStart({ ...match, status: 'Cancelada' }, new Date(2026, 9, 13, 19, 0)).allowed, false);
});

test('mata-mata empatado exige desempate antes de encerrar', () => {
  const futsal = resolveRegulation('Futsal');

  const grupo = evaluateFinish(futsal, { scoreA: 2, scoreB: 2, currentPeriod: 2, elimination: false });
  assert.equal(grupo.requiresTiebreak, false);

  const mataMata = evaluateFinish(futsal, { scoreA: 2, scoreB: 2, currentPeriod: 2, elimination: true });
  assert.equal(mataMata.requiresTiebreak, true);
  assert.match(mataMata.message, /pênaltis/i);
});

test('basquete não admite empate nem na fase de grupos', () => {
  const check = evaluateFinish(resolveRegulation('Basquete'), { scoreA: 70, scoreB: 70, currentPeriod: 2, elimination: false });

  assert.equal(check.requiresTiebreak, true);
});

test('vôlei encerra ao vencer os sets e exige justificativa antes disso', () => {
  const volei = resolveRegulation('Vôlei');

  assert.equal(evaluateFinish(volei, { scoreA: 3, scoreB: 1, currentPeriod: 4, elimination: false }).requiresEarlyClose, false);
  assert.equal(evaluateFinish(volei, { scoreA: 2, scoreB: 1, currentPeriod: 3, elimination: false }).requiresEarlyClose, true);
});

test('set só fecha com a vantagem mínima do regulamento', () => {
  const volei = resolveRegulation('Vôlei');

  assert.equal(setWinner(volei, 1, 25, 24), null);
  assert.equal(setWinner(volei, 1, 26, 24), 'home');
  assert.equal(setWinner(volei, 5, 15, 13), 'home');
  assert.equal(setWinner(volei, 5, 13, 15), 'away');
});

test('avançar de etapa antes do fim válido exige encerramento antecipado', () => {
  const futsal = resolveRegulation('Futsal');

  assert.equal(evaluateAdvancePeriod(futsal, { currentPeriod: 1, clockSeconds: 600 }).requiresEarlyClose, true);
  assert.equal(evaluateAdvancePeriod(futsal, { currentPeriod: 1, clockSeconds: 1200 }).requiresEarlyClose, false);
  assert.equal(evaluateAdvancePeriod(futsal, { currentPeriod: 2, clockSeconds: 1200 }).allowed, false);
});

test('W.O. aplica o placar regulamentar da modalidade', () => {
  assert.deepEqual(walkoverScores(resolveRegulation('Futsal'), 'home'), { scoreA: 1, scoreB: 0 });
  assert.deepEqual(walkoverScores(resolveRegulation('Vôlei'), 'away'), { scoreA: 0, scoreB: 3 });
  assert.deepEqual(walkoverScores(resolveRegulation('Basquete'), 'home'), { scoreA: 20, scoreB: 0 });
});

test('o vencedor oficial considera desempate e W.O.', () => {
  assert.equal(officialWinner({ status: 'Encerrada', scoreA: 2, scoreB: 1, entryA: 'A', entryB: 'B' }), 'A');
  assert.equal(officialWinner({ status: 'Encerrada', scoreA: 1, scoreB: 1, entryA: 'A', entryB: 'B' }), null);
  assert.equal(officialWinner({ status: 'Encerrada', scoreA: 1, scoreB: 1, entryA: 'A', entryB: 'B', tiebreak: { method: 'penaltis', label: 'Pênaltis', scoreA: 4, scoreB: 3, winner: 'A', reason: 'Pênaltis', decidedBy: 'Ana', at: '2026-10-13T22:00:00.000Z' } }), 'A');
  assert.equal(officialWinner({ status: 'W.O.', entryA: 'A', entryB: 'B', walkoverWinner: 'B' }), 'B');
});

test('a trava do operador só é regravada quando está perto de expirar', () => {
  const now = Date.parse('2026-10-13T20:00:00.000Z');
  const at = (msAgo: number) => new Date(now - msAgo).toISOString();

  // Ninguém segurando: assume.
  assert.equal(evaluateOperatorLock({}, 'op-1', now), 'renew');
  // Sou o dono e ainda há folga: não grava nada.
  assert.equal(evaluateOperatorLock({ operatorId: 'op-1', operatorHeartbeat: at(operatorRenewMs - 1000) }, 'op-1', now), 'skip');
  // Sou o dono e a trava vai expirar: renova.
  assert.equal(evaluateOperatorLock({ operatorId: 'op-1', operatorHeartbeat: at(operatorRenewMs + 1000) }, 'op-1', now), 'renew');
  // Outro operador ativo: não toma a trava por baixo dos panos.
  assert.equal(evaluateOperatorLock({ operatorId: 'op-2', operatorHeartbeat: at(1000) }, 'op-1', now), 'blocked');
  // Trava do outro já expirou: pode assumir.
  assert.equal(evaluateOperatorLock({ operatorId: 'op-2', operatorHeartbeat: at(operatorLockMs + 1000) }, 'op-1', now), 'renew');
});

test('reconhece fases eliminatórias pelo nome', () => {
  assert.equal(isEliminationPhase('Semifinal'), true);
  assert.equal(isEliminationPhase('Quartas de final'), true);
  assert.equal(isEliminationPhase('Grupo A'), false);
});
