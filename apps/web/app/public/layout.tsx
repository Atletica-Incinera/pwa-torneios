import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'InterEng Pernambuco',
  },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
