import assert from 'node:assert/strict';
import test from 'node:test';
import { tiebreakSentence } from '../../app/lib/tiebreak-text.ts';

test('pênaltis: uma frase, placar na ordem de quem venceu', () => {
  assert.equal(tiebreakSentence({ method: 'penaltis', label: 'Pênaltis', scoreA: 3, scoreB: 2, winner: 'Compressora' }, 'Compressora'), 'Compressora venceu nos pênaltis por 3 × 2');
  assert.equal(tiebreakSentence({ method: 'penaltis', label: 'Pênaltis', scoreA: 2, scoreB: 4, winner: 'Furiosa' }, 'Compressora'), 'Furiosa venceu nos pênaltis por 4 × 2');
});

test('desempate sem placar (sorteio) não inventa 0 × 0', () => {
  assert.equal(tiebreakSentence({ method: 'sorteio' as never, label: 'Sorteio', scoreA: 0, scoreB: 0, winner: 'Furiosa' }, 'Compressora'), 'Furiosa venceu no desempate (sorteio)');
});
