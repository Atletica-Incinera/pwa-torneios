/**
 * Comparação de texto para busca na tela.
 *
 * As buscas comparavam com `toLocaleLowerCase` apenas, e acento entrava na
 * conta: "caotica" não encontrava a Caótica, "joao" não encontrava o João
 * Pedro, "tubaroes" não encontrava os Tubarões. Digitar sem acento é o padrão
 * de quem procura com pressa — e no ginásio, no meio de um jogo, é o único
 * jeito de digitar rápido no celular.
 *
 * A normalização é a mesma já usada para casar escudo com nome de equipe em
 * `escudos.ts`: NFD separa a letra do acento, e a faixa combinada é removida.
 */
export function normalizarParaBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

/** Verdadeiro quando qualquer um dos campos contém o termo, ignorando acento e caixa. */
export function casaComBusca(termo: string, campos: (string | undefined)[]): boolean {
  const procurado = normalizarParaBusca(termo);
  if (!procurado) return true;
  return campos.some((campo) => campo && normalizarParaBusca(campo).includes(procurado));
}
