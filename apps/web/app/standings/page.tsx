import { AppShell } from '../components/AppShell';
import { OverallStandings } from '../components/OverallStandings';

export default function OverallStandingsPage() {
  return <AppShell active="tournaments" eyebrow="TODAS AS MODALIDADES" title="CLASSIFICAÇÃO GERAL" subtitle="Pontuação acumulada das equipes no InterEng"><OverallStandings /></AppShell>;
}
