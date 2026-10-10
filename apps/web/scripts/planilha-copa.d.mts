export const ANO: number;
export const DATA_PROVISORIA: string;
export const INTERVALO_POR_MODALIDADE: Record<string, number>;
export const ABAS: { arquivo: string; modalidade: string; naipe: string }[];

export function chave(texto: unknown): string;
export function lerCsv(texto: string): string[][];
export function dataIso(texto: string): string | null;
export function horaHHMM(texto: string): string | null;
export function ehRotulo(texto: string): boolean;
export function grafias(nomes: string[]): Map<string, string>;
export function rotuloLegivel(texto: string): string;
export function lerAba(linhas: string[][]): unknown[];
export function converter(lerArquivo: (nome: string) => string): unknown[];
