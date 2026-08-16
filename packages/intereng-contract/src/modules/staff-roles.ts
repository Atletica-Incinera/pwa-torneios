/**
 * Os dois vocabulários de papel da edição.
 *
 * O convite grava o rótulo que a tela de staff exibe; a sessão viaja com o
 * código que as guardas de rota comparam. A tradução entre os dois morava num
 * ternário do adaptador local — e o servidor teria de adivinhá-la para emitir a
 * mesma sessão a partir do mesmo convite.
 */

/** O papel como o convite o grava e a tela de staff o exibe. */
export type StaffRoleLabel = 'Admin da edição' | 'Gestor de modalidade';

/**
 * O papel como a sessão o carrega. `SUPER_ADMIN` não tem rótulo: é o
 * desenvolvedor do app, não alguém convidado para o staff da edição.
 */
export type StaffRole = 'SUPER_ADMIN' | 'EDITION_ADMIN' | 'DISCIPLINE_MANAGER';

/** Os papéis que um convite concede, na ordem em que o formulário os oferece. */
export const staffRoleLabels = ['Admin da edição', 'Gestor de modalidade'] as const satisfies readonly StaffRoleLabel[];

const rolesByLabel = {
  'Admin da edição': 'EDITION_ADMIN',
  'Gestor de modalidade': 'DISCIPLINE_MANAGER',
} as const satisfies Record<StaffRoleLabel, StaffRole>;

/** O papel de sessão de quem foi convidado ao staff com este rótulo. */
export function roleFromStaffLabel(label?: string): StaffRole {
  // Tolerante como a leitura do estado: o registro pode chegar do LocalStorage
  // ou da API com um rótulo que este contrato não conhece, e conceder o papel
  // mais restrito é o único palpite que não abre acesso indevido.
  return rolesByLabel[label as StaffRoleLabel] ?? 'DISCIPLINE_MANAGER';
}
