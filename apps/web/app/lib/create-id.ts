/**
 * Identificador de registro novo, gerado no cliente.
 *
 * Vale para as duas origens de dados: quem cria também escolhe o id, e o
 * servidor o aceita como veio. Isso mantém a navegação depois de criar
 * (`router.push('/teams/' + id)`) e torna o reenvio idempotente — a mesma
 * operação repetida por falha de rede não cria dois registros.
 *
 * O sufixo é aleatório de verdade, não um contador: o contador reiniciava a
 * cada carga de página e dois aparelhos criando no mesmo instante colidiam.
 */
export function createId(prefix: string) {
  return `${prefix}-${randomSuffix()}`;
}

/** Sufixo curto e único, com queda para ambientes sem `crypto`. */
export function randomSuffix() {
  const random = globalThis.crypto;
  if (random?.randomUUID) return random.randomUUID().replace(/-/g, '').slice(0, 12);
  if (random?.getRandomValues) return [...random.getRandomValues(new Uint8Array(6))].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}
