import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  dependeDeResultado,
  lerGrade,
  lerGrupos,
  lerJogos,
  lerMataMata,
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

test('lê o bloco do mata-mata com horário e ginásio', async () => {
  const { lerMataMata, colunaDosJogos } = await import('../../scripts/importar-chaveamento.mjs');
  // O bloco do mata-mata e reconhecido por estar numa coluna diferente da fase
  // de grupos: prender em "JOGO 16" so funcionava nesta aba, e no voleibol
  // feminino o mata-mata comeca no JOGO 7.
  const jogos = lerMataMata(grade, colunaDosJogos(grade));
  // Quatro quartas, duas semis, terceiro lugar e final.
  assert.equal(jogos.length, 8);
  assert.deepEqual(jogos.map((j) => j.numero), [16, 17, 18, 19, 20, 21, 22, 23]);
  assert.deepEqual(jogos[0], {
    numero: 16,
    casa: '1 GRUPO A',
    fora: 'MELHOR TERCEIRO COLOCADO',
    local: 'GINÁSIO A',
    horario: '08:00',
  });
  const final = jogos.at(-1);
  assert.ok(final, 'a planilha não trouxe a final');
  assert.equal(final.horario, '12:00');
  // Todos dependem de resultado: nenhum pode ser agendado antes dos grupos.
  assert.ok(jogos.every((j) => dependeDeResultado(j.casa) && dependeDeResultado(j.fora)));
});

test('a ordem do chaveamento segue quartas, semis, terceiro e final', async () => {
  const { ordemNoChaveamento } = await import('../../scripts/importar-chaveamento.mjs');
  // É esta ordem que casa cada partida gerada com a linha certa da planilha:
  // errar aqui poria a final às 08:00 e uma quarta de final às 12:00.
  const ids = [
    'cat-advanced-final',
    'cat-advanced-third',
    'cat-advanced-r2-2',
    'cat-advanced-r1-3',
    'cat-advanced-r1-1',
    'cat-advanced-r2-1',
    'cat-advanced-r1-4',
    'cat-advanced-r1-2',
  ];
  const ordenados = [...ids].sort((a, b) => ordemNoChaveamento(a) - ordemNoChaveamento(b));
  assert.deepEqual(ordenados, [
    'cat-advanced-r1-1',
    'cat-advanced-r1-2',
    'cat-advanced-r1-3',
    'cat-advanced-r1-4',
    'cat-advanced-r2-1',
    'cat-advanced-r2-2',
    'cat-advanced-third',
    'cat-advanced-final',
  ]);
  // Os nomes antigos de semifinal continuam ordenando junto com a rodada 2.
  assert.ok(ordemNoChaveamento('cat-advanced-semi-1') < ordemNoChaveamento('cat-advanced-third'));
});

test('monta a configuração da categoria a partir da planilha', async () => {
  const { montarConfiguracao, lerGrupos } = await import('../../scripts/importar-chaveamento.mjs');
  const grupos = lerGrupos(grade);
  // Os nomes vêm resolvidos contra as equipes da edição, com a grafia delas.
  const participantes = [
    'Tubarões', 'Incinera', 'Cangaceiros', 'Caótica',
    'Tríade', 'Engenhosa', 'Graxeiros', 'Engrenada',
    'Tormenta', 'Voraz', 'Invasora',
  ];
  const config = montarConfiguracao({ grupos, participantes }, {
    editionId: 'ed-2026',
    nome: 'Futsal Masculino',
    modalidade: 'Futsal',
  });

  assert.deepEqual(config.phases[0].groups, ['GRUPO A', 'GRUPO B', 'GRUPO C']);
  assert.deepEqual(config.phases[1].groups, []);
  assert.equal(config.participants.length, 11);

  // Cada equipe cai no grupo da planilha, com a grafia da edição de um lado e
  // a da planilha do outro — é aqui que acento e caixa precisam casar.
  assert.equal(config.assignments['Tubarões'], 'GRUPO A');
  assert.equal(config.assignments['Caótica'], 'GRUPO A');
  assert.equal(config.assignments['Tríade'], 'GRUPO B');
  assert.equal(config.assignments['Invasora'], 'GRUPO C');
  assert.equal(Object.keys(config.assignments).length, 11);

  // Dois por grupo mais dois melhores terceiros fecham as oito vagas das
  // quartas; com zero melhores terceiros sobram seis e o chaveamento não fecha.
  assert.deepEqual(config.advancement, {
    perGroup: 2,
    bestThirds: 2,
    crossing: 'padrao',
    thirdPlaceMatch: true,
  });
});

test('nomes da planilha viram os nomes que o app conhece', async () => {
  const { nomeNoApp } = await import('../../scripts/importar-chaveamento.mjs');
  // O regulamento padrão é resolvido por nome exato. "VOLEIBOL" não casa com
  // "Vôlei" e nasceria com regra de futebol — dois tempos de 20 minutos com
  // cronômetro — no que deveria ser um jogo de sets.
  assert.equal(nomeNoApp('VOLEIBOL'), 'Vôlei');
  assert.equal(nomeNoApp('NATAÇÃO'), 'Natação');
  assert.equal(nomeNoApp('TÊNIS DE MESA'), 'Tênis de Mesa');
  assert.equal(nomeNoApp('XADREZ'), 'Xadrez');
  assert.equal(nomeNoApp('HANDEBOL'), 'Handebol');
  assert.equal(nomeNoApp('FUTSAL'), 'Futsal');
  assert.equal(nomeNoApp('BASQUETE'), 'Basquete');
  assert.equal(nomeNoApp('QUEIMADO'), 'Queimado');
  // Esporte fora da lista passa direto, com a grafia da planilha.
  assert.equal(nomeNoApp('Peteca'), 'Peteca');
});

test('as oito modalidades da planilha viram nomes conhecidos', async () => {
  const { nomeNoApp } = await import('../../scripts/importar-chaveamento.mjs');
  const daPlanilha = lerModalidades(grade).map((m) => nomeNoApp(m.nome));
  assert.deepEqual(daPlanilha, [
    'Futsal', 'Handebol', 'Basquete', 'Vôlei',
    'Queimado', 'Xadrez', 'Tênis de Mesa', 'Natação',
  ]);
});

test('lê as abas que fogem do formato do Futsal Masculino', async () => {
  const { colunaDosJogos } = await import('../../scripts/importar-chaveamento.mjs');
  const pasta = dirname(fileURLToPath(import.meta.url));
  const abrir = (arquivo: string) => lerGrade(join(pasta, '../fixtures/' + arquivo));

  // Grupo único: todo mundo contra todo mundo, sem "GRUPO A".
  const feminino = abrir('chaveamento-futsal-feminino.csv');
  const gruposF = lerGrupos(feminino);
  assert.deepEqual(gruposF.map((g) => g.nome), ['GRUPO ÚNICO']);
  assert.equal(gruposF[0].equipes.length, 5);
  // Cinco equipes em turno único dão dez confrontos.
  assert.equal(lerJogos(feminino).length, 10);
  // E o separador aqui é "×", não a letra X — sem os dois, metade dos
  // confrontos sairia sem adversário.
  assert.deepEqual(lerJogos(feminino)[0].casa, 'CANGACEIROS');
  assert.deepEqual(lerJogos(feminino)[0].fora, 'TORMENTA');

  // Dois grupos de quatro: seis jogos em cada.
  const basquete = abrir('chaveamento-basquete-masculino.csv');
  assert.equal(lerGrupos(basquete).length, 2);
  assert.equal(lerJogos(basquete).length, 12);

  // O mata-mata do voleibol feminino começa no JOGO 7, não no 16.
  const volei = abrir('chaveamento-voleibol-feminino.csv');
  assert.equal(lerMataMata(volei, colunaDosJogos(volei)).length, 4);
});
