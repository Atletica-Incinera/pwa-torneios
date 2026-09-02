'use client';

import { FormEvent, useMemo, useState } from 'react';
import { KeyRound, Mail, ShieldCheck, UserPlus, UserX } from 'lucide-react';
import { SectionTitle } from './AppShell';
import { useUi } from './UiProvider';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { canManageEdition, useFrontendSession } from '../lib/frontend-session';

/**
 * Acesso do responsável da atlética, criado a partir da própria equipe.
 *
 * Fica aqui, e não na tela de Staff, porque o vínculo é com esta equipe: quem
 * está olhando a Alcateia não precisa escolher "Alcateia" num seletor para
 * dizer de quem é o acesso. A tela de Staff continua listando todo mundo.
 *
 * O papel alcança uma coisa só — cadastrar atletas desta equipe e dizer em que
 * modalidades eles jogam. Isso está escrito na tela porque quem concede
 * precisa saber o que está concedendo, e porque é a pergunta que a atlética
 * vai fazer de volta.
 */
export function TeamAccessManager({ teamId, teamName }: { teamId: string; teamName: string }) {
  const { state, dispatch } = useFrontendState();
  const { session } = useFrontendSession();
  const { confirm, toast } = useUi();
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  const responsaveis = useMemo(
    () =>
      Object.entries(state.staff)
        .filter(([, membro]) => membro.role === 'Responsável da atlética' && membro.scope === teamName)
        .map(([chave, membro]) => ({ chave, membro })),
    [state.staff, teamName],
  );

  if (!canManageEdition(session)) return null;

  async function criar(evento: FormEvent) {
    evento.preventDefault();
    const emailLimpo = email.trim().toLowerCase();
    const nomeLimpo = nome.trim();
    if (!nomeLimpo || !emailLimpo || !senha) {
      setErro('Preencha nome, e-mail e senha inicial.');
      return;
    }
    if (senha.length < 8) {
      setErro('A senha inicial precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (state.staff[emailLimpo]) {
      setErro('Já existe um acesso com este e-mail. Procure-o em Mais → Staff e permissões.');
      return;
    }
    setEnviando(true);
    setErro('');
    try {
      await dispatch({
        type: 'staff/upsert',
        payload: {
          email: emailLimpo,
          member: {
            name: nomeLimpo,
            email: emailLimpo,
            role: 'Responsável da atlética',
            scope: teamName,
            initials: nomeLimpo.slice(0, 2).toLocaleUpperCase('pt-BR'),
            initialPassword: senha,
          },
        },
        audit: { action: 'Responsável da atlética convidado', entity: nomeLimpo, after: teamName },
      });
      setEmail('');
      setNome('');
      setSenha('');
      toast(`${nomeLimpo} já pode entrar e cadastrar os atletas do ${teamName}.`, 'success');
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível criar o acesso.');
    } finally {
      setEnviando(false);
    }
  }

  async function revogar(chave: string, nomeDoMembro: string) {
    const membro = state.staff[chave];
    if (!membro) return;
    if (
      !(await confirm({
        title: `Revogar o acesso de ${nomeDoMembro}?`,
        message: `${nomeDoMembro} perde o acesso imediatamente. Os atletas já cadastrados continuam no elenco do ${teamName}.`,
        confirmLabel: 'Revogar',
        danger: true,
      }))
    ) {
      return;
    }
    void dispatch({
      type: 'staff/upsert',
      payload: { email: membro.email, member: { ...membro, revoked: true } },
      audit: { action: 'Acesso revogado', entity: nomeDoMembro, after: teamName },
    });
  }

  return (
    <section className="section-block acesso-atletica">
      <SectionTitle eyebrow="ACESSO" title="RESPONSÁVEL DA ATLÉTICA" />
      <div className="info-banner">
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          Quem receber este acesso entra no app e cadastra os atletas do {teamName}, dizendo em que
          modalidades cada um joga. Não enxerga o elenco das outras equipes, não mexe na agenda e não
          opera jogo.
        </p>
      </div>

      {responsaveis.length ? (
        <ul className="acesso-lista">
          {responsaveis.map(({ chave, membro }) => (
            <li key={chave} className={membro.revoked ? 'is-revoked' : undefined}>
              <div>
                <strong>{membro.name}</strong>
                <small>
                  <Mail size={13} aria-hidden="true" /> {membro.email}
                </small>
              </div>
              {membro.revoked ? (
                <span className="acesso-revogado">Revogado</span>
              ) : (
                <button
                  type="button"
                  onClick={() => revogar(chave, membro.name)}
                  aria-label={`Revogar acesso de ${membro.name}`}
                  title="Revogar acesso"
                >
                  <UserX size={17} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <form className="entity-form acesso-form" onSubmit={criar}>
        <label>
          <span>Nome do responsável</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Quem vai cadastrar os atletas" />
        </label>
        <label>
          <span>E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="responsavel@exemplo.com" />
        </label>
        <label>
          <span>Senha inicial</span>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Mínimo de 8 caracteres"
            autoComplete="new-password"
          />
        </label>
        {/* A senha e provisoria de proposito: quem convida a conhece, entao ela
            nao pode sobreviver ao primeiro acesso. */}
        <p className="form-hint">
          <KeyRound size={14} aria-hidden="true" /> Mande a senha para a pessoa por um canal direto. O
          app vai exigir que ela troque no primeiro acesso.
        </p>
        {erro ? <p className="form-error" role="alert">{erro}</p> : null}
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={enviando}>
            <UserPlus size={16} aria-hidden="true" /> {enviando ? 'Criando…' : 'Criar acesso'}
          </button>
        </div>
      </form>
    </section>
  );
}
