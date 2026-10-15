/**
 * Agenda dos jogos gerados de uma categoria.
 *
 * "Montar os jogos" gravava todos os confrontos no primeiro dia da edição, de
 * hora em hora a partir das 08:00, dois a dois no mesmo horário, sempre em
 * "A definir" — e na ordem em que o todos-contra-todos os produzia, então a
 * mesma equipe jogava três horas seguidas. Este módulo distribui por rodada
 * (ninguém joga duas vezes na mesma rodada), alterna os grupos e encaixa cada
 * jogo no próximo horário livre de uma das quadras informadas.
 */

export type ScheduleBucket = { name: string; teams: readonly string[] };

export type SchedulePlanInput = {
  buckets: readonly ScheduleBucket[];
  /** Primeiro dia, AAAA-MM-DD. */
  startDate: string;
  /** Horário do primeiro jogo, HH:MM. */
  startTime: string;
  /** Minutos entre o início de um jogo e o do seguinte na mesma quadra. */
  intervalMinutes: number;
  /** Quadras ou locais em uso ao mesmo tempo. Vazio vira "A definir". */
  venues: readonly string[];
  /** Último horário em que um jogo ainda pode começar, HH:MM. */
  lastStart?: string;
};

export type PlannedMatch = { entryA: string; entryB: string; phase: string; date: string; time: string; venue: string };

/** Todos contra todos em rodadas (método do círculo); ímpar ganha folga. */
export function roundRobinRounds(teams: readonly string[]): Array<Array<[string, string]>> {
  if (teams.length < 2) return [];
  const bye = '__folga__';
  const ring = teams.length % 2 ? [...teams, bye] : [...teams];
  const rounds: Array<Array<[string, string]>> = [];
  for (let round = 0; round < ring.length - 1; round += 1) {
    const pairs: Array<[string, string]> = [];
    for (let index = 0; index < ring.length / 2; index += 1) {
      const home = ring[index];
      const away = ring[ring.length - 1 - index];
      if (home !== bye && away !== bye) pairs.push(round % 2 && index === 0 ? [away, home] : [home, away]);
    }
    rounds.push(pairs);
    // Gira todos menos o primeiro.
    ring.splice(1, 0, ring.pop() as string);
  }
  return rounds;
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Rodada a rodada, alternando grupos; cada jogo no próximo horário livre. */
export function planSchedule(input: SchedulePlanInput): PlannedMatch[] {
  const venues = input.venues.map((venue) => venue.trim()).filter(Boolean);
  const courts = venues.length ? venues : ['A definir'];
  const interval = Math.max(10, Math.round(input.intervalMinutes));
  const first = toMinutes(input.startTime);
  const last = Math.max(first, toMinutes(input.lastStart ?? '22:00'));
  const slotsPerDay = Math.floor((last - first) / interval) + 1;

  const roundsByBucket = input.buckets.map((bucket) => ({ name: bucket.name, rounds: roundRobinRounds(bucket.teams) }));
  const totalRounds = Math.max(0, ...roundsByBucket.map((bucket) => bucket.rounds.length));
  const ordered: Array<{ pair: [string, string]; phase: string }> = [];
  for (let round = 0; round < totalRounds; round += 1) {
    for (const bucket of roundsByBucket) {
      for (const pair of bucket.rounds[round] ?? []) ordered.push({ pair, phase: bucket.name });
    }
  }

  // Mesmo horário em quadras diferentes só quando nenhuma das equipes já
  // está naquele horário — com uma quadra só, nunca há conflito.
  const busy = new Map<number, Set<string>>();
  const used = new Map<number, number>();
  return ordered.map(({ pair, phase }) => {
    let slot = 0;
    for (;;) {
      const teams = busy.get(slot) ?? new Set<string>();
      const taken = used.get(slot) ?? 0;
      if (taken < courts.length && !teams.has(pair[0]) && !teams.has(pair[1])) break;
      slot += 1;
    }
    const court = used.get(slot) ?? 0;
    used.set(slot, court + 1);
    busy.set(slot, new Set([...(busy.get(slot) ?? []), pair[0], pair[1]]));
    const day = Math.floor(slot / slotsPerDay);
    const minutes = first + (slot % slotsPerDay) * interval;
    return { entryA: pair[0], entryB: pair[1], phase, date: addDays(input.startDate, day), time: toTime(minutes), venue: courts[court] };
  });
}

/**
 * Intervalo sugerido a partir do regulamento: duração do jogo mais uma folga
 * para troca de equipes. Por sets não há duração fixa; usa a média prática.
 */
export function suggestedInterval(rules: { completion?: { mode?: string; setsToWin?: number }; periodCount?: number; periodDurationMinutes?: number } | undefined) {
  if (rules?.completion?.mode === 'sets') return (rules.completion.setsToWin ?? 2) >= 3 ? 75 : 50;
  const playing = (rules?.periodCount ?? 2) * (rules?.periodDurationMinutes ?? 20);
  return Math.ceil((playing + 15) / 5) * 5;
}
