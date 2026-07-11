import '@fontsource/boldonse';
import '@fontsource-variable/host-grotesk';
import './globals.css';
import './motion.css';

export const metadata = {
  title: 'PWA Torneios',
  description: 'Gestão de torneios esportivos',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
