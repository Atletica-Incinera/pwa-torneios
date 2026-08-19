'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, TeamMark } from './AppShell';
import { FileField } from './FileField';
import { LogoCropModal } from './LogoCropModal';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';
import { listAllTeams } from '../lib/edition-catalog';
import { randomSuffix } from '../lib/create-id';
import { MAX_SOURCE_IMAGE_BYTES, type OptimizedImage } from '../lib/image-utils';
import { uploadTeamLogo } from '../lib/repositories/logo-upload';

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function TeamCreationForm() {
  const router = useRouter();
  const { state, dispatch, source } = useFrontendState();
  const [name, setName] = useState('');
  const [initials, setInitials] = useState('');
  const [responsible, setResponsible] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [pendingLogo, setPendingLogo] = useState<OptimizedImage | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(name || initials || responsible || pendingLogo) && !submitting);

  function chooseLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_SOURCE_IMAGE_BYTES) {
      setError('A imagem deve ter no máximo 8 MB.');
      setFileInputKey((key) => key + 1);
      return;
    }
    setError('');
    setLogoFile(file);
  }

  function removeLogo() {
    setPendingLogo(null);
    setFileInputKey((key) => key + 1);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const base = slugify(name);
    if (!base || !initials.trim() || !responsible.trim()) {
      setError('Preencha nome, sigla e responsável.');
      return;
    }
    const duplicate = listAllTeams(state).some(
      (team) => team.name.toLocaleLowerCase('pt-BR') === name.trim().toLocaleLowerCase('pt-BR'),
    );
    if (duplicate) {
      setError('Já existe uma equipe com este nome.');
      return;
    }
    // O id legível é o slug; havendo choque local, entra um sufixo aleatório. Se
    // dois aparelhos criarem o mesmo nome ao mesmo tempo, quem chega depois
    // recebe 409 do servidor e vê a mensagem de nome duplicado.
    const id = state.teams[base] ? `${base}-${randomSuffix()}` : base;
    setSubmitting(true);
    setError('');
    try {
      const created = await dispatch({
        type: 'team/create',
        payload: {
          id,
          team: {
            name: name.trim(),
            initials: initials.trim().toUpperCase(),
            responsible: responsible.trim(),
            created: true,
            tone: 'blue',
            // No modo HTTP o logotipo só existe depois que a equipe existe no
            // servidor (o presign exige o teamId); no local/mock não há essa
            // dependência, então já entra junto na criação.
            ...(pendingLogo && source !== 'http' ? { logo: pendingLogo.previewUrl } : {}),
          },
        },
        audit: { action: 'Equipe cadastrada', entity: name.trim(), after: 'Ativa' },
      });
      if (!created.ok) {
        setError(created.error || 'Não foi possível cadastrar a equipe.');
        setSubmitting(false);
        return;
      }
      if (pendingLogo && source === 'http') {
        try {
          const fileKey = await uploadTeamLogo(id, pendingLogo.blob);
          await dispatch({
            type: 'team/update',
            payload: { id, patch: { logo: fileKey } },
            audit: { action: 'Logotipo cadastrado', entity: name.trim() },
          });
        } catch {
          // A equipe já foi criada; só o logotipo falhou em subir. Segue para
          // a equipe criada em vez de travar o cadastro — dá para tentar de
          // novo na tela de edição.
        }
      }
      router.push(`/teams/${id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível cadastrar a equipe.');
      setSubmitting(false);
    }
  }

  return (
    <AppShell active="teams" eyebrow="CATÁLOGO GLOBAL" title="NOVA EQUIPE" subtitle="Cadastre a equipe uma única vez">
      <form className="entity-form team-creation-form" onSubmit={submit} noValidate>
        <label>
          <span>Nome da equipe</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
            placeholder="Ex.: Alcateia"
            autoFocus
            required
          />
        </label>
        <label>
          <span>Sigla</span>
          <input
            value={initials}
            onChange={(event) => {
              setInitials(event.target.value);
              setError('');
            }}
            placeholder="ALC"
            minLength={2}
            maxLength={8}
            required
          />
        </label>
        <label>
          <span>Responsável</span>
          <input
            value={responsible}
            onChange={(event) => {
              setResponsible(event.target.value);
              setError('');
            }}
            placeholder="Nome do responsável"
            required
          />
        </label>
        <FileField
          label="Logotipo"
          accept="image/png,image/jpeg,image/webp"
          fileName={pendingLogo ? 'Imagem selecionada' : undefined}
          hint="Escolha uma imagem para recortar e ajustar ao formato usado no app — ela é convertida para WebP antes de ser armazenada."
          onChange={chooseLogo}
          inputKey={fileInputKey}
        />
        {pendingLogo ? (
          <div className="logo-preview-row">
            <TeamMark initial={(initials || name || 'E')[0]} tone="blue" logo={pendingLogo.previewUrl} />
            <button type="button" className="text-button" onClick={removeLogo}>
              Remover logotipo
            </button>
          </div>
        ) : null}
        {error ? (
          <p className="form-feedback form-feedback-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="form-actions">
          <Link href="/teams" className="secondary-button">
            Cancelar
          </Link>
          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? 'Cadastrando…' : 'Cadastrar equipe'}
          </button>
        </div>
      </form>
      {logoFile ? (
        <LogoCropModal
          file={logoFile}
          onCancel={() => {
            setLogoFile(null);
            setFileInputKey((key) => key + 1);
          }}
          onConfirm={(optimized) => {
            setPendingLogo(optimized);
            setLogoFile(null);
          }}
        />
      ) : null}
    </AppShell>
  );
}
