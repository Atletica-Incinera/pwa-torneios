import { OverallStandings } from '../../../components/OverallStandings';
import { PublicAppShell } from '../../../components/PublicAppShell';

export default function PublicOverallStandingsPage() {
  return <PublicAppShell active="disciplines" eyebrow="TODAS AS MODALIDADES" title="CLASSIFICAÇÃO GERAL" subtitle="Ranking oficial das equipes na edição"><OverallStandings readOnly /></PublicAppShell>;
}
