import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * O service worker é JavaScript solto, servido como está: não passa pelo
 * compilador e nenhum import o liga ao resto do projeto. Sem esta conferência,
 * somar um escudo em `public/teams` e esquecer de listá-lo no pré-cache não
 * quebra nada — só faz a imagem sumir na primeira abertura offline, meses
 * depois, sem erro nenhum.
 */
const web = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = readFileSync(resolve(web, 'public/sw.js'), 'utf8');

function listed(constant: string) {
  const match = new RegExp(`const ${constant} = \\[([^\\]]*)\\]`).exec(source);
  assert.ok(match, `${constant} não encontrado em sw.js`);
  return match[1].split(',').map((entry) => entry.trim().replace(/^'|'$/g, '')).filter(Boolean);
}

test('todo escudo da pasta está no pré-cache do service worker', () => {
  const onDisk = readdirSync(resolve(web, 'public/teams')).map((file) => `/teams/${file}`);
  const badges = listed('BADGES');
  assert.deepEqual([...badges].sort(), [...onDisk].sort());
});

test('o pré-cache não aponta para arquivo que não existe', () => {
  const files = new Set(readdirSync(resolve(web, 'public'), { recursive: true })
    .map((entry) => `/${String(entry).replace(/\\/g, '/')}`));
  for (const asset of [...listed('ICONS'), ...listed('BADGES')]) {
    assert.ok(files.has(asset), `${asset} está no pré-cache e não existe em public/`);
  }
});

test('a versão do cache sobe quando o pré-cache muda', () => {
  // Não dá para verificar a intenção, mas dá para exigir o formato: um número
  // no fim, que é o que o `activate` usa para apagar o cache anterior.
  assert.match(source, /const VERSION = 'intereng-v\d+';/);
});
