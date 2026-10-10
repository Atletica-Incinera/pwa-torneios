import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/*
 * Em produção o app é servido sob um prefixo (`/copahalterada`), definido na
 * build por NEXT_PUBLIC_BASE_PATH. `next/link`, `next/image` e o router aplicam
 * o prefixo sozinhos; um `<img src="/algo.png">` comum NÃO. Em desenvolvimento
 * e na suíte e2e não há prefixo, então o defeito passa em tudo e só aparece no ar:
 * foi assim que o emblema do cabeçalho e o mascote do login deram 404 no
 * primeiro deploy da Copa Halterada.
 *
 * Esta trava lê o código-fonte: toda `<img>` com caminho absoluto precisa passar
 * por `appPath(...)`.
 */
function arquivos(pasta: string): string[] {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((item) => {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) return item.name === 'node_modules' ? [] : arquivos(caminho);
    return caminho.endsWith('.tsx') ? [caminho] : [];
  });
}

test('nenhuma <img> usa caminho absoluto sem passar por appPath', () => {
  const culpados: string[] = [];
  for (const arquivo of arquivos('app')) {
    const texto = readFileSync(arquivo, 'utf8');
    for (const achado of texto.matchAll(/<img\b[^>]*?\bsrc=(["'])\/[^"']*\1/g)) {
      culpados.push(`${arquivo}: ${achado[0].slice(0, 90)}`);
    }
  }
  assert.deepEqual(culpados, [], 'use src={appPath(\'/caminho\')}, ou o app dá 404 em produção');
});
