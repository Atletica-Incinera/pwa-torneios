/**
 * Escudos publicados junto com o app, em `public/teams/`.
 *
 * O upload pelo formulário depende de uma rota de storage que o gateway ainda
 * não tem — e criá-la exige um acesso à VM que a organização do evento não
 * tem. Como os escudos das atléticas já sobem a cada deploy, o formulário
 * passa a oferecê-los: quem cadastra a equipe pela tela sai com escudo, sem
 * depender daquela rota.
 *
 * A lista é escrita à mão de propósito. O navegador não enxerga o conteúdo de
 * `public/`, e gerar isto no build acrescentaria uma etapa para uma lista que
 * muda uma vez por edição. Acrescentar uma atlética é pôr o arquivo na pasta e
 * o nome aqui.
 */
export const escudosPublicados = [
  'abrasiva',
  'aguerrida',
  'alcateia',
  'cangaceiros',
  'caotica',
  'compressora',
  'engenhosa',
  'engrenada',
  'furiosa',
  'graxeiros',
  'halterada',
  'incinera',
  'inquisidores',
  'invasora',
  'predadora',
  'kinesis',
  'leoes-do-norte',
  'mafiosa',
  'manguezal',
  'tormenta',
  'triade',
  'tubaroes',
  'voraz',
] as const;

/** Caminho relativo do escudo, como o servidor o aceita e o app o exibe. */
export function caminhoDoEscudo(slug: string) {
  return `/teams/${slug}.webp`;
}

/** Acentos e caixa fora do caminho: "Caótica" e "caotica" viram a mesma chave. */
function chave(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Escudo correspondente ao nome digitado, se houver.
 *
 * O nome da atlética raramente bate com o do arquivo — "Atlética Alcateia"
 * contra `alcateia.webp` —, então tenta o nome inteiro sem separadores e
 * depois cada palavra dele. Mesma regra do importador de planilha, para que
 * cadastrar pela tela e importar em massa cheguem ao mesmo resultado.
 */
export function acharEscudo(nome: string): string | undefined {
  const limpo = chave(nome);
  const palavras = limpo.split(/[^a-z0-9]+/).filter(Boolean);
  const semPrefixo = palavras[0] === 'atletica' ? palavras.slice(1) : palavras;
  const candidatos = [
    palavras.join(''),
    palavras.join('-'),
    semPrefixo.join(''),
    semPrefixo.join('-'),
    ...palavras,
  ];
  const achado = candidatos.find((item) => (escudosPublicados as readonly string[]).includes(item));
  return achado ? caminhoDoEscudo(achado) : undefined;
}
