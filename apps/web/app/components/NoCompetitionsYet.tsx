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
  return <section className="section-block">
    <div className="detail-card">
      <Trophy size={22} />
      <span>
        <small>Nenhuma competição cadastrada</small>
        <strong>{canCreate ? 'Crie a primeira para começar' : 'Aguardando o super administrador criar a primeira competição'}</strong>
      </span>
    </div>
    {canCreate ? <Link href="/competitions/new" className="primary-button wide-action">Criar competição</Link> : null}
  </section>;
}
