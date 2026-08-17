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
 * O que pode viajar ao lado de `data` num envelope.
 *
 * É esta lista que define a forma: `{ data, meta }` do contrato, os `links` de
 * paginação e o `{ data, statusCode, timestamp, path }` que alguns
 * interceptors do Nest devolvem. Contar chaves não distingue nada — um
 * `{ data, meta, links }` tem três e é envelope.
 */
const envelopeCompanions = new Set(['meta', 'links', 'statusCode', 'timestamp', 'path', 'success']);

/**
 * A API embrulha a resposta; o mock do contrato devolve o payload cru. Nenhum
 * corpo do contrato tem `data` na raiz, então reconhecer o envelope pela forma
 * serve aos dois sem configuração.
 *
 * O que não dá para decidir é recusado aqui, alto. Passar adiante um corpo
 * embrulhado que não foi reconhecido termina na remontagem da edição, que
 * completaria cada coleção com vazio: a tela fica pronta, plausível e sem nada
 * dentro — a pior falha possível, porque não parece falha.
 */
function unwrap<T>(payload: unknown): T {
  if (!payload || typeof payload !== 'object') return payload as T;
  const keys = Object.keys(payload);
  if (!keys.includes('data')) return payload as T;
  const strangers = keys.filter((key) => key !== 'data' && !envelopeCompanions.has(key));
  if (strangers.length) throw new Error(`O servidor respondeu num formato que o app não reconhece (campos: ${keys.join(', ')}).`);
  return (payload as { data: T }).data;
}

/**
 * Falha que o servidor descreveu.
 *
 * O status e o `code` viajam junto com a frase porque quem chama decide coisas
 * diferentes com eles: `403` numa coleção que exige papel é ausência de
 * permissão — a tela segue sem aquela parte —, enquanto qualquer outro erro na
 * mesma coleção é falha de carga e precisa parar tudo. Sem o status, distinguir
 * um do outro exigiria ler a mensagem, que é texto de humano e muda.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
  }
}

/**
 * A frase que o operador lê.
 *
 * Três formas convivem: `{ error: { code, message, details } }` da API,
 * `{ message }` do Nest cru e `{ message: [...] }` do class-validator. No 400
 * de validação a API troca a mensagem por um literal fixo — "Erro de validação
 * nos campos enviados." — e guarda o que é legível em `details[].issue`; o
 * `details[].field` é a primeira palavra da mensagem em português, quase sempre
 * um artigo, e por isso não é exibido.
 */
async function readError(response: Response) {
  try {
    const payload = await response.json() as { error?: { code?: string; message?: string; details?: Array<{ field?: string; issue?: string }> }; message?: string | string[] };
    const base = payload.error?.message ?? (Array.isArray(payload.message) ? payload.message[0] : payload.message);
    const issue = payload.error?.details?.find((detail) => detail.issue)?.issue;
    const message = issue && base ? `${base} ${issue}` : base || issue;
    return { message: message || `Falha na requisição (${response.status}).`, code: payload.error?.code };
  } catch {
    return { message: `Falha na requisição (${response.status}).`, code: undefined };
  }
}

/**
 * A renovação não completou, e **não** por culpa da credencial.
 *
 * A distinção existe porque as duas falhas levam a lugares opostos: o servidor
 * recusar a renovação encerra a sessão; não receber resposta não encerra nada.
 */
export class RenewalUnavailableError extends Error {
  constructor() { super('Não foi possível renovar a sessão agora. Tente de novo.'); }
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
    /**
     * A renovação devolve acesso novo; o resto ela pode omitir, e a maioria
     * omite — refresh não rotativo é o padrão mais comum, e o contrato o
     * permite. Sem preservar aqui, a credencial de renovação viraria
     * `undefined` na gravação e o 401 seguinte, uns quinze minutos depois, não
     * teria com o que renovar: o operador seria expulso para o login no meio da
     * partida. O prazo pelo mesmo motivo — em branco, ele seria reempurrado
     * para doze horas a cada renovação, estendendo a sessão além do que o
     * servidor autorizou.
     */
    const next = sessionFromLogin({ ...payload, user: payload.user ?? session }, session.remembered);
    writeStoredSession({
      ...next,
      refreshToken: next.refreshToken ?? session.refreshToken,
      expiresAt: payload.expiresAt ?? session.expiresAt,
    });
    return next.token;
  } catch (caught) {
    // O servidor recusar a renovação encerra a sessão: o refresh token morreu.
    // Não receber resposta é outra coisa — rede oscilando, ou a página sendo
    // descarregada no meio de uma navegação, que aborta as requisições em voo.
    // Tratar as duas igual expulsa para o login quem só clicou num link.
    if (caught instanceof UnauthorizedError) return null;
    throw new RenewalUnavailableError();
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
  if (!response.ok) {
    const { message, code } = await readError(response);
    throw new ApiError(message, response.status, code);
  }
  // 204 é o corpo vazio dos DELETE da API; 205 e o `Content-Length: 0` de um
  // proxy caem no mesmo caso — `response.json()` num corpo vazio estoura com
  // um `SyntaxError` que não diz nada a quem lê o log.
  if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T;
  return unwrap<T>(await response.json());
}
