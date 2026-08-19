import { apiRequest } from './api-client.ts';
import { readSessionToken } from './session-storage.ts';

/**
 * Cria a primeira competição de um sistema vazio, fora do pipeline de ações.
 *
 * `POST /editions/active/actions` — o caminho que `competition/create` usa
 * normalmente — resolve a edição "active" antes de rodar qualquer ação. Sem
 * nenhuma competição ativa ainda, nem essa ação chega a executar: é um
 * impasse que só existe uma vez, antes de a primeira existir. Depois dela, o
 * caminho normal (`dispatch({ type: 'competition/create', ... })`) volta a
 * funcionar — este endpoint só serve para a saída inicial.
 */
export async function bootstrapCompetition(input: {
  name: string;
  slug: string;
  year: number;
  start: string;
  end: string;
}): Promise<void> {
  await apiRequest({
    path: '/competitions/bootstrap',
    method: 'POST',
    body: input,
    token: readSessionToken(),
  });
}
