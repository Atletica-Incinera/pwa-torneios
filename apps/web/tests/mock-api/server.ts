import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { seededFrontendState, type FrontendState } from '@atletica-incinera/intereng-contract/state';
import { applyAction, type Action } from '@atletica-incinera/intereng-contract/actions';
import { privateTournamentStatuses } from '@atletica-incinera/intereng-contract/rules';
import { demoUsers } from '@atletica-incinera/intereng-contract/seed';

/**
 * A API de mentira do contrato.
 *
 * Existe para provar que o modo `http` funciona de verdade: o app é compilado
 * com `NEXT_PUBLIC_DATA_SOURCE=http` e conversa com este servidor como
 * conversaria com o NestJS. Ela roda o mesmo reducer do cliente — que é
 * exatamente o que o backend fará — e devolve o snapshot como resposta.
 */
const port = Number(process.env.MOCK_API_PORT ?? 3201);

let snapshot: FrontendState = seededFrontendState;
const sessions = new Map<string, { email: string; name: string }>();
/** Credencial de renovação, que sobrevive ao vencimento do acesso. */
const refreshTokens = new Map<string, { email: string; name: string }>();
let renewals = 0;
/**
 * Operação que o despachante ainda não implementa.
 *
 * A API vai nascer com a união de ações incompleta, e o que ela responde para
 * o que falta é `501` com uma mensagem. Aqui isso é armado por cenário, porque
 * o mock implementa tudo — roda o mesmo redutor do cliente.
 */
let unimplemented: { type: string; message: string } | null = null;

/**
 * Tempo real do contrato.
 *
 * O canal é público e carrega só o número da revisão: quem tem sessão usa o
 * evento como gatilho e rebusca o snapshot privado com o token. O snapshot
 * público viaja junto para o espectador não pagar uma segunda viagem.
 */
const streamClients = new Set<ServerResponse>();
let revision = 0;

function frame(id: number, event: string, data: unknown) {
  return `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function broadcast() {
  revision += 1;
  const at = new Date().toISOString();
  for (const client of streamClients) {
    client.write(frame(revision, 'edition-changed', { revision, at }));
    client.write(frame(revision, 'edition-snapshot', publicSnapshot(snapshot)));
  }
}

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
  if (url.pathname === '/test/reset') { snapshot = seededFrontendState; sessions.clear(); refreshTokens.clear(); unimplemented = null; revision = 0; return send(response, 204); }

  // Vence o acesso sem derrubar a renovação: é o que o app precisa atravessar
  // sozinho, sem devolver ao login.
  if (url.pathname === '/test/expire-access') { sessions.clear(); return send(response, 204); }

  // Arma o `501` de uma ação: `{ type, message }` liga, corpo vazio desliga.
  if (url.pathname === '/test/unimplemented-action') {
    const { type, message } = await readBody(request) as { type?: string; message?: string };
    unimplemented = type ? { type, message: message ?? 'Operação ainda não implementada nesta API.' } : null;
    return send(response, 204);
  }

  if (url.pathname.endsWith('/stream')) {
    // Falha proposital: é o que mantém de pé o cenário "sem tempo real, a barra avisa".
    if (url.searchParams.get('fail') === '1') return send(response, 500, { message: 'Tempo real indisponível.' });
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': '*' });
    response.write('retry: 1000\n\n');
    const seen = Number(request.headers['last-event-id'] ?? url.searchParams.get('lastEventId') ?? 0);
    // Quem volta atrasado recebe a revisão atual de uma vez: o snapshot é a
    // verdade, então não há diff para reproduzir evento a evento.
    if (seen < revision) response.write(frame(revision, 'edition-changed', { revision, at: new Date().toISOString() }));
    streamClients.add(response);
    const ping = setInterval(() => response.write(': ping\n\n'), 2_000);
    request.on('close', () => { clearInterval(ping); streamClients.delete(response); });
    return;
  }

  if (url.pathname === '/auth/login' && request.method === 'POST') {
    const { email, password } = await readBody(request) as { email?: string; password?: string };
    const user = demoUsers.find((item) => item.email === email && item.password === password);
    if (!user) return send(response, 401, { message: 'E-mail ou senha inválidos.' });
    const token = `token-${user.email}`;
    const refreshToken = `refresh-${user.email}`;
    sessions.set(token, { email: user.email, name: user.name });
    refreshTokens.set(refreshToken, { email: user.email, name: user.name });
    return send(response, 200, { token, refreshToken, expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: { email: user.email, name: user.name, role: user.role, scope: user.scope } });
  }

  if (url.pathname === '/auth/refresh' && request.method === 'POST') {
    const { refreshToken } = await readBody(request) as { refreshToken?: string };
    const owner = refreshTokens.get(refreshToken ?? '');
    if (!owner) return send(response, 401, { message: 'Renovação inválida.' });
    // Acesso novo, renovação preservada. O papel o cliente já tem guardado.
    renewals += 1;
    const token = `token-${owner.email}-${renewals}`;
    sessions.set(token, owner);
    return send(response, 200, { token, refreshToken, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
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
    // O que a API ainda não sabe fazer não é falha de rede nem dado inválido:
    // a mensagem do `501` é o que faz o operador parar de tentar.
    if (unimplemented && action.type === unimplemented.type) return send(response, 501, { message: unimplemented.message });
    // Autor e horário são do servidor, nunca do cliente.
    snapshot = applyAction(snapshot, action, { actor: session.name });
    broadcast();
    return send(response, 200, snapshot);
  }

  return send(response, 404, { message: 'Rota inexistente.' });
}).listen(port, () => console.log(`mock-api ouvindo em ${port}`));
