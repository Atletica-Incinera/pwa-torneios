'use client';

import { Cloud, CloudOff, Radio } from 'lucide-react';
import type { ConnectionState, DataSource } from '../lib/repositories/state-adapter';

/**
 * O que a barra de contexto promete sobre os dados que estão na tela.
 *
 * Antes dizia "Modo local" fixo, inclusive quando o app estivesse falando com a
 * API. Conexão é obrigatória para ver em tempo real, então a queda precisa
 * aparecer: sem isso a tela congela sem explicar por quê.
 */
export function ConnectionBadge({ source, connection, publicView = false }: { source: DataSource; connection: ConnectionState; publicView?: boolean }) {
  if (source === 'local') return <span className="sync-state"><Cloud size={15} aria-hidden="true" /> Modo local</span>;
  if (connection === 'offline') return <span className="sync-state sync-offline" role="status"><CloudOff size={15} aria-hidden="true" /> Sem conexão</span>;
  return <span className="sync-state"><Radio size={15} aria-hidden="true" /> {publicView ? 'Resultados ao vivo' : 'Ao vivo'}</span>;
}
