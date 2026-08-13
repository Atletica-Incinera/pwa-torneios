/**
 * O endereço da modalidade no app.
 *
 * Ficou de fora do contrato de propósito: é rota do Next, não regra do
 * torneio. A API não tem o que fazer com ela.
 */
export function disciplineHref(name: string) {
  return `/disciplines/${encodeURIComponent(name.toLocaleLowerCase('pt-BR'))}`;
}
