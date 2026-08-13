import { initialFrontendState, type FrontendState } from '@atletica-incinera/intereng-contract/state';

export type DevicePreferences = FrontendState['preferences'];

/**
 * Preferências de quem está usando este aparelho.
 *
 * Modalidade selecionada, som do placar e notificações são do dispositivo, não
 * da edição: o celular do operador e o telão do ginásio podem discordar sem que
 * isso seja um conflito. Por isso ficam fora do canal de operações — não viram
 * requisição, não entram na auditoria e não chegam ao servidor.
 */
export const preferencesKey = 'intereng:preferences:v1';
export const preferencesChangeEvent = 'intereng:preferences-change';

export function readDevicePreferences(): Partial<DevicePreferences> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(preferencesKey);
    return raw ? JSON.parse(raw) as Partial<DevicePreferences> : {};
  } catch { return {}; }
}

export function writeDevicePreferences(patch: Partial<DevicePreferences>) {
  const next = { ...readDevicePreferences(), ...patch };
  try { window.localStorage.setItem(preferencesKey, JSON.stringify(next)); } catch { /* storage indisponível */ }
  window.dispatchEvent(new Event(preferencesChangeEvent));
  return next;
}

/** O estado que as telas leem, com as preferências deste aparelho por cima. */
export function withDevicePreferences(state: FrontendState): FrontendState {
  const device = readDevicePreferences();
  if (!Object.keys(device).length) return state;
  return { ...state, preferences: { ...initialFrontendState.preferences, ...state.preferences, ...device } };
}
