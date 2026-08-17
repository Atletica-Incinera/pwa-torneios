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

/**
 * Como o app foi compilado para acompanhar a edição.
 *
 * `NEXT_PUBLIC_REALTIME` é embutido na compilação (`scripts/build-http.mjs`), e
 * quem compila é o mesmo comando que roda a suíte — ler a variável aqui é ler o
 * que está dentro do build. Os cenários de tempo real dependem do transporte:
 * com o stream, a mudança é empurrada; com o polling, ela chega no próximo
 * ciclo, e a contagem de cargas por página deixa de ser estável.
 */
export const realtimeMode = (process.env.NEXT_PUBLIC_REALTIME === 'poll' || process.env.NEXT_PUBLIC_REALTIME === 'off' ? process.env.NEXT_PUBLIC_REALTIME : 'sse') as 'sse' | 'poll' | 'off';

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

/**
 * Cabeçalho de um administrador, para os cenários conferirem o lado do servidor.
 *
 * O token é emitido pelo login nos dois alvos. No mock ele já foi previsível —
 * `token-<e-mail>` —, e deixou de ser quando o mock passou a imitar a API: lá o
 * acesso é um JWT que ninguém consegue adivinhar, e um cenário que montasse o
 * cabeçalho na mão passaria aqui e voltaria 401 na integração.
 */
export async function authHeaders(request: APIRequestContext) {
  const response = await request.post(`${apiUrl}/auth/login`, { data: { email: credentials.email, password: credentials.password } });
  const body = unwrap<{ token?: string; accessToken?: string }>(await response.json());
  return { Authorization: `Bearer ${body.token ?? body.accessToken}` };
}

/**
 * A rota da API por trás de uma requisição do navegador, ou `null`.
 *
 * Contar requisição por caminho ficou perigoso quando o app passou a falar
 * rotas granulares: `/competitions` é rota da API **e** tela do app, e o Next
 * pré-busca as telas que aparecem no menu. Sem separar por origem, a pré-busca
 * de uma tela entraria na conta de cargas da edição e o cenário acusaria duas
 * remontagens onde houve uma. O prefixo de versão some junto, porque só o alvo
 * real o tem.
 */
export function apiRoute(url: string) {
  if (!url.startsWith(apiUrl)) return null;
  return new URL(url).pathname.replace(/^\/api(\/v1)?/, '') || '/';
}

/**
 * A edição vigente, descoberta como o adaptador a descobre.
 *
 * O apelido `active` morreu com o snapshot: nenhuma rota resolve a edição
 * corrente, e o cenário que precisa do id no caminho tem de repetir a regra —
 * a mais recente em andamento, ou a mais recente de todas. Fixar
 * `intereng-2026` aqui passaria no mock e quebraria contra a API real, onde os
 * ids são gerados no banco.
 */
export async function activeEditionId(request: APIRequestContext) {
  const competitions = unwrap<Array<{ id: string }>>(await (await request.get(`${apiUrl}/competitions?page=1&pageSize=100`)).json());
  const editions: Array<{ id: string; year: number; status: string }> = [];
  for (const competition of competitions) {
    editions.push(...unwrap<Array<{ id: string; year: number; status: string }>>(await (await request.get(`${apiUrl}/competitions/${competition.id}/editions`)).json()));
  }
  const byYear = [...editions].sort((left, right) => right.year - left.year);
  const chosen = byYear.find((edition) => edition.status === 'ONGOING') ?? byYear[0];
  if (!chosen) throw new Error('A API não devolveu nenhuma edição: os cenários não têm o que abrir.');
  return chosen.id;
}

/**
 * Faz uma rota do mock responder um erro, como a API responderia.
 *
 * O gancho deixou de ser por nome de ação quando o despachante deixou de
 * existir: o que o operador encontra numa API sem a operação é a **rota**
 * respondendo 501, 500 ou 404. `reset` desarma, e todo cenário reseta antes de
 * começar.
 */
export async function armFailure(request: APIRequestContext, failure: { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; status: number; message: string }) {
  const response = await request.post(`${apiUrl}/test/unimplemented-action`, { data: failure });
  if (!response.ok()) throw new Error(`O gancho /test/unimplemented-action respondeu ${response.status()}.`);
}
