'use client';

import { Plus, SlidersHorizontal, Trash2, Trophy } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { SectionTitle, TeamMark } from './AppShell';
import { useUi } from './UiProvider';
import { disciplines as catalogDisciplines, teams as catalogTeams } from '../lib/repositories/catalog-repository';
import { getActiveEdition, OverallMetricState, useFrontendState } from '../lib/repositories/browser-repository';

export function OverallStandings({ readOnly = false }: { readOnly?: boolean }) {
  const { state, commit } = useFrontendState();
  const { confirm, toast } = useUi();
  const activeEdition = getActiveEdition(state);
  const [metricDraft, setMetricDraft] = useState({ name: '', points: '1' });
  const [awardDraft, setAwardDraft] = useState({ teamId: '', discipline: state.preferences.selectedDiscipline, metricId: state.overallRanking.metrics[0]?.id ?? '', points: String(state.overallRanking.metrics[0]?.defaultPoints ?? 1), note: '' });

  const teams = useMemo(() => {
    const seeded = catalogTeams.map((team) => ({ id: team.id, name: state.teams[team.id]?.name ?? team.name, logo: state.teams[team.id]?.logo ?? team.logo, tone: state.teams[team.id]?.tone ?? team.tone }));
    const created = Object.entries(state.teams).filter(([, team]) => team.created && !team.archived).map(([id, team], index) => ({ id, name: team.name ?? 'Equipe', logo: team.logo ?? '', tone: team.tone ?? (index % 2 ? 'pink' : 'blue') }));
    return [...seeded, ...created];
  }, [state.teams]);
  const disciplineOptions = [...new Set([...catalogDisciplines.map((item) => item.name), ...Object.values(state.disciplines).map((item) => item.name).filter((name): name is string => Boolean(name))])];
  const editionAwards = state.overallRanking.awards.filter((award) => award.editionId === activeEdition?.id);
  const sortedRanking = teams.map((team) => {
    const awards = editionAwards.filter((award) => award.teamId === team.id);
    return { ...team, points: awards.reduce((total, award) => total + award.points, 0), bonuses: awards.length, disciplines: new Set(awards.map((award) => award.discipline)).size };
  }).sort((a, b) => b.points - a.points || b.disciplines - a.disciplines || a.name.localeCompare(b.name, 'pt-BR'));
  const ranking = sortedRanking.map((team) => ({ ...team, rank: sortedRanking.findIndex((item) => item.points === team.points && item.disciplines === team.disciplines) + 1 }));

  function addMetric(event: FormEvent) {
    event.preventDefault();
    const name = metricDraft.name.trim();
    const points = Number(metricDraft.points);
    if (!name || !Number.isFinite(points)) { toast('Informe o nome e a pontuação da métrica.', 'error'); return; }
    const metric: OverallMetricState = { id: `metric-${Date.now()}`, name, defaultPoints: points };
    commit((current) => ({ ...current, overallRanking: { ...current.overallRanking, metrics: [...current.overallRanking.metrics, metric] } }), { action: 'Métrica do ranking criada', entity: name, after: `${points} pontos` });
    setMetricDraft({ name: '', points: '1' });
  }

  function updateMetric(metricId: string, patch: Partial<OverallMetricState>) {
    commit((current) => ({ ...current, overallRanking: { ...current.overallRanking, metrics: current.overallRanking.metrics.map((metric) => metric.id === metricId ? { ...metric, ...patch } : metric) } }));
  }

  async function removeMetric(metric: OverallMetricState) {
    if (state.overallRanking.awards.some((award) => award.metricId === metric.id)) { toast('Remova primeiro os pontos lançados com esta métrica.', 'error'); return; }
    if (!(await confirm({ title: 'Remover métrica?', message: `${metric.name} deixará de aparecer nos novos lançamentos.`, confirmLabel: 'Remover', danger: true }))) return;
    commit((current) => ({ ...current, overallRanking: { ...current.overallRanking, metrics: current.overallRanking.metrics.filter((item) => item.id !== metric.id) } }), { action: 'Métrica do ranking removida', entity: metric.name });
  }

  function chooseMetric(metricId: string) {
    const metric = state.overallRanking.metrics.find((item) => item.id === metricId);
    setAwardDraft((current) => ({ ...current, metricId, points: String(metric?.defaultPoints ?? current.points) }));
  }

  function addAward(event: FormEvent) {
    event.preventDefault();
    if (!activeEdition || !awardDraft.teamId || !awardDraft.discipline || !awardDraft.metricId || !Number.isFinite(Number(awardDraft.points))) { toast('Preencha equipe, modalidade, métrica e pontos.', 'error'); return; }
    const duplicate = editionAwards.some((award) => award.teamId === awardDraft.teamId && award.discipline === awardDraft.discipline && award.metricId === awardDraft.metricId);
    if (duplicate) { toast('Essa bonificação já foi lançada para a equipe nesta modalidade.', 'error'); return; }
    const team = teams.find((item) => item.id === awardDraft.teamId);
    const metric = state.overallRanking.metrics.find((item) => item.id === awardDraft.metricId);
    const award = { id: `award-${Date.now()}`, editionId: activeEdition.id, teamId: awardDraft.teamId, discipline: awardDraft.discipline, metricId: awardDraft.metricId, points: Number(awardDraft.points), note: awardDraft.note.trim(), createdAt: new Date().toISOString() };
    commit((current) => ({ ...current, overallRanking: { ...current.overallRanking, awards: [award, ...current.overallRanking.awards] } }), { action: 'Pontos concedidos no ranking geral', entity: team?.name ?? awardDraft.teamId, after: `${award.points} · ${metric?.name ?? 'Métrica'} · ${award.discipline}` });
    setAwardDraft((current) => ({ ...current, teamId: '', note: '' }));
  }

  async function removeAward(id: string, teamName: string) {
    if (!(await confirm({ title: 'Remover pontuação?', message: `O ranking de ${teamName} será recalculado.`, confirmLabel: 'Remover', danger: true }))) return;
    commit((current) => ({ ...current, overallRanking: { ...current.overallRanking, awards: current.overallRanking.awards.filter((award) => award.id !== id) } }), { action: 'Pontuação removida do ranking geral', entity: teamName });
  }

  return <>
    <section className="section-block overall-ranking-section">
      <SectionTitle eyebrow={`INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`} title="RANKING GERAL" />
      <p className="section-intro">Pontuação acumulada das equipes em todas as modalidades da edição.</p>
      <div className="overall-ranking-list" aria-label="Classificação geral das equipes">
        {ranking.map((team) => <article className={`overall-ranking-row rank-${team.rank}`} key={team.id}><span className="rank-block">{team.rank}</span><TeamMark initial={team.name[0]} tone={team.tone} logo={team.logo} small /><div><strong>{team.name}</strong><small>{team.disciplines} modalidades · {team.bonuses} bonificações</small></div><b>{team.points}<small>PTS</small></b></article>)}
      </div>
    </section>

    {!readOnly ? <>
      <section className="section-block ranking-admin-panel">
        <SectionTitle eyebrow="REGULAMENTO" title="MÉTRICAS DE PONTUAÇÃO" />
        <div className="ranking-metric-list">{state.overallRanking.metrics.map((metric) => <article key={metric.id}><SlidersHorizontal size={18} /><input aria-label={`Nome da métrica ${metric.name}`} value={metric.name} onChange={(event) => updateMetric(metric.id, { name: event.target.value })} /><label><span>Pontos</span><input aria-label={`Pontos de ${metric.name}`} type="number" value={metric.defaultPoints} onChange={(event) => updateMetric(metric.id, { defaultPoints: Number(event.target.value) })} /></label><button type="button" onClick={() => void removeMetric(metric)} aria-label={`Remover métrica ${metric.name}`}><Trash2 size={17} /></button></article>)}</div>
        <form className="ranking-inline-form" onSubmit={addMetric}><input aria-label="Nome da nova métrica" value={metricDraft.name} onChange={(event) => setMetricDraft({ ...metricDraft, name: event.target.value })} placeholder="Ex.: Campeão geral" /><input aria-label="Pontos da nova métrica" type="number" value={metricDraft.points} onChange={(event) => setMetricDraft({ ...metricDraft, points: event.target.value })} /><button type="submit"><Plus size={17} /> Adicionar métrica</button></form>
      </section>

      <section className="section-block ranking-admin-panel">
        <SectionTitle eyebrow="LANÇAMENTO" title="BONIFICAR EQUIPE" />
        <form className="entity-form ranking-award-form" onSubmit={addAward}>
          <label><span>Equipe</span><select aria-label="Equipe da bonificação" value={awardDraft.teamId} onChange={(event) => setAwardDraft({ ...awardDraft, teamId: event.target.value })}><option value="">Selecione</option>{teams.map((team) => <option value={team.id} key={team.id}>{team.name}</option>)}</select></label>
          <label><span>Modalidade</span><select aria-label="Modalidade da bonificação" value={awardDraft.discipline} onChange={(event) => setAwardDraft({ ...awardDraft, discipline: event.target.value })}>{disciplineOptions.map((discipline) => <option key={discipline}>{discipline}</option>)}</select></label>
          <label><span>Métrica</span><select aria-label="Métrica da bonificação" value={awardDraft.metricId} onChange={(event) => chooseMetric(event.target.value)}>{state.overallRanking.metrics.map((metric) => <option value={metric.id} key={metric.id}>{metric.name}</option>)}</select></label>
          <label><span>Pontos</span><input aria-label="Pontos da bonificação" type="number" value={awardDraft.points} onChange={(event) => setAwardDraft({ ...awardDraft, points: event.target.value })} /></label>
          <label className="full-field"><span>Observação opcional</span><input value={awardDraft.note} onChange={(event) => setAwardDraft({ ...awardDraft, note: event.target.value })} placeholder="Ex.: resultado homologado" /></label>
          <button type="submit" className="primary-button"><Trophy size={18} /> Conceder pontos</button>
        </form>
      </section>

      <section className="section-block ranking-admin-panel">
        <SectionTitle eyebrow="AUDITORIA VISUAL" title="ÚLTIMOS LANÇAMENTOS" />
        <div className="ranking-award-history">{editionAwards.length ? editionAwards.map((award) => { const team = teams.find((item) => item.id === award.teamId); const metric = state.overallRanking.metrics.find((item) => item.id === award.metricId); return <article key={award.id}><div><strong>{team?.name ?? 'Equipe'}</strong><small>{award.discipline} · {metric?.name ?? 'Métrica'}{award.note ? ` · ${award.note}` : ''}</small></div><b>{award.points} pts</b><button type="button" onClick={() => void removeAward(award.id, team?.name ?? 'equipe')} aria-label={`Remover pontuação de ${team?.name ?? 'equipe'}`}><Trash2 size={16} /></button></article>; }) : <p className="match-filter-empty">Nenhuma pontuação geral lançada nesta edição.</p>}</div>
      </section>
    </> : null}
  </>;
}
