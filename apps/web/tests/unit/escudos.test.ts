import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acharEscudo, caminhoDoEscudo, escudosPublicados } from '../../app/lib/escudos.ts';

/**
 * O nome da atlética raramente bate com o do arquivo. Esta função é o que faz
 * cadastrar pela tela e importar por planilha chegarem ao mesmo escudo — se
 * as duas divergirem, metade das equipes fica sem.
 */

test('acha pelo nome completo da atlética', () => {
  assert.equal(acharEscudo('Atlética Alcateia'), '/teams/alcateia.webp');
  assert.equal(acharEscudo('Atlética Tríade'), '/teams/triade.webp');
});

test('ignora acento e caixa', () => {
  assert.equal(acharEscudo('CAÓTICA'), '/teams/caotica.webp');
  assert.equal(acharEscudo('tubarões'), '/teams/tubaroes.webp');
  assert.equal(acharEscudo('Engrenada'), '/teams/engrenada.webp');
});

test('nome grudado sem separador nao e dividido, e isso e proposital', () => {
  // Sem separador nao ha palavra para tentar, e adivinhar por pedaco abriria a
  // porta para casar "Supervoraz" com o escudo da Voraz. Melhor ficar sem
  // escudo e a pessoa escolher do que atribuir o escudo de outra atletica.
  assert.equal(acharEscudo('AtleticaTormenta'), undefined);
  assert.equal(acharEscudo('Atletica Tormenta'), '/teams/tormenta.webp');
});

test('devolve indefinido quando não há escudo publicado', () => {
  assert.equal(acharEscudo('Atlética Sem Escudo'), undefined);
  assert.equal(acharEscudo(''), undefined);
});

test('não inventa escudo a partir de pedaço de palavra', () => {
  // "voraz" está publicado; "vora" não pode casar com ele.
  assert.equal(acharEscudo('Vora'), undefined);
});

test('o caminho é relativo, que é o formato que o servidor aceita', () => {
  for (const slug of escudosPublicados) {
    assert.match(caminhoDoEscudo(slug), /^\/teams\/[a-z0-9-]+\.webp$/);
  }
});
