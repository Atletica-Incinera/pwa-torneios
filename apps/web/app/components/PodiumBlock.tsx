'use client';

import { Medal, Trophy } from 'lucide-react';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { categoryPodium } from '../lib/podium';
import { TeamMark } from './AppShell';
import { findTeamByName } from '../lib/eligibility';

/** Campeã, vice e 3º no topo da categoria encerrada — para público e organização. */
export function PodiumBlock({ tournamentId }: { tournamentId: string }) {
  const { state } = useFrontendState();
  const podium = categoryPodium(state, tournamentId);
  if (!podium) return null;
  const logo = (name?: string) => (name ? findTeamByName(state, name)?.logo : undefined);
  return <section className="podium-block" aria-label="Pódio da categoria">
    <div className="podium-champion">
      <Trophy size={28} aria-hidden="true" />
      <TeamMark initial={podium.champion[0]} tone="blue" logo={logo(podium.champion)} />
      <div><small>Campeã</small><strong>{podium.champion}</strong></div>
    </div>
    <ol className="podium-rest">
      {podium.vice ? <li><Medal size={18} aria-hidden="true" /><span>2º</span><strong>{podium.vice}</strong></li> : null}
      {podium.third ? <li><Medal size={18} aria-hidden="true" /><span>3º</span><strong>{podium.third}</strong></li> : null}
    </ol>
    <p className="podium-source">{podium.source === 'tabela' ? 'Definido pela tabela final.' : podium.third ? 'Definido na final e na disputa de 3º lugar.' : 'Definido na final.'}</p>
  </section>;
}
