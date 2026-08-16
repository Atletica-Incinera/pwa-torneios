import type { FrontendState } from '@atletica-incinera/intereng-contract/state';
import { apiRequest } from './api-client.ts';
import { readSessionToken } from './session-storage.ts';
import { normalizeSnapshot, type RealtimeConnect } from './http-adapter.ts';

/**
 * Tempo real pobre: relê o snapshot de tempos em tempos.
 *
 * Não é o transporte padrão — quem manda é o stream por edição, e este canal
 * entra quando `NEXT_PUBLIC_REALTIME=poll` escolhe a ponte, seja porque o
 * ambiente não tem o stream de pé, seja porque um proxy no caminho não deixa o
 * `EventSource` viver. O que ele garante é a tela não congelar em silêncio, que
 * era a promessa quebrada quando se decidiu que conexão é obrigatória.
 *
 * Em aba de segundo plano não gasta rede: quem não está olhando não precisa do
 * placar atualizado, e o navegador estrangula o timer de qualquer forma. Mas a
 * volta para a aba busca na hora, sem esperar o ciclo.
 */
export type ChannelOptions = {
  /** Edição a acompanhar. `active` deixa o servidor resolver qual é a vigente. */
  edition?: string;
  getToken?: () => string | null;
  fetchImpl?: typeof fetch;
};

const defaultIntervalMs = 5_000;

export function createPollingChannel(options: ChannelOptions = {}): RealtimeConnect {
  const edition = options.edition ?? 'active';
  const token = () => (options.getToken ?? readSessionToken)();
  // `??` não cobre a variável definida e vazia, que é o caso comum de um `.env`
  // escrito à mão — e `Number('')` é zero, o que viraria um laço de busca sem
  // pausa contra o servidor.
  const configured = Number(process.env.NEXT_PUBLIC_REALTIME_INTERVAL);
  const interval = Number.isFinite(configured) && configured > 0 ? configured : defaultIntervalMs;

  return (onSnapshot, onConnection) => {
    let stopped = false;
    let failures = 0;
    let timer: number | undefined;
    /** Um ciclo foi pulado por a aba estar escondida: a tela está atrasada. */
    let skipped = false;

    const schedule = () => {
      if (stopped) return;
      timer = window.setTimeout(() => void tick(), interval);
    };

    const tick = async () => {
      if (stopped) return;
      if (typeof document !== 'undefined' && document.hidden) { skipped = true; return schedule(); }
      skipped = false;
      try {
        // Sem sessão, o app é o do espectador: pede a versão pública.
        const path = token() ? `/editions/${edition}/snapshot` : `/editions/${edition}/public-snapshot`;
        const payload = await apiRequest<Partial<FrontendState>>({ path, token: token(), fetchImpl: options.fetchImpl });
        if (stopped) return;
        failures = 0;
        onConnection?.('online');
        onSnapshot(normalizeSnapshot(payload));
      } catch {
        // Uma falha é ruído de rede; duas seguidas já merecem avisar a tela.
        failures += 1;
        if (failures >= 2) onConnection?.('offline');
      }
      schedule();
    };

    /**
     * Voltar para a aba não pode custar um ciclo inteiro de atraso: quem
     * reabre o app vê o placar de até cinco segundos atrás sem nenhum sinal de
     * que a tela está velha. Só busca se algum ciclo foi mesmo pulado — trocar
     * de aba sem perder nada não vira requisição.
     */
    const wake = () => {
      if (stopped || document.hidden || !skipped) return;
      window.clearTimeout(timer);
      void tick();
    };

    const observable = typeof document !== 'undefined';
    if (observable) document.addEventListener('visibilitychange', wake);
    schedule();
    return () => {
      stopped = true;
      if (observable) document.removeEventListener('visibilitychange', wake);
      window.clearTimeout(timer);
    };
  };
}
