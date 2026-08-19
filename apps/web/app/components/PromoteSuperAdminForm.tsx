'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { AppShell } from './AppShell';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { useUnsavedChanges } from '../lib/use-unsaved-changes';

/**
 * Concede super admin — irrestrito, sem escopo de edição nem modalidade.
 *
 * Rota separada de /staff/new de propósito: staff/upsert lida com papel e
 * escopo (Admin da edição / Gestor de modalidade), campos que super admin não
 * tem — é uma flag global da conta, não uma atribuição de edição.
 */
export function PromoteSuperAdminForm() {
  const router = useRouter();
  const { dispatch } = useFrontendState();
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  useUnsavedChanges(Boolean(name || email) && !submitting);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const key = email.trim().toLowerCase();
    if (!name.trim() || !/^\S+@\S+\.\S+$/.test(key)) { setError('Informe nome e um e-mail válido.'); return; }
    setSubmitting(true);
    const saved = await dispatch({
      type: 'staff/promoteSuperAdmin',
      payload: { email: key, name: name.trim() },
      audit: { action: 'Super administrador concedido', entity: name.trim() },
    });
    if (saved.ok) router.push('/staff'); else { setError(saved.error ?? 'Não foi possível conceder o acesso.'); setSubmitting(false); }
  }

  return <AppShell active="profile" eyebrow="ACESSO GLOBAL" title="NOVO SUPER ADMIN" subtitle="Concede acesso irrestrito, sem escopo de edição">
    <div className="info-banner"><ShieldAlert size={20} /><p>Super admin enxerga e administra qualquer competição, sem restrição de modalidade. Se o e-mail já tem conta, ela é promovida — o nome cadastrado não muda.</p></div>
    <form className="entity-form" onSubmit={(event) => void submit(event)} noValidate>
      <label><span>Nome</span><input value={name} onChange={(event) => { setName(event.target.value); setError(''); }} placeholder="Nome de quem vai administrar" autoFocus required /></label>
      <label><span>E-mail</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(''); }} placeholder="pessoa@dominio.com" required /></label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="form-actions"><button type="button" className="secondary-button" onClick={() => router.push('/staff')}>Cancelar</button><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Concedendo…' : 'Conceder super admin'}</button></div>
    </form>
  </AppShell>;
}
