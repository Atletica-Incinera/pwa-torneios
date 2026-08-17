/**
 * Com qual dos seus acessos a pessoa está trabalhando **neste aparelho**.
 *
 * Fica ao lado de `device-preferences.ts` e pelo mesmo motivo: é escolha do
 * aparelho, não da edição. Quem opera o futsal no celular do ginásio e organiza
 * a edição no computador de casa não está em conflito — as duas telas podem
 * discordar sem que uma esteja errada. Por isso não vira requisição, não entra
 * na auditoria e não chega ao servidor: o servidor já sabe todos os papéis, e
 * continua decidindo cada escrita por conta própria. O que se escolhe aqui é
 * qual deles o app usa para montar a tela.
 *
 * Fica **fora** da sessão gravada de propósito: a sessão é reescrita a cada
 * renovação de token, e uma preferência que mora dentro dela desapareceria
 * quinze minutos depois de ser feita.
 */
export const activeScopeKey = 'intereng:active-scope:v1';
export const scopeChangeEvent = 'intereng:scope-change';

export function readActiveScopeId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(activeScopeKey);
  } catch { return null; }
}

export function writeActiveScopeId(id: string) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(activeScopeKey, id); } catch { /* storage indisponível */ }
  window.dispatchEvent(new Event(scopeChangeEvent));
}

/**
 * Esquece a escolha. Não é chamado ao sair: a preferência é do aparelho, e o
 * operador que sai e volta reencontra o escopo em que estava. Escopo que deixou
 * de existir — outro usuário, papel revogado — não é encontrado na lista e cai
 * no primeiro, sem precisar ser apagado aqui.
 */
export function clearActiveScopeId() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(activeScopeKey); } catch { /* storage indisponível */ }
  window.dispatchEvent(new Event(scopeChangeEvent));
}
