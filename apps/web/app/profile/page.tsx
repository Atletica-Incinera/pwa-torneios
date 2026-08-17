'use client';

import { Bell, LogOut, Mail, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, SectionTitle, StatusBadge } from '../components/AppShell';
import { ScopeSwitcher } from '../components/ScopeSwitcher';
import { activeScopeOf, canSwitchScope, scopeLabel, useFrontendSession } from '../lib/frontend-session';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { useUi } from '../components/UiProvider';

export default function ProfilePage() {
  const router = useRouter(); const [open, setOpen] = useState(false); const { session, logout: clearSession } = useFrontendSession(); const { state, setPreference } = useFrontendState(); const { toast } = useUi(); const notifications = state.preferences.notifications;
  async function updateNotifications(value: boolean) { let enabled = value; if (value) { if (!('Notification' in window)) { toast('Este navegador não oferece notificações push.', 'error'); enabled = false; } else { const permission = await Notification.requestPermission(); enabled = permission === 'granted'; if (!enabled) toast('Permissão de notificações não concedida.', 'error'); } } setPreference({ notifications: enabled }); }
  function logout() { clearSession(); router.push('/'); }
  const escopo = activeScopeOf(session);
  const roleLabel = escopo ? scopeLabel(escopo) : 'Sem acesso';
  // A edição do escopo quando o servidor a nomeia; senão, a que está na tela —
  // o adaptador local não tem id de edição nenhum, e um literal fixo aqui já
  // dizia "InterEng 2026" para quem estava em outra.
  const editionFallback = state.editions.find((item) => item.active)?.name;
  return <AppShell active="profile" eyebrow="CONTA" title="PERFIL" subtitle="Identidade, acessos e preferências"><section className="profile-hero"><span className="profile-avatar"><UserRound size={42} /></span><div><StatusBadge tone="orange">{roleLabel}</StatusBadge><h2>{session?.name ?? 'Usuário'}</h2><p><Mail size={14} /> {session?.email}</p></div></section><section className="section-block"><SectionTitle eyebrow="PERMISSÕES" title="MEUS ACESSOS" />{canSwitchScope(session) ? <p className="form-hint">Você tem mais de um acesso. O escolhido vale só neste aparelho.</p> : null}<ScopeSwitcher editionFallback={editionFallback} /></section><section className="section-block"><SectionTitle eyebrow="PREFERÊNCIAS" title="NOTIFICAÇÕES" /><div className="module-list"><button type="button" onClick={() => setOpen(!open)} aria-expanded={open}><span><Bell size={21} /></span><div><strong>Alertas do app</strong><small>Começo e fim das partidas</small></div><b>›</b></button></div>{open ? <div className="preference-panel"><label><input type="checkbox" checked={notifications} onChange={(event) => updateNotifications(event.target.checked)} /> Avisar quando uma partida começar ou terminar</label><p>Chegam com o app em segundo plano, para a modalidade escolhida em Jogos. Aviso enviado pelo servidor depende da API.</p></div> : null}</section><button type="button" className="wide-action button-reset logout-action" onClick={logout}><LogOut size={18} /> SAIR DA CONTA <span>›</span></button></AppShell>;
}
