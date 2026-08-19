import axios, {
  type AxiosAdapter,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import {
  normalizeSessionUser,
  UnauthorizedError,
  type AuthSessionResponse,
  type FrontendSession,
} from './auth-adapter.ts';
import {
  expireStoredSession,
  readSessionLogoutMarker,
  readStoredSession,
  writeStoredSession,
} from './session-storage.ts';

export function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '/api';
}

export type ApiEnvelope<T> = { data: T; meta?: unknown };
type ApiErrorEnvelope = { error?: { code?: string; message?: string | string[] } };

/**
 * Erro da API com o código do envelope (`error.code`) preservado.
 *
 * A mensagem em português não é estável o bastante para o código decidir
 * comportamento por ela — o código é. É o que deixa `NO_ACTIVE_EDITION`
 * (estado legítimo: nenhuma competição criada ainda) distinguível de um 404
 * comum (ID errado), sem comparar texto.
 */
export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export type ApiRequest = {
  path: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  adapter?: AxiosAdapter;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  skipAuthRefresh?: boolean;
};

function createClient(adapter?: AxiosAdapter): AxiosInstance {
  return axios.create({
    baseURL: apiBaseUrl(),
    withCredentials: true,
    adapter,
    headers: { 'Content-Type': 'application/json' },
  });
}

const defaultClient = createClient();
let refreshPromise: Promise<FrontendSession> | null = null;
let authEpoch = 0;

function unwrap<T>(response: AxiosResponse<ApiEnvelope<T>>): T {
  if (response.status === 204) return undefined as T;
  return response.data.data;
}

function statusOf(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.status : undefined;
}

function isRetriableActionNetworkError(error: unknown, request: ApiRequest): boolean {
  return axios.isAxiosError(error)
    && !axios.isCancel(error)
    && !error.response
    && request.method === 'POST'
    && /^\/editions\/[^/]+\/actions(?:\?|$)/.test(request.path);
}

function requestError(error: unknown): Error {
  if (!axios.isAxiosError<ApiErrorEnvelope>(error)) {
    return error instanceof Error ? error : new Error('Não foi possível acessar o servidor.');
  }
  const raw = error.response?.data?.error?.message;
  const message = Array.isArray(raw) ? raw[0] : raw;
  return new ApiError(
    message || (error.response
      ? `Falha na requisição (${error.response.status}).`
      : 'Não foi possível acessar o servidor.'),
    error.response?.data?.error?.code,
  );
}

async function requestSessionRefresh(client: AxiosInstance): Promise<FrontendSession> {
  const current = readStoredSession();
  if (!current) throw new UnauthorizedError();
  const epoch = authEpoch;
  const logoutMarker = readSessionLogoutMarker();

  try {
    const response = await client.post<ApiEnvelope<AuthSessionResponse>>('/auth/refresh');
    const payload = unwrap(response);
    if (epoch !== authEpoch || logoutMarker !== readSessionLogoutMarker()) {
      throw new UnauthorizedError();
    }
    const session: FrontendSession = {
      ...normalizeSessionUser(payload.user, current),
      remembered: current.remembered,
      token: payload.token,
      expiresAt: payload.expiresAt,
    };
    writeStoredSession(session);
    return session;
  } catch (error) {
    if (statusOf(error) === 401) {
      expireStoredSession();
      throw new UnauthorizedError();
    }
    throw requestError(error);
  }
}

async function refreshWithBrowserLock(client: AxiosInstance): Promise<FrontendSession> {
  const tokenBeforeLock = readStoredSession()?.token;
  const rotate = async () => {
    const latest = readStoredSession();
    if (
      latest?.token &&
      latest.token !== tokenBeforeLock &&
      Date.parse(latest.expiresAt) > Date.now()
    ) {
      return latest;
    }
    return requestSessionRefresh(client);
  };

  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('intereng:refresh-token', rotate);
  }
  return rotate();
}

/** Compartilha uma única rotação entre requisições concorrentes, inclusive entre abas. */
export function refreshApiSession(adapter?: AxiosAdapter): Promise<FrontendSession> {
  if (!refreshPromise) {
    refreshPromise = refreshWithBrowserLock(adapter ? createClient(adapter) : defaultClient)
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

/** Invalida qualquer refresh em voo antes de iniciar o logout local. */
export function cancelPendingSessionRefresh(): void {
  authEpoch += 1;
  refreshPromise = null;
}

async function executeEnvelope<T>(
  client: AxiosInstance,
  request: ApiRequest,
  token: string | null | undefined,
): Promise<ApiEnvelope<T>> {
  const config: AxiosRequestConfig = {
    url: request.path,
    method: request.method ?? 'GET',
    data: request.body,
    signal: request.signal,
    headers: {
      ...request.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  const response = await client.request<ApiEnvelope<T>>(config);
  if (response.status === 204) return { data: undefined as T };
  return response.data;
}

export async function apiRequestEnvelope<T>(request: ApiRequest): Promise<ApiEnvelope<T>> {
  const client = request.adapter ? createClient(request.adapter) : defaultClient;
  let networkRetryUsed = false;
  const execute = async (token: string | null | undefined) => {
    try {
      return await executeEnvelope<T>(client, request, token);
    } catch (error) {
      if (!networkRetryUsed && isRetriableActionNetworkError(error, request)) {
        networkRetryUsed = true;
        // A primeira tentativa pode ter sido confirmada no servidor antes de a
        // conexão cair. Body e Idempotency-Key permanecem exatamente iguais.
        return executeEnvelope<T>(client, request, token);
      }
      throw error;
    }
  };

  try {
    return await execute(request.token);
  } catch (error) {
    if (statusOf(error) !== 401) throw requestError(error);
    if (request.skipAuthRefresh) throw new UnauthorizedError();

    const current = readStoredSession();
    const retryToken = current?.token && current.token !== request.token
      ? current.token
      : (await refreshApiSession(request.adapter)).token;
    try {
      return await execute(retryToken);
    } catch (retryError) {
      if (statusOf(retryError) === 401) {
        expireStoredSession();
        throw new UnauthorizedError();
      }
      throw requestError(retryError);
    }
  }
}

export async function apiRequest<T>(request: ApiRequest): Promise<T> {
  return (await apiRequestEnvelope<T>(request)).data;
}
