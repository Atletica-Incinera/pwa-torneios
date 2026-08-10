export type ImpactSound =
  | 'goal'
  | 'basket'
  | 'point'
  | 'score'
  | 'foul'
  | 'card'
  | 'match-start'
  | 'period-start'
  | 'period-end'
  | 'match-end'
  | 'field-period-end'
  | 'field-match-end'
  | 'volleyball-point'
  | 'volleyball-set-end'
  | 'volleyball-match-end'
  | 'chess-start'
  | 'chess-point'
  | 'chess-end';

type SoundClip = {
  src: string;
  volume: number;
  delay?: number;
  maxDuration?: number;
  fadeStart?: number;
};

const clips = {
  whistle: '/sounds/referee-whistle.wav',
  refereeWhistle: '/sounds/referee-whistle-sport.mp3',
  goalCrowd: '/sounds/crowd-goal-explosion.wav',
  basketNet: '/sounds/basket-net.wav',
  buzzer: '/sounds/court-buzzer.wav',
  applause: '/sounds/team-applause.wav',
  volleyballHit: '/sounds/volleyball-hit.mp3',
  volleyballBuzzer: '/sounds/volleyball-buzzer.mp3',
  chessPieces: '/sounds/chess-pieces.mp3',
} as const;

const SPORT_SOUNDS: Record<ImpactSound, SoundClip[]> = {
  goal: [{ src: clips.goalCrowd, volume: 0.72, maxDuration: 4.4, fadeStart: 2.65 }],
  point: [{ src: clips.applause, volume: 0.54, maxDuration: 1.35 }],
  score: [{ src: clips.applause, volume: 0.5, maxDuration: 1.1 }],
  basket: [
    { src: clips.basketNet, volume: 0.82, maxDuration: 0.8 },
    { src: clips.goalCrowd, volume: 0.4, delay: 0.12, maxDuration: 2.25, fadeStart: 1.3 },
  ],
  // Um único apito prolongado torna a interrupção clara sem parecer uma notificação dupla.
  foul: [{ src: clips.refereeWhistle, volume: 0.38, maxDuration: 2.2 }],
  card: [{ src: clips.refereeWhistle, volume: 0.44, maxDuration: 2.2 }],
  'match-start': [{ src: clips.whistle, volume: 0.8 }],
  'period-start': [{ src: clips.whistle, volume: 0.72 }],
  'period-end': [{ src: clips.buzzer, volume: 0.7, maxDuration: 1.8 }],
  'match-end': [
    { src: clips.buzzer, volume: 0.65, maxDuration: 1.6 },
    { src: clips.applause, volume: 0.68, delay: 0.72, maxDuration: 3.2 },
  ],
  'field-period-end': [{ src: clips.refereeWhistle, volume: 0.42, maxDuration: 2.4 }],
  'field-match-end': [
    { src: clips.refereeWhistle, volume: 0.44, maxDuration: 2.4 },
    { src: clips.applause, volume: 0.56, delay: 0.5, maxDuration: 2.1 },
  ],
  'volleyball-point': [
    { src: clips.volleyballHit, volume: 0.8, maxDuration: 1.3 },
    { src: clips.applause, volume: 0.45, delay: 0.18, maxDuration: 1.25 },
  ],
  'volleyball-set-end': [{ src: clips.volleyballBuzzer, volume: 0.76 }],
  'volleyball-match-end': [
    { src: clips.volleyballBuzzer, volume: 0.74 },
    { src: clips.applause, volume: 0.64, delay: 0.45, maxDuration: 2.5 },
  ],
  'chess-start': [{ src: clips.chessPieces, volume: 0.52, maxDuration: 0.85 }],
  'chess-point': [{ src: clips.chessPieces, volume: 0.72, maxDuration: 1.2 }],
  'chess-end': [
    { src: clips.chessPieces, volume: 0.74, maxDuration: 1.25 },
    { src: clips.applause, volume: 0.34, delay: 0.52, maxDuration: 1.4 },
  ],
};

let warmed = false;

export function warmSportsSounds() {
  if (typeof window === 'undefined' || warmed) return;
  warmed = true;
  [...new Set(Object.values(SPORT_SOUNDS).flat().map((clip) => clip.src))].forEach((src) => {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.load();
  });
}

function playClip(clip: SoundClip) {
  if (typeof window === 'undefined') return;
  const start = () => {
    const audio = new Audio(clip.src);
    audio.preload = 'auto';
    audio.volume = clip.volume;
    const stop = () => {
      audio.pause();
      audio.currentTime = 0;
    };
    if (clip.maxDuration) {
      if (clip.fadeStart && clip.fadeStart < clip.maxDuration) {
        window.setTimeout(() => {
          const fadeDuration = (clip.maxDuration! - clip.fadeStart!) * 1_000;
          const fadeFrom = audio.volume;
          const fadeBeganAt = performance.now();
          const fade = () => {
            const progress = Math.min(1, (performance.now() - fadeBeganAt) / fadeDuration);
            audio.volume = fadeFrom * (1 - progress);
            if (progress < 1) window.requestAnimationFrame(fade);
          };
          window.requestAnimationFrame(fade);
        }, clip.fadeStart * 1_000);
      }
      window.setTimeout(stop, clip.maxDuration * 1_000);
    }
    void audio.play().catch(() => undefined);
  };

  if (clip.delay) window.setTimeout(start, clip.delay * 1_000);
  else start();
}

export function playImpactSound(sound: ImpactSound) {
  SPORT_SOUNDS[sound].forEach(playClip);
}

function normalizedDiscipline(discipline: string) {
  return discipline.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function soundForLifecycle(lifecycle: 'match-start' | 'period-start' | 'period-end' | 'match-end', discipline: string): ImpactSound {
  const sport = normalizedDiscipline(discipline);
  if (/xadrez/.test(sport)) return lifecycle === 'match-end' ? 'chess-end' : 'chess-start';
  if (/volei/.test(sport)) {
    if (lifecycle === 'period-end') return 'volleyball-set-end';
    if (lifecycle === 'match-end') return 'volleyball-match-end';
  }
  if (/futsal|handebol|futebol/.test(sport)) {
    if (lifecycle === 'period-end') return 'field-period-end';
    if (lifecycle === 'match-end') return 'field-match-end';
  }
  return lifecycle;
}

export function impactSoundForEvent(eventType: string, discipline = ''): ImpactSound {
  const event = eventType.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const sport = normalizedDiscipline(discipline);

  if (/fim de set/.test(event) && /volei/.test(sport)) return 'volleyball-set-end';
  if (/fim de (tempo|periodo)/.test(event)) return soundForLifecycle('period-end', discipline);
  if (/encerrar|fim de jogo|fim da partida/.test(event)) return soundForLifecycle('match-end', discipline);
  if (/cart|advert|2 minutos/.test(event)) return 'card';
  if (/falta|penal|ocorr|tempo tecnico/.test(event)) return 'foul';
  if (/gol/.test(event) && /futsal|handebol|futebol/.test(sport)) return 'goal';
  if (/cesta/.test(event) || (/ponto/.test(event) && /basquet/.test(sport))) return 'basket';
  if (/ponto/.test(event) && /volei/.test(sport)) return 'volleyball-point';
  if (/ponto/.test(event) && /xadrez/.test(sport)) return 'chess-point';
  if (/ponto|ace|set/.test(event)) return 'point';
  return 'score';
}
