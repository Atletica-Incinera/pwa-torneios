'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { DisciplineRule, useFrontendState } from '../lib/repositories/browser-repository';
import { defaultDisciplineRules, formatDisciplineRegulation, formatDisciplineRule, resolveDisciplineRule } from '../lib/discipline-rules';
import { RegulationFields } from './RegulationFields';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';

const catalog = ['Futsal', 'Vôlei', 'Handebol', 'Xadrez', 'Natação', 'Basquete'];

export function DisciplineCreationForm() {
  const router = useRouter();
  const { state, dispatch } = useFrontendState();
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'Coletiva' | 'Individual'>('Coletiva');
  const [rule, setRule] = useState<DisciplineRule>(resolveDisciplineRule('Futsal'));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(name) && !submitting);

  function updateRule<K extends keyof DisciplineRule>(key: K, value: DisciplineRule[K]) {
    setRule((current) => ({ ...current, [key]: value }));
    setError('');
  }

  function changeName(value: string) {
    setName(value);
    setRule({ ...resolveDisciplineRule(value) });
    setMode(['Xadrez', 'Natação'].includes(value) ? 'Individual' : 'Coletiva');
    setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!name || rule.periodCount < 1 || (rule.clockMode !== 'none' && rule.periodDurationMinutes < 1) || !rule.scoring?.length) {
      setError('Defina modalidade, estrutura de tempo e ao menos uma ação de placar.');
      return;
    }
    const exists = Boolean(state.disciplines[name]);
    if (exists && state.disciplines[name]?.enabled !== false) {
      setError('Esta modalidade já está habilitada na edição.');
      return;
    }
    const normalizedRule: DisciplineRule = {
      ...rule,
      periodLabel: rule.periodLabel.trim(),
      scoringEvent: rule.scoring?.[0]?.label.trim() ?? rule.scoringEvent.trim(),
      secondaryEvents: [rule.secondary?.[0]?.label.trim() ?? '', rule.secondary?.[1]?.label.trim() ?? ''],
    };
    const config = formatDisciplineRegulation(name, normalizedRule);
    setSubmitting(true);
    const saved = await dispatch({
      type: 'discipline/update',
      payload: {
        name,
        patch: {
          name,
          mode,
          config,
          rules: normalizedRule,
          enabled: true,
          created: !exists,
          tournaments: 0,
          tone: 'blue',
        },
      },
      audit: { action: 'Modalidade adicionada à edição', entity: name, after: config },
    });
    if (saved.ok) router.push(`/disciplines/${encodeURIComponent(name.toLowerCase())}`);
    else setSubmitting(false);
  }

  const defaultHint = name && defaultDisciplineRules[name] ? 'Sugestão inicial aplicada; ajuste conforme o regulamento do InterEng.' : 'Defina a regra oficial antes de criar partidas.';

  return (
    <AppShell active="profile" eyebrow="INTERENG 2026" title="ADICIONAR MODALIDADE" subtitle="Defina as regras que serão aplicadas automaticamente aos jogos">
      <form className="entity-form discipline-rule-form" onSubmit={(event) => void submit(event)} noValidate>
        <label><span>Modalidade do catálogo</span><select value={name} onChange={(event) => changeName(event.target.value)} required><option value="">Selecione</option>{catalog.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Tipo</span><select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option>Coletiva</option><option>Individual</option></select></label>
        <div className="form-contract-note"><p><strong>{formatDisciplineRule(rule)}</strong><br />{defaultHint}</p></div>
        <label><span>Funcionamento do relógio</span><select value={rule.clockMode} onChange={(event) => updateRule('clockMode', event.target.value as DisciplineRule['clockMode'])}><option value="countdown">Regressivo</option><option value="progressive">Progressivo</option><option value="none">Sem cronômetro</option></select></label>
        <div className="rule-fields">
          <label><span>Nome da etapa</span><input value={rule.periodLabel} onChange={(event) => updateRule('periodLabel', event.target.value)} placeholder="Tempo, período ou set" required /></label>
          <label><span>Quantidade de etapas</span><input type="number" min="1" max="20" value={rule.periodCount} onChange={(event) => updateRule('periodCount', Math.max(1, Number(event.target.value)))} required /></label>
          {rule.clockMode !== 'none' ? <label><span>Minutos por etapa</span><input type="number" min="1" max="180" value={rule.periodDurationMinutes} onChange={(event) => updateRule('periodDurationMinutes', Math.max(1, Number(event.target.value)))} required /></label> : null}
        </div>
        {name ? <RegulationFields discipline={name} rule={rule} onChange={setRule} /> : null}
        {error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}
        <div className="form-actions"><Link href="/disciplines" className="secondary-button">Cancelar</Link><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Adicionando…' : 'Salvar modalidade'}</button></div>
      </form>
    </AppShell>
  );
}
