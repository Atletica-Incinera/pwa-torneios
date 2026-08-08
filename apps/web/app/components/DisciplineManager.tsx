'use client';

import { Clock3, Settings2, Trophy, Users } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useFrontendState } from '../lib/frontend-state';

export function DisciplineManager({ name, mode, initialConfig, tournaments }: { name: string; mode: string; initialConfig: string; tournaments: number }) {
  const { state, commit } = useFrontendState();
  const stored = state.disciplines[name] ?? {};
  const enabled = stored.enabled !== false;
  const config = stored.config ?? initialConfig;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(config);

  function save(event: FormEvent) {
    event.preventDefault();
    commit((current) => ({ ...current, disciplines: { ...current.disciplines, [name]: { ...current.disciplines[name], config: value, enabled: true } } }), { action: 'Configuração de modalidade alterada', entity: name, before: config, after: value });
    setEditing(false);
  }

  function toggleEnabled() {
    const next = !enabled;
    commit((current) => ({ ...current, disciplines: { ...current.disciplines, [name]: { ...current.disciplines[name], config, enabled: next } } }), { action: next ? 'Modalidade restaurada' : 'Modalidade removida da edição', entity: name, before: enabled ? 'Habilitada' : 'Removida', after: next ? 'Habilitada' : 'Removida' });
  }

  return <><div className="config-grid"><div><Clock3 size={22} /><span><small>Regra principal</small><strong>{config}</strong></span></div><div><Users size={22} /><span><small>Tipo</small><strong>{mode}</strong></span></div><div><Trophy size={22} /><span><small>Torneios</small><strong>{tournaments} cadastrados</strong></span></div><div><Settings2 size={22} /><span><small>Situação</small><strong>{enabled ? 'Habilitada' : 'Removida da edição'}</strong></span></div></div>{editing ? <form className="entity-form inline-config-form" onSubmit={save}><label><span>Regra principal</span><input value={value} onChange={(event) => setValue(event.target.value)} required /></label><div className="form-actions"><button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancelar</button><button type="submit" className="primary-button">Salvar alteração</button></div></form> : <div className="form-actions"><button type="button" className="secondary-button" onClick={toggleEnabled}>{enabled ? 'Remover da edição' : 'Restaurar modalidade'}</button>{enabled ? <button type="button" className="primary-button" onClick={() => { setValue(config); setEditing(true); }}>Editar configuração</button> : null}</div>}</>;
}
