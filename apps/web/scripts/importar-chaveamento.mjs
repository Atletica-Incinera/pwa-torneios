/**
 * Importador do chaveamento, a partir da planilha da organização.
 *
 * A planilha traz, numa aba por categoria: a tabela de modalidades, os grupos
 * com as equipes de cada um, e a lista de jogos da fase de grupos com horário
 * e local. Digitar isso na tela seriam 15 partidas por categoria, e são 16
 * categorias — mais de duzentos agendamentos à mão, cada um com horário e
 * ginásio.
 *
 * O QUE ELE NÃO CRIA, DE PROPÓSITO: as partidas do mata-mata. A planilha as
 * descreve como "1 GRUPO A × MELHOR TERCEIRO" e "VENCEDOR J16", e o app não
 * guarda partida com participante indefinido — ele **gera** o mata-mata
 * sozinho quando a fase de grupos termina, a partir da classificação real.
 * Criar essas partidas à mão seria duplicar o que o app faz e brigar com ele
 * na hora em que os grupos acabassem. O que o importador faz é configurar as
 * regras de classificação para que o mata-mata gerado saia igual ao da
 * planilha.
 *
 * SIMULAÇÃO POR PADRÃO. Sem --aplicar nada é gravado.
 *
 * Uso:
 *   $env:INTERENG_SENHA="..."; node scripts/importar-chaveamento.mjs --arquivo "..." --email ana@ufpe.br --data 2026-09-05
 *   ...mesma linha com --aplicar para gravar
 */
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const flag = (nome) => args.includes('--' + nome);
const opcao = (nome, padrao) => {
  const i = args.indexOf('--' + nome);
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao;
};

const API = opcao('api', 'https://incinera.cin.ufpe.br/intereng-api/api/v1');
const EMAIL = opcao('email');
const SENHA = process.env.INTERENG_SENHA;
const ARQUIVO = opcao('arquivo');
const DATA = opcao('data');
const APLICAR = flag('aplicar');
const SO_MODALIDADES = flag('somente-modalidades');

const chave = (texto) => String(texto ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const novoId = (prefixo) => prefixo + '-' + randomUUID().replace(/-/g, '').slice(0, 12);

/** Divide respeitando aspas: nome de local pode ter vírgula. */
function separar(linha) {
  const saida = [];
  let atual = '';
  let dentro = false;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (c === '"') {
      if (dentro && linha[i + 1] === '"') { atual += '"'; i += 1; } else { dentro = !dentro; }
      continue;
    }
    if (c === ',' && !dentro) { saida.push(atual); atual = ''; continue; }
    atual += c;
  }
  saida.push(atual);
  return saida.map((v) => v.trim());
}

/**
 * Lê a planilha como grade de células.
 *
 * A aba não tem cabeçalho: são três blocos lado a lado em colunas fixas. Ler
 * por posição é frágil, então cada bloco é localizado pelo seu rótulo — o
 * bloco de grupos pela célula "GRUPO A", o de jogos pela primeira "JOGO 1", e
 * a tabela de modalidades pela célula "MODALIDADES".
 */
export function lerGrade(caminho) {
  const texto = readFileSync(caminho, 'utf8').replace(/^﻿/, '');
  return texto.split(/\r?\n/).map(separar);
}

function acharCelula(grade, teste) {
  for (let l = 0; l < grade.length; l += 1) {
    for (let c = 0; c < grade[l].length; c += 1) {
      if (teste(grade[l][c] ?? '', c)) return { linha: l, coluna: c };
    }
  }
  return null;
}

/** Modalidades e quantas equipes cada uma tem por gênero. */
export function lerModalidades(grade) {
  const cabecalho = acharCelula(grade, (v) => chave(v) === 'modalidades');
  if (!cabecalho) return [];
  const saida = [];
  for (let l = cabecalho.linha + 1; l < grade.length; l += 1) {
    const nome = grade[l][cabecalho.coluna] ?? '';
    if (!nome.trim()) break;
    saida.push({
      nome: nome.trim(),
      masculino: Number(grade[l][cabecalho.coluna + 1] ?? 0) || 0,
      feminino: Number(grade[l][cabecalho.coluna + 2] ?? 0) || 0,
    });
  }
  return saida;
}

/** Grupos e as equipes de cada um, lidos em colunas. */
export function lerGrupos(grade) {
  // Nem toda aba usa "GRUPO A": o futsal feminino tem "GRUPO ÚNICO", com todo
  // mundo jogando contra todo mundo. O rotulo varia, o prefixo nao.
  const primeiro = acharCelula(grade, (v) => /^grupo/.test(chave(v)));
  if (!primeiro) return [];
  const grupos = [];
  for (let c = primeiro.coluna; c < (grade[primeiro.linha]?.length ?? 0); c += 1) {
    const rotulo = grade[primeiro.linha][c] ?? '';
    if (!/^grupo/.test(chave(rotulo))) continue;
    const equipes = [];
    for (let l = primeiro.linha + 1; l < grade.length; l += 1) {
      const equipe = (grade[l][c] ?? '').trim();
      if (!equipe) break;
      equipes.push(equipe);
    }
    if (equipes.length) grupos.push({ nome: rotulo.trim(), equipes });
  }
  return grupos;
}

/** Jogos da fase de grupos, com horário e local. */
export function colunaDosJogos(grade) {
  const primeiro = acharCelula(grade, (v) => /^jogo\s*1$/.test(chave(v)));
  return primeiro ? primeiro.coluna : -1;
}

export function lerJogos(grade) {
  const primeiro = acharCelula(grade, (v) => /^jogo\s*1$/.test(chave(v)));
  if (!primeiro) return [];
  const jogos = [];
  for (let l = primeiro.linha; l < grade.length; l += 1) {
    const rotulo = (grade[l][primeiro.coluna] ?? '').trim();
    const numero = /^jogo\s*(\d+)$/.exec(chave(rotulo));
    if (!numero) continue;
    const confronto = (grade[l][primeiro.coluna + 1] ?? '').trim();
    if (!confronto) continue;
    // Duas abas usam a letra X e outras o sinal de multiplicacao. Sem os dois,
    // metade dos confrontos sai com o adversario vazio.
    const [casa, fora] = confronto.split(/\s+[x×]\s+/i).map((v) => (v ?? '').trim());
    if (!casa || !fora) continue;
    jogos.push({
      numero: Number(numero[1]),
      casa,
      fora,
      local: (grade[l][primeiro.coluna + 3] ?? '').trim(),
      horario: (grade[l][primeiro.coluna + 4] ?? '').trim(),
    });
  }
  return jogos.sort((a, b) => a.numero - b.numero);
}

/**
 * Bloco do mata-mata: os confrontos que dependem de resultado, com horário e
 * local.
 *
 * Fica num bloco próprio, à esquerda da fase de grupos, e por isso não é lido
 * por `lerJogos`. As partidas em si o app cria sozinho ao fim dos grupos; o
 * que se aproveita daqui é a AGENDA — dia, hora e ginásio de cada uma. Sem
 * isso são oito reagendamentos manuais por categoria, e são dezesseis
 * categorias.
 */
export function lerMataMata(grade, colunaDosJogos) {
  // O mata-mata mora num bloco proprio, numa coluna diferente da fase de
  // grupos. Prender a leitura em "JOGO 16" so funcionava no futsal masculino:
  // no voleibol feminino ele comeca no JOGO 7, e no queimado no JOGO 13.
  const primeiro = acharCelula(
    grade,
    (v, coluna) => /^jogo\s*\d+$/.test(chave(v)) && coluna !== colunaDosJogos,
  );
  if (!primeiro) return [];
  const jogos = [];
  for (let l = primeiro.linha; l < grade.length; l += 1) {
    const rotulo = (grade[l][primeiro.coluna] ?? '').trim();
    const numero = /^jogo\s*(\d+)$/.exec(chave(rotulo));
    if (!numero) continue;
    const casa = (grade[l][primeiro.coluna + 1] ?? '').trim();
    const fora = (grade[l][primeiro.coluna + 3] ?? '').trim();
    if (!casa || !fora) continue;
    jogos.push({
      numero: Number(numero[1]),
      casa,
      fora,
      local: (grade[l][primeiro.coluna + 6] ?? '').trim(),
      horario: (grade[l][primeiro.coluna + 9] ?? '').trim(),
    });
  }
  return jogos.sort((a, b) => a.numero - b.numero);
}

/**
 * Nome da modalidade como o app a conhece.
 *
 * O regulamento padrao e resolvido por nome EXATO: "Vôlei" nasce por sets,
 * "Xadrez" por rodadas, "Natação" por prova. Criar "VOLEIBOL" em caixa alta
 * nao casa com nenhum preset, e a modalidade nasceria com regra de futebol --
 * dois tempos de vinte minutos com cronometro regressivo -- no que deveria ser
 * um jogo de sets.
 *
 * Queimado e Tenis de Mesa nao tem preset nenhum: entram com a regra generica
 * e precisam de regulamento a mao. O importador diz quais sao.
 */
const NOMES_DO_APP = {
  futsal: 'Futsal',
  basquete: 'Basquete',
  handebol: 'Handebol',
  voleibol: 'Vôlei',
  volei: 'Vôlei',
  xadrez: 'Xadrez',
  natacao: 'Natação',
  queimado: 'Queimado',
  'tenis de mesa': 'Tênis de Mesa',
};
const COM_REGULAMENTO_PRONTO = new Set(['Futsal', 'Vôlei', 'Handebol', 'Xadrez', 'Natação', 'Basquete']);
/** Esporte disputado por pessoa, nao por equipe. */
const INDIVIDUAIS = new Set(['Xadrez', 'Natação', 'Tênis de Mesa']);

/**
 * "HANDEBOL MASCULINO" vira "Handebol Masculino".
 *
 * Preposicao fica minuscula: "Tenis de Mesa Feminino", nao "Tenis De Mesa
 * Feminino".
 */
export function emCaixaDeTitulo(texto) {
  const minusculas = new Set(['de', 'do', 'da', 'dos', 'das', 'e']);
  return texto
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .filter(Boolean)
    .map((palavra, i) =>
      i > 0 && minusculas.has(palavra)
        ? palavra
        : palavra.charAt(0).toLocaleUpperCase('pt-BR') + palavra.slice(1),
    )
    .join(' ');
}

export function nomeNoApp(daPlanilha) {
  return NOMES_DO_APP[chave(daPlanilha)] ?? daPlanilha.trim();
}

/** Confronto que depende de resultado — o app monta esses sozinho. */
export const dependeDeResultado = (nome) => /vencedor|perdedor|melhor terceiro|^\d+\s+grupo/.test(chave(nome ?? ''));

/**
 * Posicao da partida no chaveamento, a partir do id que o app gera.
 *
 * O app nomeia as partidas geradas por rodada e vaga (`-advanced-r1-2`), com
 * a final e a disputa de terceiro por nome. A ordem aqui e a mesma da
 * planilha: quartas, semis, terceiro lugar e final.
 */
export function ordemNoChaveamento(id) {
  const rodada = /-advanced-r(\d+)-(\d+)$/.exec(id);
  if (rodada) return Number(rodada[1]) * 100 + Number(rodada[2]);
  if (id.endsWith('-advanced-semi-1')) return 201;
  if (id.endsWith('-advanced-semi-2')) return 202;
  if (id.endsWith('-advanced-third')) return 900;
  if (id.endsWith('-advanced-final')) return 901;
  return 999;
}

/**
 * Configuração da categoria a partir do que a planilha diz.
 *
 * Fica separada do envio para poder ser verificada sem servidor. A primeira
 * versão referenciava uma variável que não existia (`groups` em vez de
 * `grupos`) e o erro atravessou build, `node --check` e três simulações — só
 * apareceu no `--aplicar`, porque a simulação retorna antes de montar isto.
 * Toda a montagem estava sem teste, e um erro de digitação sobreviveu a isso.
 */
export function montarConfiguracao(plano, { editionId, nome, modalidade }) {
  const grupos = plano.grupos.map((g) => g.nome);
  const assignments = {};
  for (const grupo of plano.grupos) {
    for (const equipe of grupo.equipes) {
      const resolvida = plano.participantes.find((p) => chave(p) === chave(equipe));
      if (resolvida) assignments[resolvida] = grupo.nome;
    }
  }
  return {
    created: true,
    editionId,
    name: nome,
    discipline: modalidade,
    status: 'Rascunho',
    participants: plano.participantes,
    seeds: Object.fromEntries(plano.participantes.map((equipe, i) => [equipe, i + 1])),
    assignments,
    generated: false,
    phases: [
      { id: 'groups', name: 'Fase de grupos', format: 'Grupos', groups: grupos, qualifiers: 2 },
      { id: 'knockout', name: 'Mata-mata', format: 'Mata-mata', groups: [], qualifiers: 1 },
    ],
    // O mata-mata da planilha: os dois primeiros de cada grupo mais os dois
    // melhores terceiros fecham as oito vagas das quartas. Com zero melhores
    // terceiros sobram seis, e o chaveamento nao fecha.
    advancement: { perGroup: 2, bestThirds: 2, crossing: 'padrao', thirdPlaceMatch: true },
  };
}

async function entrar() {
  const resposta = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error('Login recusado (' + resposta.status + '): ' + JSON.stringify(corpo));
  const token = corpo?.data?.token;
  if (!token) throw new Error('A API respondeu sem token.');
  return token;
}

async function estadoAtual(token) {
  const resposta = await fetch(API + '/editions/active/snapshot', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error('Snapshot recusado (' + resposta.status + '): ' + JSON.stringify(corpo));
  return corpo.data ?? {};
}

async function despachar(token, acao) {
  const resposta = await fetch(API + '/editions/active/actions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
      'Idempotency-Key': novoId('chaveamento'),
      'X-Operator-Id': 'importador-chaveamento',
    },
    body: JSON.stringify(acao),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error('HTTP ' + resposta.status + ' — ' + JSON.stringify(corpo));
  }
  return corpo;
}

export function planejar(grade, estado) {
  const avisos = [];
  const grupos = lerGrupos(grade);
  const jogos = lerJogos(grade);
  const modalidades = lerModalidades(grade);

  const equipesDaEdicao = Object.values(estado.teams ?? {}).map((t) => t.name).filter(Boolean);
  const porChave = new Map(equipesDaEdicao.map((nome) => [chave(nome), nome]));
  const resolver = (nome) => porChave.get(chave(nome));

  const inscritas = grupos.flatMap((g) => g.equipes);
  for (const equipe of inscritas) {
    if (!resolver(equipe)) avisos.push(`A equipe "${equipe}" dos grupos não existe na edição.`);
  }

  // Equipe listada num grupo e que não joga nada é sinal de erro de digitação
  // na planilha, e o erro engole uma equipe inteira sem avisar.
  const emJogos = new Set();
  const daFaseDeGrupos = [];
  for (const jogo of jogos) {
    if (dependeDeResultado(jogo.casa) || dependeDeResultado(jogo.fora)) {
      avisos.push(`Jogo ${jogo.numero} depende de resultado ("${jogo.casa} × ${jogo.fora}") — o app monta esse sozinho ao fim dos grupos.`);
      continue;
    }
    const casa = resolver(jogo.casa);
    const fora = resolver(jogo.fora);
    if (!casa || !fora) {
      avisos.push(`Jogo ${jogo.numero}: equipe desconhecida em "${jogo.casa} × ${jogo.fora}".`);
      continue;
    }
    emJogos.add(chave(casa));
    emJogos.add(chave(fora));
    const grupo = grupos.find((g) => g.equipes.some((e) => chave(e) === chave(casa)));
    daFaseDeGrupos.push({ ...jogo, casa, fora, grupo: grupo?.nome ?? '' });
  }
  for (const equipe of inscritas) {
    const resolvida = resolver(equipe);
    if (resolvida && !emJogos.has(chave(resolvida))) {
      avisos.push(`"${equipe}" está num grupo mas não aparece em jogo nenhum — confira a planilha.`);
    }
  }

  return { grupos, jogos, modalidades, daFaseDeGrupos, avisos, participantes: inscritas.map(resolver).filter(Boolean) };
}

async function main() {
  if (!EMAIL) throw new Error('Informe --email.');
  if (!SENHA) throw new Error('Defina INTERENG_SENHA. Ela não entra por argumento: argumento fica no histórico do terminal.');
  if (!ARQUIVO || !existsSync(ARQUIVO)) throw new Error('Informe --arquivo com o caminho do CSV da categoria.');

  const grade = lerGrade(ARQUIVO);
  const token = await entrar();
  const estado = await estadoAtual(token);
  const plano = planejar(grade, estado);

  /*
   * O nome vem do arquivo, e o arquivo vem da planilha em caixa alta:
   * "HANDEBOL MASCULINO". As categorias que ja existem no app sao "Futsal
   * Masculino". Importar sem normalizar deixaria a lista com metade gritando.
   */
  const nomeDoArquivo = (opcao('categoria') ?? ARQUIVO.split(/[\\/]/).pop().replace(/\.csv$/i, '').split(' - ').pop()).trim();
  const nomeDaCategoria = opcao('categoria') ? nomeDoArquivo : emCaixaDeTitulo(nomeDoArquivo);
  /*
   * A modalidade tem de sair com a grafia que existe na edicao, nao a da
   * planilha. A API busca por nome exato: a planilha escreve "FUTSAL" em caixa
   * alta e a edicao tem "Futsal", e sem casar isso a criacao da categoria
   * falha logo na primeira acao com "a modalidade nao pertence a esta edicao".
   */
  // Passa pela mesma traducao que o modo de criar modalidades usa: a planilha
  // diz "VOLEIBOL" e a edicao tem "Vôlei". Sem isto, a categoria de voleibol
  // era recusada por uma modalidade que existe.
  const pedida = nomeNoApp(opcao('modalidade') ?? nomeDaCategoria.split(/\s+/)[0]);
  const naEdicao = Object.values(estado.disciplines ?? {})
    .map((d) => d?.name)
    .filter(Boolean);
  const modalidade = naEdicao.find((nome) => chave(nome) === chave(pedida));

  console.log('');
  console.log('Arquivo    ' + ARQUIVO);
  console.log('Categoria  ' + nomeDaCategoria + '  (modalidade: ' + (modalidade ?? '"' + pedida + '" NAO EXISTE NA EDICAO') + ')');
  console.log('Data       ' + (DATA ?? '(use --data AAAA-MM-DD)'));
  console.log('');
  console.log('Modalidades na planilha: ' + plano.modalidades.map((m) => `${m.nome} (${m.masculino}M/${m.feminino}F)`).join(', '));
  console.log('');
  for (const grupo of plano.grupos) console.log(`  ${grupo.nome}: ${grupo.equipes.join(', ')}`);
  console.log('');
  console.log(`Jogos da fase de grupos a agendar: ${plano.daFaseDeGrupos.length}`);
  for (const jogo of plano.daFaseDeGrupos) {
    console.log(`  J${String(jogo.numero).padStart(2)} ${jogo.horario.padEnd(6)} ${jogo.local.padEnd(20)} ${jogo.casa} × ${jogo.fora}  [${jogo.grupo}]`);
  }

  if (opcao('categoria-id')) {
    const alvo = estado.tournaments?.[opcao('categoria-id')];
    console.log('');
    console.log('Vai PREENCHER a categoria que ja existe: ' + (alvo?.name ?? '(nao encontrada)'));
    if (alvo) {
      const gruposAtuais = (alvo.phases ?? []).flatMap((f) => f.groups ?? []);
      console.log('  antes:  ' + (alvo.participants?.length ?? 0) + ' equipes, grupos [' + (gruposAtuais.join(', ') || 'nenhum') + ']');
      console.log('  depois: ' + plano.participantes.length + ' equipes, grupos [' + plano.grupos.map((g) => g.nome).join(', ') + ']');
      console.log('  Nome, modalidade e situacao ficam como estao.');
    }
  }

  if (plano.avisos.length) {
    console.log('');
    console.log(`Avisos (${plano.avisos.length}):`);
    for (const aviso of plano.avisos) console.log('  ! ' + aviso);
  }

  /*
   * Criar modalidade nao depende de categoria nem de data, e precisa rodar
   * antes da saida antecipada da simulacao -- do contrario um teste seco
   * nunca mostraria o que seria criado.
   */
  if (SO_MODALIDADES) {
    for (const m of plano.modalidades) {
      const nome = nomeNoApp(m.nome);
      const jaExiste = naEdicao.some((existente) => chave(existente) === chave(nome));
      const modo = INDIVIDUAIS.has(nome) ? 'Individual' : 'Coletiva';
      const pronto = COM_REGULAMENTO_PRONTO.has(nome);
      console.log(
        `  ${jaExiste ? 'ja existe' : 'criar   '}  ${nome.padEnd(14)} ${modo.padEnd(10)} ` +
        `${pronto ? 'regulamento pronto' : 'REGULAMENTO A DEFINIR'}` +
        (chave(nome) === chave(m.nome) ? '' : `  (planilha: ${m.nome})`),
      );
      if (jaExiste || !APLICAR) continue;
      await despachar(token, {
        type: 'discipline/update',
        payload: { name: nome, patch: { enabled: true, mode: modo } },
        audit: { action: 'Modalidade habilitada', entity: nome, after: modo },
      });
    }
    const semRegra = plano.modalidades
      .map((m) => nomeNoApp(m.nome))
      .filter((nome) => !COM_REGULAMENTO_PRONTO.has(nome));
    if (semRegra.length) {
      console.log('');
      console.log('! Sem regulamento pronto no app: ' + semRegra.join(', ') + '.');
      console.log('  Elas nascem com a regra generica (2 tempos de 20 min com cronometro).');
      console.log('  Abra cada uma em Modalidades -> Editar regras antes do evento.');
    }
    if (!APLICAR) {
      console.log('');
      console.log('SIMULACAO — nada foi gravado. Repita com --aplicar para executar.');
    }
    return;
  }

  if (!modalidade) {
    console.log('');
    console.log('! A modalidade "' + pedida + '" nao existe nesta edicao. Ha: ' + (naEdicao.join(', ') || '(nenhuma)') + '.');
    console.log('  Crie a modalidade no app antes, ou informe --modalidade com o nome exato.');
  }

  if (!APLICAR) {
    console.log('');
    console.log('SIMULACAO — nada foi gravado. Repita com --aplicar para executar.');
    return;
  }
  if (!DATA) throw new Error('Para gravar, informe --data AAAA-MM-DD (o dia dos jogos desta categoria).');
  if (!modalidade) throw new Error('A modalidade "' + pedida + '" nao existe nesta edicao — crie-a antes de importar o chaveamento.');

  if (flag('mata-mata')) {
    /*
     * Agenda o mata-mata que o app ja gerou.
     *
     * Roda DEPOIS que a fase de grupos termina: antes disso as partidas nao
     * existem, porque quem as cria e a classificacao real. O que se faz aqui e
     * so por dia, hora e ginasio nelas, na ordem do chaveamento -- quartas,
     * semis, terceiro lugar e final.
     */
    const agenda = lerMataMata(grade, colunaDosJogos(grade));
    if (!agenda.length) throw new Error('A planilha nao tem bloco de mata-mata.');
    const daCategoria = Object.entries(estado.matches ?? {})
      .filter(([id, partida]) => partida.tournamentId === opcao('categoria-id') && id.includes('-advanced'))
      .map(([id, partida]) => ({ id, partida, ordem: ordemNoChaveamento(id) }))
      .sort((a, b) => a.ordem - b.ordem);

    if (!daCategoria.length) {
      throw new Error('Nenhuma partida de mata-mata encontrada. Ela so existe depois que a fase de grupos termina.');
    }
    if (daCategoria.length !== agenda.length) {
      console.log(`! A planilha tem ${agenda.length} jogos de mata-mata e o app gerou ${daCategoria.length}. Confira antes de aplicar.`);
    }

    console.log('');
    for (let i = 0; i < Math.min(agenda.length, daCategoria.length); i += 1) {
      const alvo = daCategoria[i];
      const desejado = agenda[i];
      console.log(`  J${desejado.numero}  ${DATA ?? '(--data)'} ${desejado.horario} ${desejado.local}  <-  ${alvo.partida.entryA} x ${alvo.partida.entryB}`);
    }
    if (!APLICAR) {
      console.log('');
      console.log('SIMULACAO — nada foi gravado. Repita com --aplicar para executar.');
      return;
    }
    for (let i = 0; i < Math.min(agenda.length, daCategoria.length); i += 1) {
      const alvo = daCategoria[i];
      const desejado = agenda[i];
      await despachar(token, {
        type: 'match/update',
        payload: { id: alvo.id, patch: { date: DATA, time: desejado.horario, venue: desejado.local } },
        audit: { action: 'Jogo reagendado', entity: `${alvo.partida.entryA} x ${alvo.partida.entryB}`, after: `${DATA} ${desejado.horario}` },
      });
    }
    console.log('');
    console.log(`Concluido: ${Math.min(agenda.length, daCategoria.length)} jogos do mata-mata agendados.`);
    return;
  }


  /*
   * Preencher uma categoria que ja existe, em vez de criar outra.
   *
   * A organizacao comecou a montar o Futsal Masculino pela tela e parou no
   * meio. Criar uma segunda deixaria duas com o mesmo nome na lista, e o app
   * nao tem exclusao de categoria -- desfazer sairia caro.
   */
  const existenteId = opcao('categoria-id');
  const existente = existenteId ? estado.tournaments?.[existenteId] : undefined;
  if (existenteId && !existente) throw new Error(`A categoria "${existenteId}" nao existe nesta edicao.`);
  const categoriaId = existenteId ?? novoId('category');
  const configuracao = montarConfiguracao(plano, {
    editionId: estado.editions?.find((e) => e.active)?.id,
    nome: nomeDaCategoria,
    modalidade,
  });

  if (existente) {
    // Nome, modalidade e situacao sao de quem criou a categoria: o importador
    // preenche a estrutura, nao renomeia o que a organizacao ja decidiu.
    await despachar(token, {
      type: 'category/update',
      payload: {
        id: categoriaId,
        setup: {
          ...existente,
          participants: configuracao.participants,
          seeds: configuracao.seeds,
          assignments: configuracao.assignments,
          phases: configuracao.phases,
          advancement: configuracao.advancement,
          generated: false,
        },
      },
      audit: { action: 'Categoria configurada pelo chaveamento', entity: existente.name ?? nomeDaCategoria, after: `${plano.grupos.length} grupos` },
    });
    console.log('  categoria preenchida: ' + (existente.name ?? nomeDaCategoria));
  } else {
    await despachar(token, {
      type: 'category/create',
      payload: { id: categoriaId, category: configuracao },
      audit: { action: 'Categoria criada', entity: nomeDaCategoria, after: modalidade },
    });
    console.log('  categoria criada: ' + nomeDaCategoria);
  }

  let agendados = 0;
  const falhas = [];
  for (const jogo of plano.daFaseDeGrupos) {
    try {
      await despachar(token, {
        type: 'match/schedule',
        payload: {
          id: novoId('match'),
          match: {
            created: true,
            editionId: estado.editions?.find((e) => e.active)?.id,
            tournamentId: categoriaId,
            discipline: modalidade,
            entryA: jogo.casa,
            entryB: jogo.fora,
            phase: jogo.grupo,
            date: DATA,
            time: jogo.horario || '08:00',
            venue: jogo.local || 'A definir',
            status: 'Agendada',
            scoreA: null,
            scoreB: null,
          },
        },
        audit: { action: 'Jogo agendado', entity: `${jogo.casa} × ${jogo.fora}`, after: `${DATA} ${jogo.horario}` },
      });
      agendados += 1;
    } catch (erro) {
      falhas.push(`J${jogo.numero} ${jogo.casa} × ${jogo.fora}: ${erro.message}`);
    }
  }

  console.log('');
  console.log(`Concluido: ${agendados} jogos agendados, ${falhas.length} falhas.`);
  for (const falha of falhas) console.log('  ! ' + falha);
  console.log('O mata-mata sai sozinho quando a fase de grupos terminar.');
}

// Só executa quando chamado direto: o teste importa as funções de leitura.
if (process.argv[1] && process.argv[1].endsWith('importar-chaveamento.mjs')) main().catch((erro) => {
  console.error('\nFalhou: ' + erro.message);
  process.exitCode = 1;
});
