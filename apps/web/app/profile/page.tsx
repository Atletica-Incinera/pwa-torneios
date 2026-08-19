'use client';

import { Bell, LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, SectionTitle, StatusBadge } from '../components/AppShell';
import { passwordChangeAvailable, useFrontendSession } from '../lib/frontend-session';
import { useFrontendState } from '../lib/repositories/browser-repository';
import { PasswordChangeForm } from '../components/PasswordChangeForm';
import { useUi } from '../components/UiProvider';

export default function ProfilePage() {
  const router = useRouter(); const [open, setOpen] = useState(false); const [passwordChanged, setPasswordChanged] = useState(false); const { session, logout: clearSession } = useFrontendSession(); const { state, setPreference } = useFrontendState(); const { toast } = useUi(); const notifications = state.preferences.notifications;
  async function updateNotifications(value: boolean) { let enabled = value; if (value) { if (!('Notification' in window)) { toast('Este navegador não oferece notificações push.', 'error'); enabled = false; } else { const permission = await Notification.requestPermission(); enabled = permission === 'granted'; if (!enabled) toast('Permissão de notificações não concedida.', 'error'); } } setPreference({ notifications: enabled }); }
  function logout() { clearSession(); router.push('/'); }
  const roleLabel = session?.role === 'DISCIPLINE_MANAGER' ? `Gestor de ${session.scope}` : session?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin da edição';
  return <AppShell active="profile" eyebrow="CONTA" title="PERFIL" subtitle="Identidade, acessos e preferências"><section className="profile-hero"><span className="profile-avatar"><UserRound size={42} /></span><div><StatusBadge tone="orange">{roleLabel}</StatusBadge><h2>{session?.name ?? 'Usuário'}</h2><p><Mail size={14} /> {session?.email}</p></div></section><section className="section-block"><SectionTitle eyebrow="PERMISSÕES" title="MEUS ACESSOS" /><div className="detail-card"><div><ShieldCheck size={22} /><span><small>InterEng 2026</small><strong>{roleLabel}</strong></span></div></div></section><section className="section-block"><SectionTitle eyebrow="PREFERÊNCIAS" title="NOTIFICAÇÕES" /><div className="module-list"><button type="button" onClick={() => setOpen(!open)} aria-expanded={open}><span><Bell size={21} /></span><div><strong>Alertas do app</strong><small>Jogos, convites e operação</small></div><b>›</b></button></div>{open ? <div className="preference-panel"><label><input type="checkbox" checked={notifications} onChange={(event) => updateNotifications(event.target.checked)} /> Receber alertas de jogos e convites</label><p>O front-end está pronto; a entrega push será ativada quando o serviço estiver conectado.</p></div> : null}</section>{passwordChangeAvailable() ? <section className="section-block"><SectionTitle eyebrow="SEGURANÇA" title="SENHA" />{passwordChanged ? <div className="info-banner"><p>Senha trocada. As outras sessões desta conta foram encerradas.</p></div> : null}<PasswordChangeForm onDone={() => setPasswordChanged(true)} /></section> : null}<button type="button" className="wide-action button-reset logout-action" onClick={logout}><LogOut size={18} /> SAIR DA CONTA <span>›</span></button></AppShell>;
}
