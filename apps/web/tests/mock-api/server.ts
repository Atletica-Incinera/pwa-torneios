import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createMockApi } from './api.ts';

/**
 * A API de mentira, no fio.
 *
 * O que ela responde mora em `api.ts` — o mesmo roteador que os testes de
 * componente embrulham num `fetch`. Aqui só existe o que é de servidor: porta,
 * CORS, leitura do corpo e o `text/event-stream`, que não cabe numa resposta
 * de uma vez só.
 *
 * O app é compilado com `NEXT_PUBLIC_DATA_SOURCE=http` e conversa com este
 * servidor como conversaria com o NestJS: mesmo prefixo, mesmo envelope, mesmo
 * formato de erro.
 */
const port = Number(process.env.MOCK_API_PORT ?? 3201);
const api = createMockApi();

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>; } catch { return {}; }
}

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Last-Event-ID',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  };
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  // O prefixo é do endereço base, não das rotas: o alvo real é
  // `http://host/api/v1`, e o mock aceita com ou sem ele.
  const path = url.pathname.replace(/^\/api(\/v1)?/, '') || '/';

  if (request.method === 'OPTIONS') { response.writeHead(204, cors()); return response.end(); }

  /**
   * Tempo real por partida, como a API o oferece.
   *
   * Rota aberta, evento chamado literalmente `match-event`, `id` do fluxo do
   * Redis (que **não** é a `sequence` do evento) e batida de 25 s sem linha
   * `event:` — ela chega no ouvinte padrão. Não existe stream por edição: o que
   * o front tinha era um canal de revisão da edição, e a API não tem nada
   * parecido.
   */
  if (/^\/matches\/[^/]+\/stream$/.test(path)) {
    const matchId = path.split('/')[2];
    response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', ...cors() });
    response.write('retry: 1000\n\n');
    const listener = { matchId, send: (frame: string) => response.write(frame) };
    api.listeners.add(listener);
    const heartbeat = setInterval(() => response.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`), 25_000);
    request.on('close', () => { clearInterval(heartbeat); api.listeners.delete(listener); });
    return;
  }

  const result = api.handle({
    method: (request.method ?? 'GET').toUpperCase(),
    path,
    query: url.searchParams,
    body: await readBody(request),
    token: (request.headers.authorization ?? '').startsWith('Bearer ') ? (request.headers.authorization ?? '').slice(7) : null,
  });

  if (result.status === 204) { response.writeHead(204, cors()); return response.end(); }
  response.writeHead(result.status, { 'Content-Type': 'application/json', ...cors() });
  response.end(JSON.stringify(result.body));
}).listen(port, () => console.log(`mock-api ouvindo em ${port}`));
