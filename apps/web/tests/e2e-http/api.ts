import type { APIRequestContext } from '@playwright/test';

/**
 * Para onde os cenários apontam.
 *
 * A mesma suíte roda contra o mock (padrão, sem servidor) e contra a API real.
 * O que muda entre os dois mora aqui, para nenhum cenário precisar saber.
 */
export const apiTarget = (process.env.E2E_API === 'real' ? 'real' : 'mock') as 'mock' | 'real';
export const apiUrl = process.env.E2E_API_URL ?? (apiTarget === 'real' ? 'http://127.0.0.1:3000/api/v1' : 'http://127.0.0.1:3201');
export const isMock = apiTarget === 'mock';

export const credentials = { email: 'ana@ufpe.br', password: 'intereng2026', name: 'Ana Coordenadora' };

/** Onde o navegador guarda a sessão, para os cenários que precisam mexer nela. */
export const sessionKey = 'intereng:frontend-session';

/**
 * Tira o corpo do envelope.
 *
 * A API embrulha a resposta em `{ data }` e o mock devolve o corpo cru — as
 * duas formas que `api-client.ts` já reconhece. Desembrulhar mora aqui porque,
 * feito à mão em cada cenário, o que acontece é o que aconteceu: um lembra e o
 * outro esquece, os dois passam contra o mock, e só o segundo estoura com
 * `TypeError` contra a API.
 */
export function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload) return (payload as { data: T }).data;
  return payload as T;
}

/** Devolve a edição ao estado semeado. Na API real depende do gancho de teste. */
export async function reset(request: APIRequestContext) {
  const response = isMock ? await request.get(`${apiUrl}/test/reset`) : await request.post(`${apiUrl}/test/reset`);
  if (!response.ok() && !isMock) {
    throw new Error('A API real não expõe POST /test/reset. Suba com ENABLE_TEST_ENDPOINTS=true.');
  }
}

/** Cabeçalho de um administrador, para os cenários conferirem o lado do servidor. */
export async function authHeaders(request: APIRequestContext) {
  // No mock o token é previsível; na API real ele é emitido de verdade.
  if (isMock) return { Authorization: `Bearer token-${credentials.email}` };
  const response = await request.post(`${apiUrl}/auth/login`, { data: { email: credentials.email, password: credentials.password } });
  const body = unwrap<{ token?: string; accessToken?: string }>(await response.json());
  return { Authorization: `Bearer ${body.token ?? body.accessToken}` };
}
