import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

/**
 * O mesmo código compilado duas vezes, não empacotado.
 *
 * O consumidor Nest é CommonJS com TypeScript 5.7, e `require(esm)` sob
 * `nodenext` só chegou no 5.8: um pacote só-ESM produziria TS1479 na
 * compilação dele. Bundler está fora porque não há uma única dependência para
 * empacotar e o `.d.ts` via rollup tropeça no ciclo de tipos entre as regras.
 *
 * Cada pasta recebe um `package.json` de uma linha dizendo o seu sistema de
 * módulos. Sem esse marcador o Node lê o `"type": "module"` do pacote e trata
 * o `dist/cjs` como ESM.
 */
const require = createRequire(import.meta.url);
const tsc = resolve(dirname(require.resolve('typescript/package.json')), 'bin', 'tsc');

rmSync('dist', { recursive: true, force: true });

for (const [config, outDir, type] of [
  ['tsconfig.esm.json', 'dist/esm', 'module'],
  ['tsconfig.cjs.json', 'dist/cjs', 'commonjs'],
]) {
  execFileSync(process.execPath, [tsc, '-p', config], { stdio: 'inherit' });
  writeFileSync(resolve(outDir, 'package.json'), `${JSON.stringify({ type }, null, 2)}\n`);
}
