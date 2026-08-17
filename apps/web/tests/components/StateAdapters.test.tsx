import { beforeEach, describe, expect, it } from 'vitest';
import type { Action } from '@atletica-incinera/intereng-contract/actions';
import { storageKey } from '../../app/lib/browser-state';
import { createLocalStateAdapter } from '../../app/lib/repositories/local-adapter';
import { createHttpStateAdapter } from '../../app/lib/repositories/http-adapter';
import { createMockFetch } from '../mock-api/api';

/**
 * O adaptador HTTP contra a API de mentira — a mesma que os e2e sobem.
 *
 * Não há mais como comparar estado com o adaptador local: o local roda o
 * reducer do contrato e a API é REST granular, sem despachante de ações e sem
 * snapshot. O que precisa ser provado mudou de lugar — não é mais "os dois
 * chegam ao mesmo estado", é "a remontagem monta a edição inteira, e a falha
 * de uma rota derruba a carga em vez de entregar meia edição".
 */

async function comSessao(email = 'ana@ufpe.br', password = 'intereng2026') {
  const { api, fetchImpl } = createMockFetch();
  const resposta = await fetchImpl('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const { data } = await resposta.json() as { data: { accessToken: string } };
  return { api, fetchImpl, token: data.accessToken };
}

function adaptador(fetchImpl: typeof fetch, token: string | null) {
  return createHttpStateAdapter({ fetchImpl, getToken: () => token });
}

/**
 * Segura o efeito do recálculo por N leituras da classificação, que é como a
 * corrida acontece na API: o recálculo roda fora da requisição que o disparou.
 */
async function atrasarClassificacao(fetchImpl: typeof fetch, reads: number) {
  await fetchImpl('/api/v1/test/standings-lag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reads }) });
}

describe('carga da edição pelas rotas granulares', () => {
  beforeEach(() => { window.localStorage.clear(); });

  it('remonta a edição inteira do que as rotas devolvem', async () => {
    const { fetchImpl, token } = await comSessao();

    const state = await adaptador(fetchImpl, token).load();

    expect(state.editions.find((edition) => edition.active)?.id).toBe('intereng-2026');
    expect(Object.values(state.teams).map((team) => team.name)).toContain('Alcateia');
    expect(Object.keys(state.disciplines)).toContain('Futsal');
    expect(Object.values(state.tournaments).map((item) => item.name)).toContain('Futsal Masculino');
    expect(Object.values(state.matches).map((match) => match.entryA)).toContain('Alcateia');
    // O elenco vem das inscrições da edição, não de uma lista de atletas solta.
    expect(Object.values(state.athletes).find((athlete) => athlete.name === 'Ana Lima')?.modalities).toContain('Futsal');
    // Nada do estado é gravado no navegador: a verdade é do servidor.
    expect(window.localStorage.getItem(storageKey)).toBeNull();
  });

  it('uma rota que falha derruba a carga inteira, em vez de entregar meia edição', async () => {
    const { fetchImpl, token } = await comSessao();
    const comFalha: typeof fetch = async (input, init) => {
      if (String(input).includes('/tournaments')) return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno no servidor.' } }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      return fetchImpl(input, init);
    };

    // Uma edição sem categorias porque ninguém cadastrou e uma edição sem
    // categorias porque a rota caiu são idênticas na tela — e a segunda faz o
    // operador cadastrar tudo de novo.
    await expect(adaptador(comFalha, token).load()).rejects.toThrow(/erro interno/i);
  });

  it('o que o servidor nega por papel não derruba a carga: só falta na tela', async () => {
    // Gestor de modalidade não pode ler o staff da edição — 403 é a resposta
    // certa, e a tela dele simplesmente não tem essa parte.
    const { fetchImpl, token } = await comSessao('bruno@ufpe.br', 'futsal2026');

    const state = await adaptador(fetchImpl, token).load();

    expect(state.staff).toEqual({});
    expect(Object.keys(state.tournaments).length).toBeGreaterThan(0);
  });

  it('sem sessão a carga é a do espectador, com o que as rotas abertas devolvem', async () => {
    const { fetchImpl } = createMockFetch();

    const state = await adaptador(fetchImpl, null).load();

    expect(state.staff).toEqual({});
    // O catálogo global exige sessão, mas o nome da equipe viaja no elenco e
    // nas inscrições: a tela pública continua com equipe nomeada.
    expect(Object.values(state.teams).map((team) => team.name)).toContain('Alcateia');
    expect(Object.keys(state.tournaments).length).toBeGreaterThan(0);
  });

  it('sessão recusada com token na mão não vira visão de espectador', async () => {
    const { fetchImpl } = createMockFetch();

    // Engolir o 401 aqui devolveria ao operador uma edição sem staff e sem
    // catálogo, sem nenhum aviso: ele acharia que perdeu os dados.
    await expect(adaptador(fetchImpl, 'token-que-ninguem-emitiu').load()).rejects.toThrow();
  });
});

describe('operações que viram chamadas REST', () => {
  it('cadastrar equipe vai ao catálogo global e o registro volta na releitura', async () => {
    const { fetchImpl, token } = await comSessao();
    const action: Action = { type: 'team/create', payload: { id: 'aurora-http', team: { name: 'Aurora HTTP', initials: 'AUR', created: true } }, audit: { action: 'Equipe cadastrada', entity: 'Aurora HTTP' } };

    const state = await adaptador(fetchImpl, token).apply(action);

    const criada = Object.entries(state.teams).find(([, team]) => team.name === 'Aurora HTTP');
    expect(criada).toBeTruthy();
    // O id é do servidor: o que o cliente escolheu não sobrevive ao cadastro.
    expect(criada?.[0]).not.toBe('aurora-http');
  });

  it('remarcar partida manda o instante, e o horário volta como foi digitado', async () => {
    const { fetchImpl, token } = await comSessao();
    const adapter = adaptador(fetchImpl, token);
    await adapter.load();

    const state = await adapter.apply({ type: 'match/update', payload: { id: 'semifinal-1', patch: { date: '2026-10-15', time: '19:45', venue: 'Ginásio 2' } } });

    expect(state.matches['semifinal-1'].date).toBe('2026-10-15');
    expect(state.matches['semifinal-1'].time).toBe('19:45');
    expect(state.matches['semifinal-1'].venue).toBe('Ginásio 2');
  });

  it('mudar só o horário preserva o dia que já estava marcado', async () => {
    const { fetchImpl, token } = await comSessao();
    const adapter = adaptador(fetchImpl, token);
    const antes = await adapter.load();

    const state = await adapter.apply({ type: 'match/update', payload: { id: 'semifinal-1', patch: { time: '21:15' } } });

    expect(state.matches['semifinal-1'].date).toBe(antes.matches['semifinal-1'].date);
    expect(state.matches['semifinal-1'].time).toBe('21:15');
  });

  it('encerrar a partida é transição de estado, e é ela que carimba o vencedor', async () => {
    const { fetchImpl, token } = await comSessao();
    const adapter = adaptador(fetchImpl, token);
    await adapter.load();

    const state = await adapter.apply({ type: 'match/update', payload: { id: 'semifinal-1', patch: { status: 'Encerrada' } } });

    expect(state.matches['semifinal-1'].status).toBe('Encerrada');
  });

  it('recusa mexer no placar pela partida, dizendo de onde ele vem', async () => {
    const { fetchImpl, token } = await comSessao();
    const adapter = adaptador(fetchImpl, token);
    await adapter.load();

    // `PATCH /matches/:id` não tem placar no DTO, e com `forbidNonWhitelisted`
    // mandá-lo devolveria um 400 de validação que não diz o que foi feito.
    await expect(adapter.apply({ type: 'match/update', payload: { id: 'semifinal-1', patch: { scoreA: 3 } } })).rejects.toThrow(/placar/i);
  });

  it('ativar edição é pô-la em andamento no servidor', async () => {
    const { fetchImpl, token } = await comSessao();
    const adapter = adaptador(fetchImpl, token);
    await adapter.load();
    await adapter.apply({ type: 'edition/update', payload: { id: 'intereng-2026', patch: { status: 'PLANNING' } } });

    const state = await adapter.apply({ type: 'edition/activate', payload: { id: 'intereng-2026' } });

    expect(state.editions.find((edition) => edition.id === 'intereng-2026')?.status).toBe('ONGOING');
    expect(state.editions.find((edition) => edition.active)?.id).toBe('intereng-2026');
  });

  it('ativar edição onde o operador não tem papel é recusado pelo servidor', async () => {
    // A guarda de navegação do front não decide isto: quem decide é o papel
    // por edição, e a coordenadora de 2026 não administra 2025.
    const { fetchImpl, token } = await comSessao();
    const adapter = adaptador(fetchImpl, token);
    await adapter.load();

    await expect(adapter.apply({ type: 'edition/activate', payload: { id: 'intereng-2025' } })).rejects.toThrow(/forbidden/i);
  });

  it('renomear a edição não manda o ano junto, que a API recusaria inteiro', async () => {
    const { fetchImpl, token } = await comSessao();
    const adapter = adaptador(fetchImpl, token);
    await adapter.load();

    const state = await adapter.apply({ type: 'edition/update', payload: { id: 'intereng-2026', patch: { name: 'Edição de estreia' } } });

    expect(state.editions.find((edition) => edition.id === 'intereng-2026')?.name).toBe('Edição de estreia');
    await expect(adapter.apply({ type: 'edition/update', payload: { id: 'intereng-2026', patch: { year: 2027 } } })).rejects.toThrow(/ano da edição/i);
  });

  it('a ação de outro módulo falha dizendo de quem é a vez e onde encaixar', async () => {
    const { fetchImpl, token } = await comSessao();

    // Um `não implementado` genérico faria a próxima pessoa procurar o lugar
    // no escuro — e o operador repetir a mesma ação achando que é a rede.
    await expect(adaptador(fetchImpl, token).apply({ type: 'match/updateClock', payload: { id: 'semifinal-1', patch: { clockSeconds: 12 } } }))
      .rejects.toThrow(/operação de partida/i);
    await expect(adaptador(fetchImpl, token).apply({ type: 'ranking/close', payload: { closure: { editionId: 'intereng-2026', at: '2026-10-20T12:00:00.000Z', actor: 'Ana' } } }))
      .rejects.toThrow(/ranking geral/i);
  });
});

describe('classificação vinda do servidor', () => {
  it('a tabela do grupo chega pronta, com a ordem e a posição que o servidor gravou', async () => {
    const { fetchImpl, token } = await comSessao();

    const state = await adaptador(fetchImpl, token).load();

    const grupo = state.tournaments['volei-f'].standings?.['Grupo A'];
    expect(grupo?.map((row) => row.name)).toEqual(['Caótica', 'Energizada']);
    // Ninguém jogou ainda: as duas empatam em todos os critérios e o servidor
    // grava a mesma posição para as duas. O cálculo daqui numeraria 1 e 2 — é
    // a diferença que denuncia de onde a tabela veio.
    expect(grupo?.map((row) => row.rank)).toEqual([1, 1]);
  });

  it('encerrar a partida espera o recálculo antes de reler a classificação', async () => {
    const { fetchImpl, token } = await comSessao();
    const adapter = adaptador(fetchImpl, token);
    await adapter.load();
    await atrasarClassificacao(fetchImpl, 1);

    const state = await adapter.apply({ type: 'match/update', payload: { id: 'volei-grupo-a', patch: { status: 'Encerrada' } } });

    // Sem a espera, a releitura pega a tabela de antes: a partida encerrada na
    // tela e a classificação sem ela, sem nada dizendo qual está atrasada.
    expect(state.tournaments['volei-f'].standings?.['Grupo A']?.map((row) => row.played)).toEqual([1, 1]);
  });

  it('recálculo que não chega a tempo deixa valendo a tabela do servidor, não uma calculada aqui', async () => {
    const { fetchImpl, token } = await comSessao();
    const adapter = adaptador(fetchImpl, token);
    await adapter.load();
    await atrasarClassificacao(fetchImpl, 9);

    const state = await adapter.apply({ type: 'match/update', payload: { id: 'volei-grupo-a', patch: { status: 'Encerrada' } } });

    expect(state.matches['volei-grupo-a'].status).toBe('Encerrada');
    // Trocar a origem no meio faria a ordem mudar sozinha e voltar atrás no
    // ciclo seguinte — pior do que uma tabela com um jogo de atraso.
    expect(state.tournaments['volei-f'].standings?.['Grupo A']?.map((row) => row.played)).toEqual([0, 0]);
  });
});

describe('adaptador local', () => {
  beforeEach(() => { window.localStorage.clear(); });

  it('grava o resultado no navegador, ao contrário do HTTP', async () => {
    await createLocalStateAdapter().apply({ type: 'team/create', payload: { id: 'aurora', team: { name: 'Aurora', created: true } } });

    expect(JSON.parse(window.localStorage.getItem(storageKey) ?? '{}').teams?.aurora?.name).toBe('Aurora');
  });
});
