// O payload varia por tipo de ação (equipe, categoria, partida); quem consome conhece o formato.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const COMPETICAO_ESPERADA: string;
export function idDaCategoria(nome: string): string;
export function avancoDaChave(
  vagas: { rodada: number; vaga: number | null; sufixo: string }[],
  quantidadeDeGrupos: number,
): { perGroup: number; bestThirds: number; crossing: string; thirdPlaceMatch: boolean };
export function ordenarPelaChave<T extends { numero: number }>(jogos: T[]): T[];
export function planejarCopa(
  categorias: unknown[],
  estado: Record<string, unknown>,
  opcoes?: {
    publicar?: boolean;
    catalogo?: { id: string; name: string; initials?: string | null; archived?: boolean }[];
    equipesMeta?: { nome: string; sigla?: string; responsavel?: string; logo?: string }[];
  },
): {
  acoes: { rotulo: string; type: string; payload: any; audit: Record<string, unknown> }[];
  avisos: string[];
  provisorios: unknown[];
  equipesAVincular: string[];
  equipesACriar: string[];
  editionId?: string;
};
export function lerEquipesCsv(caminho: string): { nome: string; sigla: string; responsavel: string; logo: string }[];
