import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * O manifesto é escrito à mão, e o Next não aplica o `basePath` no conteúdo
 * dele — só no endereço do próprio arquivo.
 *
 * Em produção isso passou despercebido por semanas: o app é servido em
 * `/intereng`, o manifesto declarava ícones em `/icon-192.png` e `start_url`
 * em `/public`, e a raiz daquele domínio pertence a outro site. Os três
 * ícones respondiam 404, o Chrome recusa instalar aplicativo cujo ícone não
 * carrega, e o app não era instalável em dispositivo nenhum.
 *
 * O teste antigo não pegava porque conferia os caminhos literais — e no
 * ambiente local, sem `basePath`, eles estavam certos. Este confere a
 * propriedade que importa: tudo que o manifesto declara vive dentro do
 * `scope`, seja qual for o prefixo.
 */
import { construirManifesto } from '../../app/manifest.ts';

const manifestoCom = async (prefixo: string) => construirManifesto(prefixo);

function urlsDoManifesto(manifesto: Record<string, unknown>): string[] {
  const icones = (manifesto.icons as { src: string }[]).map((icone) => icone.src);
  const atalhos = (manifesto.shortcuts as { url: string; icons?: { src: string }[] }[]).flatMap(
    (atalho) => [atalho.url, ...(atalho.icons ?? []).map((icone) => icone.src)],
  );
  return [manifesto.start_url as string, manifesto.id as string, ...icones, ...atalhos];
}

test('sob um basePath, tudo que o manifesto declara carrega o prefixo', async () => {
  const manifesto = await manifestoCom('/intereng');
  assert.equal(manifesto.scope, '/intereng/');
  assert.equal(manifesto.start_url, '/intereng/public');
  for (const url of urlsDoManifesto(manifesto)) {
    assert.ok(
      url.startsWith('/intereng/'),
      `"${url}" está fora do prefixo — em produção isso responde 404`,
    );
  }
});

test('tudo que o manifesto declara vive dentro do scope', async () => {
  for (const prefixo of ['/intereng', '']) {
    const manifesto = await manifestoCom(prefixo);
    const scope = manifesto.scope as string;
    for (const url of urlsDoManifesto(manifesto)) {
      assert.ok(url.startsWith(scope), `"${url}" está fora do scope "${scope}"`);
    }
  }
});

test('sem basePath, o manifesto continua na raiz', async () => {
  const manifesto = await manifestoCom('');
  assert.equal(manifesto.scope, '/');
  assert.equal(manifesto.start_url, '/public');
  assert.equal((manifesto.icons as { src: string }[])[0].src, '/icon-192.png');
});
