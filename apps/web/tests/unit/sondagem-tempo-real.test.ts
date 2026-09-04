import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createHttpStateAdapter,
  type HttpAdapterOptions,
} from '../../app/lib/repositories/http-adapter.ts';
import type { EditionRevision } from '../../app/lib/repositories/http-adapter.ts';

/**
 * O tempo real do app é por SSE, e SSE atravessa proxy mal: basta uma camada
 * com buffer ligado para a conexão abrir, ficar de pé e nunca entregar um
 * byte. Foi exatamente o que se mediu em produção — vinte e cinco segundos sem
 * nenhum evento, com o servidor mandando um batimento a cada vinte.
 *
 * Sem rede de segurança, só quem opera vê o que mudou: cada ação devolve o
 * estado novo a quem a fez. O telão e o segundo aparelho ficam congelados até
 * alguém recarregar a página — no meio de um torneio, é o telão parado no
 * placar de meia hora atrás.
 *
 * A sondagem é o plano B. Estes testes travam as duas metades disso: ela
 * acontece quando o stream é mudo, e ela SAI DE CENA quando o stream funciona.
 */
function adaptador(opcoes: { conectar?: HttpAdapterOptions['connect']; intervalo: number }) {
  let buscas = 0;
  const respostaVazia = {
    data: {
      teams: {},
      athletes: {},
      disciplines: {},
      tournaments: {},
      matches: {},
      staff: {},
      audit: [],
    },
  };
  const adapter = createHttpStateAdapter({
    edition: 'ed-1',
    getToken: () => 'token',
    pollingIntervalMilliseconds: opcoes.intervalo,
    connect: opcoes.conectar,
    // Conta cada ida ao servidor: é isso que a sondagem provoca.
    adapter: (async (config: { url?: string }) => {
      if ((config.url ?? '').includes('/snapshot')) buscas += 1;
      return { data: respostaVazia.data, status: 200, statusText: 'OK', headers: {}, config };
    }) as never,
  });
  return { adapter, buscas: () => buscas };
}

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('stream mudo: o app busca o estado sozinho, em vez de congelar', async () => {
  // Um `connect` que assina e nunca entrega nada — o proxy com buffer.
  const { adapter, buscas } = adaptador({ intervalo: 40, conectar: () => () => undefined });
  const encerrar = adapter.subscribe(
    () => undefined,
    () => undefined,
  );

  await espera(180);
  encerrar();
  // Sem a sondagem este número seria zero e a tela ficaria parada.
  assert.ok(buscas() >= 2, `esperava buscas repetidas, houve ${buscas()}`);
});

test('stream funcionando: a sondagem sai de cena', async () => {
  // O stream entrega uma revisão logo no início. A partir daí o app não deve
  // ficar batendo no servidor: quem manda é o evento.
  const { adapter, buscas } = adaptador({
    intervalo: 40,
    conectar: (_edicao: string, onRevisao: (evento: EditionRevision) => void) => {
      setTimeout(() => onRevisao({ editionId: 'ed-1', revision: 1 }), 10);
      return () => undefined;
    },
  });
  const encerrar = adapter.subscribe(
    () => undefined,
    () => undefined,
  );

  await espera(60);
  const depoisDoEvento = buscas();
  await espera(160);
  encerrar();

  // Quatro intervalos se passaram sem nenhuma busca nova.
  assert.equal(buscas(), depoisDoEvento, 'a sondagem continuou mesmo com o stream vivo');
});

test('encerrar a assinatura para a sondagem', async () => {
  const { adapter, buscas } = adaptador({ intervalo: 30, conectar: () => () => undefined });
  const encerrar = adapter.subscribe(
    () => undefined,
    () => undefined,
  );
  await espera(100);
  encerrar();
  const aoEncerrar = buscas();
  await espera(120);

  assert.equal(buscas(), aoEncerrar, 'a sondagem sobreviveu ao encerramento');
});
