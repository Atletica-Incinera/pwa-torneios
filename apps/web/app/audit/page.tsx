'use client';

import { Filter, History, Radio, Shield, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppShell, EmptyState, SectionTitle, StatusBadge } from '../components/AppShell';
import { AuditState, useFrontendState } from '../lib/frontend-state';

const exampleLogs: AuditState[] = [
  { id: 'example-1', at: '2026-10-13T14:34:00', actor: 'Bruno Martins', action: 'Placar atualizado', entity: 'Alcateia 2 × 1 Cangaceiros', before: '1 × 1', after: '2 × 1' },
  { id: 'example-2', at: '2026-10-13T13:10:00', actor: 'Ana Coordenadora', action: 'Equipe inscrita', entity: 'Alcateia · Futsal Masculino', before: 'Não inscrita', after: 'Inscrita' },
];

function categoryOf(log: AuditState) {
  return /placar|partida|jogo|confronto/i.test(`${log.action} ${log.entity}`) ? 'Partidas' : 'Cadastros';
}

export default function AuditPage() {
  const { state } = useFrontendState();
  const [filter, setFilter] = useState<'Tudo' | 'Partidas' | 'Cadastros'>('Tudo');
  const logs = state.audit.length ? state.audit : exampleLogs;
  const visibleLogs = useMemo(() => filter === 'Tudo' ? logs : logs.filter((log) => categoryOf(log) === filter), [filter, logs]);

  return <AppShell active="profile" eyebrow="SEGURANÇA" title="AUDITORIA" subtitle="Histórico real das alterações da edição">
    <div className="filter-strip">{(['Tudo', 'Partidas', 'Cadastros'] as const).map((item) => <button type="button" key={item} className={`filter-chip${filter === item ? ' active' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}<button type="button" className="filter-icon" onClick={() => setFilter('Tudo')} aria-label="Limpar filtros"><Filter size={18} /></button></div>
    <section className="section-block no-top"><SectionTitle eyebrow="ATIVIDADE" title="ALTERAÇÕES" /><div className="audit-list">
      {visibleLogs.map((log) => {
        const category = categoryOf(log);
        const Icon = category === 'Partidas' ? Radio : /torneio|fase/i.test(log.action) ? Trophy : Shield;
        const tone = category === 'Partidas' ? 'orange' : /torneio|fase/i.test(log.action) ? 'pink' : 'blue';
        const date = new Date(log.at);
        return <details key={log.id}><summary><span className={`audit-icon audit-${tone}`}><Icon size={20} /></span><div><span><time>{Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time><StatusBadge tone={tone}>{log.action}</StatusBadge></span><strong>{log.actor}</strong><p>{log.entity}</p><small>Ver dados anteriores e posteriores</small></div></summary><div className="audit-diff"><span><small>ANTES</small><strong>{log.before || '—'}</strong></span><span><small>DEPOIS</small><strong>{log.after || '—'}</strong></span></div></details>;
      })}
    </div>{!visibleLogs.length ? <EmptyState title="SEM REGISTROS" copy="Não há atividade para este filtro." /> : null}</section>
    <div className="info-banner"><History size={19} /><p>{logs.length} registros disponíveis. Alterações sensíveis preservam os dados anteriores e posteriores.</p></div>
  </AppShell>;
}
