/**
 * Servidor MCP de consulta ao InterEng em producao.
 *
 * Responde perguntas sobre os dados do evento — quantas equipes, quais
 * categorias ainda nao tem gente suficiente, quais jogos estao sem data — sem
 * exigir acesso ao banco.
 *
 * POR QUE PELA API E NAO PELO POSTGRES: o banco escuta so no loopback da VM,
 * entao consultar direto exige VPN ligada, tunel SSH aberto e a senha mestra do
 * Postgres, que mora num arquivo que so a conta do runner le. Pela API bastam
 * as mesmas credenciais que a pessoa ja usa no app, funciona de qualquer lugar,
 * e o alcance maximo e o de um GET no snapshot.
 *
 * SOMENTE LEITURA por construcao: o unico endpoint de escrita da API e
 * `POST /editions/:id/actions`, e este servidor nunca o chama.
 *
 * Sem dependencias de propósito. O transporte MCP por stdio e JSON-RPC 2.0 com
 * uma mensagem por linha; implementar isso e menor do que carregar um SDK, e
 * evita mexer no package.json do app.
 *
 * Registro:
 *   claude mcp add intereng --scope local \
 *     -e INTERENG_EMAIL=voce@ufpe.br -e INTERENG_SENHA=... \
 *     -- node caminho/para/scripts/mcp-intereng.mjs
 */
const API = process.env.INTERENG_API ?? 'https://incinera.cin.ufpe.br/intereng-api/api/v1';
const EMAIL = process.env.INTERENG_EMAIL;
const SENHA = process.env.INTERENG_SENHA;

let tokenEmCache = null;
let snapshotEmCache = null;
let buscadoEm = 0;
const VALIDADE_MS = 20_000;

async function token() {
  if (tokenEmCache) return tokenEmCache;
  if (!EMAIL || !SENHA) throw new Error('Defina INTERENG_EMAIL e INTERENG_SENHA no registro do servidor MCP.');
  const resposta = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error('Login recusado (' + resposta.status + ').');
  tokenEmCache = corpo?.data?.token;
  if (!tokenEmCache) throw new Error('A API respondeu sem token.');
  return tokenEmCache;
}

/** Cache curto: uma pergunta costuma virar varias chamadas seguidas. */
async function snapshot() {
  if (snapshotEmCache && Date.now() - buscadoEm < VALIDADE_MS) return snapshotEmCache;
  const resposta = await fetch(API + '/editions/active/snapshot', {
    headers: { Authorization: 'Bearer ' + (await token()) },
  });
  if (resposta.status === 401) {
    // Sessao vencida: uma segunda tentativa com token novo, e so uma.
    tokenEmCache = null;
    const repetida = await fetch(API + '/editions/active/snapshot', {
      headers: { Authorization: 'Bearer ' + (await token()) },
    });
    if (!repetida.ok) throw new Error('Snapshot recusado (' + repetida.status + ').');
    snapshotEmCache = (await repetida.json())?.data ?? {};
  } else {
    if (!resposta.ok) throw new Error('Snapshot recusado (' + resposta.status + ').');
    snapshotEmCache = (await resposta.json())?.data ?? {};
  }
  buscadoEm = Date.now();
  return snapshotEmCache;
}

const contar = (registro) => Object.keys(registro ?? {}).length;

async function resumo() {
  const s = await snapshot();
  const edicao = Object.values(s.editions ?? {}).find((e) => e?.active) ?? Object.values(s.editions ?? {})[0];
  return {
    edicao: edicao ? { nome: edicao.name ?? edicao.year, inicio: edicao.start, fim: edicao.end, status: edicao.status } : null,
    equipes: contar(s.teams),
    atletas: contar(s.athletes),
    modalidades: contar(s.disciplines),
    categorias: contar(s.tournaments),
    jogos: contar(s.matches),
    staff: contar(s.staff),
  };
}

/** O que ainda falta para o evento poder acontecer, em vez de so contagens. */
async function prontidao() {
  const s = await snapshot();
  const pendencias = [];
  const equipes = Object.entries(s.teams ?? {}).filter(([, t]) => !t?.archived);
  const atletas = Object.values(s.athletes ?? {}).filter((a) => !a?.removed);

  if (equipes.length < 2) pendencias.push('Ha ' + equipes.length + ' equipe(s). Sem ao menos 2 nao existe confronto possivel.');
  if (!atletas.length) pendencias.push('Nenhum atleta cadastrado.');

  const semAtleta = equipes
    .filter(([id]) => !atletas.some((a) => a.teamId === id))
    .map(([, t]) => t?.name)
    .filter(Boolean);
  if (semAtleta.length) pendencias.push('Equipes sem nenhum atleta: ' + semAtleta.join(', '));

  for (const [id, categoria] of Object.entries(s.tournaments ?? {})) {
    const inscritos = (categoria?.participants ?? []).length;
    if (inscritos < 2) {
      pendencias.push('Categoria "' + (categoria?.name ?? id) + '" tem ' + inscritos + ' participante(s); precisa de 2 para gerar confrontos.');
    }
    if (!(categoria?.phases ?? []).length) {
      pendencias.push('Categoria "' + (categoria?.name ?? id) + '" nao tem nenhuma fase configurada.');
    }
  }

  const jogos = Object.values(s.matches ?? {});
  const semData = jogos.filter((j) => !j?.date).length;
  if (!jogos.length) pendencias.push('Nenhum jogo criado ainda.');
  else if (semData) pendencias.push(semData + ' jogo(s) sem data marcada.');

  return { pronto: pendencias.length === 0, pendencias };
}

async function listar(tipo, filtro) {
  const s = await snapshot();
  const mapa = {
    equipes: s.teams,
    atletas: s.athletes,
    modalidades: s.disciplines,
    categorias: s.tournaments,
    jogos: s.matches,
    staff: s.staff,
  };
  const registro = mapa[tipo];
  if (!registro) throw new Error('Tipo desconhecido: ' + tipo + '. Use um de: ' + Object.keys(mapa).join(', '));
  const termo = String(filtro ?? '').toLowerCase().trim();
  const itens = Object.entries(registro).map(([id, valor]) => ({ id, ...valor }));
  if (!termo) return itens;
  return itens.filter((item) => JSON.stringify(item).toLowerCase().includes(termo));
}

/** Elenco por equipe: a pergunta que mais aparece durante a montagem do evento. */
async function elencos() {
  const s = await snapshot();
  const atletas = Object.values(s.athletes ?? {}).filter((a) => !a?.removed);
  return Object.entries(s.teams ?? {})
    .filter(([, t]) => !t?.archived)
    .map(([id, equipe]) => {
      const doTime = atletas.filter((a) => a.teamId === id);
      const porModalidade = {};
      for (const atleta of doTime) {
        for (const m of atleta.modalities ?? []) porModalidade[m] = (porModalidade[m] ?? 0) + 1;
      }
      return { equipe: equipe?.name, sigla: equipe?.initials, atletas: doTime.length, porModalidade };
    })
    .sort((a, b) => b.atletas - a.atletas);
}

const FERRAMENTAS = [
  {
    name: 'resumo_dados',
    description: 'Contagem geral dos dados da edicao ativa do InterEng em producao: equipes, atletas, modalidades, categorias, jogos e staff, mais as datas da edicao.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'prontidao_evento',
    description: 'Lista o que ainda impede o evento de acontecer: equipes sem atleta, categorias com menos de dois participantes, categorias sem fase, jogos sem data. Responde "pronto: true" quando nao ha pendencia.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'listar',
    description: 'Lista registros de um tipo, opcionalmente filtrados por um termo livre.',
    inputSchema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['equipes', 'atletas', 'modalidades', 'categorias', 'jogos', 'staff'] },
        filtro: { type: 'string', description: 'Termo opcional; casa com qualquer campo do registro.' },
      },
      required: ['tipo'],
    },
  },
  {
    name: 'elencos',
    description: 'Quantos atletas cada equipe tem, e a distribuicao por modalidade. Ordenado do maior elenco para o menor.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function executar(nome, argumentos) {
  if (nome === 'resumo_dados') return resumo();
  if (nome === 'prontidao_evento') return prontidao();
  if (nome === 'elencos') return elencos();
  if (nome === 'listar') return listar(argumentos?.tipo, argumentos?.filtro);
  throw new Error('Ferramenta desconhecida: ' + nome);
}

/**
 * Transporte stdio do MCP: JSON-RPC 2.0, uma mensagem por linha. Notificacao
 * (sem `id`) nao leva resposta — responder a uma quebra clientes estritos.
 */
function responder(id, resultado, erro) {
  if (id === undefined || id === null) return;
  const mensagem = erro
    ? { jsonrpc: '2.0', id, error: { code: -32000, message: erro } }
    : { jsonrpc: '2.0', id, result: resultado };
  process.stdout.write(JSON.stringify(mensagem) + '\n');
}

async function tratar(mensagem) {
  const { id, method, params } = mensagem;
  try {
    if (method === 'initialize') {
      return responder(id, {
        // Ecoa a versao pedida pelo cliente: fixar uma so quebraria a conexao
        // sempre que o Claude Code adotasse uma revisao nova do protocolo.
        protocolVersion: params?.protocolVersion ?? '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'intereng', version: '1.0.0' },
      });
    }
    if (method === 'tools/list') return responder(id, { tools: FERRAMENTAS });
    if (method === 'tools/call') {
      const saida = await executar(params?.name, params?.arguments);
      return responder(id, { content: [{ type: 'text', text: JSON.stringify(saida, null, 2) }] });
    }
    if (method === 'ping') return responder(id, {});
    if (String(method ?? '').startsWith('notifications/')) return;
    return responder(id, undefined, 'Metodo nao suportado: ' + method);
  } catch (erro) {
    return responder(id, undefined, erro.message);
  }
}

let acumulado = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (pedaco) => {
  acumulado += pedaco;
  const linhas = acumulado.split('\n');
  acumulado = linhas.pop() ?? '';
  for (const linha of linhas) {
    if (!linha.trim()) continue;
    let mensagem;
    try {
      mensagem = JSON.parse(linha);
    } catch {
      continue;
    }
    void tratar(mensagem);
  }
});
