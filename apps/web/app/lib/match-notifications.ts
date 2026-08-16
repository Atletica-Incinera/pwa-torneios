import { matchStatus } from '@atletica-incinera/intereng-contract/rules';
import type { FrontendState, MatchState } from '@atletica-incinera/intereng-contract/state';

/**
 * O que avisar quando a edição muda em outro aparelho.
 *
 * A comparação é pura e fica separada do envio de propósito: o que decide se
 * vale interromper alguém é regra de produto e precisa ser testável sem
 * navegador.
 */
export type MatchNotification = { tag: string; title: string; body: string; url: string };

type Snapshot = Pick<FrontendState, 'matches'>;

/** Só estes dois merecem interromper. Placar mudando a cada lance seria ruído. */
const announced: string[] = [matchStatus.live, matchStatus.finished];

function teams(match: MatchState) {
  return `${match.entryA ?? 'A definir'} × ${match.entryB ?? 'A definir'}`;
}

function describe(match: MatchState) {
  if (match.status === matchStatus.live) {
    return { title: `${match.discipline ?? 'Partida'} · começou`, body: `${teams(match)}${match.venue ? ` · ${match.venue}` : ''}` };
  }
  const score = typeof match.scoreA === 'number' && typeof match.scoreB === 'number' ? `${match.scoreA} × ${match.scoreB}` : 'sem placar';
  return { title: `${match.discipline ?? 'Partida'} · encerrada`, body: `${teams(match)} · ${score}` };
}

/**
 * As mudanças de status que valem um aviso, entre dois snapshots.
 *
 * Partida que aparece pela primeira vez não gera aviso: no primeiro carregamento
 * a edição inteira seria "nova", e o operador receberia uma enxurrada.
 */
export function collectMatchNotifications(before: Snapshot, after: Snapshot, options: { discipline?: string } = {}): MatchNotification[] {
  const notifications: MatchNotification[] = [];

  for (const [id, match] of Object.entries(after.matches)) {
    const previous = before.matches[id];
    if (!previous) continue;
    if (previous.status === match.status) continue;
    if (!match.status || !announced.includes(match.status)) continue;
    // A modalidade escolhida no aparelho é o recorte de quem opera. Sem ela,
    // avisa tudo — é o caso de quem só acompanha.
    if (options.discipline && match.discipline && match.discipline !== options.discipline) continue;

    const { title, body } = describe(match);
    // A etiqueta junta os avisos da mesma partida: a segunda substitui a
    // primeira em vez de empilhar.
    notifications.push({ tag: `partida:${id}`, title, body, url: `/matches/live?partida=${encodeURIComponent(id)}` });
  }

  return notifications;
}

/**
 * Entrega os avisos pelo service worker.
 *
 * Nada é mostrado com a aba à frente: notificar o que a pessoa está olhando é
 * ruído, e o navegador nem sempre a exibe nesse caso.
 */
export async function showMatchNotifications(notifications: MatchNotification[]) {
  if (!notifications.length) return;
  if (typeof document === 'undefined' || !document.hidden) return;
  if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') return;

  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;

  for (const notification of notifications) {
    await registration.showNotification(notification.title, {
      body: notification.body,
      tag: notification.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: notification.url },
    });
  }
}
