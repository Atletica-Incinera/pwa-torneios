import { permanentRedirect } from 'next/navigation';

/** Agenda, tabela, resultados e fases agora vivem dentro de cada categoria. */
export default function LegacyPublicmatchesPage() {
  permanentRedirect('/public/tournaments');
}
