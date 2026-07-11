import { ArrowRight, Eye, LockKeyhole, Mail, Trophy } from 'lucide-react';

export default function LoginPage() {
  return (
    <main className="login-shell">
      <div className="ambient ambient-blue" />
      <div className="ambient ambient-pink" />

      <section className="brand-panel" aria-label="Apresentação do produto">
        <div className="brand-mark">
          <Trophy size={42} strokeWidth={2.4} />
        </div>
        <p className="eyebrow">GESTÃO DE TORNEIOS</p>
        <h1>
          PWA
          <br />
          TORNEIOS
        </h1>
        <p className="brand-copy">
          Organize equipes, partidas e placares ao vivo em uma experiência esportiva de alto impacto.
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

          <form className="auth-form">
            <label>
              <span>E-MAIL</span>
              <div className="field cut-field">
                <Mail size={19} />
                <input type="email" placeholder="seu@email.com" aria-label="E-mail" />
              </div>
            </label>

            <label>
              <span>SENHA</span>
              <div className="field cut-field">
                <LockKeyhole size={19} />
                <input type="password" placeholder="••••••••" aria-label="Senha" />
                <button type="button" className="icon-button" aria-label="Mostrar senha">
                  <Eye size={19} />
                </button>
              </div>
            </label>

            <div className="form-meta">
              <label className="remember">
                <input type="checkbox" />
                <span>Manter acesso</span>
              </label>
              <a href="#">Esqueci a senha</a>
            </div>

            <button type="submit" className="primary-action cut-button">
              <span>ENTRAR</span>
              <ArrowRight size={22} />
            </button>
          </form>

          <div className="access-note">
            <span className="live-dot" />
            <p>Acesso exclusivo para Super Admin e Staff.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
