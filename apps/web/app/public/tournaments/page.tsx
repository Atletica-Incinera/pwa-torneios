import { PublicAppShell } from '../../components/PublicAppShell';
import { PublicTournamentList } from '../../components/PublicTournamentList';
import { tournaments } from '../../lib/mock-data';
export default function PublicCompetitionsPage() { return <PublicAppShell active="tournaments" eyebrow="INTERENG 2026" title="TORNEIOS" subtitle="Modalidades, fases e resultados da edição"><PublicTournamentList tournaments={tournaments} /></PublicAppShell>; }
