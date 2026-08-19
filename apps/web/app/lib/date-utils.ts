const shortMonths = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, Math.max(0, (month || 1) - 1), day || 1, 12);
}

export function moveDateKey(value: string, amount: number) {
  const date = fromDateKey(value);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

export function resolveMatchDate(value: string, today = new Date()) {
  const normalized = value.trim().toLocaleLowerCase('pt-BR');
  if (normalized === 'hoje') return toDateKey(today);
  if (normalized === 'ontem') return moveDateKey(toDateKey(today), -1);
  if (normalized === 'amanhã' || normalized === 'amanha') return moveDateKey(toDateKey(today), 1);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toDateKey(today);
}

/** Data no formato brasileiro (dd/mm/aaaa), para mostrar ao usuário em vez do dateKey cru. */
export function formatDateKey(value: string) {
  return new Intl.DateTimeFormat('pt-BR').format(fromDateKey(resolveMatchDate(value)));
}

/**
 * Rótulo curto de data para os cartões de partida ("12 OUT").
 *
 * `formatAgendaDate` assume um dateKey ISO e estoura `RangeError` com qualquer
 * outra coisa — inclusive os rótulos relativos que `resolveMatchDate` aceita e
 * partidas sem data marcada. Como isso roda dentro do render de listas e de
 * telas públicas, um valor fora do padrão derrubaria a página inteira: aqui o
 * texto original é devolvido como está.
 */
export function formatMatchDateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value;
  return formatAgendaDate(value).short;
}

export function formatAgendaDate(value: string, todayKey = toDateKey(new Date())) {
  const distance = Math.round((fromDateKey(value).getTime() - fromDateKey(todayKey).getTime()) / 86_400_000);
  const label = distance === 0 ? 'HOJE' : distance === -1 ? 'ONTEM' : distance === 1 ? 'AMANHÃ' : new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(fromDateKey(value)).replace('.', '').toUpperCase();
  const date = fromDateKey(value);
  return { label, short: `${String(date.getDate()).padStart(2, '0')} ${shortMonths[date.getMonth()]}`, long: new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(date) };
}
