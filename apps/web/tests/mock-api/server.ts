import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { seededFrontendState, type FrontendState } from '../../app/lib/frontend-state.ts';
import { applyAction } from '../../app/lib/repositories/reducer.ts';
import type { Action } from '../../app/lib/repositories/actions.ts';
import { privateTournamentStatuses } from '../../app/lib/status.ts';

/**
 * A API de mentira do contrato.
 *
 * Existe para provar que o modo `http` funciona de verdade: o app é compilado
 * com `NEXT_PUBLIC_DATA_SOURCE=http` e conversa com este servidor como
 * conversaria com o NestJS. Ela roda o mesmo reducer do cliente — que é
 * exatamente o que o backend fará — e devolve o snapshot como resposta.
 */
const port = Number(process.env.MOCK_API_PORT ?? 3201);
const EDITION = { id: 'intereng-2026', name: '2026' };

/**
 * O papel do usuário na edição, no formato que a API real devolve.
 *
 * Não é detalhe: o app decide o que liberar a partir de `editionRoles`, não do
 * campo `role` solto. Sem esta lista, quem não é super admin entra e não
 * consegue navegar — foi o que manteve a suíte vermelha.
 */
function editionRole(
  roleAssignmentId: string,
  role: 'EDITION_ADMIN' | 'DISCIPLINE_MANAGER',
  disciplineName: string | null = null,
) {
  return {
    roleAssignmentId,
    editionId: EDITION.id,
    editionName: EDITION.name,
    editionDisciplineId: disciplineName ? `${EDITION.id}-${disciplineName.toLowerCase()}` : null,
    disciplineId: disciplineName ? disciplineName.toLowerCase() : null,
    disciplineName,
    role,
  };
}

const users = [
  {
    id: 'staff-ana', email: 'ana@ufpe.br', password: 'intereng2026', name: 'Ana Coordenadora',
    role: 'EDITION_ADMIN' as const, editionRoles: [editionRole('papel-ana', 'EDITION_ADMIN')],
    mustChangePassword: false,
  },
  {
    id: 'staff-super', email: 'super@intereng.com', password: 'super2026', name: 'Super Admin',
    role: 'SUPER_ADMIN' as const, editionRoles: [],
    mustChangePassword: false,
  },
  {
    id: 'staff-bruno', email: 'bruno@ufpe.br', password: 'futsal2026', name: 'Bruno Martins',
    role: 'DISCIPLINE_MANAGER' as const, scope: 'Futsal',
    editionRoles: [editionRole('papel-bruno', 'DISCIPLINE_MANAGER', 'Futsal')],
    mustChangePassword: false,
  },
  // Recém-convidada: entrou com a senha comum a todos os convites e ainda não
  // escolheu a sua. É este o estado em que a API recusa tudo menos a troca.
  {
    id: 'staff-nova', email: 'nova@ufpe.br', password: 'intereng2026', name: 'Nova Convidada',
    role: 'EDITION_ADMIN' as const, editionRoles: [editionRole('papel-nova', 'EDITION_ADMIN')],
    mustChangePassword: true,
  },
];

/** O usuário no formato de `AuthUserResponse` — sem a senha, evidentemente. */
function sessionUser(user: (typeof users)[number]) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    scope: 'scope' in user ? user.scope : undefined,
    editionRoles: user.editionRoles,
    mustChangePassword: user.mustChangePassword,
  };
}

/** Credenciais originais: a troca de senha muda o usuário em memória. */
const initialCredentials = users.map((user) => ({
  email: user.email,
  password: user.password,
  mustChangePassword: user.mustChangePassword,
}));

function restoreUsers() {
  for (const original of initialCredentials) {
    const user = users.find((item) => item.email === original.email);
    if (!user) continue;
    user.password = original.password;
    user.mustChangePassword = original.mustChangePassword;
  }
}

let snapshot: FrontendState = seededFrontendState;
const sessions = new Map<string, { email: string; name: string }>();

/** O payload do espectador: sem staff, sem auditoria, sem rascunho. */
function publicSnapshot(state: FrontendState) {
  const tournaments = Object.fromEntries(Object.entries(state.tournaments).filter(([, item]) => !privateTournamentStatuses.includes(item.status)));
  const matches = Object.fromEntries(Object.entries(state.matches).filter(([, item]) => !item.tournamentId || tournaments[item.tournamentId]));
  return { ...state, tournaments, matches, staff: {}, audit: [] };
}

/**
 * O app roda numa porta e este mock em outra, então toda chamada é cross-origin.
 * Como o cliente HTTP envia `withCredentials`, o navegador recusa a resposta se
 * a origem vier como `*` — ela precisa ser ecoada, junto de `Allow-Credentials`.
 * Sem isso a requisição nem chega aqui e a tela mostra "Não foi possível acessar
 * o servidor", que foi o que derrubou a suíte inteira.
 */
function corsHeaders(origin: string | undefined) {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, Idempotency-Key, X-Edition-Role, X-Edition-Discipline-Id, X-Operator-Id',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    Vary: 'Origin',
  };
}

/**
 * Toda resposta da API real vem envelopada: `{ data }` no sucesso e
 * `{ error: { message } }` na falha — é isso que o cliente HTTP desembrulha.
 * O mock devolvia o corpo cru, então o cliente lia `undefined` e quebrava antes
 * de conseguir transformar a falha numa mensagem de tela.
 */
function envelope(status: number, body: unknown) {
  if (body === undefined) return undefined;
  if (status >= 400) {
    const message = (body as { message?: string }).message ?? 'Falha na requisição.';
    return { error: { code: status === 401 ? 'UNAUTHORIZED' : 'ERROR', message } };
  }
  return { data: body };
}

function send(
  response: ServerResponse,
  status: number,
  body?: unknown,
  origin?: string,
) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    ...corsHeaders(origin),
  });
  const payload = envelope(status, body);
  response.end(payload === undefined ? '' : JSON.stringify(payload));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

createServer(async (request, response) => {
  /** Responde ecoando a origem desta requisição, exigido por withCredentials. */
  const reply = (status: number, payload?: unknown) => send(response, status, payload, request.headers.origin);
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  const session = sessions.get((request.headers.authorization ?? '').replace('Bearer ', ''));

  if (request.method === 'OPTIONS') return reply(204);

  // Gancho de teste: cada cenário começa da mesma edição — e das mesmas
  // credenciais, já que a troca de senha altera o usuário em memória.
  if (url.pathname === '/test/reset') { snapshot = seededFrontendState; sessions.clear(); restoreUsers(); return reply(204); }

  if (url.pathname === '/auth/login' && request.method === 'POST') {
    const { email, password } = await readBody(request) as { email?: string; password?: string };
    const user = users.find((item) => item.email === email && item.password === password);
    if (!user) return reply(401, { message: 'E-mail ou senha inválidos.' });
    const token = `token-${user.email}`;
    sessions.set(token, { email: user.email, name: user.name });
    return reply(200, {
      token,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: sessionUser(user),
    });
  }

  /**
   * Renovação de sessão.
   *
   * Na API real o refresh viaja num cookie HttpOnly, que não atravessa a
   * fronteira de origem desta suíte (app e mock em portas diferentes, sobre
   * HTTP). Este mock declina sempre — e é justamente disso que o teste de
   * sessão expirada precisa: ao tomar 401 aqui, o cliente encerra o acesso e
   * devolve ao login com aviso, em vez de tratar como erro genérico.
   */
  if (url.pathname.endsWith('/auth/refresh')) {
    return reply(401, { message: 'Token de atualização não fornecido.' });
  }

  // O app consulta esta rota quando restaura uma sessão sem papéis em memória.
  if (url.pathname.endsWith('/auth/me')) {
    if (!session) return reply(401, { message: 'Sessão inválida.' });
    const user = users.find((item) => item.email === session.email);
    if (!user) return reply(401, { message: 'Sessão inválida.' });
    return reply(200, sessionUser(user));
  }

  if (url.pathname === '/auth/logout') { if (session) sessions.delete((request.headers.authorization ?? '').replace('Bearer ', '')); return reply(204); }

  if (url.pathname.endsWith('/auth/change-password') && request.method === 'POST') {
    if (!session) return reply(401, { message: 'Sessão inválida.' });
    const user = users.find((item) => item.email === session.email);
    if (!user) return reply(401, { message: 'Sessão inválida.' });
    const { currentPassword, newPassword } = await readBody(request) as { currentPassword?: string; newPassword?: string };
    if (currentPassword !== user.password) return reply(401, { message: 'A senha atual está incorreta.' });
    if (!newPassword || newPassword.length < 12) return reply(400, { message: 'newPassword deve ter ao menos 12 caracteres' });
    if (newPassword === currentPassword) return reply(400, { message: 'A nova senha deve ser diferente da atual.' });
    user.password = newPassword;
    user.mustChangePassword = false;
    // Como na API real: a troca revoga todas as sessões e emite outra.
    sessions.clear();
    const token = `token-${user.email}-${newPassword.length}`;
    sessions.set(token, { email: user.email, name: user.name });
    return reply(200, { token, expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: sessionUser(user) });
  }

  // Espelha a guarda da API: enquanto a senha inicial estiver de pé, nada além
  // das rotas de sessão responde. É o que faz o app cair na tela de troca em vez
  // de tentar carregar a edição.
  if (session && users.find((item) => item.email === session.email)?.mustChangePassword) {
    return reply(403, { message: 'É necessário trocar a senha inicial antes de usar o sistema.' });
  }

  if (url.pathname.endsWith('/public-snapshot')) return reply(200, publicSnapshot(snapshot));

  if (url.pathname.endsWith('/snapshot')) {
    if (!session) return reply(401, { message: 'Sessão inválida.' });
    return reply(200, snapshot);
  }

  if (url.pathname.endsWith('/actions') && request.method === 'POST') {
    if (!session) return reply(401, { message: 'Sessão inválida.' });
    const action = await readBody(request) as Action;
    // Autor e horário são do servidor, nunca do cliente.
    snapshot = applyAction(snapshot, action, { actor: session.name });
    return reply(200, snapshot);
  }

  return reply(404, { message: 'Rota inexistente.' });
}).listen(port, () => console.log(`mock-api ouvindo em ${port}`));
