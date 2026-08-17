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

  emitir(type: string) { for (const handler of this.ouvintes.get(type) ?? []) handler(new Event(type)); }
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
