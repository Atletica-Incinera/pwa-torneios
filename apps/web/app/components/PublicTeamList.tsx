'use client';

import { TeamCard } from './TeamCard';
import { useFrontendState } from '../lib/repositories/browser-repository';

type TeamItem = { id: string; name: string; athletes: number; tone: string; initial: string; logo: string };
export function PublicTeamList({ teams }: { teams: readonly TeamItem[] }) {
  const { state } = useFrontendState();
  const seeded = teams.map((team) => { const item = state.teams[team.id]; return { ...team, name: item?.name ?? team.name, athletes: item?.athletes ?? team.athletes, initial: item?.initials?.[0] ?? team.initial, logo: item?.logo ?? team.logo, tone: item?.tone ?? team.tone, archived: item?.archived ?? false }; });
  const created = Object.entries(state.teams).filter(([, item]) => item.created).map(([id, item], index) => ({ id, name: item.name ?? 'Equipe', athletes: item.athletes ?? 0, initial: item.initials?.[0] ?? 'E', logo: item.logo ?? '', tone: item.tone ?? (index % 2 ? 'pink' : 'blue'), archived: item.archived ?? false }));
  const visible = [...seeded, ...created].filter((team) => !team.archived);
  return <section className="team-list" aria-label="Equipes participantes">{visible.map((team) => <TeamCard team={team} href={`/public/teams/${team.id}`} publicView key={team.id} />)}</section>;
}
