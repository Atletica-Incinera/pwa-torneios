'use client';

import Link from 'next/link';
import { ArrowRight, Eye, LockKeyhole, Mail, Trophy } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [message, setMessage] = useState('');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.includes('@') || password.length < 4) {
      setMessage('Informe um e-mail válido e uma senha com pelo menos 4 caracteres.');
      return;
    }
    const storage = remember ? window.localStorage : window.sessionStorage;
    storage.setItem('intereng:frontend-session', JSON.stringify({ email, role: 'EDITION_ADMIN' }));
    router.push('/dashboard');
  }

  return (
    <main className="login-shell">
      <div className="ambient ambient-blue" />
      <div className="ambient ambient-pink" />

      <section className="brand-panel" aria-label="Apresentação do produto">
        <div className="brand-mark">
          <Trophy size={42} strokeWidth={2.4} />
        </div>
        <p className="eyebrow">JOGOS DE ENGENHARIA 2026</p>
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

          <form className="auth-form" onSubmit={submit} noValidate>
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
              <button type="button" className="text-button" onClick={() => setMessage('Fluxo de recuperação solicitado. No protótipo, use qualquer e-mail válido e uma senha com 4 caracteres.')}>Esqueci a senha</button>
            </div>

            {message ? <p className="auth-feedback" role="status">{message}</p> : null}

            <button type="submit" className="primary-action cut-button">
              <span>ENTRAR</span>
              <ArrowRight size={22} />
            </button>
          </form>

          <div className="access-note">
            <span className="live-dot" />
            <p>Acesso exclusivo para Super Admin e Staff.</p>
            <Link href="/public">Ver área pública</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
