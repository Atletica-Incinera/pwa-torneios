'use client';

import { Check, ImageOff } from 'lucide-react';
import { appPath } from '../lib/base-path';
import { caminhoDoEscudo, escudosPublicados } from '../lib/escudos';

/**
 * Escolha do escudo entre os publicados com o app.
 *
 * O envio de imagem própria sobe para o storage por uma rota que o gateway
 * ainda não tem, e enquanto isso a única forma de dar escudo a uma equipe era
 * o preenchimento automático pelo nome — que só grava se algo mais no
 * formulário mudar. Quem precisasse corrigir um escudo tinha que alterar outro
 * campo de propósito, o que é contorno, não funcionalidade.
 *
 * Aqui a escolha é explícita: clicar num escudo muda o rascunho e o botão de
 * salvar habilita. Trocar e remover funcionam quantas vezes for preciso —
 * remover chega ao servidor como `logo: null`.
 */
export function EscudoPicker({
  valor,
  onEscolher,
  nomeDaEquipe,
}: {
  valor?: string;
  onEscolher: (escudo: string | undefined) => void;
  nomeDaEquipe?: string;
}) {
  return (
    <fieldset className="escudo-picker">
      <legend>Escudo da equipe</legend>
      <p className="form-hint">
        {nomeDaEquipe?.trim()
          ? 'Escolha o escudo da atlética. Ele aparece nos cartões, na tabela e nos placares.'
          : 'Informe o nome da equipe primeiro — o escudo correspondente já vem sugerido.'}
      </p>
      <div className="escudo-opcoes">
        {escudosPublicados.map((slug) => {
          const caminho = caminhoDoEscudo(slug);
          const escolhido = valor === caminho;
          return (
            <button
              key={slug}
              type="button"
              className={`escudo-opcao${escolhido ? ' is-escolhido' : ''}`}
              aria-pressed={escolhido}
              aria-label={`Usar o escudo ${slug}`}
              title={slug}
              onClick={() => onEscolher(escolhido ? undefined : caminho)}
            >
              <img src={appPath(caminho)} alt="" />
              {escolhido ? <Check size={16} aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>
      {valor ? (
        <button
          type="button"
          className="secondary-button escudo-remover"
          onClick={() => onEscolher(undefined)}
        >
          <ImageOff size={16} aria-hidden="true" /> Ficar sem escudo
        </button>
      ) : null}
    </fieldset>
  );
}
