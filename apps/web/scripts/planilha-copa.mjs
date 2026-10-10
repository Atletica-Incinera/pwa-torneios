/**
 * Planilha da Copa Halterada -> lista única e conferível de jogos.
 *
 * A planilha tem uma aba por modalidade e naipe, e CADA aba tem um layout:
 * colunas em posições diferentes, "Equipe 1 x Equipe 2" numa e "Confronto"
 * numa célula só em outra, data com e sem ano, e vôlei sem data nenhuma.
 * Digitar 94 jogos assim na tela é o tipo de trabalho em que se erra um horário
 * sem perceber. Este módulo lê os CSVs exportados, normaliza, e escreve
 * `docs/copa-halterada/jogos.json` — um arquivo que a gestão consegue ler antes
 * de qualquer coisa ser gravada.
 *
 * REGRA DA ORGANIZAÇÃO: "faça tudo de acordo com a tabela". Os nomes das equipes
 * ficam como estão na planilha. O que a tabela NÃO define é preenchido por uma
 * regra explícita e MARCADO como provisório no próprio arquivo:
 *   - horário "A SEGUIR": o jogo anterior da categoria + a duração do jogo na
 *     modalidade (a API exige um horário para agendar);
 *   - data ausente (vôlei não tem nenhuma): um dia fixo, `DATA_PROVISORIA`.
 * Provisório não é palpite escondido: o importador lista cada um, e a gestão
 * corrige pela tela.
 *
 * Uso:  node scripts/planilha-copa.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ANO = 2026;
/** Vôlei não traz data. A edição vai de 09 a 12/10; o dia do meio é o menos disputado. */
export const DATA_PROVISORIA = `${ANO}-10-11`;
/** Minutos entre o início de dois jogos da mesma categoria, quando o horário é "A SEGUIR". */
export const INTERVALO_POR_MODALIDADE = { Handebol: 30, Futsal: 30, Basquete: 40, 'Vôlei': 45 };

export const ABAS = [
  { arquivo: 'handebol_masculino.csv', modalidade: 'Handebol', naipe: 'Masculino' },
  { arquivo: 'handebol_feminino.csv', modalidade: 'Handebol', naipe: 'Feminino' },
  { arquivo: 'basquete_masculino.csv', modalidade: 'Basquete', naipe: 'Masculino' },
  { arquivo: 'basquete_feminino.csv', modalidade: 'Basquete', naipe: 'Feminino' },
  { arquivo: 'futsal_masculino.csv', modalidade: 'Futsal', naipe: 'Masculino' },
  { arquivo: 'futsal_feminino.csv', modalidade: 'Futsal', naipe: 'Feminino' },
  { arquivo: 'voleibol_masculino.csv', modalidade: 'Vôlei', naipe: 'Masculino' },
  { arquivo: 'voleibol_feminino.csv', modalidade: 'Vôlei', naipe: 'Feminino' },
];

/** Acentos e caixa fora do caminho. */
export const chave = (texto) => String(texto ?? '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ')
  .toLowerCase()
  .trim();

/** CSV com aspas (RFC 4180). A exportação do Google as usa quando a célula tem vírgula. */
export function lerCsv(texto) {
  const linhas = [];
  let linha = [];
  let atual = '';
  let dentro = false;
  const t = texto.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (dentro) {
      if (c === '"' && t[i + 1] === '"') { atual += '"'; i += 1; } else if (c === '"') dentro = false; else atual += c;
    } else if (c === '"') dentro = true;
    else if (c === ',') { linha.push(atual); atual = ''; }
    else if (c === '\n') { linha.push(atual); linhas.push(linha); linha = []; atual = ''; }
    else if (c !== '\r') atual += c;
  }
  if (atual || linha.length) { linha.push(atual); linhas.push(linha); }
  return linhas.map((l) => l.map((c) => c.trim()));
}

/** "10/10", "9/10/2026" ou "12/10/2026" -> AAAA-MM-DD. */
export function dataIso(texto) {
  const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec((texto ?? '').trim());
  if (!m) return null;
  return `${m[3] ?? ANO}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

/** "10:00", "08:00:00" -> HH:MM. "A SEGUIR" e vazio -> null. */
export function horaHHMM(texto) {
  const m = /^(\d{1,2}):(\d{2})/.exec((texto ?? '').trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

/** Lado do confronto que depende de classificação ou de outro jogo, e não é equipe. */
export const ehRotulo = (texto) => {
  const c = chave(texto);
  return /vencedor|perdedor|melhor|\bgeral\b|colocad|^\d+\s*[ºª°]?\s*(grupo|lugar)/.test(c);
};

const ARTIGOS = new Set(['do', 'da', 'de', 'dos', 'das']);
const emCaixaDeTitulo = (texto) => texto.toLowerCase().split(/\s+/)
  .map((p, i) => (i > 0 && ARTIGOS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
  .join(' ');

/**
 * Grafia única de cada equipe, entre todas as abas.
 * Prefere a forma que já vem em caixa mista ("Leões do Norte"); a planilha de
 * vôlei grita tudo ("KINESIS"), e essa só vale se for a única.
 */
export function grafias(nomes) {
  const mapa = new Map();
  for (const nome of nomes) {
    const k = chave(nome);
    const atual = mapa.get(k);
    const mista = nome !== nome.toUpperCase();
    if (!atual || (mista && atual === atual.toUpperCase())) mapa.set(k, nome);
  }
  for (const [k, v] of mapa) mapa.set(k, v === v.toUpperCase() ? emCaixaDeTitulo(v) : v);
  return mapa;
}

/** Rótulo como o público vai ler, mantendo o que a API consegue resolver ("1 GRUPO A"). */
export function rotuloLegivel(texto) {
  const t = texto.trim();
  const grupo = /^(\d+)\s*[ºª°]?\s*grupo\s+(.+)$/i.exec(t);
  if (grupo) return `${grupo[1]} GRUPO ${grupo[2].trim().toUpperCase()}`;
  const jogo = /^(vencedor|perdedor)\s*(?:do\s*)?(?:jogo\s*|j)\s*(\d+)$/i.exec(t);
  if (jogo) return `${chave(jogo[1]) === 'vencedor' ? 'Vencedor' : 'Perdedor'} do Jogo ${Number(jogo[2])}`;
  const sufixo = /^(vencedor|perdedor)\s*(sf|qf)\s*(\d+)$/i.exec(t);
  if (sufixo) return `${chave(sufixo[1]) === 'vencedor' ? 'Vencedor' : 'Perdedor'} ${sufixo[2].toUpperCase()}${sufixo[3]}`;
  const geral = /^(\d+)\s*[ºª°]?\s*(lugar\s+)?geral$/i.exec(t);
  if (geral) return `${geral[1]}º ${geral[2] ? 'lugar ' : ''}geral`;
  const melhor = /^melhor\s+(\d+)\s*[ºª°]?\s*colocad([oa])s?$/i.exec(t);
  if (melhor) return `Melhor ${melhor[1]}º colocad${melhor[2].toLowerCase()}`;
  const ordinal = /^(\d+)\s*[ºª°]?\s*(melhor\s+classificad[oa])$/i.exec(t);
  if (ordinal) return `${ordinal[1]}º ${ordinal[2].toLowerCase()}`;
  const t2 = t.toLowerCase();
  return t2.charAt(0).toUpperCase() + t2.slice(1);
}

function separarConfronto(texto) {
  const partes = texto.trim().split(/\s+(?:x|×|vs\.?)\s+/i);
  return partes.length === 2 ? [partes[0].trim(), partes[1].trim()] : null;
}

/** Linhas de uma aba -> jogos crus, na ordem da planilha. */
export function lerAba(linhas) {
  const h = linhas.findIndex((r) => r.some((c) => ['equipe 1', 'jogo / confronto', 'confronto', 'horario'].includes(chave(c))));
  if (h < 0) throw new Error('Cabeçalho não encontrado.');
  const cab = linhas[h].map(chave);
  const col = (...nomes) => { const i = cab.findIndex((c) => nomes.includes(c)); return i < 0 ? null : i; };
  const c = {
    data: col('data'), hora: col('horario'), jogo: col('jogo'), grupo: col('grupo', 'grupo unico'),
    e1: col('equipe 1'), e2: col('equipe 2'), conf: col('jogo / confronto', 'confronto'), fase: col('fase'),
    local: col('local do jogo'),
  };
  const jogos = [];
  for (const r of linhas.slice(h + 1)) {
    if (!r.some(Boolean)) continue;
    const v = (i) => (i === null ? '' : (r[i] ?? '').trim());
    let casa; let fora;
    if (c.e1 !== null) { casa = v(c.e1); fora = v(c.e2); } else {
      const par = separarConfronto(v(c.conf));
      [casa, fora] = par ?? ['', ''];
    }
    if (!casa || !fora) continue;
    const numero = /(\d+)/.exec(v(c.jogo))?.[1];
    jogos.push({
      ordem: jogos.length + 1,
      numero: numero ? Number(numero) : jogos.length + 1,
      grupoCru: v(c.grupo),
      faseCru: v(c.fase),
      dataCrua: v(c.data),
      horaCrua: v(c.hora),
      localCru: v(c.local),
      casa,
      fora,
    });
  }
  return jogos;
}

const GRUPO_LETRA = /^(?:grupo\s*)?([a-d])$/i;
const SOMA = (hhmm, minutos) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutos;
  if (total >= 24 * 60) throw new Error(`O encadeamento de horários passou da meia-noite (${hhmm} + ${minutos} min).`);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** Todas as abas -> a lista final. `lerArquivo(nome)` devolve o texto do CSV. */
export function converter(lerArquivo) {
  const cruas = ABAS.map((aba) => ({ ...aba, jogos: lerAba(lerCsv(lerArquivo(aba.arquivo))) }));
  const nomes = cruas.flatMap((a) => a.jogos.flatMap((j) => [j.casa, j.fora]).filter((n) => !ehRotulo(n)));
  const grafia = grafias(nomes);
  const nomeDe = (n) => grafia.get(chave(n)) ?? n;

  return cruas.map((aba) => {
    const intervalo = INTERVALO_POR_MODALIDADE[aba.modalidade];
    const jogos = [];
    let anterior = null;
    for (const j of aba.jogos) {
      const ladoCasa = ehRotulo(j.casa) ? { rotulo: rotuloLegivel(j.casa) } : { equipe: nomeDe(j.casa) };
      const ladoFora = ehRotulo(j.fora) ? { rotulo: rotuloLegivel(j.fora) } : { equipe: nomeDe(j.fora) };
      const ambosTimes = ladoCasa.equipe && ladoFora.equipe;
      const letra = GRUPO_LETRA.exec(j.grupoCru)?.[1]?.toUpperCase();
      const unico = /^[uú]nico$/i.test(j.grupoCru.trim());
      const deGrupo = Boolean(ambosTimes && (letra || unico));
      const ambosRotulos = ladoCasa.rotulo && ladoFora.rotulo;

      let data = dataIso(j.dataCrua);
      let provisorioData = false;
      if (!data) { data = DATA_PROVISORIA; provisorioData = true; }
      let horario = horaHHMM(j.horaCrua);
      let provisorioHora = false;
      if (!horario) {
        if (!anterior || anterior.data !== data) {
          throw new Error(`${aba.modalidade} ${aba.naipe}, jogo ${j.numero}: sem horário e sem jogo anterior no mesmo dia para encadear.`);
        }
        horario = SOMA(anterior.horario, intervalo);
        provisorioHora = true;
      }
      anterior = { data, horario };

      jogos.push({
        ordem: j.ordem,
        numero: j.numero,
        // `grupo`: jogo entre duas equipes de um grupo. `chave`: os dois lados são
        // rótulos (semifinal, final...). `avulso`: um lado é equipe e o outro
        // rótulo, como na "mini-chave" do grupo único de 3 equipes.
        tipo: deGrupo ? 'grupo' : ambosRotulos ? 'chave' : 'avulso',
        grupo: deGrupo ? (letra ?? 'Único') : null,
        fase: j.faseCru || (deGrupo ? 'Fase de grupos' : j.grupoCru) || null,
        data,
        horario,
        local: j.localCru && chave(j.localCru) !== 'a definir' ? j.localCru : null,
        casa: ladoCasa,
        fora: ladoFora,
        provisorio: { data: provisorioData, horario: provisorioHora },
      });
    }

    const equipes = [...new Set(jogos.flatMap((j) => [j.casa.equipe, j.fora.equipe]).filter(Boolean))];
    const avisos = [];
    const daFase = jogos.filter((j) => j.tipo === 'grupo');
    let grupos;
    if (daFase.every((j) => j.grupo === 'Único')) {
      // Grupo único: todas as equipes da categoria, inclusive a que só aparece
      // nos jogos encadeados (a Compressora do basquete feminino).
      grupos = daFase.length ? [{ nome: 'Único', equipes }] : [];
    } else {
      /*
       * O grupo sai de QUEM JOGA COM QUEM, e não do rótulo da coluna.
       *
       * Na aba de vôlei masculino o jogo 6 (Furiosa x Halterada B) está marcado
       * "A" e o jogo 8 (Compressora x Halterada A) está marcado "B" — ao
       * contrário do resto da própria aba. Confiar na coluna jogaria Furiosa e
       * Halterada B num grupo com seis equipes. Duas equipes que se enfrentam
       * na fase de grupos estão, por definição, no mesmo grupo: as componentes
       * conexas do grafo de jogos são os grupos.
       */
      const pai = new Map();
      const raiz = (x) => { while (pai.get(x) !== x) { pai.set(x, pai.get(pai.get(x))); x = pai.get(x); } return x; };
      for (const j of daFase) for (const e of [j.casa.equipe, j.fora.equipe]) if (!pai.has(e)) pai.set(e, e);
      for (const j of daFase) pai.set(raiz(j.casa.equipe), raiz(j.fora.equipe));
      const porRaiz = new Map();
      for (const e of pai.keys()) {
        const r = raiz(e);
        if (!porRaiz.has(r)) porRaiz.set(r, []);
        porRaiz.get(r).push(e);
      }
      grupos = [...porRaiz.values()].map((membros) => {
        const rotulos = daFase.filter((j) => membros.includes(j.casa.equipe)).map((j) => j.grupo);
        const nome = [...new Set(rotulos)].sort((a, b) => rotulos.filter((x) => x === b).length - rotulos.filter((x) => x === a).length)[0];
        return { nome, equipes: membros };
      }).sort((a, b) => a.nome.localeCompare(b.nome));
      const nomes = grupos.map((g) => g.nome);
      if (new Set(nomes).size !== nomes.length) throw new Error(`${aba.modalidade} ${aba.naipe}: dois grupos com o mesmo nome (${nomes.join(', ')}).`);
      for (const j of daFase) {
        const certo = grupos.find((g) => g.equipes.includes(j.casa.equipe)).nome;
        if (j.grupo !== certo) {
          avisos.push(`Jogo ${j.numero} (${j.casa.equipe} x ${j.fora.equipe}): a planilha diz grupo ${j.grupo}, mas as duas equipes jogam no grupo ${certo}. Usado ${certo}.`);
          j.grupo = certo;
        }
      }
    }
    return {
      categoria: `${aba.modalidade} ${aba.naipe}`,
      modalidade: aba.modalidade,
      naipe: aba.naipe,
      grupos,
      equipes,
      avisos,
      jogos,
    };
  });
}

/** Execução direta: lê docs/copa-halterada/planilha/*.csv e escreve jogos.json. */
if (process.argv[1] && process.argv[1].endsWith('planilha-copa.mjs')) {
  const base = resolve('..', '..', 'docs', 'copa-halterada');
  const categorias = converter((nome) => readFileSync(resolve(base, 'planilha', nome), 'utf8'));
  writeFileSync(resolve(base, 'jogos.json'), JSON.stringify(categorias, null, 1) + '\n', 'utf8');
  let total = 0;
  for (const c of categorias) {
    const prov = c.jogos.filter((j) => j.provisorio.horario || j.provisorio.data).length;
    total += c.jogos.length;
    console.log(`${c.categoria.padEnd(20)} ${String(c.jogos.length).padStart(2)} jogos | ${c.equipes.length} equipes | grupos: ${c.grupos.map((g) => g.nome).join(',') || '-'} | provisórios: ${prov}`);
    for (const aviso of c.avisos) console.log('   ! ' + aviso);
  }
  console.log(`TOTAL ${total} jogos -> docs/copa-halterada/jogos.json`);
}
