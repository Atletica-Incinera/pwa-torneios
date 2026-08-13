'use client';

import { Lock, Plus, SlidersHorizontal, Sparkles, Trash2, Trophy, Undo2 } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { SectionTitle, TeamMark } from './AppShell';
import { useUi } from './UiProvider';
import { getActiveEdition, OverallMetricState, OverallPosition, useFrontendState } from '../lib/repositories/browser-repository';
import { activeAwards, computeOverallRanking, editionAwards, hasAward, isRankingClosed, positionLabels, rankingClosure, suggestAutomaticAwards, listDisciplines, listTeams, createId } from '@atletica-incinera/intereng-contract/rules';
import { canManageEdition, useFrontendSession } from '../lib/frontend-session';

export function OverallStandings({ readOnly = false }: { readOnly?: boolean }) {
  const { state, dispatch } = useFrontendState();
  const { confirm, prompt, toast } = useUi();
  const { session } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  const [metricDraft, setMetricDraft] = useState({ name: '', points: '1', position: '' as OverallPosition | '' });
  const [awardDraft, setAwardDraft] = useState({ teamId: '', discipline: state.preferences.selectedDiscipline, metricId: state.overallRanking.metrics[0]?.id ?? '', points: String(state.overallRanking.metrics[0]?.defaultPoints ?? 1), note: '' });

  const teams = useMemo(() => listTeams(state), [state]);
  const disciplineOptions = listDisciplines(state, activeEdition?.id).filter((item) => item.enabled).map((item) => item.name);
  const history = editionAwards(state, activeEdition?.id);
  const live = activeAwards(state, activeEdition?.id);
  const closure = rankingClosure(state, activeEdition?.id);
  const closed = isRankingClosed(state, activeEdition?.id);
  const ranking = useMemo(() => computeOverallRanking(state, teams, activeEdition?.id), [activeEdition?.id, state, teams]);
  const suggestions = useMemo(() => (readOnly ? [] : suggestAutomaticAwards(state, activeEdition?.id)), [activeEdition?.id, readOnly, state]);
  const toneOf = (teamId: string) => teams.find((team) => team.id === teamId)?.tone ?? 'blue';

  /** Alterar o ranking depois do fechamento é retificação: exige motivo. */
  async function requireRectification(title: string) {
    if (!closed) return { ok: true, reason: undefined as string | undefined };
    const reason = await prompt({ title, message: `O ranking geral desta edição foi fechado em ${new Date(closure!.at).toLocaleString('pt-BR')} por ${closure!.actor}. Qualquer mudança agora é uma retificação rastreável.`, label: 'Motivo da retificação', placeholder: 'Ex.: recurso deferido pela comissão', confirmLabel: 'Retificar', minLength: 5, danger: true });
    return { ok: Boolean(reason), reason: reason ?? undefined };
  }

  function addMetric(event: FormEvent) {
    event.preventDefault();
    const name = metricDraft.name.trim();
    const points = Number(metricDraft.points);
    if (!name || !Number.isFinite(points)) { toast('Informe o nome e a pontuação da métrica.', 'error'); return; }
    const metric: OverallMetricState = { id: createId('metric'), name, defaultPoints: points, position: metricDraft.position || undefined };
    void dispatch({ type: 'ranking/addMetric', payload: { metric }, audit: { action: 'Métrica do ranking criada', entity: name, after: `${points} pontos · ${metric.position ? `automática (${positionLabels[metric.position]})` : 'lançamento manual'}` } });
    setMetricDraft({ name: '', points: '1', position: '' });
  }

  function updateMetric(metricId: string, patch: Partial<OverallMetricState>) {
    void dispatch({ type: 'ranking/updateMetric', payload: { metricId, patch } });
  }

  async function removeMetric(metric: OverallMetricState) {
    if (live.some((award) => award.metricId === metric.id)) { toast('Estorne primeiro os pontos lançados com esta métrica.', 'error'); return; }
    if (!(await confirm({ title: 'Remover métrica?', message: `${metric.name} deixará de aparecer nos novos lançamentos.`, confirmLabel: 'Remover', danger: true }))) return;
    await dispatch({ type: 'ranking/removeMetric', payload: { metricId: metric.id }, audit: { action: 'Métrica do ranking removida', entity: metric.name } });
  }

  function chooseMetric(metricId: string) {
    const metric = state.overallRanking.metrics.find((item) => item.id === metricId);
    setAwardDraft((current) => ({ ...current, metricId, points: String(metric?.defaultPoints ?? current.points) }));
  }

  async function addAward(event: FormEvent) {
    event.preventDefault();
    if (!activeEdition || !awardDraft.teamId || !awardDraft.discipline || !awardDraft.metricId || !Number.isFinite(Number(awardDraft.points))) { toast('Preencha equipe, modalidade, métrica e pontos.', 'error'); return; }
    if (hasAward(state.overallRanking.awards, awardDraft.teamId, awardDraft.discipline, awardDraft.metricId)) { toast('Essa bonificação já foi lançada para a equipe nesta modalidade.', 'error'); return; }
    const rectification = await requireRectification('Lançar pontos no ranking fechado?');
    if (!rectification.ok) return;
    const team = teams.find((item) => item.id === awardDraft.teamId);
    const metric = state.overallRanking.metrics.find((item) => item.id === awardDraft.metricId);
    const award = { id: createId('award'), editionId: activeEdition.id, teamId: awardDraft.teamId, discipline: awardDraft.discipline, metricId: awardDraft.metricId, points: Number(awardDraft.points), note: awardDraft.note.trim(), createdAt: new Date().toISOString(), origin: 'manual' as const };
    await dispatch({ type: 'ranking/addAwards', payload: { awards: [award] }, audit: { action: 'Pontos concedidos no ranking geral', entity: team?.name ?? awardDraft.teamId, after: `${award.points} · ${metric?.name ?? 'Métrica'} · ${award.discipline}`, reason: rectification.reason } });
    setAwardDraft((current) => ({ ...current, teamId: '', note: '' }));
  }

  async function applyAutomatic() {
    if (!activeEdition || !suggestions.length) return;
    if (!(await confirm({ title: 'Lançar pontos automáticos?', message: `${suggestions.length} bonificação(ões) sairão direto dos resultados oficiais das disputas encerradas.`, confirmLabel: 'Lançar' }))) return;
    const rectification = await requireRectification('Lançar automáticos no ranking fechado?');
    if (!rectification.ok) return;
    const created = suggestions.map((item, index) => ({ id: createId('award-auto'), editionId: activeEdition.id, teamId: item.teamId, discipline: item.discipline, metricId: item.metric.id, points: item.points, note: `${positionLabels[item.metric.position!]} · ${item.tournamentName}`, createdAt: new Date().toISOString(), origin: 'automatico' as const }));
    await dispatch({ type: 'ranking/addAwards', payload: { awards: created }, audit: { action: 'Pontos automáticos lançados no ranking geral', entity: `${created.length} bonificações`, after: created.map((item) => `${item.discipline}: ${item.points}`).join(' · '), reason: rectification.reason } });
  }

  /** Estorno preserva o lançamento original com motivo e responsável. */
  async function revokeAward(id: string, teamName: string) {
    const reason = await prompt({ title: 'Estornar pontuação?', message: `O lançamento fica registrado como estornado e o ranking de ${teamName} é recalculado.`, label: 'Motivo do estorno', placeholder: 'Ex.: lançamento em duplicidade', confirmLabel: 'Estornar', minLength: 5, danger: true });
    if (!reason) return;
    await dispatch({ type: 'ranking/revokeAward', payload: { id, revokedAt: new Date().toISOString(), revokedBy: session?.name ?? 'Usuário do app', revokeReason: reason }, audit: { action: 'Pontuação estornada no ranking geral', entity: teamName, reason } });
  }

  async function toggleClosure() {
    if (!activeEdition) return;
    if (closed) {
      const reason = await prompt({ title: 'Reabrir o ranking geral?', message: 'A classificação volta a aceitar lançamentos normais e deixa de ser oficial.', label: 'Motivo da reabertura', placeholder: 'Ex.: recurso em análise', confirmLabel: 'Reabrir', minLength: 5, danger: true });
      if (!reason) return;
      await dispatch({ type: 'ranking/reopen', payload: { editionId: activeEdition.id }, audit: { action: 'Ranking geral reaberto', entity: `Edição ${activeEdition.name}`, reason } });
      return;
    }
    if (!(await confirm({ title: 'Fechar o ranking geral?', message: 'A classificação vira o resultado oficial da edição. Depois disso, toda alteração exige motivo e fica registrada como retificação.', confirmLabel: 'Fechar ranking', danger: true }))) return;
    await dispatch({ type: 'ranking/close', payload: { closure: { editionId: activeEdition.id, at: new Date().toISOString(), actor: session?.name ?? 'Usuário do app' } }, audit: { action: 'Ranking geral fechado', entity: `Edição ${activeEdition.name}`, after: `${ranking[0]?.name ?? 'Sem líder'} em primeiro` } });
  }

  // O ranking geral é da edição inteira: gestor de modalidade não lança nem fecha.
  const canManageRanking = !readOnly && canManageEdition(session);

  return <>
    <section className="section-block overall-ranking-section">
      <SectionTitle eyebrow={`INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`} title="RANKING GERAL" />
      <p className="section-intro">Pontuação acumulada das equipes em todas as modalidades da edição.</p>
      {closed ? <div className="info-banner" role="status"><Lock size={18} /><div><strong>Classificação oficial e fechada</strong><p>Fechada em {new Date(closure!.at).toLocaleString('pt-BR')} por {closure!.actor}. Alterações posteriores aparecem como retificação na auditoria.</p></div></div> : null}
      <div className="overall-ranking-list" aria-label="Classificação geral das equipes">
        {ranking.map((team) => <article className={`overall-ranking-row rank-${team.rank}`} key={team.id}><span className="rank-block">{team.rank}</span><TeamMark initial={team.name[0]} tone={toneOf(team.id)} logo={teams.find((item) => item.id === team.id)?.logo} small /><div><strong>{team.name}</strong><small>{team.disciplines} modalidades · {team.bonuses} bonificações</small></div><b>{team.points}<small>PTS</small></b></article>)}
      </div>
    </section>

    {canManageRanking ? <>
      <section className="section-block ranking-admin-panel">
        <SectionTitle eyebrow="RESULTADOS OFICIAIS" title="PONTOS AUTOMÁTICOS" />
        <p className="form-hint">Métricas com posição declarada saem direto do pódio das disputas encerradas. As demais continuam sendo lançamento manual do admin.</p>
        {suggestions.length ? <>
          <ul className="automatic-award-list">{suggestions.map((item) => <li key={`${item.teamId}-${item.discipline}-${item.metric.id}`}><strong>{item.teamName}</strong><span>{item.discipline} · {item.metric.name}</span><b>{item.points} pts</b></li>)}</ul>
          <button type="button" className="wide-action" onClick={() => void applyAutomatic()}><Sparkles size={18} /> LANÇAR {suggestions.length} BONIFICAÇÃO(ÕES) <span>›</span></button>
        </> : <p className="match-filter-empty">Nenhuma bonificação automática pendente. Encerre as disputas para liberar o pódio.</p>}
      </section>

      <section className="section-block ranking-admin-panel">
        <SectionTitle eyebrow="REGULAMENTO" title="MÉTRICAS DE PONTUAÇÃO" />
        <div className="ranking-metric-list">{state.overallRanking.metrics.map((metric) => <article key={metric.id}><SlidersHorizontal size={18} /><input aria-label={`Nome da métrica ${metric.name}`} value={metric.name} onChange={(event) => updateMetric(metric.id, { name: event.target.value })} /><label><span>Pontos</span><input aria-label={`Pontos de ${metric.name}`} type="number" value={metric.defaultPoints} onChange={(event) => updateMetric(metric.id, { defaultPoints: Number(event.target.value) })} /></label><label><span>Origem</span><select aria-label={`Origem de ${metric.name}`} value={metric.position ?? ''} onChange={(event) => updateMetric(metric.id, { position: (event.target.value || undefined) as OverallPosition | undefined })}><option value="">Manual</option>{Object.entries(positionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" onClick={() => void removeMetric(metric)} aria-label={`Remover métrica ${metric.name}`}><Trash2 size={17} /></button></article>)}</div>
        <form className="ranking-inline-form" onSubmit={addMetric}><input aria-label="Nome da nova métrica" value={metricDraft.name} onChange={(event) => setMetricDraft({ ...metricDraft, name: event.target.value })} placeholder="Ex.: Campeão geral" /><input aria-label="Pontos da nova métrica" type="number" value={metricDraft.points} onChange={(event) => setMetricDraft({ ...metricDraft, points: event.target.value })} /><select aria-label="Origem da nova métrica" value={metricDraft.position} onChange={(event) => setMetricDraft({ ...metricDraft, position: event.target.value as OverallPosition | '' })}><option value="">Manual</option>{Object.entries(positionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><button type="submit"><Plus size={17} /> Adicionar métrica</button></form>
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
        <SectionTitle eyebrow="AUDITORIA" title="LANÇAMENTOS E ESTORNOS" />
        <div className="ranking-award-history">{history.length ? history.map((award) => {
          const team = teams.find((item) => item.id === award.teamId);
          const metric = state.overallRanking.metrics.find((item) => item.id === award.metricId);
          return <article key={award.id} className={award.revokedAt ? 'is-revoked' : ''}>
            <div><strong>{team?.name ?? 'Equipe'}</strong><small>{award.discipline} · {metric?.name ?? 'Métrica'} · {award.origin === 'automatico' ? 'automático' : 'manual'}{award.note ? ` · ${award.note}` : ''}</small>{award.revokedAt ? <small className="revoked-note">Estornado por {award.revokedBy}: {award.revokeReason}</small> : null}</div>
            <b>{award.points} pts</b>
            {award.revokedAt ? <Undo2 size={16} aria-label="Estornada" /> : <button type="button" onClick={() => void revokeAward(award.id, team?.name ?? 'equipe')} aria-label={`Estornar pontuação de ${team?.name ?? 'equipe'}`}><Undo2 size={16} /></button>}
          </article>;
        }) : <p className="match-filter-empty">Nenhuma pontuação geral lançada nesta edição.</p>}</div>
      </section>

      <section className="section-block ranking-admin-panel">
        <SectionTitle eyebrow="OFICIALIZAÇÃO" title="FECHAMENTO DO RANKING" />
        <p className="form-hint">{closed ? 'A classificação geral está oficial. Reabrir exige motivo e fica registrado na auditoria.' : 'Feche o ranking quando todos os resultados estiverem homologados. Depois disso, alterações viram retificações rastreáveis.'}</p>
        <button type="button" className="wide-action" onClick={() => void toggleClosure()}><Lock size={18} /> {closed ? 'REABRIR RANKING GERAL' : 'FECHAR RANKING GERAL'} <span>›</span></button>
      </section>
    </> : null}
  </>;
}
