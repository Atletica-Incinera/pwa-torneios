import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  dependeDeResultado,
  lerGrade,
  lerGrupos,
  lerJogos,
  lerModalidades,
} from '../../scripts/importar-chaveamento.mjs';

/**
 * A planilha da organização não tem cabeçalho: são três blocos lado a lado, em
 * colunas fixas, numa aba por categoria. Ler por posição quebraria à primeira
 * coluna inserida, então cada bloco é achado pelo próprio rótulo.
 *
 * O arquivo usado aqui é a planilha real do Futsal Masculino, não uma
 * simplificação — é a única forma de saber que a leitura aguenta o que a
 * organização de fato exporta.
 */
const planilha = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/chaveamento-futsal-masculino.csv');
const grade = lerGrade(planilha);

test('lê as oito modalidades e quantas equipes cada uma tem', () => {
  const modalidades = lerModalidades(grade);
  assert.equal(modalidades.length, 8);
  assert.deepEqual(modalidades[0], { nome: 'FUTSAL', masculino: 11, feminino: 6 });
  assert.deepEqual(modalidades.at(-1), { nome: 'NATAÇÃO', masculino: 11, feminino: 7 });
});

test('lê os três grupos com as equipes de cada um', () => {
  const grupos = lerGrupos(grade);
  assert.deepEqual(grupos.map((g) => g.nome), ['GRUPO A', 'GRUPO B', 'GRUPO C']);
  assert.deepEqual(grupos[0].equipes, ['TUBARÕES', 'INCINERA', 'CANGACEIROS', 'CAÓTICA']);
  assert.deepEqual(grupos[2].equipes, ['TORMENTA', 'VORAZ', 'INVASORA']);
  // 4 + 4 + 3 = 11, que é o total declarado para FUTSAL MASCULINO.
  assert.equal(grupos.reduce((total, g) => total + g.equipes.length, 0), 11);
});

test('lê os quinze jogos da fase de grupos com horário e local', () => {
  const jogos = lerJogos(grade);
  assert.equal(jogos.length, 15);
  assert.deepEqual(jogos[0], {
    numero: 1,
    casa: 'TUBARÕES',
    fora: 'CANGACEIROS',
    local: 'GINÁSIO A',
    horario: '08:00',
  });
  const ultimo = jogos.at(-1);
  assert.ok(ultimo, 'a planilha não trouxe o último jogo');
  assert.equal(ultimo.numero, 15);
  assert.equal(ultimo.horario, '12:00');
});

test('separa o que depende de resultado do que já tem os dois times', () => {
  // Estes o app monta sozinho ao fim dos grupos; criar à mão brigaria com ele.
  assert.equal(dependeDeResultado('VENCEDOR J3'), true);
  assert.equal(dependeDeResultado('PERDEDOR J3'), true);
  assert.equal(dependeDeResultado('MELHOR TERCEIRO COLOCADO'), true);
  assert.equal(dependeDeResultado('1 GRUPO A'), true);
  assert.equal(dependeDeResultado('TUBARÕES'), false);
  assert.equal(dependeDeResultado('CAÓTICA'), false);
});

test('a planilha do Futsal Masculino tem duas partidas que dependem de resultado', () => {
  // J12 e J15 se apoiam no resultado do J3 — e é aí que mora o erro de
  // digitação: quem joga contra o vencedor e o perdedor do J3 tem de ser a
  // terceira equipe do grupo, não uma das duas que disputaram o J3.
  const dependentes = lerJogos(grade).filter(
    (jogo) => dependeDeResultado(jogo.casa) || dependeDeResultado(jogo.fora),
  );
  assert.deepEqual(dependentes.map((j) => j.numero), [12, 15]);
});

test('a leitura acusa a equipe do grupo que não joga nada', () => {
  // INVASORA está no Grupo C e não aparece em partida nenhuma, porque J12 e
  // J15 foram escritos com VORAZ no lugar dela. Sem este alerta, uma atlética
  // inteira ficaria de fora sem ninguém notar.
  const jogos = lerJogos(grade);
  const emJogo = new Set(jogos.flatMap((j) => [j.casa, j.fora]));
  const grupoC = lerGrupos(grade).find((g) => g.nome === 'GRUPO C');
  assert.ok(grupoC, 'a planilha não trouxe o Grupo C');
  const semJogo = grupoC.equipes.filter((equipe) => !emJogo.has(equipe));
  assert.deepEqual(semJogo, ['INVASORA']);
});
