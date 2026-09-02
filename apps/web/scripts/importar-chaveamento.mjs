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
 *
 * Repita --arquivo/--categoria-id para varias planilhas num login so.
 *
 *   --categoria-id <id>         preenche a categoria que ja existe. Um por
 *                               --arquivo, na mesma ordem; use "-" para a
 *                               planilha que deve criar categoria nova
 *   --dia-mata-mata AAAA-MM-DD  sobrepoe o dia da chave (a agenda ja o traz)
 *   --so-mata-mata              cadastra so a chave, sem tocar na fase de
 *                               grupos
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
/** Todas as ocorrencias de --arquivo: varias planilhas num login so. */
const ARQUIVOS = args.reduce((lista, atual, indice) => (
  atual === '--arquivo' && args[indice + 1] ? [...lista, args[indice + 1]] : lista
), []);
const ARQUIVO = ARQUIVOS[0];
/*
 * Um --categoria-id por --arquivo, na mesma ordem.
 *
 * Era uma opcao unica, e com varias planilhas ela valia para todas: a
 * configuracao do Basquete Feminino iria parar dentro da categoria do Futsal
 * Masculino, sobrescrevendo grupos e equipes de uma categoria ja publicada.
 *
 * Use "-" para a planilha que deve criar categoria nova.
 */
const CATEGORIAS = args.reduce(
  (lista, atual, indice) =>
    atual === '--categoria-id' && args[indice + 1] ? [...lista, args[indice + 1]] : lista,
  [],
);
const categoriaDoArquivo = (indice) => {
  const informada = CATEGORIAS[indice];
  return informada && informada !== '-' ? informada : undefined;
};
const DIAS = opcao('dias');
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
const HORA = /^\d{1,2}:\d{2}$/;
/** Texto que ocupa a celula de horario ou local sem dizer nada. */
const SEM_INFORMACAO = new Set(['a seguir', 'a definir', 'a confirmar', 'xxxx', '-']);

/**
 * Local e horario de uma linha do mata-mata, achados pelo que a celula E.
 *
 * O bloco nao tem sempre as mesmas colunas: as abas normais trazem uma coluna
 * de situacao ("A SEGUIR") antes do local, e a do Queimado nao. Lendo por
 * posicao fixa, o Queimado saia com local e horario vazios -- e foi por isso
 * que aquela categoria ficou de fora do app.
 *
 * A janela e curta de proposito: logo depois dela comeca o bloco da fase de
 * grupos, e um confronto de la viraria "local" se a busca fosse mais longe.
 */
function localEHorario(linha, de, ate) {
  let local = '';
  let horario = '';
  for (let coluna = de; coluna <= ate; coluna += 1) {
    const valor = (linha[coluna] ?? '').trim();
    if (!valor || SEM_INFORMACAO.has(chave(valor))) continue;
    if (HORA.test(valor)) {
      if (!horario) horario = valor;
      continue;
    }
    if (!local) local = valor;
  }
  return { local, horario };
}

/**
 * Confrontos de um bloco "RODADAS", sem rotulo de jogo.
 *
 * O Queimado lista os jogos da fase de grupos num bloco proprio, um por linha,
 * sem "JOGO N" e sem horario. Como as referencias da propria aba contam por
 * essa ordem ("PERDEDOR J3" e o terceiro da lista), a numeracao sai da ordem
 * em que aparecem.
 */
export function lerRodadas(grade) {
  const cabecalho = acharCelula(grade, (v) => /^rodadas\b/.test(chave(v)));
  if (!cabecalho) return [];
  const jogos = [];
  for (let l = cabecalho.linha + 1; l < grade.length; l += 1) {
    const confronto = (grade[l][cabecalho.coluna] ?? '').trim();
    // Linha em branco fecha o bloco: o que vem depois, na mesma coluna, ja e
    // outra coisa da planilha.
    if (!confronto) {
      if (jogos.length) break;
      continue;
    }
    const [casa, fora] = confronto.split(/\s+[x×]\s+/i).map((v) => (v ?? '').trim());
    if (!casa || !fora) continue;
    jogos.push({ numero: jogos.length + 1, casa, fora, local: '', horario: '' });
  }
  return jogos;
}

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
      ...localEHorario(grade[l], primeiro.coluna + 4, primeiro.coluna + 9),
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
/**
 * Dia de cada categoria, lido da aba "DIAS X MODALIDADES".
 *
 * A data era um argumento por execucao, e com sete planilhas isso vira sete
 * logins -- o servidor permite dez por cinco minutos, entao simular e aplicar
 * cada uma estourava o limite no meio do trabalho. A organizacao ja escreveu
 * essa agenda; ler dali evita repetir o que ela ja decidiu e permite importar
 * tudo num login so.
 *
 * O cabecalho traz "05/09", "06/09", "07/09" em colunas separadas, e abaixo de
 * cada uma as categorias daquele dia.
 */
export function lerDias(grade, ano) {
  const cabecalho = grade.findIndex((linha) =>
    linha.some((celula) => /^\d{2}\/\d{2}$/.test((celula ?? '').trim())),
  );
  if (cabecalho < 0) return new Map();
  const porCategoria = new Map();
  grade[cabecalho].forEach((celula, coluna) => {
    const dia = /^(\d{2})\/(\d{2})$/.exec((celula ?? '').trim());
    if (!dia) return;
    const data = `${ano}-${dia[2]}-${dia[1]}`;
    for (let l = cabecalho + 1; l < grade.length; l += 1) {
      const categoria = (grade[l][coluna] ?? '').trim();
      if (!categoria) continue;
      // A primeira ocorrencia manda: o futsal masculino aparece no dia 6 (fase
      // de grupos) e no 7 (mata-mata), e o que se importa aqui sao os grupos.
      if (!porCategoria.has(chave(categoria))) porCategoria.set(chave(categoria), data);
    }
  });
  return porCategoria;
}

/**
 * O dia do mata-mata de cada categoria, da mesma agenda.
 *
 * Aqui manda a ULTIMA ocorrencia, e nao a primeira: o futsal masculino aparece
 * no dia 6 e no 7, e o segundo e o dia da chave. Para quem so aparece uma vez,
 * os dois dias coincidem -- que e o certo, a chave e no mesmo dia dos grupos.
 *
 * Sem isto, o mata-mata do futsal masculino entraria na agenda no dia errado:
 * oito jogos com dia e hora publicados, todos vinte e quatro horas adiantados.
 */
export function lerDiasDeMataMata(grade, ano) {
  const cabecalho = grade.findIndex((linha) =>
    linha.some((celula) => /^\d{2}\/\d{2}$/.test((celula ?? '').trim())),
  );
  if (cabecalho < 0) return new Map();
  const porCategoria = new Map();
  grade[cabecalho].forEach((celula, coluna) => {
    const dia = /^(\d{2})\/(\d{2})$/.exec((celula ?? '').trim());
    if (!dia) return;
    const data = `${ano}-${dia[2]}-${dia[1]}`;
    for (let l = cabecalho + 1; l < grade.length; l += 1) {
      const categoria = (grade[l][coluna] ?? '').trim();
      if (categoria) porCategoria.set(chave(categoria), data);
    }
  });
  return porCategoria;
}

/**
 * O local de cada categoria, da mesma agenda que da o dia.
 *
 * A coluna seguinte a de cada data e o local. Serve de recurso para o jogo
 * cuja linha nao traz local nenhum -- o bloco "RODADAS" do Queimado e assim, e
 * os nove jogos dele entrariam com "A definir" mesmo a organizacao tendo
 * escrito QUADRA DE VOLEI aqui e no bloco do mata-mata da propria aba.
 *
 * Recurso, nao preferencia: o local escrito na linha do jogo continua mandando,
 * porque e o mais especifico. Uma celula pode trazer mais de um local em linhas
 * separadas (o volei masculino usa dois ginasios); nesse caso vale o primeiro,
 * que e o unico que da para atribuir sem inventar.
 */
export function lerLocais(grade) {
  const cabecalho = grade.findIndex((linha) =>
    linha.some((celula) => /^\d{2}\/\d{2}$/.test((celula ?? '').trim())),
  );
  if (cabecalho < 0) return new Map();
  const porCategoria = new Map();
  grade[cabecalho].forEach((celula, coluna) => {
    if (!/^\d{2}\/\d{2}$/.test((celula ?? '').trim())) return;
    for (let l = cabecalho + 1; l < grade.length; l += 1) {
      const categoria = (grade[l][coluna] ?? '').trim();
      // A celula com dois locais chega unida ("GINASIO B | GINASIO A"): vale o
      // primeiro, que e o unico que da para atribuir sem inventar.
      const local = (grade[l][coluna + 1] ?? '')
        .split(/\s*[|\n]\s*/)
        .map((v) => v.trim())
        .find(Boolean);
      if (!categoria || !local) continue;
      if (!porCategoria.has(chave(categoria))) porCategoria.set(chave(categoria), local);
    }
  });
  return porCategoria;
}

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
 * O rotulo como o publico vai ler: "PERDEDOR J3" vira "Perdedor do Jogo 3".
 * O texto da planilha e escrito para caber numa celula, nao para ir ao ar.
 */
export function rotuloDoConfronto(nome) {
  const texto = (nome ?? '').trim();
  const jogo = /^(vencedor|perdedor)\s*(?:do\s*)?(?:jogo\s*)?j?\s*(\d+)$/i.exec(chave(texto));
  if (!jogo) return texto;
  const verbo = jogo[1].toLowerCase() === 'vencedor' ? 'Vencedor' : 'Perdedor';
  return `${verbo} do Jogo ${Number(jogo[2])}`;
}

/** O lado depende de outro jogo do mata-mata, nao da classificacao dos grupos. */
export const dependeDeOutroJogo = (nome) => /^(vencedor|perdedor)\b/.test(chave(nome ?? ''));

/**
 * A colocacao a que o rotulo se refere. Mesma gramatica de
 * `colocacao-do-chaveamento.ts` na API: aqui ela serve para RECUSAR a planilha
 * que a API nao saberia resolver, antes de aplicar. Sao repositorios separados,
 * e sem esta checagem a divergencia so apareceria quando os grupos acabassem --
 * no meio do evento.
 */
export function lerColocacao(rotulo) {
  // O "º" tem de cair aqui: `chave` nao o remove (nome de equipe pode te-lo), e
  // sem isso "2º MELHOR TERCEIRO" nao casa com nada. A API normaliza igual.
  const texto = chave(rotulo ?? '')
    .toUpperCase()
    .replace(/[º°ª]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!texto) return null;
  const ordinais = { PRIMEIRO: 1, SEGUNDO: 2, TERCEIRO: 3, QUARTO: 4 };
  // Os terceiros primeiro: "MELHOR TERCEIRO COLOCADO" tambem casaria com a
  // forma "MELHOR <grupo>", e viraria uma busca pelo grupo "TERCEIRO COLOCADO".
  const terceiro = /^(?:(\d+)|(PRIMEIRO|SEGUNDO|TERCEIRO|QUARTO))?\s*MELHOR(?:ES)? TERCEIROS?(?: COLOCADOS?)?$/.exec(texto);
  if (terceiro) {
    const posicao = terceiro[1] ? Number(terceiro[1]) : (ordinais[terceiro[2]] ?? 1);
    return posicao > 0 ? { tipo: 'melhor-terceiro', posicao } : null;
  }
  const porNumero = /^(\d+) GRUPO (.+)$/.exec(texto);
  if (porNumero) {
    const posicao = Number(porNumero[1]);
    return posicao > 0 ? { tipo: 'grupo', grupo: porNumero[2].replace(/^GRUPO\s+/, ''), posicao } : null;
  }
  const porAdjetivo = /^(?:(PRIMEIRO|SEGUNDO|TERCEIRO|QUARTO) )?MELHOR(?: CLASSIFICADO)?(?: DO)?(?: GRUPO)? (.+)$/.exec(texto);
  if (porAdjetivo) {
    return { tipo: 'grupo', grupo: porAdjetivo[2].replace(/^GRUPO\s+/, ''), posicao: ordinais[porAdjetivo[1]] ?? 1 };
  }
  return null;
}

/**
 * O mata-mata da planilha, traduzido para as vagas que o app usa.
 *
 * A traducao e ESTRUTURAL de proposito: pela natureza de cada confronto e pela
 * ordem em que aparecem, nunca pelos numeros de jogo que a planilha cita. Esses
 * numeros estao errados em duas das tres categorias que tem mata-mata:
 *
 *   Futsal Masculino: as quartas sao J16..J19, mas a semifinal diz
 *   "VENCEDOR J15 x VENCEDOR J16" -- uma casa deslocada, e J15 e um jogo da
 *   fase de grupos.
 *
 *   Basquete Masculino: as semifinais sao J13 e J14, e a final diz
 *   "VENCEDOR J19 x VENCEDOR J20" -- jogos que nao existem nessa categoria.
 *
 * Ler pela estrutura acerta as tres. Ler pelos numeros erraria duas.
 *
 *   - quem sai da classificacao dos grupos e a primeira rodada, na ordem da
 *     planilha;
 *   - quem sai de VENCEDOR preenche as rodadas seguintes, na ordem da planilha,
 *     metade das vagas a cada rodada;
 *   - quem sai de PERDEDOR e a disputa de terceiro.
 *
 * A ordem das vagas casa com a que o app usa para progredir a chave: o
 * vencedor da vaga 1 e da vaga 2 se encontram na vaga 1 da rodada seguinte.
 */
export function vagasDoMataMata(jogos) {
  const daClassificacao = jogos.filter((j) => !dependeDeOutroJogo(j.casa) && !dependeDeOutroJogo(j.fora));
  const deVencedor = jogos.filter((j) => /^vencedor/.test(chave(j.casa)) || /^vencedor/.test(chave(j.fora)));
  const dePerdedor = jogos.filter((j) => /^perdedor/.test(chave(j.casa)) && /^perdedor/.test(chave(j.fora)));

  const vagas = [];
  daClassificacao.forEach((jogo, indice) => {
    vagas.push({ ...jogo, rodada: 1, vaga: indice + 1, sufixo: `advanced-r1-${indice + 1}` });
  });

  let restantes = daClassificacao.length;
  let rodada = 1;
  let proximos = [...deVencedor];
  while (restantes > 1 && proximos.length) {
    rodada += 1;
    restantes = Math.floor(restantes / 2);
    for (let vaga = 1; vaga <= restantes && proximos.length; vaga += 1) {
      const jogo = proximos.shift();
      vagas.push({ ...jogo, rodada, vaga, sufixo: `advanced-r${rodada}-${vaga}` });
    }
  }
  // Sobrou jogo de VENCEDOR sem vaga: a planilha tem mais jogos do que a chave
  // comporta. Volta como aviso em vez de virar partida solta.
  const sobraram = proximos;

  for (const jogo of dePerdedor) {
    vagas.push({ ...jogo, rodada, vaga: null, sufixo: 'advanced-third' });
  }

  /*
   * Os rotulos que vao para o publico sao REESCRITOS a partir da estrutura, e
   * nao copiados da planilha.
   *
   * A planilha cita numeros de jogo errados: a semifinal do futsal masculino
   * diz "VENCEDOR J15", quando J15 e um jogo da fase de grupos e a quartas de
   * final e a J16. Publicar isso mandaria a torcida conferir o jogo errado.
   *
   * A primeira rodada fica como esta: la os rotulos sao colocacoes de grupo
   * ("1 GRUPO A"), estao certos, e sao justamente o que a API resolve.
   */
  const porVaga = new Map(vagas.filter((v) => v.vaga).map((v) => [v.rodada + ':' + v.vaga, v]));
  const numeroDaOrigem = (rodada, vaga) => porVaga.get(rodada + ':' + vaga)?.numero;
  const rotulo = (verbo, rodada, vaga) => {
    const numero = numeroDaOrigem(rodada, vaga);
    return numero ? `${verbo} do Jogo ${numero}` : null;
  };
  const ultimaComDuas = Math.max(
    0,
    ...[...porVaga.values()].filter((v) => v.vaga === 2).map((v) => v.rodada),
  );
  for (const vaga of vagas) {
    if (vaga.rodada === 1 && vaga.vaga) {
      vaga.rotuloA = vaga.casa;
      vaga.rotuloB = vaga.fora;
      continue;
    }
    if (vaga.sufixo === 'advanced-third') {
      vaga.rotuloA = rotulo('Perdedor', ultimaComDuas, 1) ?? vaga.casa;
      vaga.rotuloB = rotulo('Perdedor', ultimaComDuas, 2) ?? vaga.fora;
      continue;
    }
    vaga.rotuloA = rotulo('Vencedor', vaga.rodada - 1, vaga.vaga * 2 - 1) ?? vaga.casa;
    vaga.rotuloB = rotulo('Vencedor', vaga.rodada - 1, vaga.vaga * 2) ?? vaga.fora;
  }
  return { vagas, sobraram };
}

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

/**
 * A equipe da edicao mais parecida com o que a planilha escreveu.
 *
 * Erro de digitacao num nome faz o jogo inteiro sumir da agenda, e o aviso
 * "equipe desconhecida" nao diz o que corrigir. Sugerir e util; ACEITAR seria
 * perigoso -- o palpite errado agendaria o jogo com a equipe errada, e ninguem
 * perceberia. Por isso a sugestao vai para o aviso, e a decisao continua sendo
 * de quem le.
 *
 * Duas letras trocadas ou uma a mais: e o tamanho do erro que se ve nas
 * planilhas ("ENGRENANDA" por "ENGRENADA").
 */
function maisParecida(nome, equipes) {
  const alvo = chave(nome);
  if (!alvo) return null;
  let melhor = null;
  let menor = Infinity;
  for (const equipe of equipes) {
    const distancia = distanciaDeEdicao(alvo, chave(equipe));
    if (distancia < menor) {
      menor = distancia;
      melhor = equipe;
    }
  }
  return menor <= 2 ? melhor : null;
}

function distanciaDeEdicao(a, b) {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const guardado = linha[j];
      linha[j] = Math.min(
        linha[j] + 1,
        linha[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      anterior = guardado;
    }
  }
  return linha[b.length];
}

/**
 * O confronto ja esta na agenda desta categoria?
 *
 * Reconhece pelo que a planilha define -- os dois lados, o dia e a hora --,
 * nao pelo id, que e sorteado e muda a cada execucao. O lado pode ser equipe
 * ou rotulo; comparar os dois textos normalizados cobre os dois casos.
 */
export function partidaAgendada(estado, categoriaId, jogo, data) {
  const lados = [chave(jogo.casa ?? jogo.rotuloCasa), chave(jogo.fora ?? jogo.rotuloFora)];
  const achada = Object.entries(estado.matches ?? {}).find(([, partida]) => {
    if (partida.tournamentId !== categoriaId) return false;
    if (data && partida.date && partida.date !== data) return false;
    if (jogo.horario && partida.time && partida.time !== jogo.horario) return false;
    const dela = [chave(partida.entryA ?? ''), chave(partida.entryB ?? '')];
    return lados.every((lado) => dela.includes(lado));
  });
  return achada ? { id: achada[0], ...achada[1] } : null;
}

export function jaAgendado(estado, categoriaId, jogo, data) {
  return Boolean(partidaAgendada(estado, categoriaId, jogo, data));
}

/**
 * "A definir" nao e um local: e a marca de que nao havia nenhum.
 *
 * Os nove jogos de grupo do Queimado entraram assim, antes de o importador
 * saber ler o local da agenda. Preencher agora e completar o que ficou em
 * branco -- nunca sobrescrever um local que alguem escolheu, que continua
 * intocado.
 */
const SEM_LOCAL = new Set(['a definir', 'a confirmar', '']);
export function localAPreencher(partida, desejado) {
  if (!desejado || SEM_LOCAL.has(chave(desejado))) return null;
  return SEM_LOCAL.has(chave(partida.venue ?? '')) ? desejado : null;
}

export function planejar(grade, estado) {
  const avisos = [];
  const grupos = lerGrupos(grade);
  /*
   * A aba do Queimado lista os jogos da fase de grupos num bloco "RODADAS",
   * sem rotulo "JOGO N" -- que e como todas as outras os identificam. Sem esta
   * alternativa a categoria inteira ficava de fora: nove jogos de grupo lidos
   * como zero, e um mata-mata que dependeria de uma classificacao inexistente.
   */
  const jogos = lerJogos(grade).length ? lerJogos(grade) : lerRodadas(grade);
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
  /*
   * Um lado do confronto: equipe inscrita OU rótulo do que ainda será decidido.
   *
   * Grupo de três jogado como mini-chave aparece assim na planilha: "VORAZ x
   * PERDEDOR J3". Antes esses jogos eram descartados — ficavam de fora da
   * agenda, com dia, hora e quadra que a organização já tinha publicado. Agora
   * entram com o rótulo, e o participante chega quando o resultado sair.
   */
  const lado = (nome) => {
    if (dependeDeOutroJogo(nome)) return { rotulo: rotuloDoConfronto(nome) };
    const equipe = resolver(nome);
    return equipe ? { nome: equipe } : null;
  };
  for (const jogo of jogos) {
    const casa = lado(jogo.casa);
    const fora = lado(jogo.fora);
    if (!casa || !fora) {
      const desconhecida = casa ? jogo.fora : jogo.casa;
      const parecida = maisParecida(desconhecida, equipesDaEdicao);
      avisos.push(
        `Jogo ${jogo.numero}: equipe desconhecida em "${jogo.casa} × ${jogo.fora}"` +
          (parecida ? ` — "${desconhecida}" parece ser "${parecida}".` : '.'),
      );
      continue;
    }
    if (casa.nome) emJogos.add(chave(casa.nome));
    if (fora.nome) emJogos.add(chave(fora.nome));
    // O grupo sai de quem já é equipe: o rótulo ainda não aponta para ninguém.
    const conhecida = casa.nome ?? fora.nome;
    const grupo = grupos.find((g) => g.equipes.some((e) => chave(e) === chave(conhecida ?? '')));
    daFaseDeGrupos.push({
      ...jogo,
      casa: casa.nome,
      fora: fora.nome,
      rotuloCasa: casa.rotulo,
      rotuloFora: fora.rotulo,
      grupo: grupo?.nome ?? '',
    });
  }
  for (const equipe of inscritas) {
    const resolvida = resolver(equipe);
    if (resolvida && !emJogos.has(chave(resolvida))) {
      avisos.push(`"${equipe}" está num grupo mas não aparece em jogo nenhum — confira a planilha.`);
    }
  }

  const { vagas: doMataMata, sobraram } = vagasDoMataMata(lerMataMata(grade, colunaDosJogos(grade)));
  for (const jogo of sobraram) {
    avisos.push(`Jogo ${jogo.numero} ("${jogo.casa} × ${jogo.fora}") não coube na chave — confira quantos jogos o mata-mata tem.`);
  }
  /*
   * A primeira rodada do mata-mata é a única que o app resolve sozinho, lendo
   * os rótulos contra a classificação: "1 GRUPO A" vira quem terminar em
   * primeiro no grupo A. Rótulo que o app não entende faz a chave inteira cair
   * na semeadura automática — que monta um cruzamento DIFERENTE do publicado.
   *
   * Melhor descobrir isso aqui, com alguém olhando, do que no dia em que a fase
   * de grupos acabar.
   */
  for (const vaga of doMataMata.filter((v) => v.rodada === 1)) {
    for (const rotulo of [vaga.rotuloA, vaga.rotuloB]) {
      const colocacao = lerColocacao(rotulo);
      if (!colocacao) {
        avisos.push(`O app não entende o rótulo "${rotulo}" (jogo ${vaga.numero}) — com ele, a chave cai na semeadura automática e o cruzamento sai diferente do publicado.`);
        continue;
      }
      if (colocacao.tipo === 'grupo' && !grupos.some((g) => chave(g.nome).toUpperCase().replace(/^GRUPO /, '') === colocacao.grupo)) {
        avisos.push(`O rótulo "${rotulo}" (jogo ${vaga.numero}) aponta para um grupo que não existe nesta categoria.`);
      }
    }
  }

  /*
   * Jogo sem horario na planilha entra com 08:00, porque a partida precisa de
   * um horario para existir. Isso e um preenchimento, nao um dado: treze jogos
   * do Queimado empilhados as 08:00 nao sao uma agenda.
   *
   * O aviso existe para a organizacao saber que precisa preencher, em vez de
   * descobrir no dia por uma agenda que parecia pronta.
   */
  const semHorario = [...daFaseDeGrupos, ...doMataMata].filter((jogo) => !jogo.horario).length;
  if (semHorario) {
    avisos.push(`${semHorario} ${semHorario === 1 ? 'jogo nao tem' : 'jogos nao tem'} horario na planilha e ${semHorario === 1 ? 'vai entrar' : 'vao entrar'} as 08:00. Corrija na agenda do app depois, ou preencha a planilha e rode de novo.`);
  }

  return { grupos, jogos, modalidades, daFaseDeGrupos, doMataMata, avisos, participantes: inscritas.map(resolver).filter(Boolean) };
}

async function importarArquivo(token, ARQUIVO, DATA, DIA_DA_CHAVE, CATEGORIA_ID, LOCAL_DA_AGENDA) {
  if (!EMAIL) throw new Error('Informe --email.');
  if (!SENHA) throw new Error('Defina INTERENG_SENHA. Ela não entra por argumento: argumento fica no histórico do terminal.');
  if (!ARQUIVO || !existsSync(ARQUIVO)) throw new Error('Informe --arquivo com o caminho do CSV da categoria.');

  const grade = lerGrade(ARQUIVO);
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
  if (flag('so-mata-mata')) {
    console.log('--so-mata-mata: a fase de grupos fica como esta; so a chave sera cadastrada.');
    console.log('');
  }
  const categoriaAlvo = CATEGORIA_ID;
  const daFaseDeGrupos = flag('so-mata-mata') ? [] : plano.daFaseDeGrupos;
  const novos = categoriaAlvo
    ? daFaseDeGrupos.filter((jogo) => !jaAgendado(estado, categoriaAlvo, jogo, DATA))
    : daFaseDeGrupos;
  const aPreencher = categoriaAlvo
    ? daFaseDeGrupos.flatMap((jogo) => {
        const existente = partidaAgendada(estado, categoriaAlvo, jogo, DATA);
        const local = existente && localAPreencher(existente, jogo.local || LOCAL_DA_AGENDA);
        return local ? [{ existente, local }] : [];
      })
    : [];
  console.log(`Jogos da fase de grupos a agendar: ${novos.length}` +
    (daFaseDeGrupos.length !== novos.length ? `  (${daFaseDeGrupos.length - novos.length} ja estao na agenda)` : ''));
  for (const jogo of novos) {
    const casa = jogo.casa ?? jogo.rotuloCasa;
    const fora = jogo.fora ?? jogo.rotuloFora;
    const onde = jogo.local || LOCAL_DA_AGENDA || 'A definir';
    console.log(`  J${String(jogo.numero).padStart(2)} ${jogo.horario.padEnd(6)} ${onde.padEnd(20)} ${casa} × ${fora}  [${jogo.grupo}]`);
  }

  /*
   * O mata-mata tambem se reconhece, e pelo id: ele vem da vaga na chave, entao
   * a partida ja cadastrada tem exatamente o mesmo.
   *
   * Sem isto a simulacao mostrava as 28 partidas da chave como "a agendar"
   * mesmo depois de cadastradas, e aplicar de novo produzia 28 recusas da API
   * -- inofensivas, mas indistinguiveis de uma falha de verdade no meio da
   * lista.
   */
  const vagasNovas = (plano.doMataMata ?? []).filter(
    (vaga) => !(categoriaAlvo && estado.matches?.[`${categoriaAlvo}-${vaga.sufixo}`]),
  );
  const chaveJaAgendada = (plano.doMataMata?.length ?? 0) - vagasNovas.length;
  if (aPreencher.length) {
    console.log('');
    console.log(`Jogos que vao ganhar o local que esta "A definir": ${aPreencher.length}`);
    for (const { existente, local } of aPreencher) {
      console.log(`  ${existente.entryA} × ${existente.entryB}  "${existente.venue}" -> "${local}"`);
    }
  }

  if (plano.doMataMata?.length) {
    console.log('');
    console.log(`Mata-mata a agendar: ${vagasNovas.length}` +
      (chaveJaAgendada ? `  (${chaveJaAgendada} ja estao na agenda)` : '') +
      `  (dia ${DIA_DA_CHAVE ?? opcao('dia-mata-mata') ?? DATA ?? '(--data)'})`);
    for (const vaga of vagasNovas) {
      const onde = vaga.local || LOCAL_DA_AGENDA || 'A definir';
      console.log(`  J${String(vaga.numero).padStart(2)} ${vaga.horario.padEnd(6)} ${onde.padEnd(20)} ${vaga.rotuloA} × ${vaga.rotuloB}  [${vaga.sufixo}]`);
    }
  }

  if (CATEGORIA_ID) {
    const alvo = estado.tournaments?.[CATEGORIA_ID];
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
      .filter(([id, partida]) => partida.tournamentId === CATEGORIA_ID && id.includes('-advanced'))
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
  const existenteId = CATEGORIA_ID;
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

  const edicaoId = estado.editions?.find((e) => e.active)?.id;
  /*
   * Um lado vai como equipe OU como rotulo, nunca os dois: a API recusa a
   * partida que manda os dois, justamente para um erro de digitacao nao virar
   * partida fantasma.
   */
  const ladoDoPayload = (letra, nome, rotulo) =>
    nome ? { [`entry${letra}`]: nome } : { [`placeholder${letra}`]: rotulo };

  const agendar = async ({ id, casa, fora, rotuloCasa, rotuloFora, fase, data, horario, local, numero }) => {
    const descricao = `${casa ?? rotuloCasa} × ${fora ?? rotuloFora}`;
    try {
      await despachar(token, {
        type: 'match/schedule',
        payload: {
          id,
          match: {
            created: true,
            editionId: edicaoId,
            tournamentId: categoriaId,
            discipline: modalidade,
            ...ladoDoPayload('A', casa, rotuloCasa),
            ...ladoDoPayload('B', fora, rotuloFora),
            phase: fase,
            date: data,
            time: horario || '08:00',
            venue: local || LOCAL_DA_AGENDA || 'A definir',
            status: 'Agendada',
            scoreA: null,
            scoreB: null,
          },
        },
        audit: { action: 'Jogo agendado', entity: descricao, after: `${data} ${horario}` },
      });
      return true;
    } catch (erro) {
      falhas.push(`J${numero} ${descricao}: ${erro.message}`);
      return false;
    }
  };

  let agendados = 0;
  let jaEstavam = 0;
  const falhas = [];
  /*
   * Reimportar uma categoria nao pode duplicar a fase de grupos.
   *
   * O jogo de grupo nasce com id sorteado, entao o id nao o reconhece de uma
   * execucao para outra -- quem reconhece e o confronto em si: mesma categoria,
   * mesmos dois lados, mesmo dia e mesma hora.
   *
   * Isso importa agora porque o Futsal Masculino entrou com treze dos quinze
   * jogos: os dois que faltam sao os do grupo de tres jogado como mini-chave,
   * que o importador descartava. Sem esta checagem, so daria para busca-los
   * repetindo os treze.
   *
   * O mata-mata nao precisa disso: o id vem da vaga na chave, e a API recusa o
   * segundo com o mesmo id.
   */
  let locaisPreenchidos = 0;
  if (!flag('so-mata-mata')) {
    for (const jogo of plano.daFaseDeGrupos) {
      const existente = partidaAgendada(estado, categoriaId, jogo, DATA);
      if (existente) {
        const local = localAPreencher(existente, jogo.local || LOCAL_DA_AGENDA);
        if (local) {
          await despachar(token, {
            type: 'match/update',
            payload: { id: existente.id, patch: { venue: local } },
            audit: { action: 'Local do jogo preenchido', entity: `${existente.entryA} x ${existente.entryB}`, before: existente.venue, after: local },
          });
          locaisPreenchidos += 1;
        } else {
          jaEstavam += 1;
        }
        continue;
      }
      if (await agendar({ ...jogo, id: novoId('match'), fase: jogo.grupo, data: DATA })) agendados += 1;
    }
  }

  /*
   * O mata-mata entra com os IDs que a progressao usa (`<categoria>-advanced-r2-1`).
   *
   * E o que faz a partida ja agendada ser a MESMA que o app vai preencher
   * quando o resultado sair: a chave fica publica desde agora, com o dia, a
   * hora e o ginasio da planilha, e so o participante muda depois.
   *
   * O mata-mata costuma ser no ultimo dia. Sem --dia-mata-mata ele cai na
   * mesma data dos grupos, que e melhor que nao existir, mas raramente e o
   * que a organizacao publicou.
   */
  const diaDoMataMata = DIA_DA_CHAVE ?? opcao('dia-mata-mata') ?? DATA;
  let daChave = 0;
  let chaveJaEstava = 0;
  for (const vaga of plano.doMataMata ?? []) {
    // O id vem da vaga: a partida ja cadastrada tem exatamente o mesmo. A API
    // recusaria a segunda, mas recusa vira "falha" na lista e esconde as de
    // verdade.
    if (estado.matches?.[`${categoriaId}-${vaga.sufixo}`]) {
      chaveJaEstava += 1;
      continue;
    }
    const feito = await agendar({
      id: `${categoriaId}-${vaga.sufixo}`,
      rotuloCasa: vaga.rotuloA,
      rotuloFora: vaga.rotuloB,
      fase: 'Mata-mata',
      data: diaDoMataMata,
      horario: vaga.horario,
      local: vaga.local,
      numero: vaga.numero,
    });
    if (feito) daChave += 1;
  }

  console.log('');
  console.log(`Concluido: ${agendados} jogos da fase de grupos e ${daChave} do mata-mata, ${falhas.length} falhas.`);
  if (locaisPreenchidos) console.log(`${locaisPreenchidos} jogos ganharam o local que estava "A definir".`);
  if (jaEstavam || chaveJaEstava) {
    const partes = [
      jaEstavam && `${jaEstavam} da fase de grupos`,
      chaveJaEstava && `${chaveJaEstava} do mata-mata`,
    ].filter(Boolean);
    console.log(`${partes.join(' e ')} ja estavam na agenda e ficaram como estavam.`);
  }
  for (const falha of falhas) console.log('  ! ' + falha);
  if (daChave) console.log(`A chave ja fica publica com os rotulos; o app troca cada rotulo pela equipe quando o resultado sair.`);
}

// Só executa quando chamado direto: o teste importa as funções de leitura.
/**
 * Um login para todas as planilhas.
 *
 * O servidor aceita dez logins por identidade a cada cinco minutos, e passar
 * disso bloqueia por mais cinco. Com sete planilhas, simular e aplicar cada
 * uma dava catorze logins: o limite estourava no meio do trabalho, e no meio
 * de um evento a tres dias de comecar.
 */
async function main() {
  if (!EMAIL) throw new Error('Informe --email.');
  if (!SENHA) throw new Error('Defina INTERENG_SENHA. Ela não entra por argumento: argumento fica no histórico do terminal.');
  if (!ARQUIVOS.length) throw new Error('Informe --arquivo com o caminho do CSV da categoria.');
  for (const arquivo of ARQUIVOS) {
    if (!existsSync(arquivo)) throw new Error(`Arquivo não encontrado: ${arquivo}`);
  }
  if (ARQUIVOS.length > 1 && !DIAS && !DATA) {
    throw new Error('Com mais de uma planilha, informe --dias com a aba "DIAS X MODALIDADES" (ou --data para todas).');
  }

  const token = await entrar();
  const gradeDaAgenda = DIAS ? lerGrade(DIAS) : null;
  const ano = Number(opcao('ano', '2026'));
  const agenda = gradeDaAgenda ? lerDias(gradeDaAgenda, ano) : new Map();
  // O mata-mata do futsal masculino e no dia seguinte ao dos grupos, e a mesma
  // agenda diz isso. Sem ler, oito jogos entrariam com dia publicado e errado.
  const agendaDaChave = gradeDaAgenda ? lerDiasDeMataMata(gradeDaAgenda, ano) : new Map();
  const agendaDeLocais = gradeDaAgenda ? lerLocais(gradeDaAgenda) : new Map();

  if (CATEGORIAS.length && CATEGORIAS.length !== ARQUIVOS.length) {
    throw new Error(
      `Informe um --categoria-id por --arquivo, na mesma ordem (use "-" para criar categoria nova). ` +
        `Vieram ${ARQUIVOS.length} arquivos e ${CATEGORIAS.length} categorias.`,
    );
  }

  for (const [indice, arquivo] of ARQUIVOS.entries()) {
    const nomeDoArquivo = arquivo.split(/[\/]/).pop().replace(/\.csv$/i, '').split(' - ').pop().trim();
    // A agenda escreve "VOLEI MASCULINO" e o arquivo "VOLEIBOL MASCULINO": a
    // primeira palavra passa pela mesma traducao usada em todo o resto.
    const [modalidade, ...resto] = nomeDoArquivo.split(/\s+/);
    const chaveDaAgenda = chave([nomeNoApp(modalidade), ...resto].join(' '));
    const data = DATA ?? agenda.get(chaveDaAgenda) ?? agenda.get(chave(nomeDoArquivo));
    // Recurso para o jogo cuja linha nao traz local: o bloco "RODADAS" do
    // Queimado e assim, e a organizacao ja escreveu o local na agenda.
    const localDaAgenda =
      agendaDeLocais.get(chaveDaAgenda) ?? agendaDeLocais.get(chave(nomeDoArquivo));
    const diaDaChave =
      opcao('dia-mata-mata') ??
      agendaDaChave.get(chaveDaAgenda) ??
      agendaDaChave.get(chave(nomeDoArquivo)) ??
      data;
    if (ARQUIVOS.length > 1) {
      console.log('');
      console.log('══════ ' + nomeDoArquivo + ' ══════');
      if (!data) console.log('! Sem data na agenda para "' + nomeDoArquivo + '" — esta planilha nao sera gravada.');
    }
    if (data && diaDaChave && data !== diaDaChave) {
      console.log(`Mata-mata em ${diaDaChave}, um dia diferente do da fase de grupos (${data}) — como a agenda manda.`);
    }
    await importarArquivo(token, arquivo, data, diaDaChave, categoriaDoArquivo(indice), localDaAgenda);
  }
}

if (process.argv[1] && process.argv[1].endsWith('importar-chaveamento.mjs')) main().catch((erro) => {
  console.error('\nFalhou: ' + erro.message);
  process.exitCode = 1;
});
