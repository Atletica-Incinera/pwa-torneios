import { redirect } from 'next/navigation';

export default function LegacyNewTournamentPage() {
  redirect('/disciplines/new');
}
