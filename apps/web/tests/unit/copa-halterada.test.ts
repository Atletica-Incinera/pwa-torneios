import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  ABAS,
  DATA_PROVISORIA,
  converter,
  dataIso,
  ehRotulo,
  grafias,
  horaHHMM,
  rotuloLegivel,
} from '../../scripts/planilha-copa.mjs';
import { avancoDaChave, ordenarPelaChave, planejarCopa } from '../../scripts/importar-copa.mjs';

/*
 * A planilha da Copa Halterada tem 8 abas com 8 layouts. Estes testes travam o
 * que a organização pediu — "tudo de acordo com a tabela" — e as três coisas
 * em que a planilha engana: grupo rotulado errado no vôlei, a chave do futsal
 * que cruza QF1 x QF3 e não QF1 x QF2, e o horário "A SEGUIR".
 */
type Jogo = { numero: number; tipo: string; data: string; horario: string; provisorio: { data: boolean; horario: boolean } };
type Categoria = { categoria: string; equipes: string[]; jogos: Jogo[]; grupos: { nome: string; equipes: string[] }[]; avisos: string[] };

const lerPlanilha = (nome: string) => readFileSync(`../../docs/copa-halterada/planilha/${nome}`, 'utf8');
const categorias = converter(lerPlanilha) as Categoria[];
const porNome = (n: string) => categorias.find((c) => c.categoria === n)!;

const estadoCom = (equipes: string[]) => ({
  competitions: [{ name: 'Copa Halterada', active: true }],
  editions: [{ id: 'ed', active: true }],
  teams: Object.fromEntries(equipes.map((n, i) => [`t${i}`, { name: n }])),
  disciplines: {},
  tournaments: {} as Record<string, unknown>,
  matches: {} as Record<string, unknown>,
});
const todasAsEquipes = () => [...new Set(categorias.flatMap((c) => c.equipes))];

test('as 8 abas viram 94 jogos', () => {
  assert.equal(ABAS.length, 8);
  assert.equal(categorias.reduce((n, c) => n + c.jogos.length, 0), 94);
  assert.deepEqual(
    Object.fromEntries(categorias.map((c) => [c.categoria, c.jogos.length])),
    {
      'Handebol Masculino': 13, 'Handebol Feminino': 11, 'Basquete Masculino': 13, 'Basquete Feminino': 4,
      'Futsal Masculino': 23, 'Futsal Feminino': 4, 'Vôlei Masculino': 16, 'Vôlei Feminino': 10,
    },
  );
});

test('datas, horas e rótulos', () => {
  assert.equal(dataIso('10/10'), '2026-10-10');
  assert.equal(dataIso('9/10/2026'), '2026-10-09');
  assert.equal(dataIso('12/10/2026'), '2026-10-12');
  assert.equal(dataIso(''), null);
  assert.equal(horaHHMM('08:00:00'), '08:00');
  assert.equal(horaHHMM('A SEGUIR'), null);
  for (const r of ['1 GRUPO A', '1º Grupo A', 'PERDEDOR J10', 'Vencedor QF1', 'MELHOR 2 COLOCADO', '2º GERAL', '1 LUGAR GERAL', 'Melhor Classificada', '2ª Melhor Classificada']) {
    assert.equal(ehRotulo(r), true, r);
  }
  for (const n of ['Halterada 1', 'Compressora', 'Leões do Norte', 'Tubarões', 'HALTERADA A']) assert.equal(ehRotulo(n), false, n);
  assert.equal(rotuloLegivel('1º Grupo A'), '1 GRUPO A');
  assert.equal(rotuloLegivel('PERDEDOR J10'), 'Perdedor do Jogo 10');
  assert.equal(rotuloLegivel('MELHOR 2 COLOCADO'), 'Melhor 2º colocado');
});

test('a grafia de cada equipe é uma só, mesmo quando a aba grita', () => {
  const g = grafias(['Kinesis', 'KINESIS', 'HALTERADA A', 'Leões do Norte', 'LEÕES DO NORTE']);
  assert.equal(g.get('kinesis'), 'Kinesis');
  assert.equal(g.get('halterada a'), 'Halterada A');
  assert.equal(g.get('leoes do norte'), 'Leões do Norte');
});

test('são 20 equipes, com os nomes como a planilha escreve', () => {
  const todas = new Set(todasAsEquipes());
  assert.equal(todas.size, 20);
  for (const n of ['Halterada', 'Halterada 1', 'Halterada 2', 'Halterada A', 'Halterada B', 'Aguerrida', 'Devoradora', 'Predadora', 'Leões do Norte']) {
    assert.ok(todas.has(n), n);
  }
});

test('vôlei masculino: o grupo sai de quem joga com quem, não do rótulo errado da planilha', () => {
  const c = porNome('Vôlei Masculino');
  const grupo = (n: string) => c.grupos.find((g) => g.nome === n)!.equipes.slice().sort();
  assert.deepEqual(grupo('A'), ['Compressora', 'Devoradora', 'Halterada A', 'Kinesis']);
  assert.deepEqual(grupo('B'), ['Furiosa', 'Halterada B', 'Incinera', 'Inquisidores']);
  assert.equal(c.avisos.length, 2);
});

test('"A SEGUIR" encadeia a partir do jogo anterior; vôlei sem data usa o dia provisório', () => {
  const futsal = porNome('Futsal Masculino').jogos;
  assert.equal(futsal[0].horario, '08:00');
  assert.equal(futsal[0].provisorio.horario, false);
  assert.equal(futsal[1].horario, '08:30');
  assert.equal(futsal[1].provisorio.horario, true);
  const volei = porNome('Vôlei Masculino').jogos;
  assert.ok(volei.every((j) => j.data === DATA_PROVISORIA));
  assert.equal(volei[0].provisorio.data, true);
  assert.equal(volei[0].horario, '09:00');
  assert.equal(volei[1].horario, '09:45');
  assert.ok(categorias.flatMap((c) => c.jogos.map((j) => j.horario)).every((h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)));
});

test('futsal masculino: a semifinal cruza QF1 x QF3, como a planilha, e não QF1 x QF2', () => {
  const chave = porNome('Futsal Masculino').jogos.filter((j) => j.tipo === 'chave');
  const ordem = (ordenarPelaChave(chave as never) as { numero: number }[]).slice(0, 4).map((j) => j.numero);
  assert.deepEqual(ordem, [16, 18, 17, 19]);
});

test('a regra de avanço sai da chave: melhor 2º no handebol e no basquete, 2 por grupo no futsal e no vôlei', () => {
  const plano = planejarCopa(categorias as never, estadoCom(todasAsEquipes()) as never);
  const avanco = (nome: string) =>
    (plano.acoes as { type: string; payload: { id: string; category: { advancement: { perGroup: number; bestThirds: number } } } }[])
      .find((a) => a.type === 'category/create' && a.payload.id === `copa-${nome}`)!.payload.category.advancement;
  assert.deepEqual([avanco('handebol-masculino').perGroup, avanco('handebol-masculino').bestThirds], [1, 1]);
  assert.deepEqual([avanco('basquete-masculino').perGroup, avanco('basquete-masculino').bestThirds], [1, 1]);
  assert.deepEqual([avanco('futsal-masculino').perGroup, avanco('futsal-masculino').bestThirds], [2, 0]);
  assert.deepEqual([avanco('volei-feminino').perGroup, avanco('volei-feminino').bestThirds], [2, 0]);
  assert.equal(avancoDaChave([], 3).perGroup, 2);
});

test('planejar grava 94 jogos em 8 categorias e rodar de novo não duplica', () => {
  const estado = estadoCom(todasAsEquipes());
  const primeira = planejarCopa(categorias as never, estado as never);
  const por: Record<string, number> = {};
  for (const a of primeira.acoes as { type: string }[]) por[a.type] = (por[a.type] ?? 0) + 1;
  assert.equal(por['match/schedule'], 94);
  assert.equal(por['category/create'], 8);
  assert.equal(por['team/create'] ?? 0, 0);
  assert.equal(por['team/attach'] ?? 0, 0);

  // Aplica na memória e planeja de novo: nada a fazer.
  for (const a of primeira.acoes as { type: string; payload: { id: string; category?: unknown; match?: unknown } }[]) {
    if (a.type === 'category/create') estado.tournaments[a.payload.id] = a.payload.category;
    if (a.type === 'match/schedule') estado.matches[a.payload.id] = a.payload.match;
  }
  const segunda = planejarCopa(categorias as never, estado as never);
  assert.equal((segunda.acoes as { type: string }[]).filter((a) => a.type !== 'discipline/update').length, 0);
});

test('equipe que já está no catálogo é VINCULADA, não criada de novo; só a que não existe é criada', () => {
  // A edição da Copa está vazia. O catálogo tem Incinera e Tormenta (do InterEng).
  const estado = estadoCom([]);
  const catalogo = [
    { id: 'cat-incinera', name: 'Incinera', initials: 'INC', archived: false },
    { id: 'cat-tormenta', name: 'Tormenta', initials: 'TOR', archived: false },
    { id: 'cat-arq', name: 'Predadora', initials: 'PRE', archived: true },
  ];
  const equipesMeta = [{ nome: 'Mafiosa', sigla: 'MAF', responsavel: '', logo: '/teams/mafiosa.webp' }];
  const plano = planejarCopa(categorias as never, estado as never, { catalogo, equipesMeta } as never);
  const acoes = plano.acoes as { type: string; payload: { id: string; team?: { name: string; initials: string; responsible: string; logo?: string } } }[];

  const vinculadas = acoes.filter((a) => a.type === 'team/attach').map((a) => a.payload.id).sort();
  assert.deepEqual(vinculadas, ['cat-incinera', 'cat-tormenta']);

  const criadas = acoes.filter((a) => a.type === 'team/create');
  assert.equal(criadas.length, 18);
  const mafiosa = criadas.find((a) => a.payload.team?.name === 'Mafiosa')!;
  assert.deepEqual([mafiosa.payload.team!.initials, mafiosa.payload.team!.responsible, mafiosa.payload.team!.logo], ['MAF', 'A definir', '/teams/mafiosa.webp']);
  // Arquivada no catálogo: cria outra, mas avisa.
  assert.ok((plano.avisos as string[]).some((a) => a.includes('Predadora') && a.includes('ARQUIVADA')));

  // Nenhuma equipe pode ser criada duas vezes, nem vinculada E criada.
  const nomes = criadas.map((a) => a.payload.team!.name);
  assert.equal(new Set(nomes).size, nomes.length);
  assert.ok(!nomes.includes('Incinera') && !nomes.includes('Tormenta'));

  // Equipes vêm antes de modalidade, categoria e jogo.
  const tipos = acoes.map((a) => a.type);
  const ultimaEquipe = Math.max(tipos.lastIndexOf('team/attach'), tipos.lastIndexOf('team/create'));
  assert.ok(ultimaEquipe < tipos.indexOf('category/create'));
  assert.ok(tipos.indexOf('category/create') < tipos.indexOf('match/schedule'));
});
