'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { PublicAppShell } from './PublicAppShell';
import { PublicMatchCollection } from './PublicMatchCollection';
import { getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';

/**
 * O que está acontecendo agora, em todas as modalidades. Não filtra por
 * modalidade de propósito: quem abre "ao vivo" quer ver o que está rolando.
 */
export function PublicLiveView() {
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);

  return (
    <PublicAppShell active="live" eyebrow={`INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`} title="AO VIVO" subtitle="Placares oficiais acontecendo agora">
      <PublicMatchCollection mode="live" />
      <Link href="/public/tournaments" className="wide-action"><Trophy size={18} /> TODAS AS MODALIDADES <span>›</span></Link>
    </PublicAppShell>
  );
}
