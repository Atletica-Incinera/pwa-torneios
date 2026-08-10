'use client';

import { Clock3, Goal, Layers3, Settings2, Trophy, Users } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { DisciplineRule, useFrontendState } from '../lib/repositories/browser-repository';
import { formatDisciplineRule, resolveDisciplineRule } from '../lib/discipline-rules';
import { useUi } from './UiProvider';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';

export function DisciplineManager({ name, mode, initialConfig, tournaments }: { name: string; mode: string; initialConfig: string; tournaments: number }) {
  const { state, commit } = useFrontendState();
  const { confirm } = useUi();
  const stored = state.disciplines[name] ?? {};
  const enabled = stored.enabled !== false;
  const rule = resolveDisciplineRule(name, stored);
  const config = stored.config ?? initialConfig ?? formatDisciplineRule(rule);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DisciplineRule>(rule);
  useUnsavedChanges(editing && JSON.stringify(draft) !== JSON.stringify(rule));

  function updateRule<K extends keyof DisciplineRule>(key: K, value: DisciplineRule[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save(event: FormEvent) {
    event.preventDefault();
    const normalized: DisciplineRule = {
      ...draft,
      periodCount: Math.max(1, draft.periodCount),
      periodDurationMinutes: draft.clockMode === 'none' ? 0 : Math.max(1, draft.periodDurationMinutes),
      periodLabel: draft.periodLabel.trim() || 'Tempo',
      scoringEvent: draft.scoringEvent.trim() || 'Ponto',
      secondaryEvents: [draft.secondaryEvents[0].trim() || 'Falta', draft.secondaryEvents[1].trim() || 'Ocorrência'],
    };
    const nextConfig = formatDisciplineRule(normalized);
    commit((current) => ({ ...current, disciplines: { ...current.disciplines, [name]: { ...current.disciplines[name], config: nextConfig, rules: normalized, enabled: true } } }), { action: 'Regras da modalidade alteradas', entity: name, before: config, after: nextConfig });
    setEditing(false);
  }

  async function toggleEnabled() {
    const next = !enabled;
    if (!next && !(await confirm({ title: 'Remover modalidade?', message: 'Ela ficará indisponível em novos jogos, mas partidas já criadas preservarão as regras originais.', confirmLabel: 'Remover', danger: true }))) return;
    commit((current) => ({ ...current, disciplines: { ...current.disciplines, [name]: { ...current.disciplines[name], config, rules: rule, enabled: next } } }), { action: next ? 'Modalidade restaurada' : 'Modalidade removida da edição', entity: name, before: enabled ? 'Habilitada' : 'Removida', after: next ? 'Habilitada' : 'Removida' });
  }

  return <>
    <div className="config-grid discipline-rule-summary">
      <div><Clock3 size={22} /><span><small>Estrutura</small><strong>{formatDisciplineRule(rule)}</strong></span></div>
      <div><Layers3 size={22} /><span><small>Etapa</small><strong>{rule.periodCount} {rule.periodCount === 1 ? rule.periodLabel : `${rule.periodLabel}s`}</strong></span></div>
      <div><Goal size={22} /><span><small>Pontuação</small><strong>{rule.scoringEvent}</strong></span></div>
      <div><Settings2 size={22} /><span><small>Eventos rápidos</small><strong>{rule.secondaryEvents.join(' · ')}</strong></span></div>
      <div><Users size={22} /><span><small>Tipo</small><strong>{mode}</strong></span></div>
      <div><Trophy size={22} /><span><small>Disputas</small><strong>{tournaments} configuradas</strong></span></div>
    </div>
    {editing ? <form className="entity-form inline-config-form discipline-rule-form" onSubmit={save}>
      <div className="form-contract-note"><p>Novos jogos receberão estas regras. Jogos já criados mantêm a configuração com que foram agendados.</p></div>
      <label><span>Funcionamento do relógio</span><select value={draft.clockMode} onChange={(event) => updateRule('clockMode', event.target.value as DisciplineRule['clockMode'])}><option value="countdown">Regressivo</option><option value="progressive">Progressivo</option><option value="none">Sem cronômetro</option></select></label>
      <div className="rule-fields">
        <label><span>Nome da etapa</span><input value={draft.periodLabel} onChange={(event) => updateRule('periodLabel', event.target.value)} /></label>
        <label><span>Quantidade</span><input type="number" min="1" max="20" value={draft.periodCount} onChange={(event) => updateRule('periodCount', Math.max(1, Number(event.target.value)))} /></label>
        {draft.clockMode !== 'none' ? <label><span>Minutos por etapa</span><input type="number" min="1" max="180" value={draft.periodDurationMinutes} onChange={(event) => updateRule('periodDurationMinutes', Math.max(1, Number(event.target.value)))} /></label> : null}
      </div>
      <label><span>Ação que altera o placar</span><input value={draft.scoringEvent} onChange={(event) => updateRule('scoringEvent', event.target.value)} /></label>
      <div className="rule-fields two-columns"><label><span>Evento rápido 1</span><input value={draft.secondaryEvents[0]} onChange={(event) => updateRule('secondaryEvents', [event.target.value, draft.secondaryEvents[1]])} /></label><label><span>Evento rápido 2</span><input value={draft.secondaryEvents[1]} onChange={(event) => updateRule('secondaryEvents', [draft.secondaryEvents[0], event.target.value])} /></label></div>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancelar</button><button type="submit" className="primary-button">Salvar regras</button></div>
    </form> : <div className="form-actions"><button type="button" className="secondary-button" onClick={toggleEnabled}>{enabled ? 'Remover da edição' : 'Restaurar modalidade'}</button>{enabled ? <button type="button" className="primary-button" onClick={() => { setDraft(rule); setEditing(true); }}>Editar regras</button> : null}</div>}
  </>;
}
