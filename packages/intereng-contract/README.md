# @atletica-incinera/intereng-contract

O contrato do InterEng: o formato da edição, as ações nomeadas que a escrevem e
as regras puras que decidem o que é válido.

Existe para que o front e a API não escrevam a mesma regra duas vezes e
divirjam em silêncio. Nada aqui toca rede, navegador ou banco.

```ts
import { contractVersion } from '@atletica-incinera/intereng-contract';
import { … } from '@atletica-incinera/intereng-contract/rules';
import { … } from '@atletica-incinera/intereng-contract/actions';
```

| Subcaminho | O que traz |
| --- | --- |
| `.` | identidade do pacote e tipos comuns |
| `/state` | o formato da edição |
| `/rules` | regulamento, elegibilidade, chaveamento, ciclo de vida, ranking |
| `/actions` | as ações nomeadas e o redutor |
| `/seed` | a edição de exemplo |

## Por que duas compilações

O consumidor NestJS é CommonJS com TypeScript 5.7, e `require(esm)` sob
`nodenext` só chegou no 5.8: um pacote só-ESM produziria **TS1479** na
compilação dele. O `npm run build` roda o `tsc` duas vezes e grava em cada
pasta um `package.json` de uma linha com o sistema de módulos — sem esse
marcador o Node lê o `"type": "module"` do pacote e trata o `dist/cjs` como
ESM.

`npm test` roda os dois smokes contra o artefato compilado, atravessando o mapa
`exports`. `npm run attw` confere as quatro formas de resolução (`node10`,
`node16` de CJS e de ESM, e bundler) — é o que pega ESM disfarçado de CJS antes
de a versão ir para o registro, que é imutável.
