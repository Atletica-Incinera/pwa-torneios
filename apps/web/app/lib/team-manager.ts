import type { FrontendState } from './frontend-state';
import type { FrontendSession } from './frontend-session';

/**
 * A equipe do responsável da atlética, pelo id da rota.
 *
 * A sessão traz a equipe pelo papel (`editionRoles[].teamId`) e pelo nome no
 * escopo. O id do papel é o confiável; o nome fica de reserva para sessões
 * gravadas antes de o papel trazer a equipe.
 */
export function teamIdForManager(
  state: Pick<FrontendState, 'teams'>,
  session: Pick<FrontendSession, 'role' | 'scope' | 'editionRoles' | 'selectedRoleAssignmentId'> | null | undefined,
): string | undefined {
  if (session?.role !== 'TEAM_MANAGER') return undefined;
  const role = session.editionRoles?.find((item) => item.roleAssignmentId === session.selectedRoleAssignmentId)
    ?? session.editionRoles?.find((item) => item.role === 'TEAM_MANAGER');
  if (role?.teamId && state.teams[role.teamId]) return role.teamId;
  return Object.entries(state.teams).find(([, team]) => team.name === (role?.teamName ?? session.scope))?.[0];
}
