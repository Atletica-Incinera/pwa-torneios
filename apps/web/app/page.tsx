'use client';

import Link from 'next/link';
import { ArrowRight, Eye, LockKeyhole, Mail, Trophy } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from './lib/frontend-session';
import { resolveDataSource } from './lib/repositories/state-adapter';
import { useUi } from './components/UiProvider';

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useUi();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState('');
  const [recovering, setRecovering] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    const access = new URL(window.location.href).searchParams.get('access');
    if (access === 'revoked') setMessage('Seu acesso foi revogado pelo administrador da edição.');
    if (access === 'expired') setMessage('Sua sessão expirou. Entre novamente para continuar.');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!email.includes('@') || !password) {
      setMessage('Informe seu e-mail e sua senha.');
      return;
    }
    setSubmitting(true);
    const result = await signIn(email, password, remember);
    if (!result.session) { setMessage(result.error ?? 'Não foi possível entrar.'); setSubmitting(false); return; }
    const redirect = new URL(window.location.href).searchParams.get('redirect');
    toast(`Bem-vindo, ${result.session.name}.`);
    router.push(redirect?.startsWith('/') ? redirect : '/dashboard');
  }

  function recover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!recoveryEmail.includes('@')) { setMessage('Informe um e-mail válido para recuperar o acesso.'); return; }
    toast('Solicitação registrada. O envio será conectado ao serviço de e-mail da API.', 'info');
    setRecovering(false); setRecoveryEmail(''); setMessage('');
  }

  return (
    <main id="app-main" className="login-shell">
      <div className="ambient ambient-blue" />
      <div className="ambient ambient-pink" />

      <section className="brand-panel" aria-label="Apresentação do produto">
        <div className="brand-mark">
          <Trophy size={42} strokeWidth={2.4} />
        </div>
        <p className="eyebrow">INTERENG · EDIÇÃO 2026</p>
        <h1>
          INTERENG
          <br />
          PERNAMBUCO
        </h1>
        <p className="brand-copy">
          A engenharia pernambucana reunida em competição, cultura e esporte.
        </p>
        <div className="slash slash-one" />
        <div className="slash slash-two" />
      </section>

      <section className="auth-panel">
        <div className="auth-card cut-card">
          <div className="auth-heading">
            <span className="number-tag">01</span>
            <div>
              <p className="eyebrow orange">ACESSO ADMINISTRATIVO</p>
              <h2>ENTRE NO JOGO</h2>
            </div>
          </div>

          <form className="auth-form" onSubmit={(event) => void submit(event)} noValidate>
            <label>
              <span>E-MAIL</span>
              <div className="field cut-field">
                <Mail size={19} />
                <input value={email} onChange={(event) => { setEmail(event.target.value); setMessage(''); }} type="email" placeholder="seu@email.com" aria-label="E-mail" required />
              </div>
            </label>

            <label>
              <span>SENHA</span>
              <div className="field cut-field">
                <LockKeyhole size={19} />
                <input value={password} onChange={(event) => { setPassword(event.target.value); setMessage(''); }} type={showPassword ? 'text' : 'password'} placeholder="••••••••" aria-label="Senha" required />
                <button type="button" className="icon-button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  <Eye size={19} />
                </button>
              </div>
            </label>

            <div className="form-meta">
              <label className="remember">
                <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span>Manter acesso</span>
              </label>
              <button type="button" className="text-button" onClick={() => { setRecovering(true); setMessage(''); }}>Esqueci a senha</button>
            </div>

            {message ? <p className="auth-feedback" role="status">{message}</p> : null}

            <button type="submit" className="primary-action cut-button" disabled={submitting}>
              <span>{submitting ? 'ENTRANDO…' : 'ENTRAR'}</span>
              <ArrowRight size={22} />
            </button>
          </form>

          <div className="access-note">
            <span className="live-dot" />
            <p>Acesso exclusivo para Super Admin e Staff.</p>
            <Link href="/public">Ver área pública</Link>
          </div>
          {resolveDataSource() === 'local' ? <details className="demo-access"><summary>Acessos de demonstração</summary><p>Admin: ana@ufpe.br · intereng2026</p><p>Gestor: bruno@ufpe.br · futsal2026</p></details> : null}
        </div>
      </section>
      {recovering ? <div className="app-dialog-backdrop"><form className="app-dialog" role="dialog" aria-modal="true" aria-labelledby="recover-title" onSubmit={recover}><Mail size={30} /><h2 id="recover-title">RECUPERAR ACESSO</h2><p>Informe o e-mail cadastrado no staff.</p><label><span>E-mail</span><input type="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} autoFocus /></label><div><button type="button" className="secondary-button" onClick={() => setRecovering(false)}>Cancelar</button><button type="submit" className="primary-button">Solicitar recuperação</button></div></form></div> : null}
    </main>
  );
}
