import { Archivo, Outfit } from 'next/font/google';
import type { Metadata } from 'next';
import './globals.css';
import './motion.css';
import { PwaRegistration } from './components/PwaRegistration';
import { UiProvider } from './components/UiProvider';
import { appPath } from './lib/base-path';
import { loadPublicSnapshot } from './lib/public-snapshot';
import { FrontendStateProvider } from './lib/repositories/use-frontend-state';

const SITE_URL = 'https://incinera.cin.ufpe.br';

export const dynamic = 'force-dynamic';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-display-loaded',
  display: 'swap',
});

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-interface-loaded',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Copa Halterada',
    template: '%s | Copa Halterada',
  },
  description: 'Gestão e acompanhamento da Copa Halterada',
  applicationName: 'Copa Halterada',
  manifest: appPath('/manifest.webmanifest'),
  /*
   * Os ícones passam por `appPath`. O Next aplica o `basePath` no endereço do
   * manifesto, mas não no dos ícones — em produção eles apontavam para a raiz
   * do domínio, que é outro site, e respondiam 404. O `apple-touch-icon` é o
   * mais visível dos três: é ele que o iPhone usa ao adicionar à tela de
   * início, e sem ele o iOS põe um retrato da página no lugar do ícone.
   */

  icons: {
    icon: [
      { url: appPath('/icon-192.png'), sizes: '192x192', type: 'image/png' },
      { url: appPath('/icon-512.png'), sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: appPath('/apple-touch-icon.png'), sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Copa Halterada', statusBarStyle: 'black-translucent' as const },
  robots: { index: false, follow: false, nocache: true },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const initialState = await loadPublicSnapshot();
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${outfit.variable}`}>
      <body>
        <PwaRegistration />
        <FrontendStateProvider initialState={initialState}>
          <UiProvider>{children}</UiProvider>
        </FrontendStateProvider>
      </body>
    </html>
  );
}
