import Link from 'next/link';
import { Users } from 'lucide-react';
import { TeamMark } from './AppShell';

type TeamCardProps = { team: { id: string; name: string; athletes: number; tone: string; logo: string }; href: string; publicView?: boolean };

export function TeamCard({ team, href, publicView = false }: TeamCardProps) {
  return <Link className={`team-card team-${team.tone}${publicView ? ' public-static-card public-team-link' : ''}`} href={href}><TeamMark initial={team.name[0]} tone={team.tone} logo={team.logo} /><div className="team-copy tournament-main"><h2>{team.name}</h2><div className="tournament-facts"><span><Users size={15} /> {team.athletes} atletas</span></div><div className="progress-track" aria-label={`${team.athletes} atletas`}><i style={{ width: `${Math.min(90, 40 + team.athletes * 2)}%` }} /></div></div><span className="team-open poster-arrow" aria-hidden>↗</span></Link>;
}
