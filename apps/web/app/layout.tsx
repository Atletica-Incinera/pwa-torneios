import { Archivo, Outfit } from 'next/font/google';
import './globals.css';
import './motion.css';
import { PwaRegistration } from './components/PwaRegistration';
import { UiProvider } from './components/UiProvider';

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

export const metadata = {
  title: 'Copa Halterada',
  description: 'Gestão e acompanhamento da Copa Halterada',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Copa Halterada', statusBarStyle: 'black-translucent' as const },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${outfit.variable}`}>
      <body><PwaRegistration /><UiProvider>{children}</UiProvider></body>
    </html>
  );
}
