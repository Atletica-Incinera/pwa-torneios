import 'server-only';

import { cache } from 'react';
import {
  emptyFrontendState,
  initialFrontendState,
  seededFrontendState,
  type FrontendState,
} from './frontend-state';

type SnapshotEnvelope = { data?: Partial<FrontendState> };

function normalizeSnapshot(snapshot: Partial<FrontendState>): FrontendState {
  return {
    ...initialFrontendState,
    ...snapshot,
    competitions: snapshot.competitions ?? [],
    editions: snapshot.editions ?? [],
    teams: snapshot.teams ?? {},
    athletes: snapshot.athletes ?? {},
    disciplines: snapshot.disciplines ?? {},
    tournaments: snapshot.tournaments ?? {},
    matches: snapshot.matches ?? {},
    overallRanking: snapshot.overallRanking ?? emptyFrontendState.overallRanking,
    staff: {},
    superAdmins: [],
    audit: [],
    preferences: initialFrontendState.preferences,
  };
}

function internalApiUrl() {
  const configured = process.env.INTERENG_INTERNAL_API_URL?.replace(/\/$/, '');
  if (configured) return configured;

  const publicUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '');
  if (publicUrl?.startsWith('http://') || publicUrl?.startsWith('https://')) return publicUrl;

  return 'http://127.0.0.1:3201/api/v1';
}

export const loadPublicSnapshot = cache(async (): Promise<FrontendState> => {
  if (process.env.NEXT_PUBLIC_DATA_SOURCE === 'local') return seededFrontendState;

  try {
    const response = await fetch(`${internalApiUrl()}/editions/active/public-snapshot`, {
      next: { revalidate: 30 },
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return emptyFrontendState;
    const envelope = await response.json() as SnapshotEnvelope;
    return envelope.data ? normalizeSnapshot(envelope.data) : emptyFrontendState;
  } catch {
    return emptyFrontendState;
  }
});
