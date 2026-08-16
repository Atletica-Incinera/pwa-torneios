import { beforeEach, describe, expect, it } from 'vitest';
import { RenewalUnavailableError, apiRequest } from '../../app/lib/repositories/api-client';
import { UnauthorizedError, type FrontendSession } from '../../app/lib/repositories/auth-adapter';
import { clearStoredSession, readStoredSession, writeStoredSession } from '../../app/lib/repositories/session-storage';

/**
 * O cliente HTTP inteiro sem navegador, sem build e sem servidor: `fetchImpl` é
 * o ponto de injeção que o próprio `ApiRequest` já expõe.
 */
type Chamada = { url: string; bearer: string | null };

const velho = 'Bearer token-velho';
const novo = 'Bearer token-novo';

const sessaoEmVigor: FrontendSession = {
  email: 'ana@ufpe.br',
  name: 'Ana Coordenadora',
  role: 'EDITION_ADMIN',
  remembered: false,
  token: 'token-velho',
  refreshToken: 'renovacao-1',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

/**
 * Servidor de mentira que só entende duas coisas: renovar e responder com o
 * token novo. Quem testa decide o que a renovação devolve — é aí que mora a
 * diferença entre credencial recusada e transporte que não respondeu.
 */
function criarServidor(aoRenovar: () => Promise<Response>) {
  const chamadas: Chamada[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const bearer = (init?.headers as Record<string, string> | undefined)?.Authorization ?? null;
    const url = String(input);
    chamadas.push({ url, bearer });
    if (url.endsWith('/auth/refresh')) return aoRenovar();
    if (bearer !== novo) return new Response(null, { status: 401 });
    return Response.json({ data: { rota: url } });
  };
  const renovacoes = () => chamadas.filter((chamada) => chamada.url.endsWith('/auth/refresh')).length;
  return { chamadas, fetchImpl, renovacoes };
}

/** Uma resposta só: aqui o que importa é a forma do corpo, não a rota. */
function respondendo(body: unknown, init?: ResponseInit) {
  const fetchImpl: typeof fetch = async () => (body instanceof Response ? body : Response.json(body, init));
  return fetchImpl;
}

describe('envelope da resposta', () => {
  it('desembrulha o envelope da API e devolve o payload cru como está', async () => {
    const embrulhado = await apiRequest<{ nome: string }>({ path: '/teams', fetchImpl: respondendo({ data: { nome: 'Aurora' }, meta: { revision: 4 } }) });
    const cru = await apiRequest<{ nome: string }>({ path: '/teams', fetchImpl: respondendo({ nome: 'Aurora' }) });

    expect(embrulhado).toEqual({ nome: 'Aurora' });
    expect(cru).toEqual({ nome: 'Aurora' });
  });

  it('um corpo sem `data` na raiz passa inteiro, mesmo parecendo envelope', async () => {
    // `meta` sozinho não é envelope: sem `data` não há o que desembrulhar.
    const payload = await apiRequest<{ meta: unknown }>({ path: '/teams', fetchImpl: respondendo({ meta: { revision: 4 } }) });

    expect(payload).toEqual({ meta: { revision: 4 } });
  });

  it('recusa em voz alta o corpo com `data` e companhia que não é de envelope', async () => {
    // Passar adiante o que não dá para decidir termina numa tela pronta,
    // plausível e sem nada dentro — a pior falha, porque não parece falha.
    await expect(apiRequest({ path: '/teams', fetchImpl: respondendo({ data: { nome: 'Aurora' }, page: 1, total: 3 }) }))
      .rejects.toThrow(/não reconhece/i);
  });

  it('204 não tenta ler corpo nenhum', async () => {
    const vazio = await apiRequest({ path: '/teams/aurora', method: 'DELETE', fetchImpl: respondendo(new Response(null, { status: 204 })) });

    expect(vazio).toBeUndefined();
  });
});

describe('mensagem de erro do servidor', () => {
  async function mensagemDe(body: unknown, status = 400) {
    return apiRequest({ path: '/teams', fetchImpl: respondendo(body, { status }) }).then(
      () => 'não deveria ter passado',
      (caught: Error) => caught.message,
    );
  }

  it('lê o erro aninhado do contrato', async () => {
    expect(await mensagemDe({ error: { message: 'Equipe já cadastrada nesta edição.' } })).toBe('Equipe já cadastrada nesta edição.');
  });

  it('lê a mensagem única do Nest', async () => {
    expect(await mensagemDe({ message: 'Categoria não encontrada.' })).toBe('Categoria não encontrada.');
  });

  it('do array de validação mostra a primeira falha, não o array', async () => {
    // O operador precisa de uma frase para corrigir; `[object Object]` ou uma
    // lista serializada não diz qual campo está errado.
    expect(await mensagemDe({ message: ['nome deve ter ao menos 3 caracteres', 'sigla é obrigatória'] })).toBe('nome deve ter ao menos 3 caracteres');
  });

  it('corpo que não é JSON ainda rende uma frase com o status', async () => {
    expect(await mensagemDe(new Response('<html>502</html>', { status: 502 }))).toBe('Falha na requisição (502).');
  });
});

describe('renovação da sessão', () => {
  beforeEach(() => clearStoredSession());

  it('vários 401 concorrentes compartilham uma renovação e cada um repete a sua', async () => {
    writeStoredSession(sessaoEmVigor);
    const { chamadas, fetchImpl, renovacoes } = criarServidor(async () => {
      // A renovação demora um tique: é o que garante que os três 401 já estão
      // esperando quando ela responde, que é o caso que a trava existe para tratar.
      await new Promise((pronto) => setTimeout(pronto, 0));
      return Response.json({ accessToken: 'token-novo', expiresIn: 900 });
    });

    const respostas = await Promise.all(
      ['/teams', '/matches', '/athletes'].map((path) => apiRequest<{ rota: string }>({ path, token: 'token-velho', fetchImpl })),
    );

    expect(renovacoes()).toBe(1);
    expect(respostas.map((resposta) => resposta.rota)).toEqual(['/api/teams', '/api/matches', '/api/athletes']);
    // Cada rota foi chamada duas vezes: uma com o token vencido, outra com o novo.
    for (const path of ['/teams', '/matches', '/athletes']) {
      const daRota = chamadas.filter((chamada) => chamada.url.endsWith(path));
      expect(daRota.map((chamada) => chamada.bearer)).toEqual([velho, novo]);
    }
    expect(readStoredSession()?.token).toBe('token-novo');
  });

  it('a renovação que só devolve acesso preserva a credencial e o prazo', async () => {
    // Refresh não rotativo é o padrão mais comum, e o contrato permite omitir o
    // `refreshToken` na resposta. Perdê-lo aqui não quebra nada agora: quebra
    // no 401 seguinte, uns quinze minutos depois, quando não houver com o que
    // renovar e o operador for expulso no meio da partida.
    writeStoredSession(sessaoEmVigor);
    const { fetchImpl } = criarServidor(async () => Response.json({ accessToken: 'token-novo', expiresIn: 900 }));

    await apiRequest({ path: '/teams', token: 'token-velho', fetchImpl });

    const guardada = readStoredSession();
    expect(guardada?.token).toBe('token-novo');
    expect(guardada?.refreshToken).toBe('renovacao-1');
    // E o horizonte da sessão é do servidor: sem `expiresAt` na resposta, ele
    // seria reempurrado para doze horas a cada renovação, estendendo em
    // silêncio além do que foi autorizado.
    expect(guardada?.expiresAt).toBe(sessaoEmVigor.expiresAt);
  });

  it('401 na própria renovação encerra a sessão', async () => {
    writeStoredSession(sessaoEmVigor);
    const { fetchImpl, renovacoes } = criarServidor(async () => new Response(null, { status: 401 }));

    // O refresh token morreu: quem trata `UnauthorizedError` vence o acesso e
    // devolve ao login com aviso.
    await expect(apiRequest({ path: '/teams', token: 'token-velho', fetchImpl })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(renovacoes()).toBe(1);
  });

  it('falha de transporte na renovação não encerra a sessão', async () => {
    writeStoredSession(sessaoEmVigor);
    const { fetchImpl } = criarServidor(async () => { throw new TypeError('Failed to fetch'); });

    // Rede oscilando, ou a página sendo descarregada numa navegação, que aborta
    // as requisições em voo: expulsar aqui tirava do trabalho quem só clicou
    // num link. `RenewalUnavailableError` é justamente o que não é 401.
    const caught = await apiRequest({ path: '/teams', token: 'token-velho', fetchImpl }).catch((erro: unknown) => erro);

    expect(caught).toBeInstanceOf(RenewalUnavailableError);
    expect(caught).not.toBeInstanceOf(UnauthorizedError);
    expect(readStoredSession()?.token).toBe('token-velho');
  });

  it('a trava não fica presa depois de uma renovação que desiste antes do primeiro await', async () => {
    // Sessão sem credencial de renovação: `runRenewal` volta sem esperar nada.
    // Se a trava ficasse presa aí, nenhuma renovação voltaria a acontecer nesta
    // página e o próximo 401 devolveria ao login quem tinha sessão boa.
    const { refreshToken, ...semRenovacao } = sessaoEmVigor;
    expect(refreshToken).toBeTruthy();
    writeStoredSession(semRenovacao);
    const { fetchImpl, renovacoes } = criarServidor(async () => Response.json({ accessToken: 'token-novo', expiresIn: 900 }));

    await expect(apiRequest({ path: '/teams', token: 'token-velho', fetchImpl })).rejects.toBeInstanceOf(UnauthorizedError);
    expect(renovacoes()).toBe(0);

    // Agora existe credencial: a renovação seguinte precisa acontecer.
    writeStoredSession(sessaoEmVigor);
    const resposta = await apiRequest<{ rota: string }>({ path: '/teams', token: 'token-velho', fetchImpl });

    expect(resposta.rota).toBe('/api/teams');
    expect(renovacoes()).toBe(1);
  });

  it('as rotas de autenticação não renovam: 401 lá é credencial errada', async () => {
    writeStoredSession(sessaoEmVigor);
    const { fetchImpl, renovacoes } = criarServidor(async () => Response.json({ accessToken: 'token-novo', expiresIn: 900 }));

    await expect(apiRequest({ path: '/auth/login', method: 'POST', body: {}, retryOnUnauthorized: false, fetchImpl }))
      .rejects.toBeInstanceOf(UnauthorizedError);
    expect(renovacoes()).toBe(0);
  });
});
