'use client';

import { Archive, Pencil, Save } from 'lucide-react';
import { ChangeEvent, FormEvent, useState } from 'react';
import { TeamMark } from './AppShell';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { useUi } from './UiProvider';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';
import { optimizeImageFile, type OptimizedImage } from '../lib/image-utils';
import { canManageEdition, useFrontendSession } from '../lib/frontend-session';
import { athletesOfTeam, type TeamView } from '../lib/edition-catalog';
import { uploadTeamLogo } from '../lib/repositories/logo-upload';

const MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024;

export function TeamManager({ team, readOnly = false }: { team: TeamView; readOnly?: boolean }) {
  const { state, dispatch, source } = useFrontendState();
  const { confirm, toast } = useUi();
  const { session } = useFrontendSession();
  const current = {
    name: team.name,
    initials: team.initials,
    responsible: team.responsible,
    logo: team.logo,
    archived: team.archived,
  };
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [pendingLogo, setPendingLogo] = useState<OptimizedImage | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const rosterSize = athletesOfTeam(state, team.id).length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(current);
  const allowed = canManageEdition(session);
  useUnsavedChanges(editing && dirty && !submitting);

  async function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      setError('A imagem deve ter no máximo 8 MB.');
      return;
    }
    try {
      const optimized = await optimizeImageFile(file);
      setPendingLogo(optimized);
      setDraft((value) => ({ ...value, logo: optimized.previewUrl }));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível processar a imagem.');
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (submitting || !dirty) return;
    if (draft.name.trim().length < 2 || draft.initials.trim().length < 2) {
      setError('Informe nome e sigla válidos.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const logo = pendingLogo
        ? source === 'http'
          ? await uploadTeamLogo(team.id, pendingLogo.blob)
          : pendingLogo.previewUrl
        : undefined;
      const saved = await dispatch({
        type: 'team/update',
        payload: {
          id: team.id,
          patch: {
            name: draft.name.trim(),
            initials: draft.initials.trim().toUpperCase(),
            responsible: draft.responsible,
            archived: draft.archived,
            ...(logo ? { logo } : {}),
          },
        },
        audit: {
          action: 'Equipe alterada',
          entity: current.name,
          before: current.name,
          after: draft.name,
        },
      });
      if (saved.ok) {
        setPendingLogo(null);
        setEditing(false);
      } else if (saved.error) {
        setError(saved.error);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível salvar a equipe.');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleArchive() {
    const archived = !current.archived;
    if (
      archived &&
      !(await confirm({
        title: 'Arquivar equipe?',
        message:
          'Ela deixará de aparecer nos novos cadastros, mas o histórico e os resultados serão preservados.',
        confirmLabel: 'Arquivar',
        danger: true,
      }))
    )
      return;
    await dispatch({
      type: 'team/update',
      payload: { id: team.id, patch: { archived } },
      audit: {
        action: archived ? 'Equipe arquivada' : 'Equipe restaurada',
        entity: current.name,
        after: archived ? 'Arquivada' : 'Ativa',
      },
    });
    if (!archived) toast('Equipe restaurada.', 'success');
  }

  return (
    <>
      <section className={`team-hero team-detail-heading${current.archived ? ' is-archived' : ''}`}>
        <TeamMark initial={current.name[0]} tone={team.tone} logo={current.logo} />
        <div>
          <h2>{current.name}</h2>
          <p>
            {current.archived
              ? 'Equipe arquivada'
              : `${rosterSize} ${rosterSize === 1 ? 'atleta cadastrado' : 'atletas cadastrados'} na edição`}
          </p>
        </div>
      </section>
      {!readOnly && allowed && editing ? (
        <form className="entity-form inline-management-form form-step-enter" onSubmit={save} noValidate>
          <label>
            <span>Nome da equipe</span>
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              required
            />
          </label>
          <label>
            <span>Sigla</span>
            <input
              value={draft.initials}
              onChange={(event) => setDraft({ ...draft, initials: event.target.value })}
              required
              minLength={2}
              maxLength={8}
            />
          </label>
          <label>
            <span>Responsável</span>
            <input
              value={draft.responsible}
              onChange={(event) => setDraft({ ...draft, responsible: event.target.value })}
              placeholder="Nome do responsável"
            />
          </label>
          <label>
            <span>Logotipo</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={chooseLogo}
            />
          </label>
          <small className="field-help">
            A imagem é reduzida e convertida para WebP antes de ser armazenada.
          </small>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="form-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setDraft(current);
                setPendingLogo(null);
                setEditing(false);
              }}
            >
              Cancelar
            </button>
            <button type="submit" className="primary-button" disabled={!dirty || submitting}>
              <Save size={17} /> {submitting ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      ) : !readOnly && allowed ? (
        <div className="form-actions team-management-actions">
          <button type="button" className="secondary-button" onClick={toggleArchive}>
            <Archive size={17} /> {current.archived ? 'Restaurar' : 'Arquivar'}
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setDraft(current);
              setPendingLogo(null);
              setEditing(true);
            }}
          >
            <Pencil size={17} /> Editar equipe
          </button>
        </div>
      ) : null}
    </>
  );
}
