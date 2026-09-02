import type { MetadataRoute } from 'next';
import { basePath } from './lib/base-path.ts';

/**
 * Manifesto do aplicativo instalável.
 *
 * Todo caminho aqui passa por `appPath`. O manifesto é escrito à mão, e o
 * Next não aplica o `basePath` no conteúdo dele — só no endereço do próprio
 * arquivo. Sem o prefixo, em produção o app declarava ícones em
 * `/icon-192.png` e `start_url` em `/public`, que **não existem**: a raiz do
 * domínio pertence a outro site. Os três ícones respondiam 404, e o Chrome
 * recusa instalar um aplicativo cujo ícone não carrega — o app não era
 * instalável em lugar nenhum, e se fosse abriria numa página inexistente.
 *
 * `scope` amarra o aplicativo ao prefixo: sem isso, um link para fora do
 * `/intereng` abriria dentro da janela instalada como se fosse parte do app.
 */
/**
 * Construção separada do `basePath` em vigor para poder ser verificada com
 * qualquer prefixo — foi justamente a falta do prefixo que passou despercebida
 * em produção, e um teste preso ao ambiente local nunca a veria.
 */
export function construirManifesto(prefixo: string): MetadataRoute.Manifest {
  const com = (caminho: string) => `${prefixo}${caminho}`;
  const icone = (nome: string, sizes: string) => ({
    src: com(`/${nome}`),
    sizes,
    type: 'image/png' as const,
  });
  return {
    id: com('/public'),
    name: 'InterEng Pernambuco 2026',
    short_name: 'InterEng',
    description: 'Gestão e acompanhamento das edições do InterEng',
    start_url: com('/public'),
    scope: com('/'),
    display: 'standalone',
    background_color: '#022734',
    theme_color: '#022734',
    orientation: 'portrait',
    lang: 'pt-BR',
    categories: ['sports', 'entertainment'],
    icons: [
      { ...icone('icon-192.png', '192x192'), purpose: 'any' },
      { ...icone('icon-512.png', '512x512'), purpose: 'any' },
      { ...icone('icon-maskable-512.png', '512x512'), purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Jogos ao vivo', short_name: 'Ao vivo', url: com('/public'), icons: [icone('icon-192.png', '192x192')] },
      { name: 'Agenda', short_name: 'Agenda', url: com('/public/tournaments'), icons: [icone('icon-192.png', '192x192')] },
      { name: 'Equipes', short_name: 'Equipes', url: com('/public/teams'), icons: [icone('icon-192.png', '192x192')] },
    ],
  };
}

export default function manifest(): MetadataRoute.Manifest {
  return construirManifesto(basePath);
}
