'use client';

import Link from 'next/link';
import { CalendarDays, History, Users } from 'lucide-react';
import { AppShell, EmptyState, SectionTitle } from './AppShell';
import { AthleteManager } from './AthleteManager';
import { useFrontendState } from '../lib/repositories/browser-repository';

type Base = { id: string; name: string; teamId: string; modalities: readonly string[] };
export function AthleteDetailView({ id, initial, initialTeamName }: { id: string; initial?: Base; initialTeamName?: string }) {
  const { state } = useFrontendState(); const stored = state.athletes[id];
  const athlete = initial ? { ...initial, name: stored?.name ?? initial.name, modalities: stored?.modalities ?? [...initial.modalities] } : stored?.created ? { id, name: stored.name ?? 'Atleta', teamId: stored.teamId ?? '', modalities: stored.modalities ?? [] } : null;
  if (!athlete) return <AppShell active="teams" eyebrow="ATLETA" title="NÃO ENCONTRADO" subtitle="Consulta global"><EmptyState title="SEM DADOS" copy="Este atleta não está cadastrado." /></AppShell>;
  const teamName = state.teams[athlete.teamId]?.name ?? initialTeamName ?? 'Equipe cadastrada'; const modalities = athlete.modalities.length ? athlete.modalities.join(' · ') : 'Sem modalidade associada';
  return <AppShell active="teams" eyebrow="ATLETA" title={athlete.name.toUpperCase()} subtitle="Equipe e modalidades"><AthleteManager id={id} initialName={athlete.name} teamName={teamName} /><section className="section-block"><SectionTitle eyebrow="EQUIPE ATUAL" title="VÍNCULO" /><div className="detail-card"><div><Users size={22} /><span><small>Equipe</small><strong>{teamName}</strong></span></div><div><CalendarDays size={22} /><span><small>Modalidades</small><strong>{modalities}</strong></span></div></div></section><Link href={`/teams/${athlete.teamId}`} className="wide-action">GERENCIAR NA EQUIPE <span>›</span></Link><section className="section-block"><SectionTitle eyebrow="PARTICIPAÇÃO" title="HISTÓRICO" /><div className="history-line"><History size={20} /><div><strong>InterEng · Edição 2026</strong><p>{modalities} · {teamName}</p></div><span>26</span></div></section></AppShell>;
}
