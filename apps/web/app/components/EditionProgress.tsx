'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { getActiveCompetition, getActiveEdition, useFrontendState } from '../lib/repositories/browser-repository';
import { listCategories, listDisciplines, listMatches, listTeams } from '../lib/edition-catalog';

type Step = { label: string; done: boolean; href: string; hint: string };

/**
 * A ordem de montagem da edição, do primeiro passo ao último.
 *
 * Existe porque o app conhecia a ordem e não a contava a ninguém: depois de
 * criar o torneio, a única orientação sumia, e o organizador descobria que
 * faltavam equipes e atletas já dentro da tela de gestão da categoria — como
 * aviso, sem link de saída. Numa edição recém-criada o painel é quatro
 * contadores zerados e nenhuma frase dizendo o que fazer.
 *
 * Some sozinho quando os seis passos estão cumpridos: é guia de montagem, não
 * mobília permanente.
 */
export function EditionProgress() {
  const { state } = useFrontendState();
  const competition = getActiveCompetition(state);
  const edition = getActiveEdition(state);
  const teams = listTeams(state);
  const athletes = teams.reduce((total, team) => total + team.athletes, 0);
  const disciplines = listDisciplines(state, edition?.id).filter((item) => item.enabled);
  const categories = listCategories(state, edition?.id);
  const matches = listMatches(state, edition?.id);

  const steps: Step[] = [
    { label: 'Torneio', done: Boolean(competition), href: '/competitions/new', hint: 'Crie o torneio que vai abrigar as edições.' },
    { label: 'Edição', done: Boolean(edition?.start && edition?.end), href: '/competitions', hint: 'Defina o período da edição deste ano.' },
    // Dois, e não uma: publicar uma categoria exige dois participantes, e um jogo
    // exige equipes diferentes. Com `>= 1` o passo apareceria cumprido e o beco
    // só seria descoberto lá na frente.
    { label: 'Equipes', done: teams.length >= 2, href: '/teams/new', hint: 'Cadastre as equipes que vão disputar — pelo menos duas.' },
    { label: 'Atletas', done: athletes > 0, href: '/teams', hint: 'Monte o elenco de cada equipe. Abra a equipe para cadastrar.' },
    { label: 'Modalidades', done: disciplines.length > 0, href: '/disciplines/new', hint: 'Habilite os esportes da edição e o regulamento de cada um.' },
    {
      label: 'Jogos',
      done: matches.length > 0,
      href: categories.length ? `/tournaments/${categories[0].id}?aba=regras` : '/disciplines',
      hint: categories.length ? 'Inscreva os participantes na categoria, publique e monte os jogos.' : 'Crie uma categoria dentro da modalidade para montar os jogos.',
    },
  ];

  const done = steps.filter((step) => step.done).length;
  if (done === steps.length) return null;
  const next = steps.find((step) => !step.done)!;

  return (
    <section className="edition-progress" aria-label="Montagem da edição">
      <div className="edition-progress-head">
        <div><p className="eyebrow orange">MONTAGEM DA EDIÇÃO</p><h2>{done} de {steps.length} passos</h2></div>
        <span className="edition-progress-count">{done}/{steps.length}</span>
      </div>
      <ol className="edition-progress-steps">
        {steps.map((step, index) => (
          <li key={step.label} className={step.done ? 'is-done' : step === next ? 'is-next' : ''}>
            <span className="edition-progress-mark" aria-hidden="true">{step.done ? <Check size={14} /> : index + 1}</span>
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      <p className="edition-progress-hint">{next.hint}</p>
      <Link href={next.href} className="wide-action">CONTINUAR EM {next.label.toUpperCase()} <span aria-hidden="true">›</span></Link>
    </section>
  );
}
