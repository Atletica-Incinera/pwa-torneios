'use client';

import { FormEvent, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { changePassword } from '../lib/frontend-session';

/** Espelha o mínimo que a API aplica: recusar aqui evita ida e volta inútil. */
const minLength = 12;

export function PasswordChangeForm({ onDone, submitLabel = 'Trocar senha' }: { onDone?: () => void; submitLabel?: string }) {
  const [current, setCurrent] = useState(''); const [next, setNext] = useState(''); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState(''); const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting) return;
    if (next.length < minLength) { setError(`A nova senha precisa de ao menos ${minLength} caracteres.`); return; }
    if (next !== confirmation) { setError('A confirmação não corresponde à nova senha.'); return; }
    if (next === current) { setError('A nova senha deve ser diferente da atual.'); return; }
    setSubmitting(true);
    const result = await changePassword(current, next);
    if (result.error) { setError(result.error); setSubmitting(false); return; }
    // A sessão nova já foi gravada pelo adaptador; quem observa a sessão
    // (o guard, o perfil) reage sozinho ao evento de mudança.
    setCurrent(''); setNext(''); setConfirmation(''); setError(''); setSubmitting(false); onDone?.();
  }
  return <form className="entity-form" onSubmit={(event) => void submit(event)} noValidate>
    <label><span>Senha atual</span><input type="password" autoComplete="current-password" value={current} onChange={(event) => { setCurrent(event.target.value); setError(''); }} required /></label>
    <label><span>Nova senha</span><input type="password" autoComplete="new-password" value={next} onChange={(event) => { setNext(event.target.value); setError(''); }} minLength={minLength} required /></label>
    <label><span>Repita a nova senha</span><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(''); }} required /></label>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="form-actions"><button type="submit" className="primary-button" disabled={submitting}>{submitting ? 'Trocando…' : submitLabel}</button></div>
  </form>;
}

/**
 * A tela que substitui o app inteiro enquanto a senha inicial não for trocada.
 *
 * Não depende do estado da edição de propósito: com a conta marcada, a API
 * recusa o snapshot com 403, então uma tela que esperasse os dados mostraria
 * erro de carregamento em vez do formulário — e não haveria saída.
 */
export function PasswordChangeScreen({ email }: { email?: string }) {
  return <main className="app-screen global-state-screen">
    <KeyRound size={44} />
    <h1>TROQUE SUA SENHA</h1>
    <p>{email ? `${email}: ` : ''}esta conta ainda usa a senha inicial, que outra pessoa definiu. Escolha uma nova para liberar o sistema.</p>
    <PasswordChangeForm submitLabel="Trocar e entrar" />
  </main>;
}
