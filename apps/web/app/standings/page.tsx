'use client';

import Link from 'next/link';
import { ListOrdered } from 'lucide-react';
import { AppShell, EmptyState } from '../components/AppShell';
import { OverallStandings } from '../components/OverallStandings';
import { hasOverallRanking } from '../lib/source-capabilities';

/**
 * Esconder o link não impede a navegação.
 *
 * Quem chega aqui pela URL — favorito antigo, histórico do navegador, endereço
 * colado num grupo — precisa de uma resposta, e ela não pode ser o painel do
 * ranking: com a origem em http ele abre com as métricas do contrato, tabela
 * zerada e sete botões cujo único destino possível é uma mensagem de erro,
 * convidando o organizador a configurar premiação que nunca será gravada.
 *
 * Também não é um redirect. Mandar para outra tela sem dizer nada faz o
 * operador concluir que errou o endereço, e ele tenta de novo; pior, some com
 * a informação de que o ranking geral não existe **nesta origem**, que é
 * exatamente o que ele precisa saber. A rota fica de pé e diz o que houve.
 *
 * A tela é cliente porque a decisão vem de `NEXT_PUBLIC_DATA_SOURCE`, embutido
 * na compilação: é no pacote do navegador que o valor está garantido.
 */
export default function OverallStandingsPage() {
  if (!hasOverallRanking()) {
    return <AppShell active="tournaments" eyebrow="TODAS AS MODALIDADES" title="CLASSIFICAÇÃO GERAL" subtitle="Não existe nesta edição">
      <section className="section-block no-top"><EmptyState title="SEM RANKING GERAL" copy="O servidor desta edição não soma pontos entre modalidades: não há métricas, premiação nem fechamento para ler ou gravar. Isto não é uma tabela vazia — é a ausência da disputa acumulada." /></section>
      <div className="info-banner"><ListOrdered size={19} /><p>A classificação de cada categoria continua valendo e é calculada a partir das partidas. <Link href="/disciplines">Ver modalidades</Link>.</p></div>
    </AppShell>;
  }
  return <AppShell active="tournaments" eyebrow="TODAS AS MODALIDADES" title="CLASSIFICAÇÃO GERAL" subtitle="Pontuação acumulada das equipes no InterEng"><OverallStandings /></AppShell>;
}
