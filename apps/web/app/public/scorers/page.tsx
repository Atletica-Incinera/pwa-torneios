'use client';

import { Target } from 'lucide-react';
import { useMemo } from 'react';
import { PublicAppShell } from '../../components/PublicAppShell';
import { EmptyState, TeamMark } from '../../components/AppShell';
import { getActiveEdition, useFrontendState } from '../../lib/repositories/browser-repository';
import { artilhariaPorModalidade, colocacoes } from '../../lib/artilharia';

export default function PublicScorersPage() {
  const { state } = useFrontendState();
  const activeEdition = getActiveEdition(state);
  const artilharia = useMemo(
    () => artilhariaPorModalidade(state, { editionId: activeEdition?.id }),
    [state, activeEdition?.id],
  );
  // Modalidade com lance registrado entra na lista mesmo sem nenhum autor
  // informado: e justamente ai que a lacuna precisa aparecer. Escondendo, a
  // tela dizia "artilharia vazia" quando o certo era "a mesa nao anotou".
  const comArtilheiros = artilharia.filter((item) => item.artilheiros.length || item.semAutor);

  return (
    <PublicAppShell
      active="scorers"
      eyebrow={`INTERENG · EDIÇÃO ${activeEdition?.year ?? ''}`}
      title="ARTILHARIA"
      subtitle="Quem mais marcou em cada modalidade"
    >
      {comArtilheiros.map((modalidade) => {
        const posicoes = colocacoes(modalidade.artilheiros);
        return (
          <section className="section-block artilharia-bloco" key={modalidade.modalidade}>
            <header className="artilharia-cabecalho">
              <h2>{modalidade.modalidade}</h2>
              <span>{modalidade.rotuloDoLance}</span>
            </header>
            {modalidade.artilheiros.length ? <ol className="artilharia-lista">
              {modalidade.artilheiros.map((atleta, indice) => (
                <li className="artilharia-linha" key={atleta.athleteId}>
                  <span className="artilharia-posicao">{posicoes[indice]}º</span>
                  <TeamMark initial={atleta.equipe[0] ?? '?'} tone="blue" logo={atleta.logo} />
                  <div className="artilharia-nome">
                    <strong>{atleta.nome}</strong>
                    <small>{atleta.equipe}</small>
                  </div>
                  <span className="artilharia-gols">
                    <strong>{atleta.gols}</strong>
                    <small>{atleta.partidas === 1 ? '1 jogo' : `${atleta.partidas} jogos`}</small>
                  </span>
                </li>
              ))}
            </ol> : <p className="artilharia-lacuna-forte">Nenhum lance desta modalidade foi registrado com o nome de quem marcou.</p>}
            {/* A lacuna fica a vista de proposito: se a mesa deixou de anotar o
                autor, o numero aqui explica por que a soma da artilharia nao
                bate com o placar. */}
            {modalidade.semAutor ? (
              <p className="artilharia-lacuna">
                <Target size={14} aria-hidden="true" /> {modalidade.semAutor}{' '}
                {modalidade.semAutor === 1 ? 'lance registrado' : 'lances registrados'} sem o nome de
                quem marcou.
              </p>
            ) : null}
          </section>
        );
      })}

      {!comArtilheiros.length ? (
        <EmptyState
          title="ARTILHARIA AINDA VAZIA"
          copy="A lista aparece quando os primeiros gols forem registrados com o nome de quem marcou."
        />
      ) : null}
    </PublicAppShell>
  );
}
