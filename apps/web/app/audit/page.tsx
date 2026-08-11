'use client';

import { Filter, History, Radio, Shield, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AppShell, EmptyState, SectionTitle, StatusBadge } from '../components/AppShell';
import { AuditState, useFrontendState } from '../lib/repositories/browser-repository';


function categoryOf(log: AuditState) {
  return /placar|partida|jogo|confronto/i.test(`${log.action} ${log.entity}`) ? 'Partidas' : 'Cadastros';
}

export default function AuditPage() {
  const { state } = useFrontendState();
  const [filter, setFilter] = useState<'Tudo' | 'Partidas' | 'Cadastros'>('Tudo');
  // A auditoria nunca mostra exemplo: um registro inventado aqui seria lido
  // como alteração real, com nome de pessoa e placar que nunca existiram.
  const logs = state.audit;
  const visibleLogs = useMemo(() => filter === 'Tudo' ? logs : logs.filter((log) => categoryOf(log) === filter), [filter, logs]);

  return <AppShell active="profile" eyebrow="SEGURANÇA" title="AUDITORIA" subtitle="Histórico real das alterações da edição">
    <div className="filter-strip">{(['Tudo', 'Partidas', 'Cadastros'] as const).map((item) => <button type="button" key={item} className={`filter-chip${filter === item ? ' active' : ''}`} onClick={() => setFilter(item)}>{item}</button>)}<button type="button" className="filter-icon" onClick={() => setFilter('Tudo')} aria-label="Limpar filtros"><Filter size={18} /></button></div>
    <section className="section-block no-top"><SectionTitle eyebrow="ATIVIDADE" title="ALTERAÇÕES" /><div className="audit-list">
      {visibleLogs.map((log) => {
        const category = categoryOf(log);
        const Icon = category === 'Partidas' ? Radio : /torneio|disputa|fase/i.test(log.action) ? Trophy : Shield;
        const tone = category === 'Partidas' ? 'orange' : /torneio|disputa|fase/i.test(log.action) ? 'pink' : 'blue';
        const date = new Date(log.at);
        return <details key={log.id}><summary><span className={`audit-icon audit-${tone}`}><Icon size={20} /></span><div><span><time>{Number.isNaN(date.getTime()) ? '--:--' : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time><StatusBadge tone={tone}>{log.action}</StatusBadge></span><strong>{log.actor}</strong><p>{log.entity}</p><small>Ver dados anteriores e posteriores</small></div></summary><div className="audit-diff"><span><small>ANTES</small><strong>{log.before || '—'}</strong></span><span><small>DEPOIS</small><strong>{log.after || '—'}</strong></span>{log.reason ? <span className="audit-reason"><small>MOTIVO</small><strong>{log.reason}</strong></span> : null}</div></details>;
      })}
    </div>{!visibleLogs.length ? <EmptyState title="SEM REGISTROS" copy={logs.length ? "Não há atividade para este filtro." : "As alterações feitas no app aparecem aqui, com quem fez, o que mudou e o motivo."} /> : null}</section>
    <div className="info-banner"><History size={19} /><p>{logs.length ? `${logs.length} ${logs.length === 1 ? 'registro' : 'registros'} nesta sessão.` : 'Nenhuma alteração registrada ainda.'} Alterações sensíveis preservam os dados anteriores, os posteriores e o motivo.</p></div>
  </AppShell>;
}
