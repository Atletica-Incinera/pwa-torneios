'use client';

import { useCallback, useEffect, useState } from 'react';

export type CompetitionState = { id: string; name: string; slug: string; active: boolean };
export type EditionState = { id: string; name: string; year: number; start: string; end: string; status: 'Planejamento' | 'Em andamento' | 'Finalizada' | 'Arquivada'; active: boolean; competitionId?: string };
export type TeamState = { name?: string; initials?: string; responsible?: string; logo?: string; archived?: boolean; created?: boolean; athletes?: number; tone?: 'blue' | 'pink' | 'orange' };
export type AthleteState = { name?: string; teamId?: string; modalities?: string[]; created?: boolean };
export type DisciplineState = { config?: string; enabled?: boolean; created?: boolean; name?: string; mode?: 'Coletiva' | 'Individual'; tournaments?: number; tone?: 'blue' | 'pink' | 'orange' };
export type TournamentPhase = { id: string; name: string; format: 'Grupos' | 'Mata-mata' | 'Liga'; groups: string[]; qualifiers: number };
export type TournamentState = { status: 'Rascunho' | 'Publicado' | 'Em andamento' | 'Encerrado'; participants: string[]; seeds: Record<string, number>; phases: TournamentPhase[]; assignments: Record<string, string>; generated: boolean; created?: boolean; name?: string; discipline?: string; format?: string; tone?: 'blue' | 'pink' | 'orange' };
export type MatchEventState = { id: string; at: string; elapsedSeconds: number; type: string; detail: string; side: 'home' | 'away' | 'neutral'; scoreA: number; scoreB: number; previousScoreA?: number; previousScoreB?: number };
export type MatchState = { date?: string; time?: string; venue?: string; status?: 'Agendada' | 'Ao vivo' | 'Encerrada' | 'Adiada' | 'Cancelada' | 'W.O.'; reason?: string; scoreA?: number | null; scoreB?: number | null; created?: boolean; discipline?: string; entryA?: string; entryB?: string; logoA?: string; logoB?: string; phase?: string; tournamentId?: string; clockSeconds?: number; runningSince?: string; paused?: boolean; events?: MatchEventState[]; operatorId?: string; operatorName?: string; operatorHeartbeat?: string };
export type StaffState = {
  name: string;
  email: string;
  initials: string;
  role: 'Admin da edição' | 'Gestor de modalidade';
  scope: string;
  revoked?: boolean;
};
export type AuditState = { id: string; at: string; actor: string; action: string; entity: string; before?: string; after?: string };

export type FrontendState = {
  competitions: CompetitionState[];
  editions: EditionState[];
  teams: Record<string, TeamState>;
  athletes: Record<string, AthleteState>;
  disciplines: Record<string, DisciplineState>;
  tournaments: Record<string, TournamentState>;
  matches: Record<string, MatchState>;
  staff: Record<string, StaffState>;
  audit: AuditState[];
  preferences: { selectedDiscipline: string; notifications: boolean };
};

const storageKey = 'intereng:app-state:v1';
const eventName = 'intereng:state-change';

export const initialFrontendState: FrontendState = {
  competitions: [{ id: 'jogos-engenharia', name: 'Jogos de Engenharia', slug: 'jogos-de-engenharia', active: true }],
  editions: [
    { id: 'intereng-2026', name: 'InterEng 2026', year: 2026, start: '2026-10-12', end: '2026-10-19', status: 'Em andamento', active: true, competitionId: 'jogos-engenharia' },
    { id: 'intereng-2025', name: 'InterEng 2025', year: 2025, start: '2025-10-13', end: '2025-10-20', status: 'Finalizada', active: false, competitionId: 'jogos-engenharia' },
    { id: 'intereng-2024', name: 'InterEng 2024', year: 2024, start: '2024-10-14', end: '2024-10-21', status: 'Arquivada', active: false, competitionId: 'jogos-engenharia' },
  ],
  teams: {},
  athletes: {},
  disciplines: {},
  tournaments: {},
  matches: {},
  staff: {},
  audit: [],
  preferences: { selectedDiscipline: 'Futsal', notifications: true },
};

function parseState(value: string | null): FrontendState {
  if (!value) return initialFrontendState;
  try {
    const parsed = JSON.parse(value) as Partial<FrontendState>;
    return {
      ...initialFrontendState,
      ...parsed,
      competitions: parsed.competitions ?? initialFrontendState.competitions,
      editions: parsed.editions ?? initialFrontendState.editions,
      teams: { ...initialFrontendState.teams, ...parsed.teams },
      athletes: { ...initialFrontendState.athletes, ...parsed.athletes },
      disciplines: { ...initialFrontendState.disciplines, ...parsed.disciplines },
      tournaments: { ...initialFrontendState.tournaments, ...parsed.tournaments },
      matches: { ...initialFrontendState.matches, ...parsed.matches },
      staff: { ...initialFrontendState.staff, ...parsed.staff },
      audit: parsed.audit ?? [],
      preferences: { ...initialFrontendState.preferences, ...parsed.preferences },
    };
  } catch { return initialFrontendState; }
}

export function readFrontendState() {
  if (typeof window === 'undefined') return initialFrontendState;
  return parseState(window.localStorage.getItem(storageKey));
}

export function useFrontendState() {
  const [state, setState] = useState<FrontendState>(initialFrontendState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(readFrontendState());
    setHydrated(true);
    const sync = () => setState(readFrontendState());
    window.addEventListener(eventName, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(eventName, sync); window.removeEventListener('storage', sync); };
  }, []);

  const commit = useCallback((update: (current: FrontendState) => FrontendState, audit?: Omit<AuditState, 'id' | 'at' | 'actor'>) => {
    try {
      const current = readFrontendState();
      const updated = update(current);
      const sessionRaw = window.localStorage.getItem('intereng:frontend-session') ?? window.sessionStorage.getItem('intereng:frontend-session');
      const actor = sessionRaw ? (JSON.parse(sessionRaw) as { name?: string }).name ?? 'Usuário do app' : 'Usuário do app';
      const next = audit ? { ...updated, audit: [{ id: `audit-${Date.now()}`, at: new Date().toISOString(), actor, ...audit }, ...updated.audit] } : updated;
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      setState(next);
      window.dispatchEvent(new Event(eventName));
      if (audit) window.dispatchEvent(new CustomEvent('intereng:toast', { detail: { message: audit.action, tone: 'success' } }));
      return true;
    } catch {
      window.dispatchEvent(new CustomEvent('intereng:toast', { detail: { message: 'Não foi possível salvar. Tente novamente.', tone: 'error' } }));
      return false;
    }
  }, []);

  return { state, commit, hydrated };
}
