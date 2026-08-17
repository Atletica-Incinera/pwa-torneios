import { resolveDataSource } from './repositories/state-adapter';

/**
 * O que a origem dos dados tem — e o que ela não tem.
 *
 * O adaptador local roda o pacote de regras inteiro, então tudo que o contrato
 * descreve existe lá. A API é outra história: ela é um controller por recurso,
 * e há famílias inteiras do app sem contrapartida nenhuma nela. Onde falta,
 * esconder o caminho é o mínimo — um botão cujo único destino possível é uma
 * mensagem de erro é pior do que a ausência do botão, porque ensina o operador
 * a esperar algo que nunca vem.
 *
 * São perguntas separadas de propósito, e não um booleano só: são dois buracos
 * independentes na API, e ela pode tapar um sem tapar o outro.
 */

/**
 * Ranking geral acumulado: métricas, premiação e fechamento da edição.
 *
 * A API não tem nada disso — nem tabela, nem rota. `PhaseStanding` é
 * classificação **por fase**, recalculada a cada partida encerrada, e é o mais
 * longe que o servidor vai; não existe pontuação somada entre modalidades. As
 * sete ações `ranking/*` do front morrem em `pending()` no adaptador HTTP.
 */
export function hasOverallRanking() {
  return resolveDataSource() !== 'http';
}

/**
 * Histórico de alterações da edição.
 *
 * A API **grava** auditoria — a tabela `audit_logs` existe e o `AuditService`
 * escreve nela a cada cadastro — e não publica nenhuma rota que a leia: os 17
 * controllers não têm um `@Get` de log, e o inventário não lista nenhuma. Em
 * modo http `state.audit` sai vazio da remontagem, e lista vazia na tela de
 * auditoria se lê como "ninguém mexeu em nada" — o oposto da verdade.
 */
export function hasAuditTrail() {
  return resolveDataSource() !== 'http';
}
