import type { FrontendState } from '@atletica-incinera/intereng-contract/state';
import { apiRequest } from './api-client.ts';
import { readSessionToken } from './session-storage.ts';
import { normalizeSnapshot, type RealtimeConnect } from './http-adapter.ts';

/**
 * Tempo real pobre: relê o snapshot de tempos em tempos.
 *
 * Existe como ponte enquanto a API não expõe o stream por edição. Não é o
 * destino — é o que evita a tela congelar em silêncio, que era exatamente a
 * promessa quebrada quando se decidiu que conexão é obrigatória.
 *
 * Em aba de segundo plano não gasta rede: quem não está olhando não precisa do
 * placar atualizado, e o navegador estrangula o timer de qualquer forma.
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
  const interval = Number(process.env.NEXT_PUBLIC_REALTIME_INTERVAL ?? defaultIntervalMs);

  return (onSnapshot, onConnection) => {
    let stopped = false;
    let failures = 0;
    let timer: number | undefined;

    const schedule = () => {
      if (stopped) return;
      timer = window.setTimeout(() => void tick(), interval);
    };

    const tick = async () => {
      if (stopped) return;
      if (typeof document !== 'undefined' && document.hidden) return schedule();
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

    schedule();
    return () => { stopped = true; window.clearTimeout(timer); };
  };
}
