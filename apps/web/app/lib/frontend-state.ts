/**
 * Ponte para `@atletica-incinera/intereng-contract/state`.
 *
 * A metade pura mudou de casa; a que depende do navegador ficou em
 * `browser-state.ts`. Este arquivo junta as duas para nenhum dos
 * importadores precisar mudar junto, e some quando o último apontar direto.
 */
export * from '@atletica-incinera/intereng-contract/state';
export * from './browser-state.ts';
