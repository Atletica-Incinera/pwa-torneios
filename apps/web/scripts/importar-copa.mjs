/**
 * Importa as categorias e os jogos da Copa Halterada.
 *
 * A fonte é `docs/copa-halterada/jogos.json`, gerado por `planilha-copa.mjs` a
 * partir das 8 abas da planilha. O que este script faz, na ordem:
 *
 *   1. confere que a competição ATIVA é a Copa Halterada — nunca grava no
 *      InterEng por engano;
 *   2. vincula/cria as equipes e habilita as modalidades (Handebol, Basquete, Futsal, Vôlei);
 *   3. cria cada categoria, com grupos e regra de avanço deduzida da própria
 *      planilha;
 *   4. agenda os jogos da fase de grupos e a chave (mata-mata) com os lados
 *      "a definir" que a planilha escreve ("1 GRUPO A", "Vencedor do Jogo 10").
 *
 * EQUIPES: vivem num catálogo global. As que já existem nele (as do InterEng)
 * são VINCULADAS à edição; só as que não existem em lugar nenhum são criadas,
 * com sigla e escudo de `docs/copa-halterada/equipes.csv`. Assim nada duplica.
 *
 * SIMULAÇÃO POR PADRÃO. Sem --aplicar nada é gravado. É idempotente: os ids são
 * determinísticos, então rodar de novo não duplica; só agenda o que falta.
 *
 * Uso:
 *   $env:INTERENG_SENHA="..."; node scripts/importar-copa.mjs --email ana@ufpe.br
 *   ...mesma linha com --aplicar para gravar
 *
 *   --categoria "Futsal Masculino"   só esta (repita para várias)
 *   --publicar                       cria como Publicado (padrão: Rascunho)
 *   --arquivo <jogos.json>           outra fonte (padrão: docs/copa-halterada)
 *   --api <url>                      padrão: produção
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { vagasDoMataMata } from './importar-chaveamento.mjs';
import { chave } from './planilha-copa.mjs';

/** Nome da competição que PRECISA estar ativa para gravar. */
export const COMPETICAO_ESPERADA = 'copa halterada';

const slug = (texto) => chave(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Id estável da categoria: o mesmo nome dá sempre o mesmo id. */
export const idDaCategoria = (nome) => `copa-${slug(nome)}`;

/**
 * Avanço de fase deduzido da chave da planilha.
 *
 * A API entende `perGroup` (quantos de cada grupo) e `bestThirds` (o melhor da
 * posição SEGUINTE: com perGroup 1, é o melhor 2º colocado). A chave da
 * planilha tem N vagas na primeira rodada; dividir pelos grupos dá o resto.
 *   Handebol/Basquete masc.: 4 vagas / 3 grupos = 1 por grupo + melhor 2º.
 *   Futsal masc.:            8 vagas / 4 grupos = 2 por grupo.
 *   Vôlei:                   4 vagas / 2 grupos = 2 por grupo.
 */
export function avancoDaChave(vagas, quantidadeDeGrupos) {
  const primeiraRodada = vagas.filter((v) => v.rodada === 1 && v.vaga).length;
  const vagasDeEquipe = primeiraRodada * 2;
  if (!vagasDeEquipe || !quantidadeDeGrupos) {
    return { perGroup: 2, bestThirds: 0, crossing: 'padrao', thirdPlaceMatch: false };
  }
  const perGroup = Math.max(1, Math.floor(vagasDeEquipe / quantidadeDeGrupos));
  return {
    perGroup,
    bestThirds: vagasDeEquipe - perGroup * quantidadeDeGrupos,
    crossing: 'padrao',
    thirdPlaceMatch: vagas.some((v) => v.sufixo === 'advanced-third'),
  };
}

/**
 * Ordena a primeira rodada da chave pelo que a rodada seguinte REFERENCIA.
 *
 * O app cruza sempre a vaga 1 com a vaga 2 e a 3 com a 4. A planilha do futsal
 * masculino diz, porém, "semifinal 1 = Vencedor QF1 x Vencedor QF3" e
 * "semifinal 2 = Vencedor QF2 x Vencedor QF4". Na ordem em que as quartas
 * aparecem, o app cruzaria QF1 x QF2 — outra chave. Colocando as quartas na
 * ordem [QF1, QF3, QF2, QF4], o cruzamento do app coincide com o da planilha.
 *
 * Só reordena quando TODAS as referências se resolvem; senão mantém a ordem da
 * planilha, que é o comportamento anterior.
 */
export function ordenarPelaChave(jogos) {
  const dependeDeJogo = (r) => /^(vencedor|perdedor)\b/.test(chave(r ?? ''));
  const primeira = jogos.filter((j) => !dependeDeJogo(j.casa.rotulo) && !dependeDeJogo(j.fora.rotulo));
  if (primeira.length < 4) return jogos;

  // "QF3" é a terceira vaga da primeira rodada; "SF1" é da rodada seguinte e
  // não conta aqui; "Jogo 13" é pelo número do jogo.
  const refDe = (rotulo) => {
    const t = chave(rotulo);
    const rodada = /(qf|sf)\s*(\d+)$/.exec(t);
    if (rodada) return rodada[1] === 'qf' ? (primeira[Number(rodada[2]) - 1] ?? null) : null;
    const numero = /(\d+)$/.exec(t);
    return numero ? (primeira.find((j) => j.numero === Number(numero[1])) ?? null) : null;
  };
  const vencedores = (j) => /^vencedor/.test(chave(j.casa.rotulo)) && /^vencedor/.test(chave(j.fora.rotulo));
  const seguintes = jogos.filter((j) => vencedores(j) && refDe(j.casa.rotulo) && refDe(j.fora.rotulo));
  if (seguintes.length * 2 !== primeira.length) return jogos;

  const ordem = [];
  for (const semi of seguintes) {
    for (const lado of [semi.casa.rotulo, semi.fora.rotulo]) {
      const alvo = refDe(lado);
      if (!ordem.includes(alvo)) ordem.push(alvo);
    }
  }
  if (ordem.length !== primeira.length) return jogos;
  // O resto (semifinais, 3º, final) segue na ordem original, depois da primeira rodada.
  return [...ordem, ...jogos.filter((j) => !primeira.includes(j))];
}

/**
 * O que gravar, dado o plano da planilha e o estado atual da edição.
 * Função pura: não fala com a API, então dá para testar sem servidor.
 */
export function planejarCopa(categorias, estado, { publicar = false, catalogo = [], equipesMeta = [] } = {}) {
  const avisos = [];
  const acoes = [];
  const provisorios = [];
  const edicao = (estado.editions ?? []).find((e) => e.active);
  const editionId = edicao?.id;

  /*
   * As equipes vivem num CATÁLOGO GLOBAL e a edição só "vincula" as que
   * participam (`team/attach`). O snapshot da edição traz apenas as vinculadas.
   * Então, para cada equipe da planilha:
   *   - já está na edição              -> nada;
   *   - está no catálogo (InterEng...) -> vincular, para NÃO duplicar;
   *   - não existe em lugar nenhum     -> criar.
   * As ações de equipe vêm antes de tudo: categoria e jogo referenciam o nome.
   */
  const equipesDoApp = new Map(Object.values(estado.teams ?? {}).map((t) => [chave(t.name), t.name]));
  const doCatalogo = new Map(catalogo.map((t) => [chave(t.name), t]));
  const meta = new Map(equipesMeta.map((m) => [chave(m.nome), m]));
  const tons = ['blue', 'pink', 'orange'];
  const equipesAVincular = [];
  const equipesACriar = [];
  const nomesDaPlanilha = [...new Set(categorias.flatMap((c) => c.equipes))];
  for (const nome of nomesDaPlanilha) {
    const k = chave(nome);
    if (equipesDoApp.has(k)) continue;
    const noCatalogo = doCatalogo.get(k);
    if (noCatalogo && !noCatalogo.archived) {
      equipesAVincular.push(noCatalogo.name);
      equipesDoApp.set(k, noCatalogo.name);
      acoes.push({
        rotulo: `vincular equipe ${noCatalogo.name} (já está no catálogo)`,
        type: 'team/attach',
        payload: { id: noCatalogo.id },
        audit: { action: 'Equipe adicionada à edição', entity: noCatalogo.name, after: 'Ativa' },
      });
      continue;
    }
    if (noCatalogo?.archived) avisos.push(`Equipe "${nome}" está ARQUIVADA no catálogo; será criada outra com o mesmo nome. Desarquive a existente se for a mesma.`);
    const m = meta.get(k) ?? {};
    const sigla = m.sigla || chave(nome).replace(/[^a-z]/g, '').slice(0, 3).toUpperCase() || 'EQP';
    equipesACriar.push(nome);
    equipesDoApp.set(k, nome);
    acoes.push({
      rotulo: `criar equipe ${nome} (${sigla})${m.logo ? '' : ' sem escudo'}`,
      type: 'team/create',
      payload: {
        id: `copa-equipe-${slug(nome)}`,
        team: {
          name: nome,
          initials: sigla,
          responsible: m.responsavel || 'A definir',
          tone: tons[equipesACriar.length % tons.length],
          created: true,
          ...(m.logo ? { logo: m.logo } : {}),
        },
      },
      audit: { action: 'Equipe cadastrada', entity: nome },
    });
  }
  const disciplinas = Object.values(estado.disciplines ?? {});
  const existentes = Object.entries(estado.tournaments ?? {});
  const partidas = estado.matches ?? {};

  const modalidadesVistas = new Set();

  for (const cat of categorias) {
    // Modalidade com a grafia que existe na edição ("Vôlei"), não a da planilha.
    const naEdicao = disciplinas.find((d) => chave(d?.name) === chave(cat.modalidade));
    if (!modalidadesVistas.has(cat.modalidade)) {
      modalidadesVistas.add(cat.modalidade);
      if (!naEdicao || naEdicao.enabled === false) {
        acoes.push({
          rotulo: `habilitar modalidade ${cat.modalidade}`,
          type: 'discipline/update',
          payload: { name: naEdicao?.name ?? cat.modalidade, patch: { enabled: true, mode: 'Coletiva' } },
          audit: { action: 'Modalidade habilitada', entity: cat.modalidade, after: 'Coletiva' },
        });
      }
    }
    const modalidade = naEdicao?.name ?? cat.modalidade;

    const nomeNoApp = (nome) => equipesDoApp.get(chave(nome)) ?? nome;

    const categoriaId = existentes.find(([, t]) => chave(t.name) === chave(cat.categoria) && chave(t.discipline) === chave(modalidade))?.[0]
      ?? idDaCategoria(cat.categoria);
    const jaExiste = Boolean(estado.tournaments?.[categoriaId]);

    // A chave: só os jogos em que os DOIS lados são rótulos.
    const daChave = ordenarPelaChave(cat.jogos.filter((j) => j.tipo === 'chave'));
    const { vagas, sobraram } = vagasDoMataMata(daChave.map((j) => ({
      numero: j.numero,
      casa: j.casa.rotulo,
      fora: j.fora.rotulo,
      data: j.data,
      horario: j.horario,
      local: j.local ?? '',
      provisorio: j.provisorio,
    })));
    for (const jogo of sobraram) avisos.push(`${cat.categoria}: jogo ${jogo.numero} (${jogo.casa} x ${jogo.fora}) não coube na chave e não será agendado.`);

    const atual = estado.tournaments?.[categoriaId];
    const temJogos = jaExiste && Object.values(partidas).some((m) => m.tournamentId === categoriaId);

    /*
     * Nome do grupo, na convenção do app ("Grupo A") e, se a categoria já existe,
     * no nome que a gestão usou lá. A planilha escreve "A" e "Único"; a tela do
     * app cria "Grupo A". Um jogo com `phase: 'A'` numa categoria cujo grupo se
     * chama "Grupo A" ficaria fora da tabela de classificação.
     */
    const existentes_ = atual?.phases?.find((f) => f.id === 'groups')?.groups ?? [];
    const nomeDoGrupo = (nomeNaPlanilha) => {
      const candidato = nomeNaPlanilha === 'Único' ? 'Grupo A' : `Grupo ${nomeNaPlanilha}`;
      const igual = existentes_.find((g) => chave(g) === chave(candidato) || chave(g) === chave(nomeNaPlanilha));
      if (igual) return igual;
      if (nomeNaPlanilha === 'Único' && existentes_.length === 1) return existentes_[0];
      return candidato;
    };

    const participantes = cat.equipes.map(nomeNoApp);
    const grupos = cat.grupos.map((g) => nomeDoGrupo(g.nome));
    const assignments = {};
    for (const g of cat.grupos) for (const e of g.equipes) assignments[nomeNoApp(e)] = nomeDoGrupo(g.nome);
    const avanco = avancoDaChave(vagas, grupos.length);

    const configuracao = {
      participants: participantes,
      seeds: Object.fromEntries(participantes.map((e, i) => [e, i + 1])),
      assignments,
      generated: false,
      phases: [
        { id: 'groups', name: 'Fase de grupos', format: 'Grupos', groups: grupos, qualifiers: avanco.perGroup },
        { id: 'knockout', name: 'Mata-mata', format: 'Mata-mata', groups: [], qualifiers: 1 },
      ],
      advancement: avanco,
    };

    if (jaExiste && !temJogos) {
      /*
       * A gestão criou a categoria pela tela (e já a povoou). Criar outra
       * deixaria duas com o mesmo nome — o app não exclui categoria — então
       * ALINHA a que existe com a planilha, mantendo nome, modalidade e
       * situação. Só faz isso enquanto ela não tem jogo: com jogo agendado,
       * trocar participantes ou grupos desfaria o que já foi marcado.
       */
      const antes = new Set(atual.participants ?? []);
      const depois = new Set(participantes);
      const saem = [...antes].filter((e) => !depois.has(e));
      const entram = [...depois].filter((e) => !antes.has(e));
      const mudancas = [
        saem.length && `saem ${saem.join(', ')}`,
        entram.length && `entram ${entram.join(', ')}`,
      ].filter(Boolean).join('; ');
      acoes.push({
        rotulo: `alinhar categoria ${cat.categoria} com a planilha${mudancas ? ` (${mudancas})` : ''}`,
        type: 'category/update',
        payload: { id: categoriaId, setup: { ...atual, ...configuracao, ...(publicar ? { status: 'Publicado' } : {}) } },
        audit: { action: 'Categoria alinhada com a planilha', entity: cat.categoria, after: `${grupos.length} grupos` },
      });
      if (mudancas) avisos.push(`${cat.categoria}: a categoria criada na tela difere da planilha — ${mudancas}.`);
    } else if (jaExiste) {
      avisos.push(`${cat.categoria}: a categoria já tem jogos agendados e NÃO foi alterada; só os jogos que faltam entram. Confira grupos e participantes na tela.`);
    }
    if (!jaExiste) {
      acoes.push({
        rotulo: `criar categoria ${cat.categoria} (${grupos.length} grupo(s), ${participantes.length} equipes)`,
        type: 'category/create',
        payload: {
          id: categoriaId,
          category: {
            created: true,
            editionId,
            name: cat.categoria,
            discipline: modalidade,
            status: publicar ? 'Publicado' : 'Rascunho',
            ...configuracao,
          },
        },
        audit: { action: 'Categoria criada', entity: cat.categoria, after: modalidade },
      });
    }

    const agendar = ({ id, jogo, casa, fora, fase, numero }) => {
      if (partidas[id]) return;
      const lado = (letra, v) => (v.equipe ? { [`entry${letra}`]: nomeNoApp(v.equipe) } : { [`placeholder${letra}`]: v.rotulo });
      const descricao = `${casa.equipe ?? casa.rotulo} × ${fora.equipe ?? fora.rotulo}`;
      if (jogo.provisorio?.data || jogo.provisorio?.horario) {
        provisorios.push({
          categoria: cat.categoria, numero, descricao, data: jogo.data, horario: jogo.horario,
          dataProvisoria: Boolean(jogo.provisorio.data), horarioProvisorio: Boolean(jogo.provisorio.horario),
        });
      }
      acoes.push({
        rotulo: `${cat.categoria} J${numero} ${jogo.data} ${jogo.horario} ${descricao}`,
        type: 'match/schedule',
        payload: {
          id,
          match: {
            created: true,
            editionId,
            tournamentId: categoriaId,
            discipline: modalidade,
            ...lado('A', casa),
            ...lado('B', fora),
            phase: fase,
            date: jogo.data,
            time: jogo.horario,
            venue: jogo.local || 'A definir',
            status: 'Agendada',
            scoreA: null,
            scoreB: null,
          },
        },
        audit: { action: 'Jogo agendado', entity: descricao, after: `${jogo.data} ${jogo.horario}` },
      });
    };

    for (const jogo of cat.jogos.filter((j) => j.tipo === 'grupo')) {
      agendar({ id: `${categoriaId}-j${jogo.numero}`, jogo, casa: jogo.casa, fora: jogo.fora, fase: nomeDoGrupo(jogo.grupo), numero: jogo.numero });
    }
    // Um lado é equipe e o outro é "Perdedor do Jogo 1": a mini-chave do grupo
    // único de 3 equipes. Não é rodada da chave, é partida avulsa.
    for (const jogo of cat.jogos.filter((j) => j.tipo === 'avulso')) {
      const fase = grupos[0] ?? 'Fase de grupos';
      agendar({ id: `${categoriaId}-j${jogo.numero}`, jogo, casa: jogo.casa, fora: jogo.fora, fase, numero: jogo.numero });
    }
    for (const vaga of vagas) {
      agendar({
        id: `${categoriaId}-${vaga.sufixo}`,
        jogo: vaga,
        casa: { rotulo: vaga.rotuloA },
        fora: { rotulo: vaga.rotuloB },
        fase: 'Mata-mata',
        numero: vaga.numero,
      });
    }

    for (const a of cat.avisos ?? []) avisos.push(`${cat.categoria}: ${a}`);
  }

  // Equipes primeiro, depois modalidade, categoria e jogos (categoria e jogo
  // referenciam equipe pelo nome; categoria precisa existir antes do jogo).
  const ordem = { 'team/attach': 0, 'team/create': 0, 'discipline/update': 1, 'category/create': 2, 'category/update': 2, 'match/schedule': 3 };
  acoes.sort((a, b) => (ordem[a.type] ?? 9) - (ordem[b.type] ?? 9));
  return { acoes, avisos, provisorios, equipesAVincular, equipesACriar, editionId };
}

/** `nome;sigla;responsavel;logo` -> [{nome, sigla, responsavel, logo}]. */
export function lerEquipesCsv(caminho) {
  const texto = readFileSync(caminho, 'utf8');
  const limpo = texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto;
  const linhas = limpo.split('\n').map((l) => l.trim()).filter(Boolean);
  return linhas.slice(1).map((l) => {
    const [nome, sigla, responsavel, logo] = l.split(';').map((c) => (c ?? '').trim());
    return { nome, sigla, responsavel, logo };
  });
}

// ---------------------------------------------------------------------------
// Execução (rede). Só roda quando chamado direto.
// ---------------------------------------------------------------------------

async function principal() {
  const args = process.argv.slice(2);
  const flag = (n) => args.includes('--' + n);
  const opcao = (n, p) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : p; };
  const todas = (n) => args.reduce((l, a, i) => (a === '--' + n && args[i + 1] ? [...l, args[i + 1]] : l), []);

  const API = opcao('api', 'https://incinera.cin.ufpe.br/intereng-api/api/v1');
  const EMAIL = opcao('email');
  const SENHA = process.env.INTERENG_SENHA;
  const APLICAR = flag('aplicar');
  const arquivo = resolve(opcao('arquivo', '../../docs/copa-halterada/jogos.json'));
  if (!EMAIL) throw new Error('Informe --email.');
  if (!SENHA) throw new Error('Defina INTERENG_SENHA. Ela não entra por argumento: argumento fica no histórico do terminal.');

  let categorias = JSON.parse(readFileSync(arquivo, 'utf8'));
  const filtro = todas('categoria').map(chave);
  if (filtro.length) categorias = categorias.filter((c) => filtro.includes(chave(c.categoria)));
  if (!categorias.length) throw new Error('Nenhuma categoria selecionada.');

  const login = await fetch(API + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  });
  const corpoLogin = await login.json().catch(() => ({}));
  if (!login.ok || !corpoLogin?.data?.token) throw new Error(`Login recusado (${login.status}).`);
  const token = corpoLogin.data.token;

  const snap = await fetch(API + '/editions/active/snapshot', { headers: { Authorization: 'Bearer ' + token } });
  const corpoSnap = await snap.json().catch(() => ({}));
  if (!snap.ok) throw new Error(`Snapshot recusado (${snap.status}).`);
  const estado = corpoSnap.data ?? {};

  const ativa = (estado.competitions ?? []).find((c) => c.active);
  const edicao = (estado.editions ?? []).find((e) => e.active);
  console.log('');
  console.log(`API         ${API}`);
  console.log(`Competição  ${ativa?.name ?? '(nenhuma ativa)'}  edição ${edicao?.year ?? '-'}`);
  if (!ativa || chave(ativa.name) !== COMPETICAO_ESPERADA) {
    throw new Error(
      `A competição ativa é "${ativa?.name ?? 'nenhuma'}", não a Copa Halterada. ` +
      'Nada foi gravado. Ative a Copa (Torneio → seletor → "Mudar contexto") e rode de novo.',
    );
  }

  // O catálogo global, paginado. O snapshot da edição só traz as vinculadas.
  const catalogo = [];
  for (let pagina = 1; pagina <= 20; pagina += 1) {
    const r = await fetch(`${API}/teams?page=${pagina}&pageSize=100`, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error(`Catálogo de equipes recusado (${r.status}).`);
    const corpo = await r.json().catch(() => ({}));
    const itens = Array.isArray(corpo.data) ? corpo.data : (corpo.data?.items ?? []);
    catalogo.push(...itens);
    if (itens.length < 100) break;
  }
  const equipesMeta = lerEquipesCsv(resolve(opcao('equipes', '../../docs/copa-halterada/equipes.csv')));

  const plano = planejarCopa(categorias, estado, { publicar: flag('publicar'), catalogo, equipesMeta });
  console.log(`Equipes: ${Object.keys(estado.teams ?? {}).length} na edição, ${catalogo.length} no catálogo`);
  console.log('');
  const rotuloDoTipo = { 'match/schedule': 'jogo      ', 'category/create': 'CATEGORIA ', 'category/update': 'CATEGORIA ', 'discipline/update': 'modalidade', 'team/attach': 'equipe    ', 'team/create': 'EQUIPE    ' };
  for (const a of plano.acoes) console.log('  ' + (rotuloDoTipo[a.type] ?? a.type) + ' ' + a.rotulo);
  console.log('');
  const contagem = plano.acoes.reduce((m, a) => { m[a.type] = (m[a.type] ?? 0) + 1; return m; }, {});
  console.log(
    `A gravar: ${contagem['match/schedule'] ?? 0} jogos, ${contagem['category/create'] ?? 0} categorias, ` +
    `${contagem['discipline/update'] ?? 0} modalidades, ${contagem['team/attach'] ?? 0} equipes a vincular, ${contagem['team/create'] ?? 0} a criar.`,
  );
  if (plano.provisorios.length) {
    console.log('');
    console.log(`PROVISÓRIOS (${plano.provisorios.length}) — a planilha não traz data ou horário; a gestão deve corrigir na tela:`);
    for (const p of plano.provisorios) {
      const quais = [p.dataProvisoria && 'data', p.horarioProvisorio && 'horário'].filter(Boolean).join(' e ');
      console.log(`  ${p.categoria.padEnd(20)} J${String(p.numero).padStart(2)} ${p.data} ${p.horario}  ${p.descricao}  [${quais} provisório]`);
    }
  }
  for (const a of plano.avisos) console.log('  ! ' + a);

  if (!APLICAR) {
    console.log('');
    console.log('SIMULAÇÃO — nada foi gravado. Repita com --aplicar para executar.');
    return;
  }
  let feitas = 0;
  const falhas = [];
  for (const a of plano.acoes) {
    const resposta = await fetch(API + '/editions/active/actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        'Idempotency-Key': 'copa-' + randomUUID().replace(/-/g, '').slice(0, 16),
        'X-Operator-Id': 'importador-copa',
      },
      body: JSON.stringify({ type: a.type, payload: a.payload, audit: a.audit }),
    });
    if (resposta.ok) { feitas += 1; continue; }
    const corpo = await resposta.json().catch(() => ({}));
    falhas.push(`${a.rotulo}: HTTP ${resposta.status} ${JSON.stringify(corpo).slice(0, 160)}`);
    // Uma categoria que falhou derruba os jogos dela; seguir só gera ruído.
    if (a.type === 'category/create' || a.type === 'category/update') break;
  }
  console.log('');
  console.log(`Concluído: ${feitas} gravados, ${falhas.length} falhas.`);
  for (const f of falhas) console.log('  ! ' + f);
  if (falhas.length) process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].endsWith('importar-copa.mjs')) {
  principal().catch((erro) => {
    console.error('\nFalhou: ' + erro.message);
    process.exitCode = 1;
  });
}
