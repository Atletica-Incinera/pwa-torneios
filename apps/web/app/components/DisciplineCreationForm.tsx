'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from './AppShell';
import { disciplines } from '../lib/repositories/catalog-repository';
import { DisciplineRule, useFrontendState } from '../lib/repositories/browser-repository';
import { defaultDisciplineRules, formatDisciplineRule, resolveDisciplineRule } from '../lib/discipline-rules';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';

const catalog = ['Futsal', 'Vôlei', 'Handebol', 'Xadrez', 'Natação', 'Basquete'];

export function DisciplineCreationForm() {
  const router = useRouter();
  const { state, commit } = useFrontendState();
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

  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!name || rule.periodCount < 1 || (rule.clockMode !== 'none' && rule.periodDurationMinutes < 1) || !rule.scoringEvent.trim() || rule.secondaryEvents.some((item) => !item.trim())) {
      setError('Defina modalidade, estrutura de tempo e eventos da partida.');
      return;
    }
    const exists = disciplines.some((item) => item.name === name) || state.disciplines[name]?.created;
    if (exists && state.disciplines[name]?.enabled !== false) {
      setError('Esta modalidade já está habilitada na edição.');
      return;
    }
    const normalizedRule: DisciplineRule = {
      ...rule,
      periodLabel: rule.periodLabel.trim(),
      scoringEvent: rule.scoringEvent.trim(),
      secondaryEvents: [rule.secondaryEvents[0].trim(), rule.secondaryEvents[1].trim()],
    };
    const config = formatDisciplineRule(normalizedRule);
    setSubmitting(true);
    const saved = commit((current) => ({
      ...current,
      disciplines: {
        ...current.disciplines,
        [name]: {
          ...current.disciplines[name],
          name,
          mode,
          config,
          rules: normalizedRule,
          enabled: true,
          created: !disciplines.some((item) => item.name === name),
          tournaments: 0,
          tone: 'blue',
        },
      },
    }), { action: 'Modalidade adicionada à edição', entity: name, after: config });
    if (saved) router.push(`/disciplines/${encodeURIComponent(name.toLowerCase())}`);
    else setSubmitting(false);
  }

  const defaultHint = name && defaultDisciplineRules[name] ? 'Sugestão inicial aplicada; ajuste conforme o regulamento do InterEng.' : 'Defina a regra oficial antes de criar partidas.';

  return (
    <AppShell active="profile" eyebrow="INTERENG 2026" title="ADICIONAR MODALIDADE" subtitle="Defina as regras que serão aplicadas automaticamente aos jogos">
      <form className="entity-form discipline-rule-form" onSubmit={submit} noValidate>
        <label><span>Modalidade do catálogo</span><select value={name} onChange={(event) => changeName(event.target.value)} required><option value="">Selecione</option>{catalog.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Tipo</span><select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}><option>Coletiva</option><option>Individual</option></select></label>
        <div className="form-contract-note"><p><strong>{formatDisciplineRule(rule)}</strong><br />{defaultHint}</p></div>
        <label><span>Funcionamento do relógio</span><select value={rule.clockMode} onChange={(event) => updateRule('clockMode', event.target.value as DisciplineRule['clockMode'])}><option value="countdown">Regressivo</option><option value="progressive">Progressivo</option><option value="none">Sem cronômetro</option></select></label>
        <div className="rule-fields">
          <label><span>Nome da etapa</span><input value={rule.periodLabel} onChange={(event) => updateRule('periodLabel', event.target.value)} placeholder="Tempo, período ou set" required /></label>
          <label><span>Quantidade de etapas</span><input type="number" min="1" max="20" value={rule.periodCount} onChange={(event) => updateRule('periodCount', Math.max(1, Number(event.target.value)))} required /></label>
          {rule.clockMode !== 'none' ? <label><span>Minutos por etapa</span><input type="number" min="1" max="180" value={rule.periodDurationMinutes} onChange={(event) => updateRule('periodDurationMinutes', Math.max(1, Number(event.target.value)))} required /></label> : null}
        </div>
        <label><span>Ação que altera o placar</span><input value={rule.scoringEvent} onChange={(event) => updateRule('scoringEvent', event.target.value)} placeholder="Gol, ponto..." required /></label>
        <div className="rule-fields two-columns">
          <label><span>Evento rápido 1</span><input value={rule.secondaryEvents[0]} onChange={(event) => updateRule('secondaryEvents', [event.target.value, rule.secondaryEvents[1]])} placeholder="Falta" required /></label>
          <label><span>Evento rápido 2</span><input value={rule.secondaryEvents[1]} onChange={(event) => updateRule('secondaryEvents', [rule.secondaryEvents[0], event.target.value])} placeholder="Cartão" required /></label>
        </div>
        {error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}
        <div className="form-actions"><Link href="/disciplines" className="secondary-button">Cancelar</Link><button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Adicionando…' : 'Salvar modalidade'}</button></div>
      </form>
    </AppShell>
  );
}
