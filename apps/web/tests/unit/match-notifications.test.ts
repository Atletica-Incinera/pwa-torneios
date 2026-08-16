import assert from 'node:assert/strict';
import test from 'node:test';
import type { FrontendState, MatchState } from '@atletica-incinera/intereng-contract/state';
import { collectMatchNotifications } from '../../app/lib/match-notifications.ts';

const snapshot = (matches: Record<string, MatchState>) => ({ matches }) as Pick<FrontendState, 'matches'>;
const futsal = (status: MatchState['status'], extra: Partial<MatchState> = {}): MatchState =>
  ({ discipline: 'Futsal', entryA: 'Alcateia', entryB: 'Cangaceiros', venue: 'Ginásio CIn', status, ...extra });

test('partida que entra em Ao vivo vira aviso', () => {
  const [notification, ...rest] = collectMatchNotifications(
    snapshot({ 'semi-1': futsal('Agendada') }),
    snapshot({ 'semi-1': futsal('Ao vivo') }),
  );
  assert.equal(rest.length, 0);
  assert.match(notification.title, /Futsal · começou/);
  assert.match(notification.body, /Alcateia × Cangaceiros/);
  assert.equal(notification.url, '/matches/live?partida=semi-1');
});

test('partida encerrada avisa com o placar', () => {
  const [notification] = collectMatchNotifications(
    snapshot({ 'semi-1': futsal('Ao vivo', { scoreA: 3, scoreB: 2 }) }),
    snapshot({ 'semi-1': futsal('Encerrada', { scoreA: 3, scoreB: 2 }) }),
  );
  assert.match(notification.title, /encerrada/);
  assert.match(notification.body, /3 × 2/);
});

test('placar mudando no meio do jogo não interrompe ninguém', () => {
  const notifications = collectMatchNotifications(
    snapshot({ 'semi-1': futsal('Ao vivo', { scoreA: 1, scoreB: 0 }) }),
    snapshot({ 'semi-1': futsal('Ao vivo', { scoreA: 2, scoreB: 0 }) }),
  );
  assert.deepEqual(notifications, []);
});

test('adiamento e cancelamento não entram — só começo e fim', () => {
  for (const status of ['Adiada', 'Cancelada', 'W.O.'] as const) {
    const notifications = collectMatchNotifications(
      snapshot({ 'semi-1': futsal('Agendada') }),
      snapshot({ 'semi-1': futsal(status) }),
    );
    assert.deepEqual(notifications, [], status);
  }
});

test('partida de outra modalidade fica fora quando há preferência', () => {
  const before = snapshot({ 'volei-1': { discipline: 'Vôlei', entryA: 'Caótica', entryB: 'Energizada', status: 'Agendada' } });
  const after = snapshot({ 'volei-1': { discipline: 'Vôlei', entryA: 'Caótica', entryB: 'Energizada', status: 'Ao vivo' } });
  assert.deepEqual(collectMatchNotifications(before, after, { discipline: 'Futsal' }), []);
  assert.equal(collectMatchNotifications(before, after, { discipline: 'Vôlei' }).length, 1);
  // Sem preferência, quem só acompanha recebe tudo.
  assert.equal(collectMatchNotifications(before, after).length, 1);
});

test('primeiro carregamento não vira enxurrada', () => {
  // A edição inteira seria "nova" na primeira comparação.
  const notifications = collectMatchNotifications(
    snapshot({}),
    snapshot({ 'semi-1': futsal('Ao vivo'), 'quartas-1': futsal('Encerrada') }),
  );
  assert.deepEqual(notifications, []);
});

test('a etiqueta agrupa por partida, para o segundo aviso substituir o primeiro', () => {
  const [live] = collectMatchNotifications(snapshot({ 'semi-1': futsal('Agendada') }), snapshot({ 'semi-1': futsal('Ao vivo') }));
  const [done] = collectMatchNotifications(snapshot({ 'semi-1': futsal('Ao vivo') }), snapshot({ 'semi-1': futsal('Encerrada') }));
  assert.equal(live.tag, done.tag);
});
