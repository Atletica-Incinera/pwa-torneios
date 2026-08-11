let sequence = 0;

/**
 * Identificador único dentro da sessão.
 *
 * `Date.now()` sozinho colide quando dois registros nascem no mesmo
 * milissegundo — o caso visível era a auditoria, que usa o id como chave de
 * lista no React.
 */
export function createId(prefix: string) {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence.toString(36)}`;
}
