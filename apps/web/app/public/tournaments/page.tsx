import { PublicAppShell } from '../../components/PublicAppShell';
import { PublicTournamentList } from '../../components/PublicTournamentList';
import { tournaments } from '../../lib/repositories/catalog-repository';
export default function PublicCompetitionsPage() { return <PublicAppShell active="standings" eyebrow="INTERENG · EDIÇÃO 2026" title="MODALIDADES" subtitle="Categorias, fases e resultados desta edição"><PublicTournamentList tournaments={tournaments} /></PublicAppShell>; }
