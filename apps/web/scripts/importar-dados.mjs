/**
 * Importador de equipes e atletas a partir de planilha.
 *
 * Existe por uma razão de escala: o InterEng terá 16 equipes, e com uma dúzia
 * de atletas cada isso passa de 200 cadastros. Digitar um a um no app é
 * inviável no prazo — e é trabalho que não se divide bem, porque duas pessoas
 * na mesma tela se atrapalham. Com planilha, cada equipe preenche a sua e a
 * carga acontece de uma vez.
 *
 * Fala com a API pelo mesmo caminho que o app usa: POST /editions/active/actions
 * com as ações team/create e athlete/create. Nada aqui inventa rota nova — se o
 * app consegue, isto consegue; se a API recusar, recusa igual.
 *
 * SIMULAÇÃO POR PADRÃO. Sem --aplicar nada é gravado: lê o estado atual, mostra
 * o que faria e para. É banco de produção de um evento; ver antes é a ordem certa.
 *
 * Uso:
 *   node scripts/importar-dados.mjs --modelo
 *   $env:INTERENG_SENHA="..."; node scripts/importar-dados.mjs --email ana@ufpe.br
 *   $env:INTERENG_SENHA="..."; node scripts/importar-dados.mjs --email ana@ufpe.br --aplicar
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
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
const APLICAR = flag('aplicar');
const ARQ_EQUIPES = opcao('equipes', 'equipes.csv');
const ARQ_ATLETAS = opcao('atletas', 'atletas.csv');

const TONS = ['blue', 'pink', 'orange'];

/** Acentos e caixa fora do caminho: "Atlética" e "atletica" viram a mesma chave. */
const chave = (texto) => String(texto ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

/** Id no mesmo formato que o app gera: prefixo mais sufixo aleatório curto. */
const novoId = (prefixo) => prefixo + '-' + randomUUID().replace(/-/g, '').slice(0, 12);

/**
 * Escudo da equipe, entre os arquivos publicados com o app.
 *
 * As dezesseis logos vivem em `public/teams/` e sobem a cada deploy — nao
 * dependem do storage nem de rota no gateway. O nome do arquivo raramente bate
 * com o nome digitado na planilha ("Atletica Alcateia" contra `alcateia.webp`),
 * entao tentamos o nome inteiro e depois cada palavra dele. Sem correspondencia,
 * a equipe fica sem escudo e o app mostra a inicial — nada quebra.
 */
const PASTA_LOGOS = 'public/teams';
const logosDisponiveis = existsSync(PASTA_LOGOS)
  ? new Set(readdirSync(PASTA_LOGOS).filter((f) => f.endsWith('.webp')).map((f) => f.slice(0, -'.webp'.length)))
  : new Set();

const comoArquivo = (texto) => chave(texto).replace(/[^a-z0-9]+/g, '');

function acharLogo(nome, informada) {
  if (informada) return informada.startsWith('/') ? informada : `/teams/${informada}`;
  const candidatos = [comoArquivo(nome), ...chave(nome).split(/[^a-z0-9]+/).filter(Boolean)];
  const achado = candidatos.find((c) => logosDisponiveis.has(c));
  return achado ? `/teams/${achado}.webp` : undefined;
}

function modelo() {
  writeFileSync(ARQ_EQUIPES, 'nome;sigla;responsavel;logo\nAtlética Exemplo;AEX;Fulano de Tal;\n', 'utf8');
  writeFileSync(ARQ_ATLETAS, 'equipe;atleta;modalidades\nAEX;Sicrano da Silva;Futsal\nAEX;Beltrano Souza;Futsal|Basquete\n', 'utf8');
  console.log('Modelos escritos: ' + ARQ_EQUIPES + ' e ' + ARQ_ATLETAS);
  console.log('Preencha e rode de novo sem --modelo. O Excel em português salva com ; — o script aceita ; ou ,.');
  console.log('Para várias modalidades no mesmo atleta, separe por | (barra vertical).');
}

/** Separa uma linha respeitando aspas, que é onde nome com vírgula quebraria. */
function separar(linha, delim) {
  const saida = [];
  let atual = '';
  let dentro = false;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (c === '"') {
      if (dentro && linha[i + 1] === '"') {
        atual += '"';
        i += 1;
      } else {
        dentro = !dentro;
      }
      continue;
    }
    if (c === delim && !dentro) {
      saida.push(atual);
      atual = '';
      continue;
    }
    atual += c;
  }
  saida.push(atual);
  return saida.map((v) => v.trim());
}

function lerCsv(caminho) {
  if (!existsSync(caminho)) return null;
  const texto = readFileSync(caminho, 'utf8').replace(/^\uFEFF/, '');
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const primeira = linhas[0];
  const delim = primeira.split(';').length > primeira.split(',').length ? ';' : ',';
  const cabecalho = separar(primeira, delim).map(chave);
  return linhas.slice(1).map((linha) => {
    const campos = separar(linha, delim);
    const registro = {};
    cabecalho.forEach((nome, i) => {
      registro[nome] = campos[i] ?? '';
    });
    return registro;
  });
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
  if (!token) throw new Error('A API respondeu sem token: ' + JSON.stringify(corpo));
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
      'Idempotency-Key': novoId('import'),
      'X-Operator-Id': 'importador-csv',
    },
    body: JSON.stringify(acao),
  });
  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    throw new Error('HTTP ' + resposta.status + ' — ' + corpo.slice(0, 300));
  }
}

function planejar(equipesCsv, atletasCsv, estado) {
  const equipesExistentes = estado.teams ?? {};
  const atletasExistentes = estado.athletes ?? {};
  const modalidadesValidas = Object.values(estado.disciplines ?? {})
    .map((d) => d?.name)
    .filter(Boolean);

  // Resolve equipe por nome OU por sigla: a planilha de atletas referencia de
  // um jeito ou de outro, e exigir exatidão só geraria retrabalho.
  //
  // A sigla ambígua é tratada como NENHUMA equipe, de propósito. Duas equipes
  // com a mesma sigla faziam o índice resolver para uma delas conforme a ordem
  // de iteração — que muda quando entram registros novos. Resultado medido: os
  // mesmos atletas criados nas duas equipes, porque a chave de deduplicação
  // depende da equipe resolvida. Recusar e pedir o nome completo é a única
  // resposta estável.
  const porNome = new Map();
  const porSigla = new Map();
  const siglasAmbiguas = new Set();

  const registrar = (id, nome, sigla) => {
    if (nome) porNome.set(chave(nome), id);
    if (!sigla) return;
    const k = chave(sigla);
    if (porSigla.has(k) && porSigla.get(k) !== id) {
      siglasAmbiguas.add(k);
      porSigla.delete(k);
      return;
    }
    if (!siglasAmbiguas.has(k)) porSigla.set(k, id);
  };

  const resolver = (referencia) => {
    const k = chave(referencia);
    if (porNome.has(k)) return porNome.get(k);
    if (siglasAmbiguas.has(k)) return 'AMBIGUA';
    return porSigla.get(k) ?? null;
  };

  for (const [id, equipe] of Object.entries(equipesExistentes)) {
    registrar(id, equipe?.name, equipe?.initials);
  }
  // Já cadastrado não é recriado: rodar de novo depois de corrigir uma linha
  // precisa ser seguro.
  const jaTem = new Set(
    Object.values(atletasExistentes)
      .filter((a) => a?.name && a?.teamId && !a?.removed)
      .map((a) => a.teamId + '|' + chave(a.name)),
  );

  const equipes = [];
  const atletas = [];
  const avisos = [];

  equipesCsv.forEach((linha, i) => {
    const nome = linha.nome || linha.equipe || '';
    if (!nome) {
      avisos.push('equipes: linha ' + (i + 2) + ' sem nome, ignorada');
      return;
    }
    if (porNome.has(chave(nome))) return;
    const id = novoId('team');
    const sigla = (linha.sigla || nome.slice(0, 3)).toUpperCase();
    equipes.push({
      id,
      nome,
      sigla,
      responsavel: linha.responsavel || '',
      tom: TONS[equipes.length % TONS.length],
      logo: acharLogo(nome, linha.logo),
    });
    const siglaJaVista = porSigla.has(chave(sigla)) || siglasAmbiguas.has(chave(sigla));
    registrar(id, nome, sigla);
    if (siglaJaVista) {
      avisos.push(
        'equipes: linha ' + (i + 2) + ' — sigla "' + sigla +
        '" repetida; os atletas destas equipes precisam referenciar o NOME completo, nao a sigla',
      );
    }
  });

  (atletasCsv ?? []).forEach((linha, i) => {
    const nome = linha.atleta || linha.nome || '';
    const referencia = linha.equipe || '';
    if (!nome) {
      avisos.push('atletas: linha ' + (i + 2) + ' sem nome, ignorada');
      return;
    }
    const teamId = resolver(referencia);
    if (teamId === 'AMBIGUA') {
      avisos.push(
        'atletas: linha ' + (i + 2) + ' — "' + referencia +
        '" e sigla de mais de uma equipe; use o nome completo. Linha ignorada',
      );
      return;
    }
    if (!teamId) {
      avisos.push('atletas: linha ' + (i + 2) + ' — equipe "' + referencia + '" nao encontrada, ignorada');
      return;
    }
    if (jaTem.has(teamId + '|' + chave(nome))) return;
    const modalidades = String(linha.modalidades || '')
      .split(/[|;,]/)
      .map((m) => m.trim())
      .filter(Boolean);
    for (const m of modalidades) {
      if (modalidadesValidas.length && !modalidadesValidas.some((v) => chave(v) === chave(m))) {
        avisos.push('atletas: linha ' + (i + 2) + ' — modalidade "' + m + '" nao existe na edicao');
      }
    }
    atletas.push({ id: novoId('athlete'), nome, teamId, modalidades });
    jaTem.add(teamId + '|' + chave(nome));
  });

  return { equipes, atletas, avisos, modalidadesValidas };
}

async function principal() {
  if (flag('modelo')) return modelo();
  if (!EMAIL) throw new Error('Informe --email. Use --modelo para gerar as planilhas de exemplo.');
  if (!SENHA) {
    throw new Error(
      'Defina a variavel INTERENG_SENHA com a senha da conta. Ela nao entra por argumento de propósito: argumento fica no histórico do terminal e na lista de processos.',
    );
  }

  const equipesCsv = lerCsv(ARQ_EQUIPES);
  const atletasCsv = lerCsv(ARQ_ATLETAS);
  if (!equipesCsv) throw new Error('Arquivo nao encontrado: ' + ARQ_EQUIPES + '. Rode com --modelo para gerar os exemplos.');

  const token = await entrar();
  const estado = await estadoAtual(token);
  const plano = planejar(equipesCsv, atletasCsv, estado);

  console.log('');
  console.log('Estado atual em ' + API);
  console.log('  ' + Object.keys(estado.teams ?? {}).length + ' equipes, ' + Object.keys(estado.athletes ?? {}).length + ' atletas');
  console.log('  modalidades da edicao: ' + (plano.modalidadesValidas.join(', ') || '(nenhuma)'));
  console.log('');
  console.log('A criar: ' + plano.equipes.length + ' equipes, ' + plano.atletas.length + ' atletas');
  for (const e of plano.equipes) {
    console.log('  equipe  ' + e.nome + ' (' + e.sigla + ')' + (e.logo ? '  escudo: ' + e.logo : '  SEM ESCUDO'));
  }
  const semEscudo = plano.equipes.filter((e) => !e.logo);
  if (semEscudo.length) {
    console.log('');
    console.log(semEscudo.length + ' equipe(s) sem escudo. O app mostra a inicial no lugar.');
    console.log('Para resolver: ponha o arquivo em apps/web/public/teams/<nome>.webp e rode de novo,');
    console.log('ou acrescente uma coluna logo na planilha com o nome do arquivo.');
  }
  for (const a of plano.atletas.slice(0, 20)) {
    console.log('  atleta  ' + a.nome + '  [' + (a.modalidades.join(', ') || 'sem modalidade') + ']');
  }
  if (plano.atletas.length > 20) console.log('  ... e mais ' + (plano.atletas.length - 20) + ' atletas');

  if (plano.avisos.length) {
    console.log('');
    console.log('Avisos (' + plano.avisos.length + '):');
    for (const aviso of plano.avisos.slice(0, 30)) console.log('  ! ' + aviso);
    if (plano.avisos.length > 30) console.log('  ... e mais ' + (plano.avisos.length - 30));
  }

  if (!APLICAR) {
    console.log('');
    console.log('SIMULACAO — nada foi gravado. Repita com --aplicar para executar.');
    return;
  }

  console.log('');
  let feitos = 0;
  const falhas = [];
  for (const e of plano.equipes) {
    try {
      await despachar(token, {
        type: 'team/create',
        payload: {
          id: e.id,
          team: {
            name: e.nome,
            initials: e.sigla,
            responsible: e.responsavel,
            tone: e.tom,
            created: true,
            ...(e.logo ? { logo: e.logo } : {}),
          },
        },
        audit: { action: 'Equipe cadastrada', entity: e.nome },
      });
      feitos += 1;
      console.log('  ok   equipe ' + e.nome);
    } catch (erro) {
      falhas.push('equipe ' + e.nome + ': ' + erro.message);
      console.log('  ERRO equipe ' + e.nome + ' -> ' + erro.message);
    }
  }
  for (const a of plano.atletas) {
    try {
      await despachar(token, {
        type: 'athlete/create',
        payload: {
          id: a.id,
          athlete: { name: a.nome, teamId: a.teamId, modalities: a.modalidades, created: true },
        },
        audit: { action: 'Atleta cadastrado', entity: a.nome },
      });
      feitos += 1;
    } catch (erro) {
      falhas.push('atleta ' + a.nome + ': ' + erro.message);
      console.log('  ERRO atleta ' + a.nome + ' -> ' + erro.message);
    }
  }

  console.log('');
  console.log('Concluido: ' + feitos + ' registros criados, ' + falhas.length + ' falhas.');
  if (falhas.length) {
    console.log('Corrija as linhas apontadas e rode de novo — o que ja entrou nao sera duplicado.');
  }
}

principal().catch((erro) => {
  console.error('');
  console.error(erro.message);
  process.exitCode = 1;
});
