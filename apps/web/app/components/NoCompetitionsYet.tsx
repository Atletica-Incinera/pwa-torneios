'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';

/**
 * Nenhuma competição existe ainda — o primeiro estado real de um sistema
 * recém-migrado, não um erro. `competition/create` é ação global (só o super
 * admin executa), então é a única pessoa para quem faz sentido o atalho.
 *
 * Compartilhado entre o dashboard e `/competitions`: as duas páginas indexam
 * `state.competitions[0]` sem checar o tamanho, e um array vazio aqui — só
 * alcançável desde que o snapshot passou a tratar "sem edição ativa" como
 * estado válido em vez de erro — lançava exceção antes desta tela existir.
 */
export function NoCompetitionsYet({ canCreate }: { canCreate: boolean }) {
  return <section className="section-block first-competition-card">
    <div className="profile-hero">
      <Trophy size={28} />
      <span>
        <h2>Nenhuma competição cadastrada</h2>
        <p>{canCreate ? 'Crie a primeira competição e a edição inicial para liberar o resto do app.' : 'Aguardando o super administrador criar a primeira competição.'}</p>
      </span>
    </div>
    {canCreate ? <Link href="/competitions/new" className="primary-button">Criar competição</Link> : null}
  </section>;
}
