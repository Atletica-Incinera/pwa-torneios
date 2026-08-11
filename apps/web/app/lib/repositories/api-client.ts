import { UnauthorizedError } from './auth-adapter.ts';

/**
 * O cliente HTTP do app.
 *
 * Uma única porta de saída: todo request passa por aqui, então o tratamento de
 * 401 e de erro de rede é escrito uma vez só. `NEXT_PUBLIC_API_URL` aponta para
 * a API (o `API_HOST` do compose); sem ele, assume o mesmo host em `/api`.
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
};

async function readError(response: Response) {
  try {
    const payload = await response.json() as { message?: string | string[] };
    const message = Array.isArray(payload.message) ? payload.message[0] : payload.message;
    return message || `Falha na requisição (${response.status}).`;
  } catch {
    return `Falha na requisição (${response.status}).`;
  }
}

export async function apiRequest<T>({ path, method = 'GET', body, token, fetchImpl, signal }: ApiRequest): Promise<T> {
  const call = fetchImpl ?? globalThis.fetch;
  const response = await call(`${apiBaseUrl()}${path}`, {
    method,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // 401 é sessão, não erro de tela: quem trata encerra o acesso e volta ao login.
  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) throw new Error(await readError(response));
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}
