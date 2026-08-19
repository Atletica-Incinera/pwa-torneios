import axios from 'axios';
import { apiRequest } from './api-client.ts';
import { readSessionToken } from './session-storage.ts';

const LOGO_CONTENT_TYPE = 'image/webp';

type LogoUploadContract = {
  fileKey: string;
  uploadUrl: string;
  method: 'POST';
  fields: Record<string, string>;
  expiresAt: string;
  maxSizeBytes: number;
};

export async function uploadTeamLogo(teamId: string, blob: Blob): Promise<string> {
  if (blob.type !== LOGO_CONTENT_TYPE) {
    throw new Error('O logotipo precisa estar convertido para WebP.');
  }

  const checksumSha256 = await sha256Base64(blob);
  const contract = await apiRequest<LogoUploadContract>({
    path: `/teams/${encodeURIComponent(teamId)}/logo-upload-url`,
    method: 'POST',
    body: {
      contentType: LOGO_CONTENT_TYPE,
      sizeBytes: blob.size,
      checksumSha256,
    },
    token: readSessionToken(),
  });
  if (blob.size > contract.maxSizeBytes) {
    throw new Error('A imagem convertida ultrapassa o limite permitido.');
  }

  const form = new FormData();
  for (const [field, value] of Object.entries(contract.fields)) form.append(field, value);
  form.append('file', blob, 'logo.webp');

  try {
    await axios.post(contract.uploadUrl, form, {
      withCredentials: false,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        error.response
          ? `Não foi possível enviar o logotipo (${error.response.status}).`
          : 'Não foi possível acessar o armazenamento de imagens.',
      );
    }
    throw error;
  }
  return contract.fileKey;
}

async function sha256Base64(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
