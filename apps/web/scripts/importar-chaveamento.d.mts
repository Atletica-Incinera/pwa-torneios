/**
 * Tipos das funções de leitura da planilha de chaveamento.
 *
 * O script é `.mjs` porque roda direto pelo Node, sem passar pelo build do
 * app — mas o que ele lê é a parte arriscada e tem teste. Sem esta declaração
 * o teste importaria tudo como `any`, e a verificação de tipo, que é metade
 * do valor de testar um parser, não aconteceria.
 */
export type Modalidade = { nome: string; masculino: number; feminino: number };
export type Grupo = { nome: string; equipes: string[] };
export type Jogo = {
  numero: number;
  casa: string;
  fora: string;
  local: string;
  horario: string;
};

export function lerGrade(caminho: string): string[][];
export function lerModalidades(grade: string[][]): Modalidade[];
export function lerGrupos(grade: string[][]): Grupo[];
export function lerJogos(grade: string[][]): Jogo[];
export function dependeDeResultado(nome: string): boolean;
export function lerMataMata(grade: string[][], colunaDosJogos?: number): Jogo[];
export function ordemNoChaveamento(id: string): number;

export type JogoPlanejado = Jogo & {
  casa?: string;
  fora?: string;
  rotuloCasa?: string;
  rotuloFora?: string;
  grupo: string;
};
export function planejar(
  grade: string[][],
  estado: { teams?: Record<string, { name?: string }> },
): {
  grupos: Grupo[];
  jogos: Jogo[];
  modalidades: Modalidade[];
  daFaseDeGrupos: JogoPlanejado[];
  doMataMata: VagaDaChave[];
  avisos: string[];
  participantes: string[];
};

export type Plano = { grupos: Grupo[]; participantes: string[] };
export function montarConfiguracao(
  plano: Plano,
  contexto: { editionId?: string; nome: string; modalidade: string },
): {
  participants: string[];
  seeds: Record<string, number>;
  assignments: Record<string, string>;
  phases: { id: string; name: string; format: string; groups: string[]; qualifiers: number }[];
  advancement: { perGroup: number; bestThirds: number; crossing: string; thirdPlaceMatch: boolean };
  [chave: string]: unknown;
};

export function nomeNoApp(daPlanilha: string): string;

export function colunaDosJogos(grade: string[][]): number;

export function emCaixaDeTitulo(texto: string): string;

export function lerDias(grade: string[][], ano: number): Map<string, string>;

export type Colocacao =
  | { tipo: 'grupo'; grupo: string; posicao: number }
  | { tipo: 'melhor-terceiro'; posicao: number };
export function lerColocacao(rotulo: string): Colocacao | null;

export function dependeDeOutroJogo(nome: string): boolean;

export function rotuloDoConfronto(nome: string): string;

export type VagaDaChave = Jogo & {
  rodada: number;
  vaga: number | null;
  /** O que vai depois do id da categoria: `advanced-r2-1`, `advanced-third`. */
  sufixo: string;
  rotuloA: string;
  rotuloB: string;
};
export function vagasDoMataMata(jogos: Jogo[]): { vagas: VagaDaChave[]; sobraram: Jogo[] };

export function jaAgendado(
  estado: { matches?: Record<string, { tournamentId?: string; entryA?: string; entryB?: string; date?: string; time?: string }> },
  categoriaId: string,
  jogo: { casa?: string; fora?: string; rotuloCasa?: string; rotuloFora?: string; horario?: string },
  data?: string,
): boolean;
