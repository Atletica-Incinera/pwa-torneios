'use client';

import Link from 'next/link';
import { CalendarDays, Trophy, Users } from 'lucide-react';
import { AppShell, EmptyState, SectionTitle, StatusBadge } from './AppShell';
import { AthleteManager } from './AthleteManager';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { findTeam, listCategories } from '@atletica-incinera/intereng-contract/rules';

export function AthleteDetailView({ id }: { id: string }) {
  const { state } = useFrontendState();
  const stored = state.athletes[id];
  const activeEdition = getActiveEdition(state);
  const athlete = stored ? { id, name: stored.name ?? 'Atleta', teamId: stored.teamId ?? '', modalities: stored.modalities ?? [] } : null;

  if (!athlete || stored?.removed) {
    return <AppShell active="teams" eyebrow="ATLETA" title="NÃO ENCONTRADO" subtitle="Consulta global">
      <EmptyState title="SEM DADOS" copy={stored?.removed ? 'Este atleta foi removido da equipe.' : 'Este atleta não está cadastrado.'} />
    </AppShell>;
  }

  const teamName = findTeam(state, athlete.teamId)?.name ?? 'Equipe cadastrada';
  const modalities = athlete.modalities.length ? athlete.modalities.join(' · ') : 'Sem modalidade associada';
  // Participação real: categorias da edição na modalidade do atleta em que a
  // equipe dele está inscrita. Antes este bloco repetia as próprias modalidades.
  const participations = listCategories(state, activeEdition?.id)
    .filter((category) => athlete.modalities.includes(category.discipline))
    .map((category) => ({ ...category, registered: state.tournaments[category.id]?.participants.includes(teamName) ?? false }));

  return (
    <AppShell active="teams" eyebrow="ATLETA" title={athlete.name.toUpperCase()} subtitle="Equipe e modalidades">
      <AthleteManager id={id} initialName={athlete.name} teamName={teamName} />

      <section className="section-block">
        <SectionTitle eyebrow="EQUIPE ATUAL" title="VÍNCULO" />
        <div className="detail-card">
          <div><Users size={22} /><span><small>Equipe</small><strong>{teamName}</strong></span></div>
          <div><CalendarDays size={22} /><span><small>Modalidades</small><strong>{modalities}</strong></span></div>
        </div>
      </section>

      <Link href={`/teams/${athlete.teamId}`} className="wide-action">GERENCIAR NA EQUIPE <span>›</span></Link>

      <section className="section-block">
        <SectionTitle eyebrow={`EDIÇÃO ${activeEdition?.year ?? ''}`} title="PARTICIPAÇÃO" />
        {participations.length ? (
          <div className="stack-list">
            {participations.map((category) => (
              <Link href={`/tournaments/${category.id}`} className="list-row" key={category.id}>
                <Trophy size={20} />
                <span><strong>{category.name}</strong><small>{category.discipline} · {category.phase}</small></span>
                <StatusBadge tone={category.registered ? 'orange' : 'neutral'}>{category.registered ? 'Equipe inscrita' : 'Equipe não inscrita'}</StatusBadge>
              </Link>
            ))}
          </div>
        ) : (
          <p className="match-filter-empty">{athlete.modalities.length ? 'Nenhuma categoria desta modalidade na edição ativa.' : 'Associe o atleta a uma modalidade para ver onde ele pode competir.'}</p>
        )}
      </section>
    </AppShell>
  );
}
