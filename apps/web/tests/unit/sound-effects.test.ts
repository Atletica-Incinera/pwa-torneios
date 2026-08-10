import assert from 'node:assert/strict';
import test from 'node:test';
import { impactSoundForEvent } from '../../app/lib/sound-effects.ts';

test('seleciona uma assinatura esportiva para cada ação principal do placar', () => {
  assert.equal(impactSoundForEvent('Gol', 'Futsal'), 'goal');
  assert.equal(impactSoundForEvent('Ponto', 'Basquete'), 'basket');
  assert.equal(impactSoundForEvent('Cesta de 3', 'Basquete'), 'basket');
  assert.equal(impactSoundForEvent('Ponto', 'Vôlei'), 'volleyball-point');
  assert.equal(impactSoundForEvent('Ponto', 'Xadrez'), 'chess-point');
  assert.equal(impactSoundForEvent('Falta', 'Handebol'), 'foul');
  assert.equal(impactSoundForEvent('Cartão', 'Futsal'), 'card');
  assert.equal(impactSoundForEvent('Fim de set', 'Vôlei'), 'volleyball-set-end');
  assert.equal(impactSoundForEvent('Encerrar tabuleiro', 'Xadrez'), 'chess-end');
});

test('normaliza acentos e mantém fallback para eventos personalizados', () => {
  assert.equal(impactSoundForEvent('Advertência', 'Xadrez'), 'card');
  assert.equal(impactSoundForEvent('Tempo técnico', 'Basquete'), 'foul');
  assert.equal(impactSoundForEvent('Touchdown', 'Futebol americano'), 'score');
});
