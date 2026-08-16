import { UnauthorizedError, sessionFromLogin, type LoginPayload } from './auth-adapter.ts';
import { readStoredSession, writeStoredSession } from './session-storage.ts';

/**
 * O cliente HTTP do app.
 *
 * Uma única porta de saída: todo request passa por aqui, então o envelope da
 * resposta, o formato do erro, o 401 e a renovação da sessão são escritos uma
 * vez só. `NEXT_PUBLIC_API_URL` aponta para a API; sem ele, assume o mesmo host
 * em `/api`.
 */
export function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '/api';
}

export type ApiRequest = {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** As rotas de autenticação recusam a renovação: 401 lá é credencial errada. */
  retryOnUnauthorized?: boolean;
};

/**
 * A API embrulha a resposta em `{ data, meta }`; o mock do contrato devolve o
 * payload cru. Nenhum corpo do contrato tem `data` na raiz, então reconhecer o
 * envelope pela chave serve aos dois sem configuração.
 */
function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === 'object' && 'data' in payload && Object.keys(payload).length <= 2) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

async function readError(response: Response) {
  try {
    const payload = await response.json() as { error?: { message?: string }; message?: string | string[] };
    const message = payload.error?.message ?? (Array.isArray(payload.message) ? payload.message[0] : payload.message);
    return message || `Falha na requisição (${response.status}).`;
  } catch {
    return `Falha na requisição (${response.status}).`;
  }
}

/**
 * Renovação em voo único.
 *
 * Um snapshot vencido derruba várias requisições ao mesmo tempo. Sem isto,
 * cada uma pediria a própria renovação e as últimas usariam um refresh token
 * já rotacionado — derrubando a sessão de quem só queria continuar trabalhando.
 */
let renewal: Promise<string | null> | null = null;

function renewSession(fetchImpl?: typeof fetch): Promise<string | null> {
  if (!renewal) {
    renewal = runRenewal(fetchImpl);
    // A trava é solta por fora, e não num `finally` dentro do corpo: quando o
    // corpo retorna antes do primeiro `await` — sessão sem credencial de
    // renovação —, o `finally` rodaria *antes* da atribuição acima e deixaria
    // `renewal` preso num `null` já resolvido. A partir daí nenhuma renovação
    // voltaria a acontecer nesta página, e o próximo 401 devolveria ao login
    // quem tinha sessão boa. `.finally` de promessa é sempre assíncrono, então
    // roda depois da atribuição.
    renewal.then(() => { renewal = null; }, () => { renewal = null; });
  }
  return renewal;
}

async function runRenewal(fetchImpl?: typeof fetch): Promise<string | null> {
  const session = readStoredSession();
  if (!session?.refreshToken) return null;
  try {
    const payload = await apiRequest<LoginPayload>({
      path: '/auth/refresh',
      method: 'POST',
      body: { refreshToken: session.refreshToken },
      retryOnUnauthorized: false,
      fetchImpl,
    });
    const next = sessionFromLogin({ ...payload, user: payload.user ?? session }, session.remembered);
    writeStoredSession(next);
    return next.token;
  } catch {
    return null;
  }
}

export async function apiRequest<T>({ path, method = 'GET', body, token, fetchImpl, signal, retryOnUnauthorized = true }: ApiRequest): Promise<T> {
  const call = fetchImpl ?? globalThis.fetch;
  const send = (bearer?: string | null) => call(`${apiBaseUrl()}${path}`, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let response = await send(token);

  // 401 é sessão, não erro de tela. Com credencial de renovação, tenta uma vez;
  // sem ela, quem trata encerra o acesso e devolve ao login com aviso.
  if (response.status === 401 && retryOnUnauthorized) {
    const renewed = await renewSession(fetchImpl);
    if (renewed) response = await send(renewed);
  }

  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) throw new Error(await readError(response));
  if (response.status === 204) return undefined as T;
  return unwrap<T>(await response.json());
}
