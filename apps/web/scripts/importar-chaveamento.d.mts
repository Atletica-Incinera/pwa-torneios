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
