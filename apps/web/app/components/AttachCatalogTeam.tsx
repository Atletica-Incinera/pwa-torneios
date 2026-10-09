'use client';

import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { apiRequest } from '../lib/repositories/api-client';
import { readSessionToken } from '../lib/repositories/session-storage';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { casaComBusca } from '../lib/busca';
import { useUi } from './UiProvider';

type CatalogTeam = {
  id: string;
  name: string;
  initials: string | null;
  archived: boolean;
};

// O interceptor de paginação da API expõe os itens diretamente em `data` e o
// metadado na chave externa `meta`. Manter o formato com `items` também deixa
// o componente compatível com o contrato antigo durante a transição.
type CatalogResponse = CatalogTeam[] | { items?: CatalogTeam[] };

/**
 * O snapshot de uma edição traz apenas suas participantes. Este seletor consulta
 * o catálogo global separadamente e cria somente o vínculo `EditionTeam`.
 */
export function AttachCatalogTeam({ linkedIds }: { linkedIds: string[] }) {
  const { dispatch, source } = useFrontendState();
  const { toast } = useUi();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attachingId, setAttachingId] = useState<string | null>(null);
  const [teams, setTeams] = useState<CatalogTeam[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const available = useMemo(() => teams.filter((team) => !team.archived && !linkedIds.includes(team.id)
    && casaComBusca(query, [team.name, team.initials ?? ''])), [linkedIds, query, teams]);

  if (source !== 'http') return null;

  async function showCatalog() {
    setOpen(true);
    setError('');
    if (teams.length) return;
    setLoading(true);
    try {
      const response = await apiRequest<CatalogResponse>({
        path: '/teams?page=1&pageSize=100',
        token: readSessionToken(),
      });
      setTeams(Array.isArray(response) ? response : response.items ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar o catálogo.');
    } finally {
      setLoading(false);
    }
  }

  async function attach(team: CatalogTeam) {
    setAttachingId(team.id);
    const result = await dispatch({
      type: 'team/attach',
      payload: { id: team.id },
      audit: { action: 'Equipe adicionada à edição', entity: team.name, after: 'Ativa' },
    });
    setAttachingId(null);
    if (result.ok) {
      toast(`${team.name} foi adicionada a esta edição.`, 'success');
      setOpen(false);
    }
  }

  return <section className="section-block catalog-team-attach">
    <button type="button" className="wide-action button-reset" onClick={() => void showCatalog()} aria-expanded={open}>
      + ADICIONAR EQUIPE DO CATÁLOGO <span aria-hidden="true">›</span>
    </button>
    {open ? <div className="entity-form inline-management-form">
      <label className="search-field cut-field"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar no catálogo global" aria-label="Buscar equipe no catálogo global" /></label>
      {loading ? <p className="form-hint">Carregando catálogo…</p> : null}
      {error ? <p className="form-feedback form-feedback-error" role="alert">{error}</p> : null}
      {!loading && !error ? <div className="stack-list" aria-label="Equipes disponíveis no catálogo">
        {available.map((team) => <article className="list-row" key={team.id}>
          <span><strong>{team.name}</strong><small>{team.initials ?? 'Sem sigla'}</small></span>
          <button type="button" className="secondary-button" disabled={attachingId !== null} onClick={() => void attach(team)}>{attachingId === team.id ? 'Adicionando…' : 'Adicionar'}</button>
        </article>)}
        {!available.length ? <p className="form-hint">Nenhuma equipe disponível com esse filtro.</p> : null}
      </div> : null}
    </div> : null}
  </section>;
}
