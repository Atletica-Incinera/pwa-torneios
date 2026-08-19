import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// A suíte de componentes exercita o caminho local: usuários de demonstração,
// sessão em localStorage, nenhuma rede. Desde que a integração passou a ser o
// padrão, `resolveDataSource()` devolve 'http' quando a variável não existe —
// e sem ela estes testes tentavam falar com uma API que não está de pé.
// Quem for testar o modo integrado sobrescreve isto no próprio arquivo.
process.env.NEXT_PUBLIC_DATA_SOURCE ??= 'local';

afterEach(() => cleanup());
