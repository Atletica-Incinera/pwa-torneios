import { redirect } from 'next/navigation';

/** A gestão virou a aba Regras da própria categoria. */
export default async function LegacyManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/tournaments/${id}?aba=regras`);
}
