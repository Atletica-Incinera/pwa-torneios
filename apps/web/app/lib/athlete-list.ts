/**
 * Lista de atletas colada pela atlética: um nome por linha.
 *
 * Aceita o que costuma vir de planilha e de mensagem de WhatsApp — numeração
 * ("1. Ana", "01 - Ana"), marcadores ("- Ana", "• Ana"), número de camisa no
 * fim ("Ana Souza 10") e espaços sobrando. Nome repetido na própria lista ou
 * já presente no elenco é ignorado e listado, para quem colou entender por que
 * o total ficou menor.
 */
export function parseAthleteList(text: string, existing: string[] = []) {
  const known = new Set(existing.map((name) => normalize(name)));
  const names: string[] = [];
  const skipped: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const name = raw
      .replace(/^\s*(?:\d{1,3}\s*[.)\-–:]\s*|[-•*·]\s*)/, '')
      .replace(/\s+\d{1,3}\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name.length < 3) continue;
    const key = normalize(name);
    if (known.has(key)) { skipped.push(name); continue; }
    known.add(key);
    names.push(name);
  }
  return { names, skipped };
}

function normalize(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').trim();
}
