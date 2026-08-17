import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seededFrontendState, type FrontendState } from '@atletica-incinera/intereng-contract/state';
import type { Action } from '@atletica-incinera/intereng-contract/actions';
import type { StateAdapter } from '../../app/lib/repositories/state-adapter';
import { hasAuditTrail, hasOverallRanking } from '../../app/lib/source-capabilities';

// A moldura administrativa pede o roteador e o caminho atual, que só existem
// dentro do App Router.
vi.mock('next/navigation', () => ({ usePathname: () => '/standings', useRouter: () => ({ push: () => {}, replace: () => {} }) }));

const sessaoDoDev = { email: 'dev@intereng.app', name: 'Dev', role: 'SUPER_ADMIN' as const, expiresAt: '2099-01-01T00:00:00.000Z' };

/**
 * Só a sessão é trocada; os predicados de autorização continuam sendo os de
 * verdade. O assunto aqui é a origem dos dados, não o papel de quem entrou —
 * e substituir o módulo inteiro faria o teste quebrar a cada acesso novo que
 * a moldura passasse a consultar.
 */
vi.mock('../../app/lib/frontend-session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../app/lib/frontend-session')>()),
  useFrontendSession: () => ({ session: sessaoDoDev, hydrated: true, expired: false, logout: () => {} }),
}));

const { FrontendStateProvider } = await import('../../app/lib/repositories/frontend-state-provider');
const { UiProvider } = await import('../../app/components/UiProvider');
const MorePage = (await import('../../app/more/page')).default;
const OverallStandingsPage = (await import('../../app/standings/page')).default;
const AuditPage = (await import('../../app/audit/page')).default;
const { TeamPerformance } = await import('../../app/components/TeamPerformance');
const PublicOverallStandingsPage = (await import('../../app/public/standings/general/page')).default;
const PublicCategoriesPage = (await import('../../app/public/tournaments/page')).default;

function adaptadorDe(state: FrontendState): StateAdapter {
  return { load: async () => state, apply: async (_action: Action) => state, subscribe: () => () => {} };
}

async function montar(state: FrontendState, children: React.ReactNode) {
  render(<UiProvider><FrontendStateProvider adapter={adaptadorDe(state)}>{children}</FrontendStateProvider></UiProvider>);
  // A moldura só entrega o conteúdo depois que o estado chega.
  await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
}

const comRegistro: FrontendState = {
  ...seededFrontendState,
  audit: [{ id: 'log-1', at: '2026-10-13T20:15:00.000Z', actor: 'Ana Coordenadora', action: 'Equipe cadastrada', entity: 'Aurora' }],
};

beforeEach(() => { window.localStorage.clear(); });
afterEach(() => { delete process.env.NEXT_PUBLIC_DATA_SOURCE; });

describe('o que a origem dos dados tem', () => {
  it('a origem local tem ranking geral e auditoria, porque roda o pacote de regras inteiro', () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'local';
    expect(hasOverallRanking()).toBe(true);
    expect(hasAuditTrail()).toBe(true);
  });

  it('a API não tem nenhum dos dois', () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'http';
    expect(hasOverallRanking()).toBe(false);
    expect(hasAuditTrail()).toBe(false);
  });
});

describe('ranking geral em modo http', () => {
  it('o hub de gestão deixa de oferecer a classificação geral', async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'http';
    await montar(seededFrontendState, <MorePage />);
    expect(screen.queryByRole('link', { name: /classificação geral/i })).toBeNull();
    // Os outros módulos continuam onde estavam: some o que não existe, não o resto.
    expect(screen.getByRole('link', { name: /staff e permissões/i })).toBeInTheDocument();
  });

  it('o hub de gestão continua oferecendo a classificação geral em modo local', async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'local';
    await montar(seededFrontendState, <MorePage />);
    expect(screen.getByRole('link', { name: /classificação geral/i })).toBeInTheDocument();
  });

  it('quem chega pela URL direta recebe a recusa em voz alta, e não o painel de premiação', async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'http';
    await montar(seededFrontendState, <OverallStandingsPage />);
    expect(screen.getByText('SEM RANKING GERAL')).toBeInTheDocument();
    // O painel tem formulário de métrica e histórico de lançamentos: nenhum dos
    // dois pode aparecer, porque toda escrita deles morre no adaptador.
    expect(screen.queryByText('LANÇAMENTOS E ESTORNOS')).toBeNull();
  });

  it('a mesma URL em modo local abre o painel de sempre', async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'local';
    await montar(seededFrontendState, <OverallStandingsPage />);
    expect(screen.queryByText('SEM RANKING GERAL')).toBeNull();
    expect(screen.getByText('LANÇAMENTOS E ESTORNOS')).toBeInTheDocument();
  });

  it('a faixa de posição geral some do desempenho da equipe em vez de dizer "sem posição"', async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'http';
    await montar(seededFrontendState, <TeamPerformance teamId="alcateia" teamName="Alcateia" />);
    expect(screen.queryByText('Ranking geral do InterEng')).toBeNull();
    // O desempenho por categoria continua: ele vem das partidas, que a API tem.
    expect(screen.getByText('CLASSIFICAÇÕES')).toBeInTheDocument();
  });

  it('a área pública também responde a URL direta, com a mesma recusa', async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'http';
    await montar(seededFrontendState, <PublicOverallStandingsPage />);
    expect(screen.getByText('SEM RANKING GERAL')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver modalidades/i })).toBeInTheDocument();
  });

  it('o espectador deixa de ver o atalho para o ranking na lista de modalidades', async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'http';
    await montar(seededFrontendState, <PublicCategoriesPage />);
    expect(screen.queryByRole('link', { name: /classificação geral do intereng/i })).toBeNull();
  });

  it('a faixa de posição geral continua em modo local', async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'local';
    await montar(seededFrontendState, <TeamPerformance teamId="alcateia" teamName="Alcateia" />);
    expect(screen.getByText('Ranking geral do InterEng')).toBeInTheDocument();
  });
});

describe('auditoria em modo http', () => {
  it('a tela diz que o servidor não publica o histórico, em vez de mostrar lista vazia', async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'http';
    await montar(comRegistro, <AuditPage />);
    expect(screen.getByText('HISTÓRICO NÃO PUBLICADO')).toBeInTheDocument();
    expect(screen.queryByText('SEM REGISTROS')).toBeNull();
    // Filtrar o que não existe é convite a achar que o filtro escondeu algo.
    expect(screen.queryByRole('button', { name: 'Partidas' })).toBeNull();
  });

  it('em modo local a tela continua listando o que o estado registrou', async () => {
    process.env.NEXT_PUBLIC_DATA_SOURCE = 'local';
    await montar(comRegistro, <AuditPage />);
    expect(screen.queryByText('HISTÓRICO NÃO PUBLICADO')).toBeNull();
    expect(screen.getByText('Ana Coordenadora')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Partidas' })).toBeInTheDocument();
  });
});
