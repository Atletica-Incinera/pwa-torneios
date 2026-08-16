import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { seededFrontendState } from '@atletica-incinera/intereng-contract/state';

/**
 * A semente da edição grava caminho de arquivo — `logo` na equipe, `logoA` e
 * `logoB` na partida — e os arquivos moram aqui, em `public/teams`. Nada ligava
 * as duas pontas: renomear um `.webp` deixava a edição de exemplo pedindo uma
 * imagem que não existe, sem erro de compilação e sem teste vermelho. O que
 * aparecia era um escudo faltando na tela, meses depois.
 *
 * A conferência mora do lado dos arquivos, e não junto da semente, porque o
 * contrato é um pacote publicado: quem o instala é a API, que não tem `public/`
 * nenhum. Um teste lá dentro teria de enxergar para fora do próprio pacote para
 * valer alguma coisa — e deixaria de valer no dia em que ele for consumido de
 * fora deste repositório. Aqui é o contrário: a pasta é desta aplicação, o
 * pacote já é dependência dela, e este é o mesmo trato que
 * `service-worker.test.ts` faz com o pré-cache.
 */
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * Todo caminho de arquivo que a semente carrega, em qualquer profundidade.
 *
 * Varre o snapshot inteiro em vez de listar os três campos conhecidos: o campo
 * que ninguém lembrou de conferir é exatamente o que some sem avisar.
 */
function assetPaths(value: unknown, found: Set<string> = new Set()) {
  if (typeof value === 'string') {
    if (/^\/[\w./-]+\.\w{2,5}$/.test(value)) found.add(value);
    return found;
  }
  if (value && typeof value === 'object') for (const entry of Object.values(value)) assetPaths(entry, found);
  return found;
}

test('todo arquivo apontado pela semente da edição existe em public/', () => {
  const referenced = [...assetPaths(seededFrontendState)];
  // Sem isto, uma semente que parasse de carregar caminho — ou um `import` que
  // trouxesse o pacote vazio — passaria como acerto.
  assert.ok(referenced.length > 0, 'nenhum caminho de arquivo encontrado na semente do contrato');

  const files = new Set(readdirSync(resolve(web, 'public'), { recursive: true })
    .map((entry) => `/${String(entry).replace(/\\/g, '/')}`));
  for (const asset of referenced) {
    assert.ok(files.has(asset), `${asset} está na semente do contrato e não existe em apps/web/public/`);
  }
});
