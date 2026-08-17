import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRealtimeChannel } from '../../app/lib/repositories/realtime-channel';
import { createPollingChannel } from '../../app/lib/repositories/polling-channel';
import type { FrontendState } from '@atletica-incinera/intereng-contract/state';
import { createMockFetch } from '../mock-api/api';

/**
 * `EventSource` de mentira: registra as aberturas e deixa quem testa emitir os
 * eventos na mão. `readyState` fica em `CLOSED` porque é o estado em que o
 * navegador desiste — é aí que a reconexão passa a ser responsabilidade nossa.
 */
class FonteFalsa {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static abertas: FonteFalsa[] = [];
  readyState = FonteFalsa.CLOSED;
  fechada = false;
  private ouvintes = new Map<string, Array<(event: Event) => void>>();

  constructor(readonly url: string) { FonteFalsa.abertas.push(this); }

  addEventListener(type: string, handler: (event: Event) => void) {
    this.ouvintes.set(type, [...(this.ouvintes.get(type) ?? []), handler]);
  }

  close() { this.fechada = true; }

  /**
   * Sem `data` o evento é só sinal (`open`, `error`); com `data` ele é um
   * quadro de verdade, e precisa ser `MessageEvent` para o canal conseguir ler
   * o corpo e o `lastEventId`.
   */
  emitir(type: string, data?: string) {
    const event = data === undefined ? new Event(type) : new MessageEvent(type, { data, lastEventId: 'evento-1' });
    for (const handler of this.ouvintes.get(type) ?? []) handler(event);
  }
}

/** O menor corpo que ainda é uma edição: uma competição e uma edição. */
const quadroValido = {
  competitions: [{ id: 'c1', name: 'InterEng', slug: 'intereng', active: true }],
  editions: [{ id: 'e1', name: '2026', year: 2026, start: '2026-10-12', end: '2026-10-19', status: 'ONGOING', active: true, competitionId: 'c1' }],
  teams: { 't1': { name: 'Alcateia' } },
};

/** Assina como espectador — é quem recebe estado pelo evento de snapshot. */
function assinarComoEspectador() {
  const recebidos: FrontendState[] = [];
  const conexoes: string[] = [];
  const desligar = createRealtimeChannel({ eventSourceImpl, getToken: () => null })(
    (estado) => recebidos.push(estado),
    (conexao) => conexoes.push(conexao),
  );
  return { recebidos, conexoes, desligar, fonte: FonteFalsa.abertas.at(-1)! };
}

const eventSourceImpl = FonteFalsa as unknown as typeof EventSource;

function definirRede(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: online });
}

function definirAbaEscondida(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
}

afterEach(() => {
  FonteFalsa.abertas = [];
  vi.useRealTimers();
  definirRede(true);
  definirAbaEscondida(false);
});

describe('canal de tempo real por stream', () => {
  it('evento que chega depois do desligamento não fala mais com a tela', () => {
    const conexoes: string[] = [];
    const desligar = createRealtimeChannel({ eventSourceImpl, getToken: () => null })(() => {}, (estado) => conexoes.push(estado));
    const fonte = FonteFalsa.abertas.at(-1)!;

    desligar();
    fonte.emitir('error');

    expect(conexoes).toEqual([]);
  });

  it('sem rede a reconexão espera a volta dela em vez de queimar tentativa no relógio', () => {
    vi.useFakeTimers();
    definirRede(false);
    const desligar = createRealtimeChannel({ eventSourceImpl, getToken: () => null })(() => {}, () => {});
    FonteFalsa.abertas.at(-1)!.emitir('error');

    // Dois minutos de rede fora não podem virar duas dezenas de tentativas.
    vi.advanceTimersByTime(120_000);
    expect(FonteFalsa.abertas).toHaveLength(1);

    definirRede(true);
    window.dispatchEvent(new Event('online'));
    expect(FonteFalsa.abertas).toHaveLength(2);

    // E a espera acumulada zerou com a rede: a próxima falha volta ao primeiro
    // degrau do backoff, não ao teto de 30 s.
    FonteFalsa.abertas.at(-1)!.emitir('error');
    vi.advanceTimersByTime(1_500);
    expect(FonteFalsa.abertas).toHaveLength(3);

    desligar();
  });

  it('quadro de JSON válido e forma errada não vira o estado do app', () => {
    const { recebidos, conexoes, desligar, fonte } = assinarComoEspectador();

    // Corpo embrulhado, página de erro de proxy, quadro de outro assunto: todos
    // saem daqui com JSON válido, e nenhum é o estado de uma edição.
    fonte.emitir('edition-snapshot', JSON.stringify({ data: quadroValido }));
    fonte.emitir('edition-snapshot', JSON.stringify({ mensagem: 'servico indisponivel' }));
    fonte.emitir('edition-snapshot', JSON.stringify([]));

    expect(recebidos).toEqual([]);
    // Recusar em silêncio deixaria o espectador com a tela velha e a barra
    // dizendo "ao vivo" — a falha silenciosa que a recusa existe para evitar.
    expect(conexoes).toEqual(['offline', 'offline', 'offline']);
    desligar();
  });

  it('quadro com competição e edição, mas coleção no contêiner errado, é recusado', () => {
    const { recebidos, desligar, fonte } = assinarComoEspectador();

    // A checagem antiga era "tem algum campo do estado", e este corpo tem
    // todos: passaria por ela e chegaria às telas com `Object.entries(teams)`
    // devolvendo índice numérico como id de equipe.
    fonte.emitir('edition-snapshot', JSON.stringify({ ...quadroValido, teams: [], audit: {} }));

    expect(recebidos).toEqual([]);
    desligar();
  });

  it('quadro que é a edição é absorvido, com o que faltava completado', () => {
    const { recebidos, conexoes, desligar, fonte } = assinarComoEspectador();

    fonte.emitir('edition-snapshot', JSON.stringify(quadroValido));

    expect(recebidos).toHaveLength(1);
    expect(conexoes).toEqual(['online']);
    expect(recebidos[0].teams).toEqual({ 't1': { name: 'Alcateia' } });
    // Coleção omitida vira vazia, e não `undefined`, que é o que quebraria as
    // telas que iteram sem checar.
    expect(recebidos[0].matches).toEqual({});
    expect(recebidos[0].audit).toEqual([]);
    // E o que faltava não veio do exemplo do contrato: completar `editions`
    // com ele publicaria três edições fictícias como se fossem do servidor.
    expect(recebidos[0].editions.map((edicao) => edicao.id)).toEqual(['e1']);
    desligar();
  });

  it('a volta da rede depois do desligamento não reabre o stream', () => {
    vi.useFakeTimers();
    definirRede(false);
    const desligar = createRealtimeChannel({ eventSourceImpl, getToken: () => null })(() => {}, () => {});
    FonteFalsa.abertas.at(-1)!.emitir('error');

    desligar();
    definirRede(true);
    window.dispatchEvent(new Event('online'));

    expect(FonteFalsa.abertas).toHaveLength(1);
  });
});

describe('canal de tempo real por polling', () => {
  /**
   * Um ciclo do canal virou muitas requisições: a API não tem snapshot, e cada
   * releitura remonta a edição das rotas granulares. O que conta um ciclo é a
   * primeira rota da remontagem, e não o total de chamadas.
   */
  function contandoCiclos() {
    const { fetchImpl } = createMockFetch();
    const ciclos: string[] = [];
    const contando: typeof fetch = async (input, init) => {
      if (String(input).includes('/competitions?')) ciclos.push(String(input));
      return fetchImpl(input, init);
    };
    return { ciclos, fetchImpl: contando };
  }

  /** A remontagem tem ondas encadeadas: uma volta de relógio não as esgota. */
  async function assentar() {
    for (let volta = 0; volta < 30; volta += 1) await vi.advanceTimersByTimeAsync(0);
  }

  it('a volta para a aba busca na hora, sem esperar o ciclo inteiro', async () => {
    vi.useFakeTimers();
    definirAbaEscondida(true);
    const { ciclos, fetchImpl } = contandoCiclos();
    const recebidos: FrontendState[] = [];
    const desligar = createPollingChannel({ fetchImpl, getToken: () => null })((snapshot) => { recebidos.push(snapshot); }, () => {});

    await vi.advanceTimersByTimeAsync(5_000);
    expect(ciclos).toHaveLength(0);

    definirAbaEscondida(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await assentar();

    expect(ciclos).toHaveLength(1);
    // Contar requisição não prova entrega: com uma remontagem que falha, o
    // canal engole o erro e o teste seguiria verde sem nunca chamar quem
    // espera o estado.
    expect(recebidos).toHaveLength(1);
    expect(Object.keys(recebidos[0].tournaments).length).toBeGreaterThan(0);
    desligar();
  });

  it('trocar de aba sem perder ciclo nenhum não vira requisição extra', async () => {
    vi.useFakeTimers();
    const { ciclos, fetchImpl } = contandoCiclos();
    const desligar = createPollingChannel({ fetchImpl, getToken: () => null })(() => {}, () => {});

    await vi.advanceTimersByTimeAsync(5_000);
    await assentar();
    expect(ciclos).toHaveLength(1);

    document.dispatchEvent(new Event('visibilitychange'));
    await assentar();

    expect(ciclos).toHaveLength(1);
    desligar();
  });
});
