import localFont from 'next/font/local';
import './globals.css';
import './motion.css';
import { PwaRegistration } from './components/PwaRegistration';
import { UiProvider } from './components/UiProvider';

const kenyanCoffee = localFont({
  src: [
    { path: './fonts/kenyan-coffee-regular.otf', weight: '400', style: 'normal' },
    { path: './fonts/kenyan-coffee-regular-italic.otf', weight: '400', style: 'italic' },
    { path: './fonts/kenyan-coffee-bold.otf', weight: '700', style: 'normal' },
    { path: './fonts/kenyan-coffee-bold-italic.otf', weight: '700', style: 'italic' },
  ],
  variable: '--font-kenyan-coffee-loaded',
  display: 'swap',
});

const ttTravelsNext = localFont({
  src: [
    { path: './fonts/tt-travels-next-regular.ttf', weight: '400', style: 'normal' },
    { path: './fonts/tt-travels-next-regular-italic.ttf', weight: '400', style: 'italic' },
    { path: './fonts/tt-travels-next-medium.ttf', weight: '500', style: 'normal' },
    { path: './fonts/tt-travels-next-medium-italic.ttf', weight: '500', style: 'italic' },
    { path: './fonts/tt-travels-next-demibold.ttf', weight: '600', style: 'normal' },
    { path: './fonts/tt-travels-next-demibold-italic.ttf', weight: '600', style: 'italic' },
    { path: './fonts/tt-travels-next-bold.ttf', weight: '700', style: 'normal' },
    { path: './fonts/tt-travels-next-bold-italic.ttf', weight: '700', style: 'italic' },
    { path: './fonts/tt-travels-next-extrabold.ttf', weight: '800', style: 'normal' },
    { path: './fonts/tt-travels-next-extrabold-italic.ttf', weight: '800', style: 'italic' },
    { path: './fonts/tt-travels-next-black.ttf', weight: '900', style: 'normal' },
    { path: './fonts/tt-travels-next-black-italic.ttf', weight: '900', style: 'italic' },
  ],
  variable: '--font-tt-travels-next-loaded',
  display: 'swap',
});

import { appPath } from './lib/base-path';

export const metadata = {
  title: 'InterEng Pernambuco 2026',
  description: 'Gestão e acompanhamento das edições do InterEng',
  manifest: '/manifest.webmanifest',
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
  appleWebApp: { capable: true, title: 'InterEng', statusBarStyle: 'black-translucent' as const },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${kenyanCoffee.variable} ${ttTravelsNext.variable}`}>
      <body><PwaRegistration /><UiProvider>{children}</UiProvider></body>
    </html>
  );
}
