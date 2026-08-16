import type { Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './motion.css';
import { appleStartupImages } from './lib/pwa-assets';
import { FrontendStateProvider } from './lib/repositories/frontend-state-provider';
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

/**
 * Separada de `metadata` porque o Next as dividiu na 14 — enquanto isso não
 * existia, o documento saía sem `theme-color` e a barra do navegador ficava
 * cinza, contradizendo o manifesto.
 *
 * `viewportFit: 'cover'` é o que faz `env(safe-area-inset-*)` devolver valor no
 * iOS. O `globals.css` já conta com esses valores na barra inferior, na região
 * de toast e no banner do PWA, e o app se declara `black-translucent`: sem esta
 * linha, todo esse CSS é inerte e o conteúdo fica embaixo do entalhe.
 */
export const viewport: Viewport = {
  themeColor: '#022734',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata = {
  title: 'InterEng Pernambuco 2026',
  description: 'Gestão e acompanhamento das edições do InterEng',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // Sem `startupImage`, o iPhone abre o app instalado com tela branca até o
  // React montar — o oposto do que o `background_color` do manifesto promete.
  appleWebApp: { capable: true, title: 'InterEng', statusBarStyle: 'black-translucent' as const, startupImage: appleStartupImages },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${kenyanCoffee.variable} ${ttTravelsNext.variable}`}>
      <body><PwaRegistration /><UiProvider><FrontendStateProvider>{children}</FrontendStateProvider></UiProvider></body>
    </html>
  );
}
