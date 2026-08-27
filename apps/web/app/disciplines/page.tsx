'use client';

import Link from 'next/link';
import { ChevronRight, ListOrdered, Plus, Users } from 'lucide-react';
import { AppShell, StatusBadge } from '../components/AppShell';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { disciplineHref, listDisciplines } from '../lib/edition-catalog';
import { canManageDiscipline, canManageEdition, useFrontendSession } from '../lib/frontend-session';

export default function DisciplinesPage() {
  const { state } = useFrontendState();
  const { session } = useFrontendSession();
  const activeEdition = getActiveEdition(state);
  // O gestor de modalidade só enxerga a modalidade do seu escopo.
  const disciplines = listDisciplines(state, activeEdition?.id).filter((item) => canManageDiscipline(session, item.name));
  const enabled = disciplines.filter((item) => item.enabled);
  // Modalidade desativada sai da lista principal. Antes ficava no meio das
  // ativas com uma tarja "REMOVIDA" — a tela anunciava as modalidades da
  // edicao e mostrava justamente as que nao sao. O grupo recolhido abaixo e o
  // caminho para reativar, que so existe entrando na modalidade.
  const desativadas = disciplines.filter((item) => !item.enabled);

  return (
    <AppShell
      active="tournaments"
      eyebrow={`INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`}
      title="MODALIDADES"
      subtitle={`${enabled.length} modalidades habilitadas · ${enabled.reduce((total, item) => total + item.categories.length, 0)} categorias`}
      actionHref={canManageEdition(session) ? "/disciplines/new" : undefined}
      actionLabel="Adicionar modalidade à edição"
      actionShortLabel="Modalidade"
    >
      <Link href="/standings" className="wide-action ranking-entry-action"><ListOrdered size={18} /> CLASSIFICAÇÃO GERAL <span>›</span></Link>
      {/* Segundo item da barra inferior e primeiro passo depois de criar a
          competição: chegar aqui num branco absoluto quebrava a cadeia logo no
          começo. O gestor de modalidade cai no mesmo vazio por outro motivo — a
          modalidade do escopo dele ainda não foi habilitada — e precisa de outra
          explicação, não de um convite que ele não pode aceitar. */}
      {!enabled.length ? <div className="empty-state">
        <strong>NENHUMA MODALIDADE HABILITADA</strong>
        <p>{canManageEdition(session)
          ? 'Adicione a primeira modalidade e o regulamento dela para liberar categorias, inscrições e jogos.'
          : session?.role === 'DISCIPLINE_MANAGER'
            ? `A modalidade do seu escopo (${session.scope}) ainda não foi habilitada nesta edição. Fale com o administrador da edição.`
            : 'Nenhuma modalidade foi habilitada nesta edição ainda. Aguarde o administrador da edição.'}</p>
        {canManageEdition(session) ? <Link href="/disciplines/new" className="secondary-button"><Plus size={16} aria-hidden="true" /> Adicionar primeira modalidade</Link> : null}
      </div> : null}
      <section className="poster-list">
        {enabled.map((discipline, index) => (
          <Link href={disciplineHref(discipline.name)} className={`discipline-card accent-${discipline.tone}`} key={discipline.name}>
            <span className="discipline-index">{String(index + 1).padStart(2, '0')}</span>
            <div>
              <StatusBadge tone={discipline.tone}>{discipline.mode}</StatusBadge>
              <h2>{discipline.name}</h2>
              <p>{discipline.config}</p>
              <small><Users size={14} /> {discipline.categories.length} {discipline.categories.length === 1 ? 'categoria' : 'categorias'}</small>
            </div>
            <ChevronRight size={22} />
          </Link>
        ))}
      </section>
      {desativadas.length ? <details className="grupo-inativos">
        <summary>Desativadas ({desativadas.length})</summary>
        <section className="poster-list">
          {desativadas.map((discipline) => (
            <Link href={disciplineHref(discipline.name)} className="discipline-card accent-neutral is-disabled" key={discipline.name}>
              <div>
                <StatusBadge tone="neutral">Desativada</StatusBadge>
                <h2>{discipline.name}</h2>
                <p>Abra para reativar ou excluir de vez.</p>
                <small><Users size={14} /> {discipline.categories.length} {discipline.categories.length === 1 ? 'categoria' : 'categorias'}</small>
              </div>
              <ChevronRight size={22} />
            </Link>
          ))}
        </section>
      </details> : null}
    </AppShell>
  );
}
