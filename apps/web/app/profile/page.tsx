'use client';

import { Bell, LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, SectionTitle, StatusBadge } from '../components/AppShell';

export default function ProfilePage() {
  const router = useRouter(); const [open, setOpen] = useState(false); const [notifications, setNotifications] = useState(true);
  useEffect(() => { const saved = window.localStorage.getItem('intereng:notifications'); if (saved !== null) setNotifications(saved === 'true'); }, []);
  function updateNotifications(value: boolean) { setNotifications(value); window.localStorage.setItem('intereng:notifications', String(value)); }
  function logout() { window.localStorage.removeItem('intereng:frontend-session'); window.sessionStorage.removeItem('intereng:frontend-session'); router.push('/'); }
  return <AppShell active="profile" eyebrow="CONTA" title="PERFIL" subtitle="Identidade, acessos e preferências"><section className="profile-hero"><span className="profile-avatar"><UserRound size={42} /></span><div><StatusBadge tone="orange">Admin da edição</StatusBadge><h2>Ana Coordenadora</h2><p><Mail size={14} /> ana@ufpe.br</p></div></section><section className="section-block"><SectionTitle eyebrow="PERMISSÕES" title="MEUS ACESSOS" /><div className="detail-card"><div><ShieldCheck size={22} /><span><small>InterEng 2026</small><strong>Admin da edição</strong></span></div><div><ShieldCheck size={22} /><span><small>Jogos de Informática 2025</small><strong>Gestora de Futsal</strong></span></div></div></section><section className="section-block"><SectionTitle eyebrow="PREFERÊNCIAS" title="NOTIFICAÇÕES" /><div className="module-list"><button type="button" onClick={() => setOpen(!open)} aria-expanded={open}><span><Bell size={21} /></span><div><strong>Alertas do app</strong><small>Jogos, convites e operação</small></div><b>›</b></button></div>{open ? <div className="preference-panel"><label><input type="checkbox" checked={notifications} onChange={(event) => updateNotifications(event.target.checked)} /> Receber alertas de jogos e convites</label></div> : null}</section><button type="button" className="wide-action button-reset logout-action" onClick={logout}><LogOut size={18} /> SAIR DA CONTA <span>›</span></button></AppShell>;
}
