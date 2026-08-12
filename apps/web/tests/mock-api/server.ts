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
const users = [
  { email: 'ana@ufpe.br', password: 'intereng2026', name: 'Ana Coordenadora', role: 'EDITION_ADMIN' as const },
  { email: 'super@intereng.com', password: 'super2026', name: 'Super Admin', role: 'SUPER_ADMIN' as const },
  { email: 'bruno@ufpe.br', password: 'futsal2026', name: 'Bruno Martins', role: 'DISCIPLINE_MANAGER' as const, scope: 'Futsal' },
];

let snapshot: FrontendState = seededFrontendState;
const sessions = new Map<string, { email: string; name: string }>();

/** O payload do espectador: sem staff, sem auditoria, sem rascunho. */
function publicSnapshot(state: FrontendState) {
  const tournaments = Object.fromEntries(Object.entries(state.tournaments).filter(([, item]) => !privateTournamentStatuses.includes(item.status)));
  const matches = Object.fromEntries(Object.entries(state.matches).filter(([, item]) => !item.tournamentId || tournaments[item.tournamentId]));
  return { ...state, tournaments, matches, staff: {}, audit: [] };
}

function send(response: ServerResponse, status: number, body?: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  response.end(body === undefined ? '' : JSON.stringify(body));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  const session = sessions.get((request.headers.authorization ?? '').replace('Bearer ', ''));

  if (request.method === 'OPTIONS') return send(response, 204);

  // Gancho de teste: cada cenário começa da mesma edição.
  if (url.pathname === '/test/reset') { snapshot = seededFrontendState; sessions.clear(); return send(response, 204); }

  if (url.pathname === '/auth/login' && request.method === 'POST') {
    const { email, password } = await readBody(request) as { email?: string; password?: string };
    const user = users.find((item) => item.email === email && item.password === password);
    if (!user) return send(response, 401, { message: 'E-mail ou senha inválidos.' });
    const token = `token-${user.email}`;
    sessions.set(token, { email: user.email, name: user.name });
    return send(response, 200, { token, expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: { email: user.email, name: user.name, role: user.role, scope: 'scope' in user ? user.scope : undefined } });
  }

  if (url.pathname === '/auth/logout') { if (session) sessions.delete((request.headers.authorization ?? '').replace('Bearer ', '')); return send(response, 204); }

  if (url.pathname.endsWith('/public-snapshot')) return send(response, 200, publicSnapshot(snapshot));

  if (url.pathname.endsWith('/snapshot')) {
    if (!session) return send(response, 401, { message: 'Sessão inválida.' });
    return send(response, 200, snapshot);
  }

  if (url.pathname.endsWith('/actions') && request.method === 'POST') {
    if (!session) return send(response, 401, { message: 'Sessão inválida.' });
    const action = await readBody(request) as Action;
    // Autor e horário são do servidor, nunca do cliente.
    snapshot = applyAction(snapshot, action, { actor: session.name });
    return send(response, 200, snapshot);
  }

  return send(response, 404, { message: 'Rota inexistente.' });
}).listen(port, () => console.log(`mock-api ouvindo em ${port}`));
