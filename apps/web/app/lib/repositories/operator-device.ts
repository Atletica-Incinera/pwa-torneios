import { createId } from '../create-id.ts';

const operatorIdKey = 'intereng:operator-id';
let volatileOperatorId: string | undefined;

/**
 * Identifica esta aba durante a operação do placar. O sessionStorage mantém o
 * valor em recargas, mas outra aba ou outro aparelho recebe uma trava própria.
 */
export function getOperatorDeviceId(): string {
  if (typeof window === 'undefined') return volatileOperatorId ??= createId('operator');
  try {
    const stored = window.sessionStorage.getItem(operatorIdKey);
    if (stored) return stored;
    const created = createId('operator');
    window.sessionStorage.setItem(operatorIdKey, created);
    volatileOperatorId = created;
    return created;
  } catch {
    return volatileOperatorId ??= createId('operator');
  }
}
