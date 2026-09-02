import { permanentRedirect } from 'next/navigation';

/**
 * A classificacao geral e restrita a organizacao.
 *
 * A rota continua existindo, redirecionando, porque o endereco ja circulou:
 * devolver 404 para quem tem o link antigo e pior que levar a pessoa para a
 * lista de categorias, que e o que ela consegue ver. O dado tambem nao vem
 * mais no snapshot publico, entao esconder a tela nao e a unica barreira.
 */
export default function PublicOverallStandingsPage() {
  permanentRedirect('/public/tournaments');
}
